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
    assert meta["author"]["nickname"] == "测试作者"
    assert meta["statistics"]["digg_count"] == 100
