import pytest
from unittest.mock import patch, AsyncMock
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def test_manual_input_returns_video_content(client):
    """手动输入路由应返回完整的 VideoContent"""
    response = client.post("/api/video/manual", json={
        "title": "大三不找实习就废了",
        "text": "你都大三了还不找实习，基本上和毕业即失业没区别。现在私信我。",
        "author": "职场导师",
    })

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "大三不找实习就废了"
    assert data["transcript"] == "你都大三了还不找实习，基本上和毕业即失业没区别。现在私信我。"
    assert data["author"] == "职场导师"
    assert data["source"] == "manual"
    assert "video_id" in data
    assert len(data["video_id"]) > 0


def test_manual_input_without_author_uses_default(client):
    """不提供 author 时应使用默认值"""
    response = client.post("/api/video/manual", json={
        "title": "标题",
        "text": "内容",
    })

    assert response.status_code == 200
    data = response.json()
    assert data["author"] == "未知账号"
    assert data["source"] == "manual"


def test_manual_input_generates_unique_video_ids(client):
    """每次调用应生成唯一的 video_id"""
    response1 = client.post("/api/video/manual", json={"title": "t", "text": "c"})
    response2 = client.post("/api/video/manual", json={"title": "t", "text": "c"})
    assert response1.json()["video_id"] != response2.json()["video_id"]


def test_extract_returns_fallback_when_extraction_fails(client):
    """CDN 解析失败时应返回 422 和降级提示"""
    with patch("routers.video.extract_video", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = None

        response = client.post("/api/video/extract", json={
            "url": "https://v.douyin.com/invalid-url"
        })

    assert response.status_code == 422
    data = response.json()
    assert data["code"] == "EXTRACT_FAILED"
    assert data["fallback_available"] is True
    assert "手动粘贴" in data["error"]


def test_extract_returns_video_content_when_successful(client):
    """CDN 解析成功时应返回完整 VideoContent（含元数据字段）"""
    from models.schemas import VideoContent

    mock_video = VideoContent(
        video_id="7000000000000000001",
        transcript="视频转录内容",
        title="测试视频标题",
        author="测试账号",
        likes=50000,
        play_count=300000,
        follower_count=80000,
        with_shop_entry=True,
        commerce_level=3,
        creator_verified="知名博主",
        source="asr",
    )

    with patch("routers.video.extract_video", new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = mock_video

        response = client.post("/api/video/extract", json={
            "url": "https://v.douyin.com/valid-url"
        })

    assert response.status_code == 200
    data = response.json()
    assert data["video_id"] == "7000000000000000001"
    assert data["play_count"] == 300000
    assert data["with_shop_entry"] is True
    assert data["creator_verified"] == "知名博主"
