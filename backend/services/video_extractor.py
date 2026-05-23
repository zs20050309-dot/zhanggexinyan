import json
import os
import re
import tempfile
from typing import Any

import httpx

from models.schemas import VideoContent

MOBILE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    ),
    "Referer": "https://www.douyin.com/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

AWEME_ID_PATTERNS = (
    r"/video/(\d+)",
    r"/note/(\d+)",
    r"[?&]modal_id=(\d+)",
    r"[?&]item_ids=(\d+)",
)


def _extract_url_from_share_text(text: str) -> str:
    patterns = [
        r"https?://v\.douyin\.com/\S+",
        r"https?://www\.douyin\.com/video/\d+",
        r"https?://www\.douyin\.com/note/\d+",
        r"https?://www\.iesdouyin\.com/\S+",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0).rstrip(".,;)")
    return text.strip()


def _extract_aweme_id_from_url(url: str) -> str | None:
    for pattern in AWEME_ID_PATTERNS:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def _parse_json_string_field(html: str, field: str) -> str | None:
    match = re.search(rf'"{field}"\s*:\s*"((?:\\.|[^"\\])*)"', html)
    if not match:
        return None
    try:
        return json.loads(f'"{match.group(1)}"')
    except json.JSONDecodeError:
        return match.group(1).encode("utf-8").decode("unicode_escape")


def _parse_json_int_field(html: str, field: str) -> int | None:
    match = re.search(rf'"{field}"\s*:\s*(\d+)', html)
    return int(match.group(1)) if match else None


def _parse_json_bool_field(html: str, field: str) -> bool | None:
    match = re.search(rf'"{field}"\s*:\s*(true|false)', html)
    if not match:
        return None
    return match.group(1) == "true"


def _parse_hashtags(desc: str) -> list[str] | None:
    tags = re.findall(r"#([\u4e00-\u9fff\w]+)", desc)
    return tags or None


def _clean_transcript(desc: str) -> str:
    text = desc.strip()
    text = re.sub(r"#([\u4e00-\u9fff\w]+)", r"\1", text)
    return re.sub(r"\n{3,}", "\n\n", text)


def parse_share_page_html(html: str, aweme_id: str) -> dict[str, Any] | None:
    """从抖音分享页 SSR HTML 中提取内容（视频/图文均可用，通常 2-5 秒）。"""
    desc = _parse_json_string_field(html, "desc")
    if not desc:
        meta_match = re.search(
            r'<meta[^>]+(?:property|name)="(?:og:description|description)"[^>]+content="([^"]+)"',
            html,
        )
        if meta_match:
            desc = meta_match.group(1)

    author = _parse_json_string_field(html, "nickname")
    if not desc and not author:
        return None

    transcript = _clean_transcript(desc or "")
    if not transcript:
        return None

    custom_verify = _parse_json_string_field(html, "custom_verify")
    return {
        "video_id": aweme_id,
        "transcript": transcript,
        "title": (desc or transcript)[:120],
        "author": author or "未知账号",
        "likes": _parse_json_int_field(html, "digg_count"),
        "comments": _parse_json_int_field(html, "comment_count"),
        "shares": _parse_json_int_field(html, "share_count"),
        "play_count": _parse_json_int_field(html, "play_count"),
        "duration_seconds": _parse_json_int_field(html, "duration"),
        "is_ad": _parse_json_bool_field(html, "is_ads"),
        "with_shop_entry": _parse_json_bool_field(html, "with_shop_entry"),
        "commerce_level": _parse_json_int_field(html, "commerce_user_level"),
        "creator_verified": custom_verify or None,
        "follower_count": _parse_json_int_field(html, "follower_count"),
        "hashtags": _parse_hashtags(desc or ""),
        "aweme_type": _parse_json_int_field(html, "aweme_type"),
        "source": "subtitle",
    }


async def _fetch_share_page(url: str) -> tuple[str, str]:
    async with httpx.AsyncClient(
        follow_redirects=True, headers=MOBILE_HEADERS, timeout=20
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text, str(resp.url)


async def _fetch_aweme_metadata(aweme_id: str) -> dict | None:
    api_url = (
        f"https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids={aweme_id}"
    )
    async with httpx.AsyncClient(headers=MOBILE_HEADERS, timeout=15) as client:
        resp = await client.get(api_url)
        if resp.status_code != 200:
            return None
        data = resp.json()

    items = data.get("item_list", [])
    return items[0] if items else None


def _merge_api_metadata(parsed: dict[str, Any], meta: dict) -> dict[str, Any]:
    statistics = meta.get("statistics", {})
    author_info = meta.get("author", {})
    hashtags = [
        t["hashtag_name"]
        for t in meta.get("text_extra", [])
        if t.get("hashtag_name")
    ] or parsed.get("hashtags")

    desc = meta.get("desc") or parsed.get("transcript") or ""
    return {
        **parsed,
        "transcript": _clean_transcript(desc) or parsed["transcript"],
        "title": (meta.get("desc") or parsed.get("title") or "")[:120],
        "author": author_info.get("nickname") or parsed.get("author") or "未知账号",
        "likes": statistics.get("digg_count", parsed.get("likes")),
        "comments": statistics.get("comment_count", parsed.get("comments")),
        "shares": statistics.get("share_count", parsed.get("shares")),
        "play_count": statistics.get("play_count", parsed.get("play_count")),
        "duration_seconds": meta.get("duration", parsed.get("duration_seconds")),
        "is_ad": meta.get("is_ads") or parsed.get("is_ad") or False,
        "with_shop_entry": author_info.get("with_shop_entry", parsed.get("with_shop_entry")),
        "commerce_level": author_info.get("commerce_user_level", parsed.get("commerce_level")),
        "creator_verified": author_info.get("custom_verify") or parsed.get("creator_verified"),
        "follower_count": author_info.get("follower_count", parsed.get("follower_count")),
        "hashtags": hashtags,
        "aweme_type": meta.get("aweme_type", parsed.get("aweme_type")),
    }


def _video_play_urls(meta: dict) -> list[str]:
    video_info = meta.get("video", {}) or {}
    return (
        video_info.get("play_addr", {}).get("url_list", [])
        or video_info.get("download_addr", {}).get("url_list", [])
    )


async def _download_file(url: str, suffix: str = ".mp4") -> str:
    fd, path = tempfile.mkstemp(suffix=suffix)
    async with httpx.AsyncClient(follow_redirects=True, timeout=120) as client:
        async with client.stream(
            "GET",
            url,
            headers={
                "User-Agent": MOBILE_HEADERS["User-Agent"],
                "Referer": "https://www.douyin.com/",
            },
        ) as resp:
            resp.raise_for_status()
            with os.fdopen(fd, "wb") as f:
                async for chunk in resp.aiter_bytes(65536):
                    f.write(chunk)
    return path


async def _maybe_transcribe_video(parsed: dict[str, Any], meta: dict | None) -> str | None:
    """可选慢路径：下载视频 + Whisper。默认关闭，需 ENABLE_VIDEO_ASR=1。"""
    if os.environ.get("ENABLE_VIDEO_ASR", "0") != "1":
        return None
    if not meta:
        return None
    if len(parsed.get("transcript", "")) >= 120:
        return None

    url_list = _video_play_urls(meta)
    if not url_list:
        return None

    from services.asr import transcribe

    video_path = await _download_file(url_list[0], suffix=".mp4")
    try:
        return await transcribe(video_path)
    finally:
        try:
            os.remove(video_path)
        except OSError:
            pass


def _to_video_content(data: dict[str, Any]) -> VideoContent:
    return VideoContent(
        video_id=data["video_id"],
        transcript=data["transcript"],
        title=data.get("title") or data["transcript"][:120],
        author=data.get("author") or "未知账号",
        likes=data.get("likes"),
        comments=data.get("comments"),
        shares=data.get("shares"),
        play_count=data.get("play_count"),
        duration_seconds=data.get("duration_seconds"),
        is_ad=data.get("is_ad"),
        with_shop_entry=data.get("with_shop_entry"),
        commerce_level=data.get("commerce_level"),
        creator_verified=data.get("creator_verified"),
        follower_count=data.get("follower_count"),
        hashtags=data.get("hashtags"),
        source=data.get("source", "subtitle"),
    )


async def extract_video(raw_input: str) -> VideoContent | None:
    """
    主入口：抖音分享链接 → 文字稿 + 元数据。

    默认走分享页 HTML 快速解析（2-5 秒，支持视频/图文）。
    可选 ENABLE_VIDEO_ASR=1 时对短视频补充 Whisper 转录（15-45 秒）。
    """
    try:
        url = _extract_url_from_share_text(raw_input)
        html, final_url = await _fetch_share_page(url)
        aweme_id = _extract_aweme_id_from_url(final_url) or _extract_aweme_id_from_url(url)
        if not aweme_id:
            print("[video_extractor] 无法提取 aweme_id")
            return None

        parsed = parse_share_page_html(html, aweme_id)
        if not parsed:
            print(f"[video_extractor] 分享页解析失败，aweme_id={aweme_id}")
            return None

        meta = await _fetch_aweme_metadata(aweme_id)
        if meta:
            parsed = _merge_api_metadata(parsed, meta)

        asr_text = await _maybe_transcribe_video(parsed, meta)
        if asr_text:
            parsed["transcript"] = asr_text
            parsed["source"] = "asr"

        return _to_video_content(parsed)

    except Exception as e:
        print(f"[video_extractor] 解析失败: {e}")
        return None
