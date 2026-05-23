import pytest
from unittest.mock import patch
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models.schemas import SavedReport


MOCK_SAVED_REPORT = SavedReport(
    report_id="abc12345",
    content="## 视频内容解析\n这是一份测试报告。",
    video_title="测试视频标题",
    diagnosis_types=["anxiety_selling"],
    created_at="2026-05-23T00:00:00+00:00",
)


def test_get_report_returns_saved_report(client):
    """GET /api/report/{id} 应返回已保存的报告"""
    with patch("routers.report.get_report", return_value=MOCK_SAVED_REPORT):
        response = client.get("/api/report/abc12345")

    assert response.status_code == 200
    data = response.json()
    assert data["report_id"] == "abc12345"
    assert data["content"] == "## 视频内容解析\n这是一份测试报告。"
    assert data["video_title"] == "测试视频标题"
    assert data["diagnosis_types"] == ["anxiety_selling"]


def test_get_report_returns_404_for_unknown_id(client):
    """GET /api/report/{id} 找不到报告时返回 404"""
    with patch("routers.report.get_report", return_value=None):
        response = client.get("/api/report/notexist")

    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data.get("code") == "REPORT_NOT_FOUND"
