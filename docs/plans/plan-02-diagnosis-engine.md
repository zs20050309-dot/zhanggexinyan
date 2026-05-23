# Plan 02: AI 诊断引擎

> **执行方式：** TDD——先写测试，看到失败，再实现，看到通过。每个 Task 独立 commit。

**Goal:** 实现内容诊断核心功能：接收视频文字稿，输出内容类型标签、风险评分和核心问题，是整个产品最核心的 AI 能力。

**Architecture:** `routers/diagnosis.py` 接收 HTTP 请求 → 调用 `prompts/diagnosis.py` 构建 prompt → 调用 `services/ai_client.py` 调用 Claude API → 解析 JSON 输出 → 返回 `DiagnosisResult`。

**Tech Stack:** FastAPI TestClient, pytest-asyncio, anthropic SDK, unittest.mock

---

### Task 1：测试 AI 客户端基础功能（含 mock）

**Files:**
- Create: `backend/tests/test_ai_client.py`
- Verify: `backend/services/ai_client.py`（已存在，不修改）

- [ ] **Step 1: 写失败测试——非流式调用**

创建 `backend/tests/test_ai_client.py`：

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_call_claude_returns_text():
    """非流式调用应返回字符串"""
    mock_content = MagicMock()
    mock_content.text = "Hello from Claude"

    mock_message = MagicMock()
    mock_message.content = [mock_content]

    with patch("services.ai_client.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_message)
        mock_get_client.return_value = mock_client

        from services.ai_client import call_claude
        result = await call_claude(system="你是助手", user="你好")

    assert result == "Hello from Claude"


@pytest.mark.asyncio
async def test_call_claude_returns_parsed_json_when_expect_json():
    """expect_json=True 时应返回解析后的字典"""
    mock_content = MagicMock()
    mock_content.text = '{"types": ["anxiety_selling"], "risk_score": 72}'

    mock_message = MagicMock()
    mock_message.content = [mock_content]

    with patch("services.ai_client.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_message)
        mock_get_client.return_value = mock_client

        from services.ai_client import call_claude
        result = await call_claude(system="你是助手", user="分析内容", expect_json=True)

    assert isinstance(result, dict)
    assert result["types"] == ["anxiety_selling"]
    assert result["risk_score"] == 72


@pytest.mark.asyncio
async def test_call_claude_handles_json_in_code_block():
    """模型返回 ```json ... ``` 格式时应能正确解析"""
    mock_content = MagicMock()
    mock_content.text = '```json\n{"types": ["conflict_provoking"], "risk_score": 55}\n```'

    mock_message = MagicMock()
    mock_message.content = [mock_content]

    with patch("services.ai_client.get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_message)
        mock_get_client.return_value = mock_client

        from services.ai_client import call_claude
        result = await call_claude(system="你是助手", user="分析", expect_json=True)

    assert result["types"] == ["conflict_provoking"]
```

- [ ] **Step 2: 运行测试，确认失败（预期失败原因：模块路径问题）**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
pytest tests/test_ai_client.py -v
```

若失败原因是 `ModuleNotFoundError: No module named 'services'`，继续 Step 3。
若已通过，直接跳到 Step 4 检查流式测试。

- [ ] **Step 3: 在 conftest.py 确认路径设置正确**

检查 `backend/tests/conftest.py` 中 `sys.path.insert` 那行是否存在。若不存在，添加：

```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
```

- [ ] **Step 4: 再次运行，确认 3 个测试全部通过**

```bash
pytest tests/test_ai_client.py -v
```

Expected:
```
PASSED tests/test_ai_client.py::test_call_claude_returns_text
PASSED tests/test_ai_client.py::test_call_claude_returns_parsed_json_when_expect_json
PASSED tests/test_ai_client.py::test_call_claude_handles_json_in_code_block
3 passed in 0.xxs
```

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_ai_client.py backend/tests/conftest.py
git commit -m "test: add ai_client unit tests with mocked Claude responses"
```

---

### Task 2：测试诊断 Prompt 构建函数

**Files:**
- Create: `backend/tests/test_diagnosis_prompt.py`
- Verify: `backend/prompts/diagnosis.py`（已存在）

- [ ] **Step 1: 写失败测试——Prompt 构建**

创建 `backend/tests/test_diagnosis_prompt.py`：

```python
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
    # 截断后 prompt 长度不应超过合理范围（原 transcript 不完整出现）
    assert "中间内容省略" in prompt
    assert len(prompt) < len(long_transcript) + 500
```

- [ ] **Step 2: 运行测试，看哪些失败**

```bash
pytest tests/test_diagnosis_prompt.py -v
```

根据失败信息调整 `backend/prompts/diagnosis.py` 中的 `SYSTEM` 常量或 `build_user_prompt` 函数，直到全部通过。

- [ ] **Step 3: 运行所有测试确认未引入退步**

```bash
pytest tests/ -v
```

Expected: 全部 passed。

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_diagnosis_prompt.py
git commit -m "test: add diagnosis prompt unit tests"
```

---

### Task 3：测试诊断路由（mock Claude）

**Files:**
- Create: `backend/tests/test_diagnosis_router.py`
- Verify: `backend/routers/diagnosis.py`（已存在）

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_diagnosis_router.py`：

```python
import pytest
from unittest.mock import patch, AsyncMock


MOCK_DIAGNOSIS_RESPONSE = {
    "types": ["anxiety_selling"],
    "risk_score": 72,
    "core_issue": "视频用'大三'这个时间节点制造了普遍性焦虑，但完全没说明结论成立需要哪些前提",
    "missing_premises": ["专业方向", "个人规划（考研/就业/出国）", "已有经验积累"],
    "emotional_manipulation": "反复使用'废了''完了'等绝对化词汇",
    "commercial_intent": "主页有求职培训课程链接",
    "needs_realtime_search": False,
    "search_query": None,
}


def test_diagnosis_returns_correct_structure(client):
    """诊断接口应返回包含所有必要字段的结果"""
    with patch("routers.diagnosis.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = MOCK_DIAGNOSIS_RESPONSE

        response = client.post("/api/diagnosis", json={
            "video_id": "test-video-id",
            "transcript": "大三了还不找实习？你已经输了。现在私信我，还来得及。",
            "title": "大三不找实习就废了",
            "author": "职场导师小明",
            "likes": 50000,
        })

    assert response.status_code == 200
    data = response.json()

    # 必要字段存在
    assert "video_id" in data
    assert "types" in data
    assert "types_display" in data
    assert "risk_score" in data
    assert "risk_level" in data
    assert "core_issue" in data
    assert "missing_premises" in data
    assert "needs_realtime_search" in data


def test_diagnosis_risk_level_mapping(client):
    """风险评分应被正确映射到风险等级"""
    with patch("routers.diagnosis.call_claude", new_callable=AsyncMock) as mock_claude:
        # 高风险：72分 → high
        mock_claude.return_value = {**MOCK_DIAGNOSIS_RESPONSE, "risk_score": 72}
        response = client.post("/api/diagnosis", json={
            "video_id": "id1", "transcript": "内容", "title": "标题", "author": "作者"
        })
    assert response.json()["risk_level"] == "high"


def test_diagnosis_risk_level_low(client):
    with patch("routers.diagnosis.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = {**MOCK_DIAGNOSIS_RESPONSE, "risk_score": 20}
        response = client.post("/api/diagnosis", json={
            "video_id": "id2", "transcript": "内容", "title": "标题", "author": "作者"
        })
    assert response.json()["risk_level"] == "low"


def test_diagnosis_types_display_is_chinese(client):
    """types_display 字段应为中文"""
    with patch("routers.diagnosis.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = MOCK_DIAGNOSIS_RESPONSE
        response = client.post("/api/diagnosis", json={
            "video_id": "id3", "transcript": "内容", "title": "标题", "author": "作者"
        })
    data = response.json()
    assert "焦虑贩卖型" in data["types_display"]


def test_diagnosis_risk_score_clamped(client):
    """risk_score 应被限制在 0-100 范围内"""
    with patch("routers.diagnosis.call_claude", new_callable=AsyncMock) as mock_claude:
        mock_claude.return_value = {**MOCK_DIAGNOSIS_RESPONSE, "risk_score": 150}
        response = client.post("/api/diagnosis", json={
            "video_id": "id4", "transcript": "内容", "title": "标题", "author": "作者"
        })
    assert response.json()["risk_score"] == 100
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
pytest tests/test_diagnosis_router.py -v
```

常见失败原因：
- `call_claude` 的 patch 路径不对 → 检查 routers/diagnosis.py 的 import 方式
- 字段缺失 → 检查 DiagnosisResult 的构建逻辑

- [ ] **Step 3: 修复 routers/diagnosis.py 直到所有测试通过**

主要检查：
1. `call_claude` 的 import 路径是否和测试 patch 路径一致
2. `score_to_level` 函数的边界值是否正确（31-60 → medium, 61-85 → high）
3. `CONTENT_TYPE_ZH` 映射是否完整

当前 `backend/routers/diagnosis.py` 中的 import：
```python
from services.ai_client import call_claude
```

对应测试 patch 路径是 `routers.diagnosis.call_claude`，这是正确的。

- [ ] **Step 4: 运行所有测试确认全部通过**

```bash
pytest tests/ -v
```

Expected: 全部 passed。

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_diagnosis_router.py
git commit -m "test: add diagnosis router tests with mocked Claude"
```

---

### Task 4：用真实 Claude API 调试 Prompt（手动测试）

**Files:**
- Possibly modify: `backend/prompts/diagnosis.py`（根据输出质量调整）

> 这个 Task 不写自动化测试，而是用真实 API 验证 Prompt 质量。
> 对照 `prompts/diagnosis_v1.md` 中的四个测试用例逐一验证。

- [ ] **Step 1: 创建临时测试脚本 backend/scripts/test_diagnosis_manual.py**

```python
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.ai_client import call_claude
from prompts.diagnosis import SYSTEM, build_user_prompt


async def test_case(name: str, transcript: str, title: str, author: str, likes: int = None):
    print(f"\n{'='*60}")
    print(f"测试用例：{name}")
    print(f"{'='*60}")

    user_prompt = build_user_prompt(transcript, title, author, likes)
    result = await call_claude(system=SYSTEM, user=user_prompt, max_tokens=1024, expect_json=True)

    print(f"类型: {result.get('types')}")
    print(f"风险评分: {result.get('risk_score')}")
    print(f"核心问题: {result.get('core_issue')}")
    print(f"缺失前提: {result.get('missing_premises')}")
    print(f"需要搜索: {result.get('needs_realtime_search')}")
    return result


async def main():
    # 用例1：焦虑贩卖型
    await test_case(
        name="焦虑贩卖型（大三实习）",
        transcript="现在这个就业环境，你都大三了还没找实习，基本上和毕业即失业没区别。"
                   "你知道你的竞争对手是谁吗？985院校的同学大一就开始实习了。"
                   "不要觉得大三还早，等你大四再投简历，HR一看你这段空白期直接pass掉。"
                   "现在私信我，我告诉你怎么在三个月内逆袭。",
        title="大三了还没实习？你已经输了",
        author="职场导师小明",
        likes=120000,
    )

    # 用例2：信息差收割型
    await test_case(
        name="信息差收割型（AI设计师）",
        transcript="image2一出来，我就知道，设计师的时代结束了。"
                   "现在客户直接用AI生成图片，不需要设计师了。"
                   "我认识的一个设计师朋友，上个月直接被公司裁了，就是因为AI。"
                   "趋势来了你挡不住，现在还不学AI提示词技巧就来不及了。"
                   "我这里有个课程帮你3个月完成转型，只要699。",
        title="AI绘画已经让设计师失业，赶紧转型",
        author="AI技能培训",
        likes=85000,
    )

    # 用例3：正常内容（不应误判）
    await test_case(
        name="正常内容（应低风险）",
        transcript="找实习这件事，不同专业有不同的节奏。"
                   "金融、咨询这类岗位，大三找暑期实习是比较合理的时间节点。"
                   "但如果你是做科研方向的，或者打算出国，实习不一定是最优先的事。"
                   "每个人的情况不同，关键是要想清楚自己的目标是什么，然后倒推时间表。",
        title="给大学生的求职建议",
        author="职场分享",
        likes=3000,
    )

    # 用例4：矛盾挑起型
    await test_case(
        name="矛盾挑起型（两性矛盾）",
        transcript="说真的，如果你男朋友不主动付账、不接送你、不照顾你生病，这种男人根本不值得托付。"
                   "这些基本的事都做不到，还谈什么爱你？姐妹们要清醒一点，擦亮眼睛。",
        title="不做这三件事的男人不值得托付",
        author="情感博主",
        likes=200000,
    )


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: 运行手动测试**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
python scripts/test_diagnosis_manual.py
```

- [ ] **Step 3: 对照预期结果检查（来自 prompts/diagnosis_v1.md）**

| 用例 | 期望类型 | 期望评分范围 | 期望 needs_realtime_search |
|---|---|---|---|
| 焦虑贩卖型 | anxiety_selling | 75-90 | false |
| 信息差收割型 | info_gap_harvesting | 80+ | true |
| 正常内容 | 任意 | 0-30 | false |
| 矛盾挑起型 | conflict_provoking | 50-70 | false |

- [ ] **Step 4: 根据实际输出调整 Prompt**

常见问题及调整方向：
- 评分偏高（正常内容 > 30）→ 在 SYSTEM 中增加更多"不应识别"的反例
- 不触发实时搜索 → 在 SYSTEM 中明确说明 info_gap_harvesting 必须触发的条件
- JSON 格式不稳定 → 在 SYSTEM 的输出格式说明中加粗"不要代码块"
- 类型识别错误 → 在 SYSTEM 中加强对应类型的识别特征描述

- [ ] **Step 5: 调整后重新运行直到四个用例结果符合预期**

反复运行 `python scripts/test_diagnosis_manual.py`，每次修改后确认所有用例结果。

- [ ] **Step 6: 运行自动化测试确认调整没破坏已有测试**

```bash
pytest tests/ -v
```

Expected: 全部 passed。

- [ ] **Step 7: Commit**

```bash
git add backend/prompts/diagnosis.py backend/scripts/test_diagnosis_manual.py
git commit -m "feat: tune diagnosis prompt, all 4 test cases pass quality check"
```

---

**Plan 02 完成标准：**
- [ ] `pytest tests/` 全部通过（含 ai_client 和 diagnosis 的测试）
- [ ] 手动测试4个用例，评分和类型符合预期
- [ ] 正常内容风险评分 < 30（不误判）
- [ ] 信息差收割型触发 `needs_realtime_search: true`
