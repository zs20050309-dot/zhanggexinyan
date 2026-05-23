import os
import re
import uuid
import tempfile
import httpx
from models.schemas import VideoContent
from services.asr import transcribe

# 模拟移动端请求头，触发抖音返回内嵌 JSON（无需 cookie 或签名参数）
MOBILE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    ),
    "Referer": "https://www.douyin.com/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def _extract_url_from_share_text(text: str) -> str:
    """从分享文本中提取 URL（兼容纯链接和带文字的分享文本）"""
    patterns = [
        r"https?://v\.douyin\.com/\S+",
        r"https?://www\.douyin\.com/video/\d+",
        r"https?://www\.iesdouyin\.com/\S+",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0).rstrip(".,;)")
    return text.strip()


async def _resolve_aweme_id(url: str) -> str | None:
    """跟随短链跳转，从最终 URL 中提取 aweme_id"""
    async with httpx.AsyncClient(
        follow_redirects=True, headers=MOBILE_HEADERS, timeout=15
    ) as client:
        resp = await client.get(url)
        final_url = str(resp.url)

    for target in (final_url, url):
        match = re.search(r"/video/(\d+)", target)
        if match:
            return match.group(1)
    return None


async def _fetch_aweme_metadata(aweme_id: str) -> dict | None:
    """调用 iesdouyin API 获取视频完整元数据"""
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


async def _download_file(url: str, suffix: str = ".mp4") -> str:
    """流式下载文件到临时路径，返回本地路径"""
    fd, path = tempfile.mkstemp(suffix=suffix)
    async with httpx.AsyncClient(follow_redirects=True, timeout=120) as client:
        async with client.stream(
            "GET", url, headers={"User-Agent": MOBILE_HEADERS["User-Agent"]}
        ) as resp:
            resp.raise_for_status()
            with os.fdopen(fd, "wb") as f:
                async for chunk in resp.aiter_bytes(65536):
                    f.write(chunk)
    return path


async def extract_video(raw_input: str) -> VideoContent | None:
    """
    主入口：从抖音分享链接或含链接的分享文本中提取视频内容。
    成功返回 VideoContent，失败返回 None（由 router 提供降级提示）。
    """
    try:
        url = _extract_url_from_share_text(raw_input)
        aweme_id = await _resolve_aweme_id(url)
        if not aweme_id:
            print("[video_extractor] 无法提取 aweme_id")
            return None

        meta = await _fetch_aweme_metadata(aweme_id)
        if not meta:
            print(f"[video_extractor] API 返回空，aweme_id={aweme_id}")
            return None

        # 获取视频直链（含完整音轨）
        video_info = meta.get("video", {})
        url_list = (
            video_info.get("play_addr", {}).get("url_list", [])
            or video_info.get("download_addr", {}).get("url_list", [])
        )
        if not url_list:
            print("[video_extractor] 未找到可用的视频直链")
            return None

        # 下载并转录（Whisper API 原生支持 mp4）
        video_path = await _download_file(url_list[0], suffix=".mp4")
        try:
            transcript = await transcribe(video_path)
        finally:
            try:
                os.remove(video_path)
            except OSError:
                pass

        # 提取统计与账号元数据
        statistics = meta.get("statistics", {})
        author_info = meta.get("author", {})
        hashtags = [
            t["hashtag_name"]
            for t in meta.get("text_extra", [])
            if t.get("hashtag_name")
        ] or None

        return VideoContent(
            video_id=aweme_id,
            transcript=transcript,
            title=meta.get("desc", ""),
            author=author_info.get("nickname", ""),
            likes=statistics.get("digg_count"),
            comments=statistics.get("comment_count"),
            shares=statistics.get("share_count"),
            play_count=statistics.get("play_count"),
            duration_seconds=meta.get("duration"),
            is_ad=meta.get("is_ads") or False,
            with_shop_entry=author_info.get("with_shop_entry") or False,
            commerce_level=author_info.get("commerce_user_level"),
            creator_verified=author_info.get("custom_verify") or None,
            follower_count=author_info.get("follower_count"),
            hashtags=hashtags,
            source="asr",
        )

    except Exception as e:
        print(f"[video_extractor] CDN 解析失败: {e}")
        return None
