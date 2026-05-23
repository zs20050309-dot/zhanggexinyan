import pytest
from unittest.mock import patch, AsyncMock
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


MOCK_DIAGNOSIS = {
    "video_id": "test-id",
    "types": ["anxiety_selling"],
    "types_display": ["焦虑贩卖型"],
    "risk_score": 72,
    "risk_level": "high",
    "core_issue": "视频用时间节点制造焦虑",
    "missing_premises": ["专业方向", "个人规划"],
    "emotional_manipulation": "使用绝对化词汇",
    "commercial_intent": None,
    "needs_realtime_search": False,
    "search_query": None,
}

MOCK_QUESTIONS_RESPONSE = [
    {"id": 1, "text": "你现在是什么学历阶段？", "type": "choice",
     "options": ["大一大二", "大三大四", "研究生", "已工作"]},
    {"id": 2, "text": "你的目标方向是？", "type": "choice",
     "options": ["就业", "考研/出国", "创业", "还没想好"]},
    {"id": 3, "text": "看完视频的第一反应？", "type": "text", "options": None},
]


def test_questionnaire_generate_returns_questions(client):
    """问卷生成接口应返回 questions 数组"""
    with patch("routers.questionnaire.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = MOCK_QUESTIONS_RESPONSE

        response = client.post("/api/questionnaire/generate", json={
            "video_id": "test-id",
            "diagnosis": MOCK_DIAGNOSIS,
        })

    assert response.status_code == 200
    data = response.json()
    assert "questions" in data
    assert isinstance(data["questions"], list)
    assert len(data["questions"]) > 0


def test_questionnaire_questions_have_required_fields(client):
    """每个问题必须包含 id, text, type 字段"""
    with patch("routers.questionnaire.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = MOCK_QUESTIONS_RESPONSE

        response = client.post("/api/questionnaire/generate", json={
            "video_id": "test-id",
            "diagnosis": MOCK_DIAGNOSIS,
        })

    data = response.json()
    for q in data["questions"]:
        assert "id" in q
        assert "text" in q
        assert "type" in q
        assert q["type"] in ("choice", "text")


def test_questionnaire_choice_questions_have_options(client):
    """选择题必须有选项，填写题选项应为 null"""
    with patch("routers.questionnaire.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = MOCK_QUESTIONS_RESPONSE

        response = client.post("/api/questionnaire/generate", json={
            "video_id": "test-id",
            "diagnosis": MOCK_DIAGNOSIS,
        })

    data = response.json()
    for q in data["questions"]:
        if q["type"] == "choice":
            assert q["options"] is not None
            assert len(q["options"]) >= 2
        else:
            assert q["options"] is None


def test_questionnaire_uses_fallback_when_claude_fails(client):
    """Claude 调用失败时应返回兜底问题而不是报错"""
    with patch("routers.questionnaire.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.side_effect = Exception("Claude API 超时")

        response = client.post("/api/questionnaire/generate", json={
            "video_id": "test-id",
            "diagnosis": MOCK_DIAGNOSIS,
        })

    assert response.status_code == 200
    data = response.json()
    assert "questions" in data
    assert len(data["questions"]) >= 3


def test_questionnaire_fallback_has_valid_structure(client):
    """兜底问题也必须符合 Question 模型的结构"""
    with patch("routers.questionnaire.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.side_effect = ValueError("JSON 解析失败")

        response = client.post("/api/questionnaire/generate", json={
            "video_id": "test-id",
            "diagnosis": MOCK_DIAGNOSIS,
        })

    data = response.json()
    for q in data["questions"]:
        assert "id" in q
        assert "text" in q
        assert "type" in q
