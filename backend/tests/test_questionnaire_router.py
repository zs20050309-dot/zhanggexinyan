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


def test_questionnaire_logs_exception_when_claude_fails(client, caplog):
    """AI 调用失败时必须把 exception 写到 log（之前 silent fallback 让 401 隐藏数小时）"""
    import logging
    with patch("routers.questionnaire.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.side_effect = RuntimeError("Auth 401 token exhausted")

        with caplog.at_level(logging.WARNING):
            response = client.post("/api/questionnaire/generate", json={
                "video_id": "test-id",
                "diagnosis": MOCK_DIAGNOSIS,
            })

    assert response.status_code == 200
    # 关键断言：错误必须留下痕迹
    log_text = caplog.text
    assert "Auth 401" in log_text or "token exhausted" in log_text or "questionnaire" in log_text.lower(), \
        f"AI 失败时必须 log exception，当前 log:\n{log_text}"


def test_questionnaire_response_flags_fallback_source(client):
    """成功 vs fallback 必须从响应能区分（让前端能 UI 提示）"""
    # 路径 A：AI 成功
    with patch("routers.questionnaire.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = MOCK_QUESTIONS_RESPONSE
        resp_ai = client.post("/api/questionnaire/generate", json={
            "video_id": "test-id",
            "diagnosis": MOCK_DIAGNOSIS,
        })

    # 路径 B：AI 失败
    with patch("routers.questionnaire.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.side_effect = Exception("boom")
        resp_fb = client.post("/api/questionnaire/generate", json={
            "video_id": "test-id",
            "diagnosis": MOCK_DIAGNOSIS,
        })

    data_ai = resp_ai.json()
    data_fb = resp_fb.json()
    # 必须能从响应判断（最简单：加一个 source 字段，'ai' 或 'fallback'）
    assert data_ai.get("source") == "ai", f"AI 成功应标 source=ai，得到 {data_ai}"
    assert data_fb.get("source") == "fallback", f"fallback 应标 source=fallback，得到 {data_fb}"
