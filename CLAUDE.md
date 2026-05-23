# 抖音内容识别器 — 项目交接文档

## 项目是什么

**抖音内容识别器**：帮助用户判断一条抖音视频的观点"对自己的具体情况是否成立"。

用户粘贴视频链接 → AI 诊断视频操控类型和风险等级 → 用户回答 3-5 个个性化问卷 → AI 生成专属分析报告。

**背景**：字节跳动黑客松（抖音AI创变者计划 Track 2），不急，慢慢做。

**GitHub**：https://github.com/zs20050309-dot/zhanggexinyan

---

## 技术栈

| 层 | 技术 | 端口 |
|---|---|---|
| Backend | FastAPI + Python 3.10.7 | 8000 |
| Frontend | Next.js 14 + TypeScript + Tailwind | 3000 |
| AI | Claude claude-sonnet-4-6（通过 OpenAI 兼容中转） | — |
| ASR | OpenAI Whisper API | — |
| 视频解析 | httpx CDN 直链解析（无 yt-dlp） | — |
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
│   ├── requirements.txt    # 依赖（无 yt-dlp，有 pytest）
│   ├── main.py             # FastAPI 入口，含 /health
│   ├── models/schemas.py   # 所有 Pydantic 模型
│   ├── routers/            # 路由层（video/diagnosis/questionnaire/report/search）
│   ├── services/           # 服务层（ai_client/asr/video_extractor/report_store/search_client）
│   ├── prompts/            # Claude prompt 构建（diagnosis/questionnaire/report）
│   ├── tests/              # pytest 测试（20个测试，全部通过）
│   └── scripts/            # 手动测试脚本（test_diagnosis_manual.py 等）
├── frontend/
│   ├── lib/types.ts        # TypeScript 类型定义
│   ├── lib/api.ts          # 后端 API 调用封装
│   ├── lib/constants.ts    # Demo 案例常量
│   ├── package.json
│   └── （app/ 目录尚未创建，见 plan-07 到 plan-10）
├── docs/
│   ├── tech_spec.md        # 完整技术规格（必读，含所有设计决策）
│   └── plans/              # plan-01 到 plan-10（详细开发计划）
└── CLAUDE.md               # 本文件
```

---

## 当前进度

### 已完成

| Plan | 内容 | 状态 |
|---|---|---|
| plan-01 | 后端环境：venv、依赖安装、pytest 框架、/health 测试 | ✅ 完成 |
| plan-02 Task 1-3 | AI 客户端测试、诊断 prompt 测试、诊断路由测试（全 mock）| ✅ 完成，20 tests passed |

```bash
# 当前测试状态验证
cd backend && .venv/bin/pytest tests/ -v
# 结果：20 passed in 0.03s
```

### 待完成（按顺序）

| Plan | 内容 |
|---|---|
| **plan-02 Task 4** | **用真实 API 跑手动诊断测试，验证 prompt 质量** ← 下一步 |
| plan-03 | CDN 视频解析验证 + ASR 测试 + Demo JSON 缓存 |
| plan-04 | 问卷模块 TDD |
| plan-05 | 报告生成 + SSE 流式 TDD |
| plan-06 | Tavily 搜索（加分项，低优先级） |
| plan-07 | 前端安装 + 首页 |
| plan-08 | 前端诊断结果页 |
| plan-09 | 前端问卷页 |
| plan-10 | 前端报告页 + 分享页 |

---

## 当前阻塞项（必读）

### AI 客户端需要改造

用户使用的是 **OpenAI 兼容格式的中转 API**（不是官方 Anthropic API），目前 `services/ai_client.py` 用的是 Anthropic SDK，需要改成 **OpenAI SDK + 自定义 base_url**。

**待确认信息**（需要问用户）：
1. 中转 API 的正确 base_url 是什么？（例如 `https://api.xxx.com/v1`）
2. 中转 API 用来调用 Claude 的模型名是什么？（例如 `claude-sonnet-4-6` 或 `claude-3-5-sonnet-20241022`）

**改造方向**（OpenAI SDK 调用 Claude）：

```python
# ai_client.py 改造示意
from openai import AsyncOpenAI

def get_client():
    return AsyncOpenAI(
        api_key=os.environ["ANTHROPIC_API_KEY"],   # 中转平台的 key
        base_url=os.environ["ANTHROPIC_BASE_URL"],  # 中转平台的 API 地址
    )

# 调用时用 client.chat.completions.create()
# system prompt 放进 messages 的 system role
# model 名改为中转支持的 Claude 模型名
```

`stream_claude` 也要一并改造（用 `client.chat.completions.create(stream=True)`）。

**注意**：改造后所有 mock 测试仍然有效（patch 路径不变），只需更新 `get_client` 内部实现。

---

## 开发规范（Superpowers TDD）

1. **写测试先于实现**：先写失败测试（RED），看到 FAIL，再实现（GREEN）
2. **每个 Task 独立 commit**：完成即提交，不积攒
3. **完成标准**：必须运行验证命令看到 passed，不靠推断
4. **不能跳计划顺序**：plan 必须按 01→10 顺序推进

---

## 本地运行方式

```bash
# 后端启动
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# 运行所有测试
.venv/bin/pytest tests/ -v

# 前端启动（需先 plan-07 完成后执行 npm install）
cd frontend
npm run dev
```

---

## 关键设计决策（勿改动方向）

- **视频解析**：CDN 直链解析（移动端 UA + iesdouyin API），不用 yt-dlp
- **可获取的视频元数据**：点赞/播放/评论/分享数、粉丝数、是否开通小店（with_shop_entry）、商业化等级（commerce_level 0-5）、认证标签（custom_verify）、是否广告（is_ad）
- **这些元数据已注入诊断 prompt**，让 AI 判断商业意图时有客观信号，不靠猜
- **报告用 SSE 流式输出**（plan-05/10）
- **Demo 三个案例**：全部预缓存为静态 JSON，不依赖实时 API，确保演示稳定
- **报告存储**：内存 dict + 8位 UUID，不用数据库
- **前端状态管理**：sessionStorage 在页面间传递数据

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
| `docs/tech_spec.md` | 完整技术规格，所有 API 接口定义和数据模型 |
| `docs/plans/plan-NN.md` | 每个 plan 的详细步骤和验收标准 |
| `backend/models/schemas.py` | 所有 Pydantic 数据模型（VideoContent 含元数据字段）|
| `backend/services/ai_client.py` | Claude 调用层（**当前需要改造**） |
| `backend/services/video_extractor.py` | CDN 解析实现（已完成，待 plan-03 验证）|
| `backend/prompts/diagnosis.py` | 诊断 prompt（含元数据注入逻辑）|
| `frontend/lib/types.ts` | 前端 TypeScript 类型（与 schemas.py 同步）|
| `frontend/lib/api.ts` | 前端 API 调用封装（SSE 流式逻辑在此）|
