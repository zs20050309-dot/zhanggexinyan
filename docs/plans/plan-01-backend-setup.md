# Plan 01: Backend 环境搭建与健康检查

> **执行方式：** 逐步手动执行，每步验证后再进行下一步。

**Goal:** 确保后端服务能在本地启动，所有依赖安装正确，API 基础框架可以接收请求。

**Architecture:** FastAPI 应用运行在 localhost:8000，通过 `.env` 文件管理 API Keys，使用 uvicorn 启动。

**Tech Stack:** Python 3.11+, FastAPI, uvicorn, python-dotenv

---

### Task 1：创建 Python 虚拟环境并安装依赖

**Files:**
- Create: `backend/.venv/`（虚拟环境，不提交）
- Create: `backend/.gitignore`

- [ ] **Step 1: 检查 Python 版本**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
python3 --version
```

Expected: `Python 3.11.x` 或更高。低于 3.10 需要升级。

- [ ] **Step 2: 创建虚拟环境**

```bash
python3 -m venv .venv
```

Expected: 无报错，`.venv/` 目录出现在 backend/ 下。

- [ ] **Step 3: 激活虚拟环境**

```bash
source .venv/bin/activate
```

Expected: 命令行提示符前出现 `(.venv)`。

- [ ] **Step 4: 安装依赖**

```bash
pip install -r requirements.txt
```

Expected: 所有包安装完成，无 ERROR 行。最后几行形如：
```
Successfully installed anthropic-0.36.0 fastapi-0.115.0 ...
```

- [ ] **Step 5: 创建 backend/.gitignore**

内容：
```
.venv/
__pycache__/
*.pyc
.env
/tmp/
```

- [ ] **Step 6: 确认 .venv 未被 git 追踪**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon
git status backend/
```

Expected: `.venv/` 不出现在 untracked files 列表中（如果出现，检查 .gitignore 是否生效）。

---

### Task 2：配置环境变量

**Files:**
- Create: `backend/.env`（不提交，内容参考 `.env.example`）

- [ ] **Step 1: 复制模板**

```bash
cp backend/.env.example backend/.env
```

- [ ] **Step 2: 填入真实 API Keys**

打开 `backend/.env`，将占位符替换为真实 key：
```
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxx
OPENAI_API_KEY=sk-proj-xxxxxxxx
TAVILY_API_KEY=tvly-xxxxxxxx
```

如暂时没有 TAVILY_API_KEY，可先留空，搜索模块后续单独处理。

- [ ] **Step 3: 验证文件内容格式正确**

```bash
cat backend/.env
```

Expected: 三行 KEY=VALUE 格式，无空格，无引号问题。

---

### Task 3：验证 FastAPI 应用启动

**Files:**
- Verify: `backend/main.py`（已存在，不修改）

- [ ] **Step 1: 确认在 backend/ 目录且虚拟环境已激活**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
echo $VIRTUAL_ENV
```

Expected: 输出包含 `.venv` 的路径。若为空，重新运行 `source .venv/bin/activate`。

- [ ] **Step 2: 启动服务**

```bash
uvicorn main:app --reload --port 8000
```

Expected:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxxx] using WatchFiles
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

若出现 `ImportError`，说明某个依赖安装有问题，回到 Task 1 Step 4。

- [ ] **Step 3: 另开终端，验证健康检查接口**

```bash
curl http://localhost:8000/health
```

Expected:
```json
{"status":"ok"}
```

- [ ] **Step 4: 验证 API 文档可访问**

浏览器打开 `http://localhost:8000/docs`

Expected: FastAPI 自动生成的 Swagger UI 页面，显示所有路由（/api/video/extract, /api/diagnosis 等）。

- [ ] **Step 5: 回到启动终端，按 Ctrl+C 停止服务**

Expected: 服务正常停止，无残留进程。

---

### Task 4：安装测试框架

**Files:**
- Modify: `backend/requirements.txt`（添加测试依赖）
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: 向 requirements.txt 追加测试依赖**

在 `backend/requirements.txt` 末尾添加：
```
pytest==8.3.3
pytest-asyncio==0.24.0
httpx==0.27.2
```

注意：httpx 已在文件中，不要重复添加。

- [ ] **Step 2: 安装新增依赖**

```bash
pip install pytest pytest-asyncio
```

Expected: 安装成功，无报错。

- [ ] **Step 3: 创建 backend/tests/__init__.py**

内容：空文件（0字节）。

- [ ] **Step 4: 创建 backend/tests/conftest.py**

```python
import pytest
from fastapi.testclient import TestClient
import sys
import os

# 确保 backend/ 目录在 Python 路径中
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app


@pytest.fixture
def client():
    return TestClient(app)
```

- [ ] **Step 5: 创建首个健康检查测试 backend/tests/test_health.py**

```python
def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 6: 运行测试，确认通过**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/backend
pytest tests/test_health.py -v
```

Expected:
```
PASSED tests/test_health.py::test_health_check
1 passed in 0.xxs
```

---

**Plan 01 完成标准：**
- [ ] `uvicorn main:app --reload --port 8000` 启动无报错
- [ ] `curl http://localhost:8000/health` 返回 `{"status":"ok"}`
- [ ] `pytest tests/test_health.py -v` 显示 1 passed
