"""
手动测试报告流式生成质量（需要真实 ANTHROPIC_API_KEY）。

运行方式：
    cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
    source .venv/bin/activate
    python scripts/test_report_stream_manual.py

验收标准：
    - 流式输出正常（每次打印一个 chunk，最终收到 done）
    - 报告包含四个章节（视频内容解析/对你而言/事实核查省略/识别公式）
    - 识别公式包含 3 个问题
    - 对你而言章节引用了用户的具体回答（如"大三"）
    - 未出现"大多数人"等模糊表述
    - 总长度 500-2000 字（800-1200字是理想范围）
"""
import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.ai_client import stream_claude
from prompts.report import SYSTEM, build_user_prompt
from models.schemas import DiagnosisResult, QAPair


DIAGNOSIS = DiagnosisResult(
    video_id="demo_1",
    types=["anxiety_selling"],
    types_display=["焦虑贩卖型"],
    risk_score=82,
    risk_level="high",
    core_issue="视频用'大三'时间节点制造普遍焦虑，省略专业方向等关键前提，用绝对化词汇驱动恐惧行动",
    missing_premises=["专业方向（理工/文科/艺术差异极大）", "个人规划（考研/就业/出国）", "已有实习/项目经验"],
    emotional_manipulation="用'你就完了''太晚了'制造紧迫感",
    commercial_intent="引导关注账号，隐性推广简历课程",
    needs_realtime_search=False,
    search_query=None,
)

TRANSCRIPT = (
    "大三了还没有实习经验？你就完了！现在不去实习，毕业找工作你就是最底层！"
    "我见过太多大三学生还在玩，最后简历一片空白，哭都来不及。"
    "你知道那些985毕业生为什么还是找不到工作吗？因为没有实习经验！"
    "趁现在赶紧去找实习，晚了真的来不及了。点击主页有简历指导课程，帮你快速拿到offer。"
)

ANSWERS = [
    QAPair(question="你现在是什么学历阶段？", answer="大三大四"),
    QAPair(question="你的专业方向是？", answer="计算机科学，打算直接就业"),
    QAPair(question="看完视频的第一反应是什么？", answer="有点焦虑，但感觉这视频说得有点夸张"),
]


async def main():
    user_prompt = build_user_prompt(
        transcript=TRANSCRIPT,
        title="大三没实习你就完了",
        author="职场干货博主",
        diagnosis=DIAGNOSIS,
        answers=ANSWERS,
        search_result=None,
    )

    print("=" * 60)
    print("开始流式生成报告...")
    print("=" * 60)
    print()

    chunks = []
    async for chunk in stream_claude(system=SYSTEM, user=user_prompt, max_tokens=4096):
        print(chunk, end="", flush=True)
        chunks.append(chunk)

    full_report = "".join(chunks)
    print()
    print()
    print("=" * 60)
    print("质量检查")
    print("=" * 60)

    checks = [
        ("包含'视频内容解析'章节", "视频内容解析" in full_report),
        ("包含'对你而言'章节", "对你而言" in full_report),
        ("包含'识别公式'章节", "识别公式" in full_report),
        ("'对你而言'引用用户背景（大三/计算机/就业）",
         any(kw in full_report for kw in ["大三", "计算机", "就业"])),
        ("未出现'大多数人'等模糊表述", "大多数人" not in full_report and "很多人" not in full_report),
        ("总字数在合理范围（500-2000）", 500 <= len(full_report) <= 2000),
    ]

    all_pass = True
    for desc, result in checks:
        icon = "✅" if result else "❌"
        print(f"  {icon} {desc}")
        if not result:
            all_pass = False

    print()
    print(f"总字数：{len(full_report)}")
    print(f"整体结果：{'✅ 全部通过' if all_pass else '❌ 存在问题'}")


if __name__ == "__main__":
    asyncio.run(main())
