"""
手动测试问卷 Prompt 质量（需要真实 ANTHROPIC_API_KEY）。

运行方式：
    cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
    source .venv/bin/activate
    python scripts/test_questionnaire_manual.py

预期结果：
    - 每个案例生成 3-5 个问题
    - 选择题占多数（至少 2/3）
    - 问题与内容类型强相关
    - 语气口语化，无隐私敏感内容
"""
import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.ai_client import call_claude
from prompts.questionnaire import SYSTEM, build_user_prompt
from models.schemas import DiagnosisResult


def make_diagnosis(types, types_display, core_issue, premises):
    return DiagnosisResult(
        video_id="test",
        types=types,
        types_display=types_display,
        risk_score=75,
        risk_level="high",
        core_issue=core_issue,
        missing_premises=premises,
        needs_realtime_search=False,
    )


async def test_questionnaire(name: str, diagnosis: DiagnosisResult):
    print(f"\n{'='*60}")
    print(f"测试用例：{name}")
    print(f"类型：{diagnosis.types_display}")
    print(f"{'='*60}")

    user_prompt = build_user_prompt(diagnosis)
    result = await call_claude(system=SYSTEM, user=user_prompt, max_tokens=1024, expect_json=True)

    if not isinstance(result, list):
        print(f"❌ 返回格式异常（期望 list）: {result}")
        return

    choice_count = sum(1 for q in result if q.get("type") == "choice")
    print(f"生成问题数：{len(result)}（选择题 {choice_count} 个，填写题 {len(result) - choice_count} 个）")

    ok = 3 <= len(result) <= 5
    print(f"数量 3-5：{'✅' if ok else '❌'}")
    print(f"选择题占比：{'✅' if choice_count >= len(result) * 2 / 3 else '⚠️'}")

    for i, q in enumerate(result, 1):
        print(f"\n  Q{i}: {q.get('text')}")
        print(f"  类型: {q.get('type')}")
        if q.get("options"):
            for opt in q["options"]:
                print(f"    · {opt}")


async def main():
    await test_questionnaire(
        "焦虑贩卖型（大三实习）",
        make_diagnosis(
            ["anxiety_selling"], ["焦虑贩卖型"],
            "视频用'大三'时间节点制造普遍焦虑，省略专业方向等前提",
            ["专业方向", "个人规划（考研/就业/出国）", "已有经验积累"],
        ),
    )

    await test_questionnaire(
        "信息差收割型（AI设计师）",
        make_diagnosis(
            ["info_gap_harvesting"], ["信息差收割型"],
            "视频以image2为锚点，将影响夸大为对所有设计师的全面冲击",
            ["受影响的设计类型", "时效性是否成立", "课程价值是否真实"],
        ),
    )

    await test_questionnaire(
        "矛盾挑起型（两性关系）",
        make_diagnosis(
            ["conflict_provoking"], ["矛盾挑起型"],
            "视频通过绝对化群体评判制造对立情绪，获取愤怒流量",
            ["情境是否普适", "是否代表所有人"],
        ),
    )


if __name__ == "__main__":
    asyncio.run(main())
