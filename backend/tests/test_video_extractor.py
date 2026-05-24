import pytest
from services.video_extractor import (
    _extract_url_from_share_text,
    _aweme_id_from_string,
    normalize_play_url,
    _subtitle_from_meta,
    _video_url_from_meta,
)


def test_extract_url_from_share_text_with_chinese():
    text = "7.48 复制打开抖音 https://v.douyin.com/abc123/ 看看这个"
    assert _extract_url_from_share_text(text) == "https://v.douyin.com/abc123/"


def test_extract_url_from_real_share_format():
    text = "https://v.douyin.com/15ZzY6bMaqc/ a@N.wS eoq:/ 01/13 :2pm"
    assert _extract_url_from_share_text(text) == "https://v.douyin.com/15ZzY6bMaqc/"


def test_extract_url_from_plain_link():
    url = "https://www.douyin.com/video/7123456789012345678"
    assert _extract_url_from_share_text(url) == url


def test_aweme_id_from_video_path():
    assert _aweme_id_from_string("https://www.douyin.com/video/7123456789012345678") == "7123456789012345678"


def test_normalize_play_url_removes_watermark():
    wm = "https://aweme.snssdk.com/aweme/v1/playwm/?video_id=abc"
    assert "playwm" not in normalize_play_url(wm)
    assert "play" in normalize_play_url(wm)


def test_video_url_from_meta_playwm():
    meta = {
        "video": {
            "play_addr": {
                "url_list": [
                    "https://aweme.snssdk.com/aweme/v1/playwm/?video_id=v123"
                ]
            }
        }
    }
    url = _video_url_from_meta(meta)
    assert url is not None
    assert "playwm" not in url


def test_subtitle_fallback_to_desc():
    meta = {"desc": "这是一条足够长的视频描述文字" * 3, "video": {}}
    text = _subtitle_from_meta(meta)
    assert text is not None
    assert len(text) >= 20


def test_meta_from_fallback_api():
    from services.video_extractor import _meta_from_fallback_api

    payload = {
        "code": 0,
        "data": {
            "stat": {"aweme_id": "7641252398422352293", "like": 100},
            "author": {"name": "测试作者"},
            "item": {"title": "测试视频文案内容", "url": "https://example.com/v.mp4", "duration": 60},
        },
    }
    meta = _meta_from_fallback_api(payload)
    assert meta is not None
    assert meta["aweme_id"] == "7641252398422352293"
    assert meta["_meta_source"] == "fallback"
    assert meta["author"]["nickname"] == "测试作者"
    assert meta["statistics"]["digg_count"] == 100


def test_parse_subtitle_webvtt():
    from services.video_extractor import _parse_subtitle_payload

    raw = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\n你好世界\n"
    assert _parse_subtitle_payload(raw) == "你好世界"


def test_subtitle_urls_from_meta():
    from services.video_extractor import _subtitle_urls_from_meta

    meta = {
        "video": {
            "subtitle_infos": [
                {"url": {"url_list": ["https://example.com/sub.json"]}},
            ]
        }
    }
    assert _subtitle_urls_from_meta(meta) == ["https://example.com/sub.json"]


# ─── _build_video_content 字段映射修复 ─────────────────────────

def test_build_uses_mplatform_followers_count_when_present():
    """直连抖音 meta 里粉丝数字段叫 mplatform_followers_count，不是 follower_count。"""
    from services.video_extractor import _build_video_content

    meta = {
        "aweme_id": "1234567890123456789",
        "desc": "测试视频",
        "author": {
            "nickname": "测试作者",
            "mplatform_followers_count": 320000,
        },
        "statistics": {"digg_count": 100},
    }
    vc = _build_video_content(meta, "transcript", "asr")
    assert vc.follower_count == 320000, "应抽 mplatform_followers_count，得到 None 说明字段映射错了"


def test_build_falls_back_to_follower_count_for_legacy_meta():
    """xingzhige fallback API meta 用 follower_count 字段名，也要兼容。"""
    from services.video_extractor import _build_video_content

    meta = {
        "aweme_id": "1234567890123456789",
        "desc": "测试视频",
        "author": {"nickname": "测试作者", "follower_count": 50000},
        "statistics": {"digg_count": 100},
    }
    vc = _build_video_content(meta, "transcript", "subtitle")
    assert vc.follower_count == 50000


def test_build_normalizes_zero_play_count_to_none():
    """抖音 web API 反爬 → play_count 恒为 0。展示 '0 播放' 误导用户，应转为 None。"""
    from services.video_extractor import _build_video_content

    meta = {
        "aweme_id": "1",
        "desc": "x",
        "author": {"nickname": "x"},
        "statistics": {"digg_count": 100, "play_count": 0},
    }
    vc = _build_video_content(meta, "t", "asr")
    assert vc.play_count is None, "play_count=0 是抖音反爬假数据，应规范化为 None 不展示"


def test_build_preserves_real_play_count_when_nonzero():
    """如果未来抖音放开 play_count 字段（不是 0），保留真实值。"""
    from services.video_extractor import _build_video_content

    meta = {
        "aweme_id": "1",
        "desc": "x",
        "author": {"nickname": "x"},
        "statistics": {"digg_count": 100, "play_count": 50000},
    }
    vc = _build_video_content(meta, "t", "asr")
    assert vc.play_count == 50000
