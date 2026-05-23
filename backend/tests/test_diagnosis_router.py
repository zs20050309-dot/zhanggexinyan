import pytest
from unittest.mock import patch, AsyncMock


MOCK_DIAGNOSIS_RESPONSE = {
    "types": ["anxiety_selling"],
    "risk_score": 72,
    "core_issue": "视频用'大三'这个时间节点制造了普遍性焦虑，但完全没说明结论成立需要哪些前提",
    "missing_premises": ["专业方向", "个人规划（考研/就业/出国）", "已有经验积累"],
    "emotional_manipulation": "反复使用'废了''完了'等绝对化词汇",
    "commercial_intent": "主页有求职培训课程链接",
    "needs_realtime_search": False,
    "search_query": None,
}

BASE_REQUEST = {
    "video_id": "test-video-id",
    "transcript": "大三了还不找实习？你已经输了。现在私信我，还来得及。",
    "title": "大三不找实习就废了",
    "author": "职场导师小明",
    "likes": 50000,
}


def test_diagnosis_returns_correct_structure(client):
    """诊断接口应返回包含所有必要字段的结果"""
    with patch("routers.diagnosis.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = MOCK_DIAGNOSIS_RESPONSE
        response = client.post("/api/diagnosis", json=BASE_REQUEST)

    assert response.status_code == 200
    data = response.json()
    assert "video_id" in data
    assert "types" in data
    assert "types_display" in data
    assert "risk_score" in data
    assert "risk_level" in data
    assert "core_issue" in data
    assert "missing_premises" in data
    assert "needs_realtime_search" in data


def test_diagnosis_risk_level_high(client):
    """72分 → high"""
    with patch("routers.diagnosis.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = {**MOCK_DIAGNOSIS_RESPONSE, "risk_score": 72}
        response = client.post("/api/diagnosis", json=BASE_REQUEST)
    assert response.json()["risk_level"] == "high"


def test_diagnosis_risk_level_low(client):
    """20分 → low"""
    with patch("routers.diagnosis.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = {**MOCK_DIAGNOSIS_RESPONSE, "risk_score": 20}
        response = client.post("/api/diagnosis", json=BASE_REQUEST)
    assert response.json()["risk_level"] == "low"


def test_diagnosis_risk_level_medium(client):
    """45分 → medium"""
    with patch("routers.diagnosis.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = {**MOCK_DIAGNOSIS_RESPONSE, "risk_score": 45}
        response = client.post("/api/diagnosis", json=BASE_REQUEST)
    assert response.json()["risk_level"] == "medium"


def test_diagnosis_risk_level_critical(client):
    """90分 → critical"""
    with patch("routers.diagnosis.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = {**MOCK_DIAGNOSIS_RESPONSE, "risk_score": 90}
        response = client.post("/api/diagnosis", json=BASE_REQUEST)
    assert response.json()["risk_level"] == "critical"


def test_diagnosis_types_display_is_chinese(client):
    """types_display 字段应为中文"""
    with patch("routers.diagnosis.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = MOCK_DIAGNOSIS_RESPONSE
        response = client.post("/api/diagnosis", json=BASE_REQUEST)
    assert "焦虑贩卖型" in response.json()["types_display"]


def test_diagnosis_risk_score_clamped_upper(client):
    """risk_score 超过 100 应被夹到 100"""
    with patch("routers.diagnosis.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = {**MOCK_DIAGNOSIS_RESPONSE, "risk_score": 150}
        response = client.post("/api/diagnosis", json=BASE_REQUEST)
    assert response.json()["risk_score"] == 100


def test_diagnosis_risk_score_clamped_lower(client):
    """risk_score 低于 0 应被夹到 0"""
    with patch("routers.diagnosis.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = {**MOCK_DIAGNOSIS_RESPONSE, "risk_score": -10}
        response = client.post("/api/diagnosis", json=BASE_REQUEST)
    assert response.json()["risk_score"] == 0


def test_diagnosis_accepts_metadata_fields(client):
    """诊断接口应接受账号元数据字段（CDN 解析时提供）"""
    with patch("routers.diagnosis.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = MOCK_DIAGNOSIS_RESPONSE
        response = client.post("/api/diagnosis", json={
            **BASE_REQUEST,
            "play_count": 500000,
            "with_shop_entry": True,
            "commerce_level": 4,
            "creator_verified": "知名职场博主",
            "follower_count": 280000,
        })
    assert response.status_code == 200
