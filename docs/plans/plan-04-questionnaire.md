# Plan 04: 动态问卷模块

> **执行方式：** TDD——先写测试，看到失败，再实现，看到通过。

**Goal:** 实现根据诊断结果动态生成3-5个问题的问卷接口，包含兜底问题集（当 Claude 生成失败时使用），确保问卷功能在任何情况下都能正常运行。

**Architecture:** `routers/questionnaire.py` 接收诊断结果 → `prompts/questionnaire.py` 构建 prompt → `services/ai_client.py` 调用 Claude → 解析 JSON 数组 → 返回 `QuestionnaireGenerateResponse`。兜底时直接返回预设的 `FALLBACK_QUESTIONS`。

**Tech Stack:** FastAPI TestClient, pytest, unittest.mock

---

### Task 1：测试问卷 Prompt 构建函数

**Files:**
- Create: `backend/tests/test_questionnaire_prompt.py`
- Verify: `backend/prompts/questionnaire.py`（已存在）

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_questionnaire_prompt.py`：

```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from prompts.questionnaire import build_user_prompt, SYSTEM
from models.schemas import DiagnosisResult


def _make_diagnosis(content_type: str, risk_score: int = 72) -> DiagnosisResult:
    """测试用辅助函数：快速构造 DiagnosisResult"""
    return DiagnosisResult(
        video_id="test-id",
        types=[content_type],
        types_display={"anxiety_selling": "焦虑贩卖型", "info_gap_harvesting": "信息差收割型",
                       "conflict_provoking": "矛盾挑起型", "pseudo_science_ad": "伪科普软广型"}[content_type:content_type],
        risk_score=risk_score,
        risk_level="high",
        core_issue="核心问题描述",
        missing_premises=["前提1", "前提2"],
        needs_realtime_search=False,
    )


def _make_diagnosis_simple(content_type: str, risk_score: int = 72) -> DiagnosisResult:
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
    """系统 Prompt 必须说明问题数量限制"""
    assert "3" in SYSTEM and "5" in SYSTEM  # 3-5个问题


def test_system_prompt_contains_choice_type():
    """系统 Prompt 必须说明选择题格式"""
    assert "choice" in SYSTEM or "选择题" in SYSTEM


def test_system_prompt_contains_privacy_constraint():
    """系统 Prompt 必须有不问隐私信息的约束"""
    assert "隐私" in SYSTEM or "敏感" in SYSTEM


def test_build_user_prompt_includes_content_type():
    """用户 Prompt 必须包含内容类型"""
    diagnosis = _make_diagnosis_simple("anxiety_selling")
    prompt = build_user_prompt(diagnosis)
    assert "焦虑贩卖型" in prompt


def test_build_user_prompt_includes_core_issue():
    """用户 Prompt 必须包含核心问题描述"""
    diagnosis = _make_diagnosis_simple("info_gap_harvesting")
    diagnosis.core_issue = "视频夸大了AI的影响范围"
    prompt = build_user_prompt(diagnosis)
    assert "视频夸大了AI的影响范围" in prompt


def test_build_user_prompt_includes_missing_premises():
    """用户 Prompt 必须包含缺失的前提条件"""
    diagnosis = _make_diagnosis_simple("anxiety_selling")
    diagnosis.missing_premises = ["专业方向", "个人规划"]
    prompt = build_user_prompt(diagnosis)
    assert "专业方向" in prompt
    assert "个人规划" in prompt
```

- [ ] **Step 2: 运行测试，看失败**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
pytest tests/test_questionnaire_prompt.py -v
```

- [ ] **Step 3: 修复 prompts/questionnaire.py 直到通过**

重点检查：
- `SYSTEM` 常量中是否有 "3-5" 或明确的数量限制
- `build_user_prompt` 函数是否使用了 `diagnosis.core_issue` 和 `diagnosis.missing_premises`

- [ ] **Step 4: 运行所有测试确认未退步**

```bash
pytest tests/ -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_questionnaire_prompt.py
git commit -m "test: add questionnaire prompt unit tests"
```

---

### Task 2：测试问卷生成路由

**Files:**
- Create: `backend/tests/test_questionnaire_router.py`
- Verify: `backend/routers/questionnaire.py`（已存在）

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_questionnaire_router.py`：

```python
import pytest
from unittest.mock import patch, AsyncMock
import sys, os
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

    # 不应返回 500，而是返回兜底问题
    assert response.status_code == 200
    data = response.json()
    assert "questions" in data
    assert len(data["questions"]) >= 3  # 兜底问题至少 3 个


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
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
pytest tests/test_questionnaire_router.py -v
```

- [ ] **Step 3: 修复 routers/questionnaire.py 直到测试通过**

检查重点：
1. `call_claude` 的 patch 路径是 `routers.questionnaire.call_claude`，确认 import 一致
2. 兜底逻辑：`except Exception: questions = FALLBACK_QUESTIONS`（已存在）
3. `FALLBACK_QUESTIONS` 是否有正确的 `options: None` 字段（`type: text` 的问题）

- [ ] **Step 4: 确认所有测试通过**

```bash
pytest tests/ -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_questionnaire_router.py
git commit -m "test: add questionnaire router tests covering normal and fallback paths"
```

---

### Task 3：用真实 Claude API 调试问卷 Prompt

**Files:**
- Create: `backend/scripts/test_questionnaire_manual.py`
- Possibly modify: `backend/prompts/questionnaire.py`

- [ ] **Step 1: 创建手动测试脚本**

创建 `backend/scripts/test_questionnaire_manual.py`：

```python
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

import sys
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
    print(f"测试用例：{name} ({diagnosis.types_display})")
    print(f"{'='*60}")

    user_prompt = build_user_prompt(diagnosis)
    result = await call_claude(system=SYSTEM, user=user_prompt, max_tokens=1024, expect_json=True)

    if isinstance(result, list):
        print(f"生成了 {len(result)} 个问题：")
        for i, q in enumerate(result, 1):
            print(f"\n  Q{i}: {q.get('text')}")
            print(f"  类型: {q.get('type')}")
            if q.get('options'):
                print(f"  选项: {q.get('options')}")
    else:
        print(f"❌ 返回格式异常: {result}")


async def main():
    await test_questionnaire(
        "焦虑贩卖型（大三实习）",
        make_diagnosis(
            ["anxiety_selling"], ["焦虑贩卖型"],
            "视频用'大三'时间节点制造普遍焦虑，省略专业方向等前提",
            ["专业方向", "个人规划（考研/就业/出国）", "已有经验积累"],
        )
    )

    await test_questionnaire(
        "信息差收割型（AI设计师）",
        make_diagnosis(
            ["info_gap_harvesting"], ["信息差收割型"],
            "视频以image2为锚点，将影响夸大为对所有设计师的全面冲击",
            ["受影响的设计类型", "时效性是否成立", "课程价值是否真实"],
        )
    )

    await test_questionnaire(
        "矛盾挑起型",
        make_diagnosis(
            ["conflict_provoking"], ["矛盾挑起型"],
            "视频通过绝对化群体评判制造对立情绪",
            ["情境是否普适", "是否代表所有人"],
        )
    )

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: 运行手动测试**

```bash
python scripts/test_questionnaire_manual.py
```

- [ ] **Step 3: 检查问题质量**

每个案例检查：
- [ ] 问题数量在 3-5 个范围内
- [ ] 选择题占大多数（至少 2/3）
- [ ] 问题与内容类型强相关（不是通用问题）
- [ ] 没有问隐私敏感信息
- [ ] 语气口语化

- [ ] **Step 4: 根据输出调整 prompts/questionnaire.py**

常见问题：
- 生成超过 5 个问题 → 在 SYSTEM 中加硬限制："总共不超过5个"，并举例
- 问题太通用 → 在 SYSTEM 中针对每种类型的重点提问方向更具体
- 格式不是 JSON 数组 → 在输出格式说明中强调"直接输出 JSON 数组，第一个字符是 ["

- [ ] **Step 5: 调整后重新运行直到质量满意**

- [ ] **Step 6: 运行自动化测试确认没有退步**

```bash
pytest tests/ -v
```

- [ ] **Step 7: Commit**

```bash
git add backend/prompts/questionnaire.py backend/scripts/test_questionnaire_manual.py
git commit -m "feat: tune questionnaire prompt, quality verified for 3 content types"
```

---

**Plan 04 完成标准：**
- [ ] `pytest tests/test_questionnaire_router.py -v` 全部通过（含兜底场景）
- [ ] 手动测试三种类型的问题质量满足标准
- [ ] `pytest tests/ -v` 全部通过
