import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from prompts.report import build_user_prompt, SYSTEM
from models.schemas import DiagnosisResult, QAPair, SearchResult


def _make_diagnosis(**overrides) -> DiagnosisResult:
    defaults = dict(
        video_id="test-id",
        types=["anxiety_selling"],
        types_display=["焦虑贩卖型"],
        risk_score=72,
        risk_level="high",
        core_issue="视频用时间节点制造焦虑",
        missing_premises=["专业方向", "个人规划"],
        emotional_manipulation="使用绝对化词汇",
        commercial_intent=None,
        needs_realtime_search=False,
        search_query=None,
    )
    defaults.update(overrides)
    return DiagnosisResult(**defaults)


def _make_answers() -> list[QAPair]:
    return [
        QAPair(question="你现在是什么学历阶段？", answer="大三大四"),
        QAPair(question="你的目标方向是？", answer="就业"),
    ]


def test_system_forbids_vague_expressions():
    """SYSTEM prompt 必须禁止模糊表述（大多数人等）"""
    assert "大多数人" in SYSTEM or "禁止" in SYSTEM


def test_system_requires_four_sections():
    """SYSTEM prompt 必须包含四章节结构"""
    assert "视频内容解析" in SYSTEM
    assert "对你而言" in SYSTEM
    assert "事实核查" in SYSTEM
    assert "识别公式" in SYSTEM


def test_system_requires_personalization():
    """SYSTEM prompt 必须强调个性化约束"""
    assert "个性化" in SYSTEM or "用户的具体" in SYSTEM


def test_build_user_prompt_includes_transcript():
    """用户 Prompt 必须包含视频转录内容"""
    prompt = build_user_prompt(
        transcript="这是视频的转录文本",
        title="测试标题",
        author="测试账号",
        diagnosis=_make_diagnosis(),
        answers=_make_answers(),
        search_result=None,
    )
    assert "这是视频的转录文本" in prompt


def test_build_user_prompt_includes_user_answers():
    """用户 Prompt 必须包含用户的问卷回答"""
    answers = [
        QAPair(question="你在哪个阶段？", answer="大三"),
        QAPair(question="你的目标？", answer="考研"),
    ]
    prompt = build_user_prompt(
        transcript="视频内容",
        title="标题",
        author="账号",
        diagnosis=_make_diagnosis(),
        answers=answers,
        search_result=None,
    )
    assert "大三" in prompt
    assert "考研" in prompt


def test_build_user_prompt_truncates_long_transcript():
    """超过 3000 字的 transcript 必须被截断，且包含省略标记"""
    long_transcript = "A" * 4000
    prompt = build_user_prompt(
        transcript=long_transcript,
        title="标题",
        author="账号",
        diagnosis=_make_diagnosis(),
        answers=_make_answers(),
        search_result=None,
    )
    assert "中间内容省略" in prompt
    assert len(long_transcript) not in [len(p) for p in prompt.split("\n")]


def test_build_user_prompt_includes_search_result_when_present():
    """有搜索结果时，Prompt 必须包含搜索摘要"""
    search = SearchResult(
        summary="目前AI主要影响重复性设计工作",
        sources=["来源A", "来源B"],
        retrieved_at="2026-05-23T00:00:00+00:00",
    )
    diagnosis = _make_diagnosis(search_query="AI替代设计师", needs_realtime_search=True)
    prompt = build_user_prompt(
        transcript="视频内容",
        title="标题",
        author="账号",
        diagnosis=diagnosis,
        answers=_make_answers(),
        search_result=search,
    )
    assert "目前AI主要影响重复性设计工作" in prompt
