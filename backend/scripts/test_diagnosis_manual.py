"""
手动测试诊断 Prompt 质量（需要真实 ANTHROPIC_API_KEY）。

运行方式：
    cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
    source .venv/bin/activate
    python scripts/test_diagnosis_manual.py

预期结果对照表：
    焦虑贩卖型   → types: [anxiety_selling],       risk_score: 75-90, needs_search: false
    信息差收割型 → types: [info_gap_harvesting],    risk_score: 80+,   needs_search: true
    正常内容     → 任意类型,                        risk_score: 0-30,  needs_search: false
    矛盾挑起型   → types: [conflict_provoking],     risk_score: 50-70, needs_search: false
"""
import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.ai_client import call_claude
from prompts.diagnosis import SYSTEM, build_user_prompt


async def test_case(name: str, transcript: str, title: str, author: str,
                    likes: int = None, with_shop_entry: bool = False,
                    commerce_level: int = None, follower_count: int = None):
    print(f"\n{'='*60}")
    print(f"用例：{name}")
    print(f"{'='*60}")

    user_prompt = build_user_prompt(
        transcript=transcript,
        title=title,
        author=author,
        likes=likes,
        with_shop_entry=with_shop_entry,
        commerce_level=commerce_level,
        follower_count=follower_count,
    )
    result = await call_claude(system=SYSTEM, user=user_prompt, max_tokens=1024, expect_json=True)

    score = result.get("risk_score", "?")
    print(f"  类型:         {result.get('types')}")
    print(f"  风险评分:     {score}")
    print(f"  核心问题:     {result.get('core_issue')}")
    print(f"  缺失前提:     {result.get('missing_premises')}")
    print(f"  情绪操控:     {result.get('emotional_manipulation')}")
    print(f"  商业意图:     {result.get('commercial_intent')}")
    print(f"  需要实时搜索: {result.get('needs_realtime_search')}")
    return result


async def main():
    await test_case(
        name="焦虑贩卖型（大三实习）— 期望 75-90分，不触发搜索",
        transcript=(
            "现在这个就业环境，你都大三了还没找实习，基本上和毕业即失业没区别。"
            "你知道你的竞争对手是谁吗？985院校的同学大一就开始实习了。"
            "不要觉得大三还早，等你大四再投简历，HR一看你这段空白期直接pass掉。"
            "现在私信我，我告诉你怎么在三个月内逆袭。"
        ),
        title="大三了还没实习？你已经输了",
        author="职场导师小明",
        likes=120000,
        with_shop_entry=True,
        commerce_level=3,
        follower_count=320000,
    )

    await test_case(
        name="信息差收割型（AI设计师）— 期望 80+分，触发实时搜索",
        transcript=(
            "image2一出来，我就知道，设计师的时代结束了。"
            "现在客户直接用AI生成图片，不需要设计师了。"
            "我认识的一个设计师朋友，上个月直接被公司裁了，就是因为AI。"
            "趋势来了你挡不住，现在还不学AI提示词技巧就来不及了。"
            "我这里有个课程帮你3个月完成转型，只要699。"
        ),
        title="AI绘画已经让设计师失业，赶紧转型",
        author="AI技能培训",
        likes=85000,
        with_shop_entry=True,
        commerce_level=4,
        follower_count=156000,
    )

    await test_case(
        name="正常内容（应低风险）— 期望 0-30分",
        transcript=(
            "找实习这件事，不同专业有不同的节奏。"
            "金融、咨询这类岗位，大三找暑期实习是比较合理的时间节点。"
            "但如果你是做科研方向的，或者打算出国，实习不一定是最优先的事。"
            "每个人的情况不同，关键是要想清楚自己的目标是什么，然后倒推时间表。"
        ),
        title="给大学生的求职建议",
        author="职场分享",
        likes=3000,
    )

    await test_case(
        name="矛盾挑起型（两性矛盾）— 期望 50-70分",
        transcript=(
            "说真的，如果你男朋友不主动付账、不接送你、不照顾你生病，这种男人根本不值得托付。"
            "这些基本的事都做不到，还谈什么爱你？姐妹们要清醒一点，擦亮眼睛。"
        ),
        title="不做这三件事的男人不值得托付",
        author="情感博主",
        likes=200000,
        follower_count=890000,
    )


if __name__ == "__main__":
    asyncio.run(main())
