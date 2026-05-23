import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from prompts.diagnosis import build_user_prompt, SYSTEM


def test_system_prompt_contains_four_types():
    """系统 Prompt 必须包含全部四种内容类型"""
    assert "anxiety_selling" in SYSTEM
    assert "conflict_provoking" in SYSTEM
    assert "info_gap_harvesting" in SYSTEM
    assert "pseudo_science_ad" in SYSTEM


def test_system_prompt_contains_risk_anchors():
    """系统 Prompt 必须包含风险评分锚定案例"""
    assert "0-30" in SYSTEM or "低风险" in SYSTEM
    assert "61-85" in SYSTEM or "高风险" in SYSTEM


def test_build_user_prompt_includes_title_and_author():
    """构建的用户 Prompt 必须包含视频标题和账号名"""
    prompt = build_user_prompt(
        transcript="这是视频内容",
        title="大三不找实习就废了",
        author="职场导师",
        likes=10000,
    )
    assert "大三不找实习就废了" in prompt
    assert "职场导师" in prompt


def test_build_user_prompt_includes_likes():
    """构建的用户 Prompt 必须包含点赞量信息"""
    prompt = build_user_prompt(
        transcript="内容",
        title="标题",
        author="作者",
        likes=50000,
    )
    assert "50,000" in prompt or "50000" in prompt


def test_build_user_prompt_truncates_long_transcript():
    """超过 3000 字的 transcript 应被截断"""
    long_transcript = "测试内容" * 1000  # 4000 字
    prompt = build_user_prompt(
        transcript=long_transcript,
        title="标题",
        author="作者",
        likes=None,
    )
    assert "中间内容省略" in prompt
    assert len(prompt) < len(long_transcript) + 500


def test_build_user_prompt_includes_metadata_signals():
    """账号元数据应出现在 Prompt 中"""
    prompt = build_user_prompt(
        transcript="内容",
        title="标题",
        author="作者",
        with_shop_entry=True,
        commerce_level=4,
        creator_verified="知名健康博主",
        follower_count=500000,
    )
    assert "小店" in prompt or "shop" in prompt.lower()
    assert "知名健康博主" in prompt
    assert "500,000" in prompt or "500000" in prompt


def test_build_user_prompt_flags_platform_ad():
    """is_ad=True 时 Prompt 应明确标注为广告"""
    prompt = build_user_prompt(
        transcript="内容",
        title="标题",
        author="作者",
        is_ad=True,
    )
    assert "广告" in prompt
