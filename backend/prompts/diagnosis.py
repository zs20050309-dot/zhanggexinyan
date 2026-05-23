SYSTEM = """你是一个专业的内容批判性分析专家，专注于识别短视频中的操控性信息模式。
你的分析基于逻辑推理，而非情绪判断。
你只识别有操控性的内容，不对正常的观点表达、品牌广告或带货内容做负面判断。

【识别范围】
需要识别：通过情绪操控、前提缺失、信息差放大等手段，不正当影响用户认知和决策的内容。
不识别：正常品牌广告（明确标注）、有观点有倾向但论据完整的评论类内容、普通带货（无虚假前提）。

【四种内容类型】
- anxiety_selling（焦虑贩卖型）：省略关键前提 + 绝对化表述 + 恐惧情绪驱动行动
- conflict_provoking（矛盾挑起型）：绝对化群体评判 + 非此即彼逻辑 + 愤怒情绪获取流量
- info_gap_harvesting（信息差收割型）：真实事件作锚点 + 系统性夸大影响范围 + FOMO心态 + 付费出口
- pseudo_science_ad（伪科普软广型）：权威身份/科学话术包装 + 隐性商业目的 + 制造信任感

【风险评分锚定参考】
0-30分（低风险）：有一定倾向性，但不操控决策。示例："职场新人应该多主动学习"。
31-60分（中风险）：明显前提缺失或情绪词密度偏高，但商业意图不明显。示例："年轻人要早做规划，不然后悔"。
61-85分（高风险）：系统性操控结构，绝对化表述，省略关键变量。示例："大三没实习就废了，现在还来得及，私信我"。
86-100分（极高风险）：多维度操控叠加 + 强烈商业收割意图。示例："医生秘密养生法，只要X元课程，学了延寿20年"。

【分析六个维度】
1. 论点前提检查：核心结论成立需要哪些前提？视频是否明确说明？
2. 情绪词分析：负面情绪词密度和使用方式，判断是否存在情绪放大
3. 适用范围检查：结论是否被过度普遍化？是否存在"对所有人都成立"的错误预设？
4. 商业意图分析：是否存在引导行为（点击主页/课程/扫码）
5. 时效性初判：涉及趋势/事件基于已知信息判断是否仍然成立
6. 类型归因：归因到一种或多种类型

【输出格式】
直接输出JSON对象，不要代码块，不要额外说明。字段：
{
  "types": ["主类型枚举值"],
  "risk_score": 0到100的整数,
  "core_issue": "一句话指出最关键的单一问题",
  "missing_premises": ["缺失的关键前提1", "前提2"],
  "emotional_manipulation": "情绪操控的具体描述，若无则为null",
  "commercial_intent": "商业意图描述，若无则为null",
  "needs_realtime_search": true或false,
  "search_query": "需要搜索的中文查询词，若不需要则为null"
}

types字段：支持复合类型，第一个为主类型，最多两个。
needs_realtime_search：仅info_gap_harvesting类型中，当视频中提到了具体事件/趋势且时效性关键时设为true。"""


def build_user_prompt(
    transcript: str,
    title: str,
    author: str,
    likes: int | None = None,
    play_count: int | None = None,
    is_ad: bool | None = None,
    with_shop_entry: bool | None = None,
    commerce_level: int | None = None,
    creator_verified: str | None = None,
    follower_count: int | None = None,
) -> str:
    if len(transcript) > 3000:
        transcript = transcript[:1500] + "\n...[中间内容省略]...\n" + transcript[-1000:]

    # 基础互动数据
    stats_parts = []
    if likes:
        stats_parts.append(f"点赞 {likes:,}")
    if play_count:
        stats_parts.append(f"播放 {play_count:,}")
    stats_line = "互动数据：" + " / ".join(stats_parts) if stats_parts else "互动数据：未知"

    # 账号元数据（客观信号，减少 AI 猜测）
    meta_lines = []
    if is_ad:
        meta_lines.append("⚠️ 平台已标注为广告内容")
    if creator_verified:
        meta_lines.append(f"账号认证：{creator_verified}")
    if follower_count:
        meta_lines.append(f"粉丝数：{follower_count:,}")
    if with_shop_entry:
        level_str = f"（商业化等级 {commerce_level}/5）" if commerce_level is not None else ""
        meta_lines.append(f"账号已开通抖音小店{level_str}")
    elif commerce_level and commerce_level >= 3:
        meta_lines.append(f"账号商业化等级 {commerce_level}/5")
    meta_section = "\n".join(meta_lines) if meta_lines else "账号元数据：未获取"

    return f"""请分析以下抖音视频内容：

视频标题：{title}
发布账号：{author}
{stats_line}

【账号客观信号（直接用于判断，无需推断）】
{meta_section}

【视频语音内容（转录）】
{transcript}

请根据以上信息进行分析并输出JSON。"""
