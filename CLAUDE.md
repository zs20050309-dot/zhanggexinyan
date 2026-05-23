# 抖音内容识别器 — 项目交接文档

## 项目是什么

**抖音内容识别器**：帮助用户判断一条抖音视频的观点"对自己的具体情况是否成立"。

**背景**：字节跳动黑客松（抖音AI创变者计划 Track 2）。

**GitHub**：https://github.com/zs20050309-dot/zhanggexinyan

---

## 演示策略（已调整）

**策略变更（2026-05-23）**：放弃实时视频上传/CDN 解析/ASR 转录，改为纯预置数据 + AI 动态交互模式。

**新的演示流程：**
1. 首页展示 3 个预置视频卡片（点击选择）
2. 点击卡片 → 直接从 `frontend/public/demo/demo_X.json` 加载诊断结果（不调用后端）
3. 用户看完诊断 → 点击"开始个性化分析"→ 调用真实 AI 生成问卷（`/api/questionnaire/generate`）
4. 用户回答问题 → 调用真实 AI 流式生成报告（`/api/report/generate`，SSE）

**保留的 AI 能力（真实调用）：**
- 问卷动态生成（针对每种视频类型个性化）
- 报告 SSE 流式生成（根据用户回答个性化）

**弃用的功能（代码保留，Demo 不走）：**
- 视频链接上传 / CDN 解析 / ASR 转录（网络问题 + 时间不够）
- 实时诊断 AI 调用（Demo 走缓存）

---

## 技术栈

| 层 | 技术 | 端口 |
|---|---|---|
| Backend | FastAPI + Python 3.10.7 | 8000 |
| Frontend | Next.js 14 + TypeScript + Tailwind | 3000 |
| AI | claude-opus-4-6（Anthropic SDK + 中转 relay） | — |
| 搜索 | Tavily API（加分项，可选） | — |

---

## 项目结构

```
dyhackthon/
├── backend/
│   ├── .venv/              # Python 虚拟环境（已创建）
│   ├── .env                # API Keys（用户自己管理，不提交）
│   ├── .env.example        # Key 模板
│   ├── pytest.ini          # pytest 配置（asyncio_mode=auto）
│   ├── requirements.txt    # 依赖
│   ├── main.py             # FastAPI 入口，含 /health
│   ├── models/schemas.py   # 所有 Pydantic 模型
│   ├── routers/            # 路由层（video/diagnosis/questionnaire/report/search）
│   ├── services/           # 服务层（ai_client/report_store 等）
│   ├── prompts/            # Claude prompt 构建（diagnosis/questionnaire/report）
│   ├── tests/              # pytest 测试（38个测试，全部通过）
│   └── scripts/            # 手动测试脚本
├── frontend/
│   ├── public/demo/        # 3个 Demo 案例预缓存 JSON（demo_1/2/3.json）
│   ├── lib/types.ts        # TypeScript 类型定义
│   ├── lib/api.ts          # 后端 API 调用封装（SSE 流式逻辑在此）
│   ├── lib/constants.ts    # Demo 案例常量
│   ├── package.json
│   └── app/                # Next.js 页面（plan-07 之后创建）
├── docs/
│   └── plans/              # plan-01 到 plan-10（详细开发计划）
└── CLAUDE.md               # 本文件
```

---

## 当前进度

### 已完成

| Plan | 内容 | 状态 |
|---|---|---|
| plan-01 | 后端环境：venv、依赖安装、pytest 框架、/health 测试 | ✅ 完成 |
| plan-02 | AI 客户端、诊断 prompt、诊断路由（全 mock）+ 真实 API 手动验证 | ✅ 完成 |
| plan-03 | CDN 脚本、ASR 测试、视频路由测试、Demo JSON 缓存 | ✅ 完成 |
| plan-04 | 问卷 prompt 测试、路由测试（含兜底）、手动 API 质量验证 | ✅ 完成 |
| plan-05 | 报告 store/router/prompt 测试 + SSE 流式手动验证（52 tests passing） | ✅ 完成 |
| plan-07 | 前端完整实现：首页 + 诊断页 + 问卷页 + 报告 SSE 页 | ✅ 完成 |

```bash
# 后端测试状态
cd backend && .venv/bin/pytest tests/ -v
# 结果：52 passed in 0.06s

# 前端启动
cd frontend && npm run dev   # http://localhost:3000
```

### 待完成

| Plan | 内容 | 备注 |
|---|---|---|
| plan-06 | Tavily 搜索 | 加分项，低优先级，可跳过 |
| — | 端到端联调测试 | 同时启动前后端，走完完整 Demo 流程 |

---

## AI 客户端配置（已解决）

`services/ai_client.py` 使用 **Anthropic SDK + 中转 relay**，已正常工作。

```python
MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-4-6")

def get_client():
    kwargs = {"api_key": os.environ["ANTHROPIC_API_KEY"]}
    base_url = os.environ.get("ANTHROPIC_BASE_URL")
    if base_url:
        kwargs["base_url"] = base_url
    return anthropic.AsyncAnthropic(**kwargs)
```

**.env 需要配置的 key**：
```
ANTHROPIC_API_KEY=中转平台的key
ANTHROPIC_BASE_URL=中转平台的API地址
TAVILY_API_KEY=搜索用（可选）
```

**已验证**：claude-opus-4-6 在中转 relay 正常工作。诊断 4 案例（78/82/8/52分）、问卷 3 种类型均通过质量验证。

---

## 开发规范（Superpowers TDD）

1. **写测试先于实现**：先写失败测试（RED），看到 FAIL，再实现（GREEN）
2. **每个 Task 完成后 commit**：不积攒（不用每次都推 GitHub，多做几步再统一推）
3. **完成标准**：必须运行验证命令看到 passed，不靠推断

---

## 本地运行方式

```bash
# 后端启动
cd backend && source .venv/bin/activate
uvicorn main:app --reload --port 8000

# 运行所有测试
cd backend && .venv/bin/pytest tests/ -v

# 手动脚本（需要真实 API Key）
python scripts/test_diagnosis_manual.py
python scripts/test_questionnaire_manual.py
python scripts/test_report_stream_manual.py  # plan-05 完成后可用

# 前端启动（plan-07 完成后）
cd frontend && npm run dev
```

---

## 预置 Demo 数据说明

3 个 Demo JSON 文件在 `frontend/public/demo/`，每个包含：

```json
{
  "videoContent": { "video_id": "demo_X", "transcript": "...", ... },
  "diagnosis":    { "types": [...], "risk_score": ..., ... },
  "questions":    [ ... ]   // 参考问题，实际演示时由 AI 实时生成
}
```

**前端直接 `fetch('/demo/demo_X.json')` 加载，不走后端**。

| Demo | 类型 | 风险分 |
|---|---|---|
| demo_1 | 焦虑贩卖型（大三实习） | 82分 high |
| demo_2 | 信息差收割型（AI设计师）+ 焦虑贩卖型 | 88分 critical |
| demo_3 | 伪科普软广型（护肤） | 79分 high |

---

## 四种内容类型（核心产品概念）

| 类型 | 英文 key | 描述 |
|---|---|---|
| 焦虑贩卖型 | `anxiety_selling` | 省略关键前提 + 绝对化表述 + 恐惧驱动行动 |
| 矛盾挑起型 | `conflict_provoking` | 绝对化群体评判 + 非此即彼 + 愤怒获取流量 |
| 信息差收割型 | `info_gap_harvesting` | 真实事件锚点 + 夸大影响 + FOMO + 付费出口 |
| 伪科普软广型 | `pseudo_science_ad` | 权威话术包装 + 隐性商业目的 + 制造信任感 |

---

## 重要文件速查

| 文件 | 用途 |
|---|---|
| `backend/models/schemas.py` | 所有 Pydantic 数据模型 |
| `backend/services/ai_client.py` | Claude 调用层（已正常工作）|
| `backend/prompts/diagnosis.py` | 诊断 prompt |
| `backend/prompts/questionnaire.py` | 问卷 prompt（已质量验证）|
| `backend/prompts/report.py` | 报告 prompt |
| `backend/services/report_store.py` | 内存报告存储 |
| `frontend/public/demo/` | 3个 Demo 预缓存 JSON |
| `frontend/lib/api.ts` | 前端 API 调用封装（SSE 流式逻辑在此）|
| `frontend/lib/types.ts` | 前端 TypeScript 类型 |
