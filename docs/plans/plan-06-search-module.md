# Plan 06: 实时搜索模块

> **执行方式：** TDD，此模块为加分项，优先级低于 Plan 01-05，有时间再做。

**Goal:** 实现 Tavily 实时搜索接口，为"信息差收割型"内容提供时效性核实。搜索失败时不影响报告生成（兜底为 null）。

**Architecture:** `routers/search.py` → `services/search_client.py`（Tavily）→ 返回 `SearchResult`。

**Tech Stack:** Tavily API, FastAPI TestClient, pytest, unittest.mock

---

### Task 1：测试搜索路由（含兜底）

**Files:**
- Create: `backend/tests/test_search_router.py`
- Verify: `backend/routers/search.py`（已存在）
- Verify: `backend/services/search_client.py`（已存在）

- [ ] **Step 1: 写失败测试**

创建 `backend/tests/test_search_router.py`：

```python
import pytest
from unittest.mock import patch, AsyncMock
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models.schemas import SearchResult


MOCK_SEARCH_RESULT = SearchResult(
    summary="image2于2025年发布，对批量执行类设计工作影响较大，但创意类设计师影响有限",
    sources=["TechCrunch报道", "设计师行业报告2025", "Adobe官方声明"],
    retrieved_at="2025-05-23T10:00:00Z",
)


def test_search_returns_result(client):
    """搜索接口正常时应返回搜索结果"""
    with patch("routers.search.search", new_callable=AsyncMock) as mock_search:
        mock_search.return_value = MOCK_SEARCH_RESULT

        response = client.post("/api/search", json={
            "query": "image2 AI设计师失业影响范围 2025",
            "context": "视频声称image2发布后设计师将全面失业",
        })

    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "sources" in data
    assert "retrieved_at" in data
    assert len(data["summary"]) > 0


def test_search_returns_503_when_unavailable(client):
    """Tavily 不可用时应返回 503 而不是 500"""
    with patch("routers.search.search", new_callable=AsyncMock) as mock_search:
        mock_search.return_value = None  # search_client 返回 None 表示失败

        response = client.post("/api/search", json={
            "query": "测试查询",
            "context": "测试上下文",
        })

    assert response.status_code == 503
    data = response.json()
    assert data["code"] == "SEARCH_UNAVAILABLE"


def test_search_result_has_valid_sources(client):
    """搜索结果的 sources 应是字符串列表"""
    with patch("routers.search.search", new_callable=AsyncMock) as mock_search:
        mock_search.return_value = MOCK_SEARCH_RESULT

        response = client.post("/api/search", json={
            "query": "查询词",
            "context": "上下文",
        })

    data = response.json()
    assert isinstance(data["sources"], list)
    for source in data["sources"]:
        assert isinstance(source, str)
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
pytest tests/test_search_router.py -v
```

- [ ] **Step 3: 修复 routers/search.py 直到测试通过**

检查 patch 路径：`routers.search.search`，对应 `from services.search_client import search`。

- [ ] **Step 4: 确认所有测试通过**

```bash
pytest tests/ -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_search_router.py
git commit -m "test: add search router tests covering normal and unavailable paths"
```

---

### Task 2：手动验证 Tavily API（可选）

> 仅在 TAVILY_API_KEY 已配置时执行。

**Files:**
- Create: `backend/scripts/test_search_manual.py`

- [ ] **Step 1: 创建手动测试脚本**

创建 `backend/scripts/test_search_manual.py`：

```python
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.search_client import search


async def main():
    if not os.environ.get("TAVILY_API_KEY"):
        print("❌ TAVILY_API_KEY 未配置，跳过测试")
        return

    print("测试搜索：image2 AI设计师影响")
    result = await search(
        query="image2 Stability AI 2025年发布 设计师影响",
        context="视频声称image2让设计师全面失业",
    )

    if result:
        print(f"\n✅ 搜索成功")
        print(f"摘要: {result.summary}")
        print(f"来源: {result.sources}")
    else:
        print("\n❌ 搜索失败，Tavily API 可能不可用")

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: 运行测试**

```bash
python scripts/test_search_manual.py
```

- [ ] **Step 3: 如果搜索失败，确认降级方案工作正常**

在报告生成时，`search_result=None` 时报告应跳过"事实核查"章节，而不是报错。验证方式：将 `plan-05` 的 curl 测试中加入 `"search_result": null` 确认正常。

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/test_search_manual.py
git commit -m "test: add Tavily manual test script"
```

---

**Plan 06 完成标准：**
- [ ] `pytest tests/test_search_router.py -v` 全部通过
- [ ] `pytest tests/ -v` 全部通过
- [ ] Tavily API 可用时，手动测试返回有效摘要（或确认降级方案工作）
