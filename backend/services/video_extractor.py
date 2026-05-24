"""
抖音视频解析：短链 → 元数据 → 下载/字幕/描述 → 转录文本

网络策略（按顺序尝试，"直连优先 + API 兜底"）：

  ┌─ aweme_id 解析 ──────────────────────────────────┐
  │  0. URL 已含数字 ID → regex 直接提取（不走网络）   │
  │  1. 直连 v.douyin.com 短链 → 跟随重定向取 ID       │  ← PRIMARY
  │  2. 镜像 API api.douyin.wtf/get_aweme_id          │  ← FALLBACK
  │  3. 显式 DOUYIN_PROXY 代理重试（仅当配置时）       │
  └──────────────────────────────────────────────────┘
  ┌─ 元数据获取 ─────────────────────────────────────┐
  │  1. 直连 iesdouyin.com iteminfo                   │  ← PRIMARY
  │  2. 直连 iesdouyin.com 分享页 HTML                │  ← PRIMARY
  │  3. 备用聚合 API api.xingzhige.com                │  ← FALLBACK
  │  4. 显式 DOUYIN_PROXY 代理重试（仅当配置时）       │
  └──────────────────────────────────────────────────┘

进程内短路（避免重复浪费）：首次直连超时即设 `_direct_unavailable=True`，
后续调用直接跳过直连进入兜底。重启服务（或调 /api/video/ping）可重置。
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import uuid
import tempfile
import httpx
from models.schemas import VideoContent
from services.asr import transcribe

MOBILE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    ),
    "Referer": "https://www.douyin.com/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

API_HEADERS = {
    **MOBILE_HEADERS,
    "Accept": "application/json, text/plain, */*",
}

ROUTER_DATA_RE = re.compile(
    r"window\._ROUTER_DATA\s*=\s*(\{.*?\})\s*</script>",
    re.S,
)

AWEME_ID_PATTERNS = [
    re.compile(r"/video/(\d+)"),
    re.compile(r"aweme_id=(\d+)"),
    re.compile(r"item_ids=(\d+)"),
    re.compile(r"modal_id=(\d+)"),
    re.compile(r"/share/video/(\d+)"),
]

# 短链只取字母数字段，避免把分享文案粘进 URL
SHORT_LINK_RE = re.compile(r"https?://v\.douyin\.com/([A-Za-z0-9_-]+)/?")
FULL_VIDEO_RE = re.compile(r"https?://www\.douyin\.com/video/(\d+)")
NOTE_RE = re.compile(r"https?://www\.douyin\.com/note/(\d+)")

MIRROR_AWEME_ID_API = os.environ.get(
    "DOUYIN_MIRROR_API",
    "https://api.douyin.wtf/api/douyin/web/get_aweme_id",
)

# 直连抖音失败时的元数据备用源（已验证可解析用户提供的真实链接）
FALLBACK_PARSE_API = os.environ.get(
    "DOUYIN_FALLBACK_API",
    "https://api.xingzhige.com/API/douyin/",
)

# 网络模式（中国大陆 + VPN 开发场景）：
#   auto          — 默认：直连优先，失败走备用 API（VPN 开着只能拿到描述文案）
#   direct        — 仅直连抖音，不走备用 API（关 VPN 或 Clash 抖音分流 DIRECT 时用）
#   fallback_only — 仅备用 API，等同 VPN 开着时的元数据模式
def _network_mode() -> str:
    return os.environ.get("DOUYIN_NETWORK_MODE", "auto").strip().lower()

def _always_probe_direct() -> bool:
    """每次 extract 都重新探测直连（关 VPN 后无需手动 ping）。"""
    return os.environ.get("DOUYIN_ALWAYS_PROBE_DIRECT", "").lower() in ("1", "true", "yes")

# ── 直连超时（短）─ VPN 开着走国外出口时直连抖音失败，快速失败立刻切到兜底 API ─
_DIRECT_TIMEOUT_SECONDS = 6

# ── 进程内短路标记 ──────────────────────────────────────────────
# False = 尚未试过直连，None = 直连可用，True = 直连不可用（之后跳过）
_direct_unavailable: bool = False

# 兼容老逻辑保留的成功代理缓存
_working_proxy: str | None | bool = False  # False=未探测, None=直连, str=代理 URL


def reset_network_cache() -> None:
    """重置进程内直连缓存。关 VPN 后调用，或 extract 前自动探测时调用。"""
    global _direct_unavailable, _working_proxy
    _direct_unavailable = False
    _working_proxy = False


def _use_fallback_api() -> bool:
    return _network_mode() in ("auto", "fallback_only")


def _use_direct_douyin() -> bool:
    return _network_mode() in ("auto", "direct")


def _client_kwargs(proxy: str | None = None) -> dict:
    explicit = proxy if proxy is not None else os.environ.get("DOUYIN_PROXY") or os.environ.get("DOUYIN_HTTP_PROXY")
    kwargs: dict = {
        "headers": MOBILE_HEADERS,
        "timeout": 30,
        "trust_env": False,
    }
    if explicit:
        kwargs["proxy"] = explicit
    return kwargs


def _make_client(proxy: str | None = None, **overrides) -> httpx.AsyncClient:
    kwargs = _client_kwargs(proxy)
    kwargs.update(overrides)
    return httpx.AsyncClient(**kwargs)


def _extract_url_from_share_text(text: str) -> str:
    """从分享文本中提取干净的抖音 URL"""
    m = SHORT_LINK_RE.search(text)
    if m:
        return f"https://v.douyin.com/{m.group(1)}/"
    m = FULL_VIDEO_RE.search(text)
    if m:
        return f"https://www.douyin.com/video/{m.group(1)}"
    m = NOTE_RE.search(text)
    if m:
        return f"https://www.douyin.com/note/{m.group(1)}"
  # 兜底：旧逻辑但截断空白
    for pattern in (
        r"https?://v\.douyin\.com/[A-Za-z0-9_-]+/?",
        r"https?://www\.douyin\.com/video/\d+",
        r"https?://www\.iesdouyin\.com/share/video/\d+",
    ):
        match = re.search(pattern, text)
        if match:
            return match.group(0).rstrip(".,;)!?\"'")
    return text.strip()


def _aweme_id_from_string(text: str) -> str | None:
    for pattern in AWEME_ID_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(1)
    if text.isdigit() and len(text) >= 15:
        return text
    return None


def normalize_play_url(url: str) -> str:
    url = url.replace("playwm", "play")
    url = url.replace("aweme.snssdk.com", "api.amemv.com")
    return url


def _video_url_from_meta(meta: dict) -> str | None:
    video_info = meta.get("video") or {}
    url_list = (
        video_info.get("play_addr", {}).get("url_list", [])
        or video_info.get("download_addr", {}).get("url_list", [])
    )
    if not url_list:
        vid = video_info.get("vid")
        if vid:
            return normalize_play_url(
                f"https://aweme.snssdk.com/aweme/v1/play/?video_id={vid}&ratio=720p&line=0"
            )
        return None
    return normalize_play_url(url_list[0])


def _subtitle_from_meta(meta: dict) -> str | None:
    video_info = meta.get("video") or {}
    for key in ("subtitle", "caption", "video_subtitle"):
        val = video_info.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    desc = (meta.get("desc") or "").strip()
    if len(desc) >= 8:
        return desc
    return None


def _subtitle_urls_from_meta(meta: dict) -> list[str]:
    """从官方 iteminfo 的 subtitle_infos 提取字幕文件 URL（仅直连 meta 常有）。"""
    video_info = meta.get("video") or {}
    urls: list[str] = []
    for sub in video_info.get("subtitle_infos") or []:
        if not isinstance(sub, dict):
            continue
        url_field = sub.get("url")
        if isinstance(url_field, str) and url_field.startswith("http"):
            urls.append(url_field)
        elif isinstance(url_field, dict):
            for u in url_field.get("url_list") or []:
                if isinstance(u, str) and u.startswith("http"):
                    urls.append(u)
    return urls


def _parse_subtitle_payload(raw: str) -> str | None:
    """解析 WebVTT / SRT / 纯 JSON 字幕为纯文本。"""
    text = raw.strip()
    if not text:
        return None

    if text.startswith("{"):
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                utterances = data.get("utterances") or data.get("sentences") or []
                parts = []
                for u in utterances:
                    if isinstance(u, dict):
                        t = u.get("text") or u.get("content") or ""
                        if t:
                            parts.append(str(t).strip())
                if parts:
                    return "\n".join(parts)
        except json.JSONDecodeError:
            pass

    lines: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("WEBVTT") or s.startswith("NOTE"):
            continue
        if re.match(r"^\d+$", s):
            continue
        if re.match(r"^\d{2}:\d{2}", s) or "-->" in s:
            continue
        if s.startswith("{") or s.startswith("["):
            continue
        lines.append(s)
    merged = "\n".join(lines).strip()
    return merged if merged else None


async def _download_subtitle_text(url: str, proxy: str | None) -> str | None:
    try:
        async with _make_client(proxy=proxy, follow_redirects=True, timeout=30) as client:
            resp = await client.get(url, headers=API_HEADERS)
            if resp.status_code != 200:
                return None
            return _parse_subtitle_payload(resp.text)
    except httpx.HTTPError as e:
        print(f"[video_extractor] 字幕下载失败: {e}")
        return None


async def _fetch_subtitle_from_meta(meta: dict, proxy: str | None) -> str | None:
    """优先下载官方字幕文件（比描述文案更接近口播）。"""
    for url in _subtitle_urls_from_meta(meta):
        text = await _download_subtitle_text(url, proxy)
        if text:
            print(f"[video_extractor] 官方字幕下载成功 ({len(text)} 字)")
            return text
    return None


def _meta_from_router_data(html: str) -> dict | None:
    match = ROUTER_DATA_RE.search(html)
    if not match:
        return None
    raw = match.group(1).strip().rstrip(";")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    loader = data.get("loaderData") or {}
    for value in loader.values():
        if not isinstance(value, dict):
            continue
        aweme = value.get("awemeDetail") or value.get("aweme")
        if aweme:
            return aweme
        item_list = (value.get("videoInfoRes") or {}).get("item_list") or []
        if item_list:
            return item_list[0]
    return None


async def _resolve_aweme_id_mirror(url: str) -> str | None:
    """通过 douyin.wtf 镜像 API 解析 aweme_id（不依赖直连抖音）"""
    try:
        async with _make_client(proxy=None) as client:
            resp = await client.get(MIRROR_AWEME_ID_API, params={"url": url}, headers=API_HEADERS)
            if resp.status_code != 200:
                print(f"[video_extractor] 镜像 get_aweme_id HTTP {resp.status_code}")
                return None
            data = resp.json()
            if data.get("code") != 200:
                print(f"[video_extractor] 镜像 get_aweme_id code={data.get('code')}")
                return None
            aweme_id = data.get("data")
            if isinstance(aweme_id, str) and aweme_id.isdigit():
                print(f"[video_extractor] 镜像解析 aweme_id={aweme_id}")
                return aweme_id
    except httpx.HTTPError as e:
        print(f"[video_extractor] 镜像 get_aweme_id 失败: {e}")
    return None


async def _resolve_aweme_id_direct(url: str, proxy: str | None) -> str | None:
    direct = _aweme_id_from_string(url)
    if direct:
        return direct

    async with _make_client(proxy=proxy, follow_redirects=True, timeout=_DIRECT_TIMEOUT_SECONDS) as client:
        try:
            resp = await client.get(url)
            found = _aweme_id_from_string(str(resp.url))
            if found:
                return found
            found = _aweme_id_from_string(resp.text)
            if found:
                return found
            meta = _meta_from_router_data(resp.text)
            if meta:
                aid = meta.get("aweme_id") or meta.get("awemeId")
                if aid:
                    return str(aid)
        except httpx.HTTPError as e:
            print(f"[video_extractor] 短链直连失败(proxy={proxy}): {e}")

    async with _make_client(proxy=proxy, follow_redirects=False, timeout=_DIRECT_TIMEOUT_SECONDS) as client:
        try:
            resp = await client.get(url)
            location = resp.headers.get("location", "")
            return _aweme_id_from_string(location)
        except httpx.HTTPError as e:
            print(f"[video_extractor] Location 直连失败(proxy={proxy}): {e}")
    return None


async def _resolve_aweme_id(url: str) -> str | None:
    """解析 aweme_id：直连优先（direct/auto），镜像 API 兜底（auto/fallback_only）。"""
    global _direct_unavailable, _working_proxy

    if _always_probe_direct():
        reset_network_cache()

    # 0) 快速通道：URL 已含 ID
    direct_id = _aweme_id_from_string(url)
    if direct_id:
        return direct_id

    mode = _network_mode()

    # 1) 直连 v.douyin.com（PRIMARY）
    if _use_direct_douyin() and not _direct_unavailable:
        aweme_id = await _resolve_aweme_id_direct(url, None)
        if aweme_id:
            _working_proxy = None
            return aweme_id
        _direct_unavailable = True
        print("[video_extractor] 直连不可用，后续请求将直接走兜底 API")

    # 2) 镜像 API（FALLBACK）— fallback_only 模式也走这里
    if _use_fallback_api():
        aweme_id = await _resolve_aweme_id_mirror(url)
        if aweme_id:
            return aweme_id

    # 3) 显式 DOUYIN_PROXY
    if _use_direct_douyin():
        explicit_proxy = os.environ.get("DOUYIN_PROXY")
        if explicit_proxy:
            aweme_id = await _resolve_aweme_id_direct(url, explicit_proxy)
            if aweme_id:
                _working_proxy = explicit_proxy
                return aweme_id

    if mode == "direct":
        print("[video_extractor] direct 模式：直连失败且无镜像兜底，请关 VPN 或配置 Clash 抖音 DIRECT")
    return None


async def _fetch_aweme_metadata_api(aweme_id: str, proxy: str | None) -> dict | None:
    endpoints = [
        f"https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids={aweme_id}",
        (
            "https://www.douyin.com/aweme/v1/web/aweme/detail/"
            f"?aweme_id={aweme_id}&aid=6383&version_name=23.5.0&device_platform=webapp"
        ),
    ]
    async with _make_client(proxy=proxy) as client:
        for api_url in endpoints:
            try:
                resp = await client.get(api_url, headers=API_HEADERS)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                items = data.get("item_list") or []
                if items:
                    return items[0]
                detail = data.get("aweme_detail")
                if detail:
                    return detail
            except (httpx.HTTPError, json.JSONDecodeError) as e:
                print(f"[video_extractor] metadata API 失败: {e}")
    return None


async def _fetch_aweme_metadata_share_page(aweme_id: str, proxy: str | None) -> dict | None:
    share_url = f"https://www.iesdouyin.com/share/video/{aweme_id}"
    async with _make_client(proxy=proxy) as client:
        try:
            resp = await client.get(share_url)
            if resp.status_code != 200:
                return None
            return _meta_from_router_data(resp.text)
        except httpx.HTTPError as e:
            print(f"[video_extractor] 分享页失败: {e}")
            return None


def _meta_from_fallback_api(payload: dict) -> dict | None:
    """将第三方聚合 API 响应转为 iesdouyin 兼容的 meta 结构"""
    if payload.get("code") != 0:
        return None
    data = payload.get("data") or {}
    stat = data.get("stat") or {}
    item = data.get("item") or {}
    author = data.get("author") or {}
    play_url = item.get("url") or item.get("ury")
    if not play_url and not item.get("title"):
        return None

    duration_sec = item.get("duration") or 0
    return {
        "_meta_source": "fallback",
        "aweme_id": stat.get("aweme_id") or data.get("jx", {}).get("item_id"),
        "desc": item.get("title") or "",
        "author": {
            "nickname": author.get("name") or "未知账号",
            "follower_count": author.get("follower_count"),
            "with_shop_entry": False,
            "commerce_user_level": 0,
            "custom_verify": None,
        },
        "statistics": {
            "digg_count": stat.get("like"),
            "comment_count": stat.get("comment"),
            "share_count": stat.get("share"),
            "play_count": stat.get("play"),
        },
        "video": {
            "play_addr": {"url_list": [play_url]} if play_url else {},
            "duration": int(float(duration_sec) * 1000) if duration_sec else None,
        },
        "duration": int(float(duration_sec) * 1000) if duration_sec else None,
        "is_ads": False,
        "text_extra": [],
    }


async def _fetch_aweme_metadata_fallback(url: str) -> dict | None:
    """第三方聚合 API（不依赖直连 iesdouyin.com）"""
    try:
        async with _make_client(proxy=None) as client:
            resp = await client.get(FALLBACK_PARSE_API, params={"url": url}, headers=API_HEADERS)
            if resp.status_code != 200:
                print(f"[video_extractor] 备用 API HTTP {resp.status_code}")
                return None
            meta = _meta_from_fallback_api(resp.json())
            if meta:
                print("[video_extractor] 备用 API 元数据获取成功")
            return meta
    except (httpx.HTTPError, json.JSONDecodeError) as e:
        print(f"[video_extractor] 备用 API 失败: {e}")
        return None


async def _fetch_aweme_metadata(aweme_id: str, source_url: str | None = None) -> dict | None:
    """拉元数据：直连 iesdouyin 优先；direct 模式不走备用 API。"""
    global _direct_unavailable, _working_proxy

    if _always_probe_direct():
        reset_network_cache()

    mode = _network_mode()

    # 1) 直连 iesdouyin（PRIMARY）
    if _use_direct_douyin() and not _direct_unavailable:
        meta = await _fetch_aweme_metadata_api(aweme_id, None)
        if meta:
            meta["_meta_source"] = "direct"
            _working_proxy = None
            return meta
        meta = await _fetch_aweme_metadata_share_page(aweme_id, None)
        if meta:
            meta["_meta_source"] = "direct"
            _working_proxy = None
            return meta
        _direct_unavailable = True
        print("[video_extractor] 直连元数据失败，后续走兜底 API")

    # 2) 备用聚合 API（auto / fallback_only）
    if _use_fallback_api() and source_url:
        meta = await _fetch_aweme_metadata_fallback(source_url)
        if meta:
            return meta

    # 3) 显式 DOUYIN_PROXY
    if _use_direct_douyin():
        explicit_proxy = os.environ.get("DOUYIN_PROXY")
        if explicit_proxy:
            meta = await _fetch_aweme_metadata_api(aweme_id, explicit_proxy)
            if meta:
                meta["_meta_source"] = "direct"
                _working_proxy = explicit_proxy
                return meta
            meta = await _fetch_aweme_metadata_share_page(aweme_id, explicit_proxy)
            if meta:
                meta["_meta_source"] = "direct"
                _working_proxy = explicit_proxy
                return meta

    if mode == "direct":
        print("[video_extractor] direct 模式：无法从 iesdouyin 获取元数据，请关 VPN 后重试")
    return None


async def _download_file(url: str, proxy: str | None, suffix: str = ".mp4") -> str:
    """下载文件到临时路径。返回路径供 ASR 用。"""
    fd, path = tempfile.mkstemp(suffix=suffix)
    download_headers = {
        "User-Agent": MOBILE_HEADERS["User-Agent"],
        "Referer": "https://www.douyin.com/",
    }
    import time
    t0 = time.time()
    bytes_total = 0
    async with _make_client(proxy=proxy, follow_redirects=True, timeout=120) as client:
        async with client.stream("GET", url, headers=download_headers) as resp:
            resp.raise_for_status()
            with os.fdopen(fd, "wb") as f:
                async for chunk in resp.aiter_bytes(65536):
                    f.write(chunk)
                    bytes_total += len(chunk)
    elapsed = time.time() - t0
    print(f"[video_extractor] 下载完成 {bytes_total/1024:.0f}KB 用时 {elapsed:.1f}s")
    return path


async def _transcribe_video(play_url: str, proxy: str | None) -> tuple[str, str]:
    """下载视频 + Whisper 转录，返回 (文本, source='asr')。"""
    import time
    video_path = await _download_file(play_url, proxy, suffix=".mp4")
    try:
        t0 = time.time()
        text = await transcribe(video_path)
        print(f"[video_extractor] Whisper 用时 {time.time()-t0:.1f}s")
        return text, "asr"
    finally:
        try:
            os.remove(video_path)
        except OSError:
            pass


def _build_video_content(meta: dict, transcript: str, source: str) -> VideoContent:
    statistics = meta.get("statistics") or {}
    author_info = meta.get("author") or {}
    hashtags = [
        t["hashtag_name"]
        for t in (meta.get("text_extra") or [])
        if isinstance(t, dict) and t.get("hashtag_name")
    ] or None

    aweme_id = str(meta.get("aweme_id") or meta.get("awemeId") or uuid.uuid4())
    duration = meta.get("duration") or 0

    # 抖音 web API 反爬：play_count 恒为 0。0 是假数据，规范化为 None 不展示
    raw_play = statistics.get("play_count")
    play_count = raw_play if (isinstance(raw_play, int) and raw_play > 0) else None

    # 粉丝数：直连 meta 用 mplatform_followers_count；fallback API 用 follower_count
    follower_count = (
        author_info.get("mplatform_followers_count")
        or author_info.get("follower_count")
    )

    return VideoContent(
        video_id=aweme_id,
        transcript=transcript,
        title=(meta.get("desc") or "")[:200],
        author=author_info.get("nickname") or "未知账号",
        likes=statistics.get("digg_count"),
        comments=statistics.get("comment_count"),
        shares=statistics.get("share_count"),
        play_count=play_count,
        duration_seconds=duration // 1000 if duration > 1000 else duration,
        is_ad=bool(meta.get("is_ads")),
        with_shop_entry=bool(author_info.get("with_shop_entry")),
        commerce_level=author_info.get("commerce_user_level"),
        creator_verified=author_info.get("custom_verify") or None,
        follower_count=follower_count,
        hashtags=hashtags,
        source=source,  # type: ignore[arg-type]
    )


async def extract_video(raw_input: str) -> VideoContent | None:
    """端到端解析：分享文本 → 短链 → aweme_id → 元数据 → transcript → VideoContent。

    文案优先级（直连 meta 可用时）：
      1. 官方字幕文件 subtitle_infos
      2. Whisper ASR（需 OPENAI_API_KEY 且未设 SKIP_ASR）
      3. 视频描述 desc

    VPN 开着时通常只能走到备用 API → 仅第 3 项（描述文案）。
    关 VPN 或 Clash 抖音 DIRECT 后，可拿到 1 或 2。
    """
    try:
        if _always_probe_direct():
            reset_network_cache()

        url = _extract_url_from_share_text(raw_input)
        print(f"[video_extractor] 清洗 URL: {url} | mode={_network_mode()}")

        aweme_id = await _resolve_aweme_id(url)
        if not aweme_id:
            print("[video_extractor] 无法提取 aweme_id")
            return None

        meta = await _fetch_aweme_metadata(aweme_id, source_url=url)
        if not meta:
            print(f"[video_extractor] 元数据为空 aweme_id={aweme_id}")
            return None

        meta_source = meta.get("_meta_source", "unknown")
        print(f"[video_extractor] 元数据来源: {meta_source}")

        # 下载/字幕一律走直连（None），不走 VPN 代理
        media_proxy: str | None = None
        skip_asr = os.environ.get("SKIP_ASR", "").lower() in ("1", "true", "yes")
        if _network_mode() == "fallback_only":
            skip_asr = True

        transcript: str | None = None
        source = "subtitle"
        play_url = _video_url_from_meta(meta)

        # 1) 官方字幕（仅直连 meta 通常有 subtitle_infos）
        if meta_source == "direct":
            transcript = await _fetch_subtitle_from_meta(meta, media_proxy)
            if transcript:
                source = "subtitle"

        # 2) Whisper ASR
        if not transcript and play_url and not skip_asr:
            try:
                print(f"[video_extractor] 开始 ASR: aweme_id={aweme_id}")
                transcript, source = await _transcribe_video(play_url, media_proxy)
                preview = transcript[:50].replace("\n", " ")
                print(f"[video_extractor] ASR 成功 ({len(transcript)} 字): {preview}…")
            except Exception as e:
                print(f"[video_extractor] ASR 失败，降级: {e}")

        # 3) 描述文案
        if not transcript:
            transcript = _subtitle_from_meta(meta)
            source = "subtitle"
            if meta_source == "fallback":
                print(
                    "[video_extractor] 当前为备用 API 元数据，仅有描述文案。"
                    " 要口播/字幕请关 VPN 后设 DOUYIN_NETWORK_MODE=direct 再解析"
                )

        if skip_asr and not transcript:
            pass
        elif skip_asr and transcript and source == "subtitle":
            print("[video_extractor] SKIP_ASR=true，使用描述/字幕文案")

        if not transcript:
            print("[video_extractor] 无可用文本")
            return None

        return _build_video_content(meta, transcript, source)

    except httpx.HTTPError as e:
        print(f"[video_extractor] 网络错误: {e}")
        return None
    except Exception as e:
        print(f"[video_extractor] 解析失败: {e}")
        return None


async def check_douyin_connectivity() -> dict:
    """探测当前网络对抖音域名的可达性；并重置直连缓存。"""
    reset_network_cache()

    targets = ["https://www.iesdouyin.com/", "https://v.douyin.com/"]
    results = {}
    proxy = os.environ.get("DOUYIN_PROXY") or os.environ.get("DOUYIN_HTTP_PROXY")
    async with _make_client(proxy=None, follow_redirects=False, timeout=_DIRECT_TIMEOUT_SECONDS) as client:
        for url in targets:
            try:
                resp = await client.get(url)
                results[url] = {"ok": True, "status": resp.status_code}
            except Exception as e:
                results[url] = {"ok": False, "error": str(e)}

    direct_ok = all(r.get("ok") for r in results.values())
    mirror_ok = False
    try:
        async with _make_client() as client:
            r = await client.get(
                MIRROR_AWEME_ID_API,
                params={"url": "https://v.douyin.com/15ZzY6bMaqc/"},
                headers=API_HEADERS,
                timeout=15,
            )
            mirror_ok = r.status_code == 200 and r.json().get("code") == 200
    except Exception:
        pass

    recommendation = "unknown"
    if direct_ok:
        recommendation = (
            "直连可用：设 DOUYIN_NETWORK_MODE=direct，去掉 SKIP_ASR，可解析字幕/ASR"
        )
    elif mirror_ok:
        recommendation = (
            "仅备用 API 可用（典型 VPN 开全局）：只能拿描述文案。"
            " 要字幕请关 VPN 后 curl /api/video/ping，再设 DOUYIN_NETWORK_MODE=direct"
        )
    else:
        recommendation = "抖音直连与镜像均失败，请检查网络"

    return {
        "trust_env": False,
        "network_mode": _network_mode(),
        "douyin_proxy": proxy or None,
        "direct_douyin_ok": direct_ok,
        "mirror_api_ok": mirror_ok,
        "recommendation": recommendation,
        "targets": results,
    }
