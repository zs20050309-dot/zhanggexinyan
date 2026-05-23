# Plan 05: 报告生成与存储

> **执行方式：** TDD——先写测试，看到失败，再实现，看到通过。

**Goal:** 实现流式生成个性化分析报告（SSE）并将报告存储供分享访问。报告质量是产品核心价值，Prompt 必须通过质量检验。

**Architecture:** `routers/report.py` 接收完整上下文 → `prompts/report.py` 构建 prompt → `services/ai_client.py` stream_claude 流式输出 → SSE 推送给前端，同时收集完整内容 → `services/report_store.py` 存储 → 返回 report_id。

**Tech Stack:** FastAPI StreamingResponse, pytest, unittest.mock, SSE (text/event-stream)

---

### Task 1：测试报告存储服务

**Files:**
- Create: `backend/tests/test_report_store.py`
- Verify: `backend/services/report_store.py`（已存在）

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_report_store.py`：

```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def test_save_report_returns_string_id():
    """save_report 应返回字符串类型的 report_id"""
    # 每次测试重置存储（通过重新导入）
    import importlib
    import services.report_store as store
    importlib.reload(store)

    report_id = store.save_report(
        content="## 视频内容解析\n\n这是报告内容",
        video_title="大三不找实习就废了",
        diagnosis_types=["anxiety_selling"],
    )

    assert isinstance(report_id, str)
    assert len(report_id) > 0


def test_save_report_id_is_short():
    """report_id 应足够短，方便分享（不超过 12 个字符）"""
    import importlib
    import services.report_store as store
    importlib.reload(store)

    report_id = store.save_report(
        content="内容",
        video_title="标题",
        diagnosis_types=["anxiety_selling"],
    )

    assert len(report_id) <= 12


def test_get_report_returns_saved_content():
    """get_report 应能取回 save_report 保存的内容"""
    import importlib
    import services.report_store as store
    importlib.reload(store)

    content = "## 报告\n\n个性化分析内容"
    title = "测试视频标题"
    types = ["info_gap_harvesting"]

    report_id = store.save_report(content=content, video_title=title, diagnosis_types=types)
    result = store.get_report(report_id)

    assert result is not None
    assert result.content == content
    assert result.video_title == title
    assert result.diagnosis_types == types
    assert result.report_id == report_id


def test_get_report_returns_none_for_unknown_id():
    """get_report 对不存在的 ID 应返回 None"""
    import services.report_store as store

    result = store.get_report("nonexistent-id-12345")
    assert result is None


def test_each_save_generates_unique_id():
    """每次保存应生成唯一 ID"""
    import importlib
    import services.report_store as store
    importlib.reload(store)

    ids = {store.save_report("内容", "标题", ["anxiety_selling"]) for _ in range(10)}
    assert len(ids) == 10  # 10次保存，10个不同ID
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
pytest tests/test_report_store.py -v
```

- [ ] **Step 3: 修复 services/report_store.py 直到测试通过**

当前 `report_store.py` 使用 `str(uuid.uuid4())[:8]` 生成 8 字符 ID，符合 `len <= 12` 的要求，应该直接通过。

如果 `test_save_report_id_is_short` 失败，检查 UUID 截取逻辑。

- [ ] **Step 4: 确认测试通过**

```bash
pytest tests/test_report_store.py -v
```

Expected: 5 passed。

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_report_store.py
git commit -m "test: add report_store unit tests"
```

---

### Task 2：测试报告 GET 接口

**Files:**
- Create: `backend/tests/test_report_router.py`

- [ ] **Step 1: 写测试**

创建 `backend/tests/test_report_router.py`：

```python
import pytest
from unittest.mock import patch
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models.schemas import SavedReport
from datetime import datetime, timezone


MOCK_SAVED_REPORT = SavedReport(
    report_id="abc12345",
    content="## 视频内容解析\n\n这是完整的报告内容\n\n## 对你而言",
    video_title="大三不找实习就废了",
    diagnosis_types=["anxiety_selling"],
    created_at=datetime.now(timezone.utc).isoformat(),
)


def test_get_report_returns_saved_report(client):
    """GET /api/report/{id} 应返回存储的报告"""
    with patch("routers.report.get_report") as mock_get:
        mock_get.return_value = MOCK_SAVED_REPORT

        response = client.get("/api/report/abc12345")

    assert response.status_code == 200
    data = response.json()
    assert data["report_id"] == "abc12345"
    assert data["video_title"] == "大三不找实习就废了"
    assert "## 视频内容解析" in data["content"]
    assert data["diagnosis_types"] == ["anxiety_selling"]


def test_get_report_returns_404_for_unknown_id(client):
    """不存在的 report_id 应返回 404"""
    with patch("routers.report.get_report") as mock_get:
        mock_get.return_value = None

        response = client.get("/api/report/nonexistent")

    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "REPORT_NOT_FOUND"
    assert "error" in data
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
pytest tests/test_report_router.py -v
```

- [ ] **Step 3: 检查 routers/report.py 中 GET 接口是否正确**

当前 `routers/report.py` 的 `get` 函数应该有：
```python
@router.get("/{report_id}")
async def get(report_id: str):
    report = get_report(report_id)
    if report is None:
        return JSONResponse(
            status_code=404,
            content={"error": "报告不存在或已过期", "code": "REPORT_NOT_FOUND"},
        )
    return report
```

patch 路径是 `routers.report.get_report`，确认与 import 一致。

- [ ] **Step 4: 确认测试通过**

```bash
pytest tests/test_report_router.py -v
```

- [ ] **Step 5: 运行所有测试**

```bash
pytest tests/ -v
```

- [ ] **Step 6: Commit**

```bash
git add backend/tests/test_report_router.py
git commit -m "test: add report GET router tests"
```

---

### Task 3：测试报告 Prompt 构建函数

**Files:**
- Create: `backend/tests/test_report_prompt.py`
- Verify: `backend/prompts/report.py`（已存在）

- [ ] **Step 1: 写测试**

创建 `backend/tests/test_report_prompt.py`：

```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from prompts.report import build_user_prompt, SYSTEM
from models.schemas import DiagnosisResult, QAPair, SearchResult


def _make_diagnosis():
    return DiagnosisResult(
        video_id="test",
        types=["anxiety_selling"],
        types_display=["焦虑贩卖型"],
        risk_score=72,
        risk_level="high",
        core_issue="用时间节点制造焦虑",
        missing_premises=["专业方向", "个人规划"],
        needs_realtime_search=False,
    )


def test_system_prompt_forbids_vague_expressions():
    """系统 Prompt 必须明确禁止'大多数人'等模糊表述"""
    assert "大多数人" in SYSTEM or "模糊" in SYSTEM  # 提到这个禁止规则


def test_system_prompt_requires_four_sections():
    """系统 Prompt 必须要求四个章节结构"""
    assert "视频内容解析" in SYSTEM
    assert "对你而言" in SYSTEM
    assert "识别公式" in SYSTEM


def test_system_prompt_requires_personalization():
    """系统 Prompt 必须强调个性化约束"""
    assert "个性化" in SYSTEM or "具体背景" in SYSTEM or "用户的" in SYSTEM


def test_build_user_prompt_includes_transcript():
    """报告 Prompt 必须包含视频文字稿"""
    diagnosis = _make_diagnosis()
    prompt = build_user_prompt(
        transcript="这是视频转录内容",
        title="测试标题",
        author="测试账号",
        diagnosis=diagnosis,
        answers=[QAPair(question="问题1", answer="答案1")],
        search_result=None,
    )
    assert "这是视频转录内容" in prompt


def test_build_user_prompt_includes_user_answers():
    """报告 Prompt 必须包含用户的问卷回答"""
    diagnosis = _make_diagnosis()
    prompt = build_user_prompt(
        transcript="视频内容",
        title="标题",
        author="作者",
        diagnosis=diagnosis,
        answers=[
            QAPair(question="你是什么学历阶段？", answer="大三大四"),
            QAPair(question="目标方向是？", answer="考研"),
        ],
        search_result=None,
    )
    assert "大三大四" in prompt
    assert "考研" in prompt


def test_build_user_prompt_includes_search_result_when_present():
    """有搜索结果时，报告 Prompt 必须包含搜索信息"""
    diagnosis = _make_diagnosis()
    search = SearchResult(
        summary="image2对执行类设计影响较大，创意类影响有限",
        sources=["来源1", "来源2"],
        retrieved_at="2025-01-01T00:00:00Z",
    )
    prompt = build_user_prompt(
        transcript="视频内容",
        title="标题",
        author="作者",
        diagnosis=diagnosis,
        answers=[],
        search_result=search,
    )
    assert "image2对执行类设计影响较大" in prompt


def test_build_user_prompt_truncates_long_transcript():
    """超长文字稿应被截断"""
    diagnosis = _make_diagnosis()
    long_transcript = "测试" * 2000  # 超过 3000 字

    prompt = build_user_prompt(
        transcript=long_transcript,
        title="标题",
        author="作者",
        diagnosis=diagnosis,
        answers=[],
        search_result=None,
    )
    assert "中间内容省略" in prompt
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
pytest tests/test_report_prompt.py -v
```

- [ ] **Step 3: 修复 prompts/report.py 直到测试通过**

重点检查 `SYSTEM` 常量和 `build_user_prompt` 函数。

- [ ] **Step 4: 确认测试通过，所有测试未退步**

```bash
pytest tests/ -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_report_prompt.py
git commit -m "test: add report prompt unit tests"
```

---

### Task 4：验证 SSE 流式输出（手动测试）

**Files:**
- Create: `backend/scripts/test_report_stream_manual.py`

> SSE 流式输出不适合用 TestClient 自动化测试（TestClient 会等待全部完成）。
> 使用 curl 验证流式效果，使用脚本验证内容质量。

- [ ] **Step 1: 创建手动测试脚本**

创建 `backend/scripts/test_report_stream_manual.py`：

```python
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.ai_client import stream_claude
from prompts.report import SYSTEM, build_user_prompt
from models.schemas import DiagnosisResult, QAPair


async def main():
    diagnosis = DiagnosisResult(
        video_id="test",
        types=["anxiety_selling"],
        types_display=["焦虑贩卖型"],
        risk_score=82,
        risk_level="high",
        core_issue="视频用'大三'这个时间节点制造了普遍性焦虑，但完全没说明结论成立需要哪些前提",
        missing_premises=["专业方向", "个人规划（考研/就业/出国）", "已有经验积累"],
        emotional_manipulation="反复使用'废了''完了'等绝对化词汇",
        commercial_intent="主页有求职培训课程链接",
        needs_realtime_search=False,
    )

    answers = [
        QAPair(question="你现在是什么学历阶段？", answer="大三大四"),
        QAPair(question="你的目标方向是？", answer="考研/出国"),
        QAPair(question="你目前有实习或相关项目经验吗？", answer="有，但不多"),
        QAPair(question="看完这个视频，你当时第一反应是什么？", answer="有点担心，但又觉得和我的情况不完全一样"),
    ]

    user_prompt = build_user_prompt(
        transcript="现在这个就业环境，你都大三了还没找实习，基本上和毕业即失业没区别。"
                   "你知道你的竞争对手是谁吗？985院校的同学大一就开始实习了。"
                   "不要觉得大三还早，等你大四再投简历，HR一看你这段空白期直接pass掉。"
                   "现在私信我，我告诉你怎么在三个月内逆袭。",
        title="大三了还没实习？你已经输了",
        author="职场导师小明",
        diagnosis=diagnosis,
        answers=answers,
        search_result=None,
    )

    print("开始流式生成报告...\n")
    print("="*60)

    full_content = []
    async for chunk in stream_claude(system=SYSTEM, user=user_prompt, max_tokens=4096):
        print(chunk, end="", flush=True)
        full_content.append(chunk)

    report = "".join(full_content)

    print("\n" + "="*60)
    print("\n【质量检查】")
    checks = [
        ("包含'视频内容解析'章节", "视频内容解析" in report),
        ("包含'对你而言'章节", "对你而言" in report or "真实情况" in report),
        ("包含'识别公式'章节", "识别公式" in report),
        ("包含用户背景（考研）", "考研" in report),
        ("无'大多数人'等模糊表述", "大多数人" not in report),
        ("字数在合理范围", 400 < len(report) < 2000),
    ]

    for desc, passed in checks:
        status = "✅" if passed else "❌"
        print(f"  {status} {desc}")

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: 启动后端服务（另一个终端）**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
uvicorn main:app --reload --port 8000
```

- [ ] **Step 3: 运行手动测试脚本**

```bash
python scripts/test_report_stream_manual.py
```

- [ ] **Step 4: 对照质量检查项评估输出**

重点关注：
- "对你而言"章节是否引用了用户的具体回答（考研、有少量实习）
- 识别公式的三个问题是否针对焦虑贩卖型，而非通用废话
- 是否没有出现"大多数人""很多人"等模糊表述

- [ ] **Step 5: 根据结果调整 prompts/report.py 的 SYSTEM 或 build_user_prompt**

常见问题及修复：
- 个性化不足（没有引用"考研""少量实习"）→ 在 SYSTEM 个性化约束章节加更强的强制语气："每段必须引用用户的原话"
- 识别公式太通用 → 在 SYSTEM 中针对四种类型各提供一个识别公式的示例
- 字数超过 2000 → 在 SYSTEM 中加"总字数不超过 1200 字"
- 报告出现"您" → 在 SYSTEM 中加"用'你'不用'您'，如果出现'您'立刻重写"

- [ ] **Step 6: 测试 curl 流式效果**

```bash
curl -N -X POST http://localhost:8000/api/report/generate \
  -H "Content-Type: application/json" \
  -d '{
    "video_id": "test",
    "transcript": "你都大三了还不找实习就废了",
    "title": "大三不找实习就废了",
    "author": "职场导师",
    "diagnosis": {
      "video_id": "test",
      "types": ["anxiety_selling"],
      "types_display": ["焦虑贩卖型"],
      "risk_score": 72,
      "risk_level": "high",
      "core_issue": "用时间节点制造焦虑",
      "missing_premises": ["专业方向"],
      "needs_realtime_search": false
    },
    "answers": [
      {"question": "你的阶段？", "answer": "大三大四"},
      {"question": "目标方向？", "answer": "考研"}
    ]
  }'
```

Expected: 终端逐字打印 `data: {"type":"chunk","content":"..."}` 事件，最后出现 `data: {"type":"done","report_id":"xxxxxxxx"}`。

- [ ] **Step 7: Commit**

```bash
git add backend/prompts/report.py backend/scripts/test_report_stream_manual.py
git commit -m "feat: tune report prompt, streaming verified, quality checks pass"
```

---

**Plan 05 完成标准：**
- [ ] `pytest tests/test_report_store.py -v` 全部通过
- [ ] `pytest tests/test_report_router.py -v` 全部通过
- [ ] `pytest tests/test_report_prompt.py -v` 全部通过
- [ ] 手动测试：报告质量检查 6 项全部 ✅
- [ ] curl 测试：SSE 流式事件正常输出，最后返回 report_id
- [ ] `pytest tests/ -v` 全部通过
