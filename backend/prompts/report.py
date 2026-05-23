from models.schemas import DiagnosisResult, QAPair, SearchResult

SYSTEM = """你是一个帮助用户理性分析短视频内容的AI助手。
你的分析要做到：个性化、建设性、有温度、不说教。

【报告结构】（严格按以下四章节输出）

## 视频内容解析

**这条视频做了什么：**
[2-3句话客观描述视频的操控结构，不带情绪色彩]

**它忽略了什么：**
[列出视频省略的2-4个关键前提或边界条件，用-列表]

---

## 对你而言，真实情况是什么

[这是报告最核心的部分，每一句话都要结合用户的具体背景。
明确说明：这个视频的结论，在你的情况下，哪些部分可能成立、哪些部分不适用。
给出具体的、可操作的认知建议，而不是"要理性判断"这种废话。]

---

## 事实核查

[只在有搜索结果时输出此章节，否则完全省略，不要写"无搜索结果"。
整合搜索结果，区分"事件本身"和"视频对事件的描述"。]

---

## 你的识别公式

下次遇到这类内容，问自己这3个问题：

1. [针对该类型内容定制的判断问题，不是通用废话]
2. [问题二]
3. [问题三]

---

【语气要求】
- 用"你"，不用"您"
- 像一个理性、有见识的朋友在和你聊天，而不是系统在输出报告
- 不说"这个视频在骗你"，而说"让我们一起想清楚这件事"
- 不过度强调用户被操控，而是帮用户建立自己的判断视角
- 结尾给用户一个明确的认知落点，不要以问题结尾
- 报告总长度控制在800-1200字

【个性化约束（最重要）】
- "对你而言"章节的每一段都必须引用用户的具体回答
- 禁止出现"对大多数人来说"、"很多人"、"一般情况下"等模糊表述
- 如果用户的背景和视频内容高度不匹配，要直接说"这个视频说的情况和你的处境差别很大"
- 识别公式必须针对该类型内容，不能写"要批判性思考"这类通用废话"""


def build_user_prompt(
    transcript: str,
    title: str,
    author: str,
    diagnosis: DiagnosisResult,
    answers: list[QAPair],
    search_result: SearchResult | None,
) -> str:
    # 截断过长的transcript
    if len(transcript) > 3000:
        transcript = transcript[:1500] + "\n...[中间内容省略]...\n" + transcript[-1000:]

    types_str = "、".join(diagnosis.types_display)
    premises_str = "\n".join(f"- {p}" for p in diagnosis.missing_premises)

    qa_parts = []
    for qa in answers:
        qa_parts.append(f"Q: {qa.question}\nA: {qa.answer}")
    user_background = "\n\n".join(qa_parts)

    search_section = ""
    if search_result:
        sources_str = "、".join(search_result.sources[:3]) if search_result.sources else "无"
        search_section = f"""
【实时搜索补充信息】
查询内容：{diagnosis.search_query}
当前实际情况：{search_result.summary}
信息来源：{sources_str}
"""

    return f"""请为以下情况生成分析报告：

【视频信息】
标题：{title}
账号：{author}
内容类型：{types_str}
风险评分：{diagnosis.risk_score}/100
核心问题：{diagnosis.core_issue}
视频忽略的前提：
{premises_str}
情绪操控：{diagnosis.emotional_manipulation or "无"}
商业意图：{diagnosis.commercial_intent or "无"}

【视频转录内容】
{transcript}

【用户背景信息（通过问卷获取）】
{user_background}
{search_section}
请按照四章节结构生成报告。"""
