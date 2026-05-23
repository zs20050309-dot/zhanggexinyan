import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from prompts.questionnaire import build_user_prompt, SYSTEM
from models.schemas import DiagnosisResult


def _make_diagnosis(content_type: str, risk_score: int = 72) -> DiagnosisResult:
    type_map = {
        "anxiety_selling": "焦虑贩卖型",
        "info_gap_harvesting": "信息差收割型",
        "conflict_provoking": "矛盾挑起型",
        "pseudo_science_ad": "伪科普软广型",
    }
    return DiagnosisResult(
        video_id="test-id",
        types=[content_type],
        types_display=[type_map[content_type]],
        risk_score=risk_score,
        risk_level="high",
        core_issue="这条视频存在明显的操控结构",
        missing_premises=["前提条件1", "前提条件2"],
        needs_realtime_search=False,
    )


def test_system_prompt_contains_question_count_constraint():
    """系统 Prompt 必须说明问题数量限制（3-5个）"""
    assert "3" in SYSTEM and "5" in SYSTEM


def test_system_prompt_contains_choice_type():
    """系统 Prompt 必须说明选择题格式"""
    assert "choice" in SYSTEM or "选择题" in SYSTEM


def test_system_prompt_contains_privacy_constraint():
    """系统 Prompt 必须有不问隐私信息的约束"""
    assert "隐私" in SYSTEM or "敏感" in SYSTEM


def test_build_user_prompt_includes_content_type():
    """用户 Prompt 必须包含内容类型"""
    diagnosis = _make_diagnosis("anxiety_selling")
    prompt = build_user_prompt(diagnosis)
    assert "焦虑贩卖型" in prompt


def test_build_user_prompt_includes_core_issue():
    """用户 Prompt 必须包含核心问题描述"""
    diagnosis = _make_diagnosis("info_gap_harvesting")
    diagnosis.core_issue = "视频夸大了AI的影响范围"
    prompt = build_user_prompt(diagnosis)
    assert "视频夸大了AI的影响范围" in prompt


def test_build_user_prompt_includes_missing_premises():
    """用户 Prompt 必须包含缺失的前提条件"""
    diagnosis = _make_diagnosis("anxiety_selling")
    diagnosis.missing_premises = ["专业方向", "个人规划"]
    prompt = build_user_prompt(diagnosis)
    assert "专业方向" in prompt
    assert "个人规划" in prompt
