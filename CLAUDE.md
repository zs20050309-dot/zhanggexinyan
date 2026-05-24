# 抖音内容识别器 — 项目交接文档

## 项目是什么

**抖音内容识别器**：帮助用户判断一条抖音视频的观点"对自己的具体情况是否成立"。

**背景**：字节跳动黑客松（抖音AI创变者计划 Track 2）。

**GitHub**：https://github.com/zs20050309-dot/zhanggexinyan

---

## 演示策略

支持**两条平行路径**，演示时可自由切换：

### A. Demo 卡片路径（最稳，离线兜底）
1. 首页展示 3 个预置视频卡片（点击选择）
2. 直接从 `frontend/public/demo/demo_X.json` 加载视频内容 + 诊断结果（不调后端）
3. 点击"开始个性化分析" → 调真实 AI 生成问卷（`/api/questionnaire/generate`）
4. 答完 → 调真实 AI 流式生成报告（`/api/report/generate`，SSE）

### B. 真实 URL 路径（关 VPN 时全功能）
1. 首页粘贴抖音分享链接 → `/api/video/extract`
2. 后端流程：清洗 URL → aweme_id（直连 → 镜像 API 兜底）→ 元数据（直连 → xingzhige 兜底）→ ASR Whisper 转录（失败降级到标题+话题）
3. → `/api/diagnosis`（真实 AI 诊断）→ 问卷 → 报告（同路径 A）

**网络环境对路径 B 的影响**：

| 环境 | aweme_id | 元数据 | ASR 字幕 | 总耗时 |
|---|---|---|---|---|
| 开 VPN（出境 IP） | 镜像 API ✅ | xingzhige ✅ | ❌ 抖音 CDN 不通，降级用 title+hashtags | ~14s |
| 关 VPN（国内 IP） | 直连 ✅ | 直连 iesdouyin ✅ | ✅ Whisper 转录 80-150 字 | ~12s |

VPN 下 transcript 是 ~50 字的 subtitle 兜底（来自 fallback API 的 title+hashtags），AI 仍能正确分类但会显式声明信息有限。前端 analyze 页会显示 `ℹ 当前分析基于视频标题与话题标签` 提示。

---

## 技术栈

| 层 | 技术 | 端口 |
|---|---|---|
| Backend | FastAPI + Python 3.10.7 | 8000 |
| Frontend | Next.js 14 + TypeScript + Tailwind | 3000 |
| AI（诊断/问卷/报告） | claude-opus-4-6（Anthropic SDK + 中转 relay） | — |
| ASR（视频转字幕） | OpenAI Whisper-1（同一个中转 relay 复用 key） | — |
| 搜索 | Tavily API（加分项，可选） | — |

**前后端通信**：浏览器走 `/api/*` 相对路径 → Next.js dev server `rewrite` 反代到 `127.0.0.1:8000`。这样浏览器完全不直连 `localhost:8000`，**绕开 Clash/FlClash TUN 模式对本地端口的劫持**。配置在 `frontend/next.config.js`。

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
│   ├── services/asr.py     # Whisper 转录（OPENAI_BASE_URL 中转兼容）
│   ├── services/video_extractor.py  # URL 解析全链路（直连优先 + API 兜底 + 短路缓存）
│   ├── tests/              # pytest 测试（78 个测试，全部通过）
│   └── scripts/            # 手动测试脚本（含 test_asr_manual.py）
├── frontend/
│   ├── public/demo/        # 3 个 Demo 案例预缓存 JSON（demo_1/2/3.json）
│   ├── public/images/      # 3 张 Unsplash 案例配图（demo_1/2/3.jpg）
│   ├── components/         # 共享组件：Logo.tsx / Navbar.tsx
│   ├── lib/types.ts        # TypeScript 类型定义
│   ├── lib/api.ts          # 后端 API 调用封装（SSE 流式逻辑在此）
│   ├── lib/constants.ts    # Demo 案例常量
│   ├── lib/demoReports.ts  # 3 份预置 markdown 报告（演示兜底）
│   ├── package.json
│   └── app/                # Next.js 页面：/、/analyze/[id]、/chat/[id]、/report、/share/[id]
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
| plan-05 | 报告 store/router/prompt 测试 + SSE 流式手动验证 | ✅ 完成 |
| plan-07 | 前端完整实现：首页 + 诊断页 + 问卷页 + 报告 SSE 页 | ✅ 完成 |
| design | 前端全页面视觉重构：动画/高斯模糊导航栏/SVG 风险仪表盘/问卷过渡动画 | ✅ 完成 |
| design v2 | 视觉再升级：共享 Logo/Navbar、真实 Unsplash 图片、How-it-works 流程区、噪点 + 动态光斑、新建 /share/[id] | ✅ 完成 |
| URL 模式 | 首页加回真实链接解析流程（`extractVideo` → `diagnose` → 跳转），含手动输入兜底 + 错误态 | ✅ 完成 |
| Demo 离线兜底 | Demo 案例走真实后端 AI 流程（个性化问卷 + 个性化报告 SSE）；只在 API 失败时静默兜底到预置 markdown，保证演示不挂 | ✅ 完成 |
| E2E 验证 | 后端三个核心端点（diagnosis/questionnaire/report SSE）真实链路全部跑通，AI 真实引用用户答案做个性化 | ✅ 完成 |
| ASR 主路径 | OpenAI Whisper（中转）转录 mp4 → transcript=口播逐字稿（关 VPN 时全链路通） | ✅ 完成 |
| Next.js 反代 | `/api/*` 由 Next dev server `rewrites` → `127.0.0.1:8000`，避开 Clash 对 localhost 的拦截 | ✅ 完成 |
| 问卷可观测 | `QuestionnaireGenerateResponse.source = 'ai' \| 'fallback'`，AI 失败 `logger.warning(exc_info=True)` 不再静默 | ✅ 完成 |
| /ping 重置 | `GET /api/video/ping` 现在重置 `_direct_unavailable` 短路标记，用户关 VPN 后无需重启进程即可恢复直连探测 | ✅ 完成 |
| 网络模式三态 | `DOUYIN_NETWORK_MODE = auto / direct / fallback_only` + `DOUYIN_ALWAYS_PROBE_DIRECT` 自动重探 | ✅ 完成 |
| 官方字幕优先 | 直连 meta 含 `subtitle_infos` 时，先下载官方 WebVTT/SRT/JSON 字幕，比 ASR 更快更准 | ✅ 完成 |
| 反爬字段防误导 | `play_count=0` 和 `follower_count=null/0` 后端规范化为 None，前端 UI 不展示假数据 | ✅ 完成 |
| Logo 重做 + 品牌精炼 | Logo 改为金色渐变 SVG 眼睛+扫描环（无色块底）；删 Beta tag、v0.1 标识、"关于产品"按钮；emoji 改 SVG icon | ✅ 完成 |
| /guide 教程 landing | 新增使用教程页：工具定位 / 4 种内容类型详解（带例子）/ 4 步流程 / "我们不做什么" | ✅ 完成 |

```bash
# 后端测试状态
cd backend && .venv/bin/pytest tests/ -q
# 结果：84 passed in 2.83s（含网络真实探测的 ping reset 测试 ~7s）

# 启动方式（两个终端分别运行）
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000
cd frontend && npm run dev   # http://localhost:3000
```

### 前端页面一览

| 路由 | 页面 | 关键特性 |
|---|---|---|
| `/` | 首页 | Hero 多层光晕 + SVG 噪点 + 三步流程 + 真实链接解析 + Demo 卡片 + 教程入口 |
| `/guide` | 使用教程 | Landing：Hero + 工具定位 + 4 种内容类型详解 + 4 步流程 + "我们不做什么" + CTA |
| `/analyze/[id]` | 诊断结果 | SVG 风险仪表盘 + 风险色调环境光晕 + 类型卡按类型上色 + 数据来源提示 |
| `/chat/[id]` | 个性化问卷 | AI 实时生成 + 滑动过渡 + 步骤指示器进 Navbar + AI fallback 提示 |
| `/report` | 流式报告 | SSE 实时渲染 + 顶部流光进度条 + 完成态绿色对勾 |
| `/share/[id]` | 分享报告 | 拉取 `getReport(id)` 只读展示 + "我也来分析一个" 引导 CTA |

### 共享组件
| 组件 | 文件 | 用途 |
|---|---|---|
| `<Logo />` | `frontend/components/Logo.tsx` | SVG 眼睛+放大镜，支持 sm/md 尺寸 + Beta tag |
| `<Navbar />` | `frontend/components/Navbar.tsx` | hero（滚动磨砂）+ inner（返回+居中Logo+右侧 slot）两种变体 |

### 待完成

| Plan | 内容 | 备注 |
|---|---|---|
| plan-06 | Tavily 搜索 | 代码已写但**无测试 + 无 TAVILY_API_KEY**。加分项，黑客松决定跳过 |
| 上线部署 | Vercel + Railway / 国内云 | 需修 key 注入 + API base URL + CORS + 报告持久化（当前是内存 dict） |

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
# Anthropic（诊断/问卷/报告）
ANTHROPIC_API_KEY=中转平台的key
ANTHROPIC_BASE_URL=中转平台的API地址

# OpenAI Whisper（ASR 视频转字幕）— 多数中转和 Anthropic 共用一把 key
OPENAI_API_KEY=同上
OPENAI_BASE_URL=同上（代码自动补 /v1 路径）

TAVILY_API_KEY=搜索用（可选）

# 可选：跳过 ASR 走描述文案兜底（演示降级用）
# SKIP_ASR=true
```

**已验证**：claude-opus-4-6 在中转 relay 正常工作；Whisper 在同一中转转录 65KB 中文音频约 3.5 秒得到精准结果。

---

## 已知网络限制 & 关 VPN 操作

**事实**：抖音对境外 IP 拒服务。任何让出口走境外的 VPN（Clash/FlClash TUN 模式开启时即使 bypass localhost 也劫持本机所有出站流量）会导致：
- ❌ 抖音直连域名（`v.douyin.com` / `iesdouyin.com`）SSL_SYSCALL
- ❌ 抖音视频 CDN（`douyinvod.com` / `amemv.com`）SSL_SYSCALL → ASR 无视频可下
- ✅ 镜像 API（`api.douyin.wtf` / `api.xingzhige.com`）通畅 → 仍可拿元数据 + title + hashtags 做 subtitle 兜底

### 三种网络模式（`DOUYIN_NETWORK_MODE`）

| 模式 | 行为 | 适用场景 |
|---|---|---|
| `auto`（默认）| 直连优先 → 失败走镜像 API 兜底 | 普通环境 |
| `direct` | **仅直连抖音**，拒绝走镜像兜底；可拿字幕 + ASR | 关 VPN / Clash 抖音 DIRECT 分流 |
| `fallback_only` | **仅走镜像 API**，跳过 ASR，强制走描述文案 | VPN 开着但镜像可用时演示降级 |

配套环境变量：
- `DOUYIN_ALWAYS_PROBE_DIRECT=true` — 每次 extract 前重置 `_direct_unavailable` 短路标记，无需手动调 `/ping`
- `SKIP_ASR=true` — 强制跳过 Whisper 用 desc 兜底（更快但内容粗）

### 关 VPN 步骤（让 ASR 主路径 + 字幕生效）
1. 退出 FlClash 和 Clash Verge 应用（菜单栏右上角图标 → Quit）
2. 系统设置 → 网络 → Wi-Fi → 详细信息 → 代理 → 把 Web 代理 / 安全 Web 代理全关
3. `.env` 设 `DOUYIN_NETWORK_MODE=direct` + `DOUYIN_ALWAYS_PROBE_DIRECT=true`
4. **重启后端**（kill 旧进程 + 重新启动，让新代码 + 新 env 生效）
5. 验证：`curl http://localhost:8000/api/video/ping` 应返回 `direct_douyin_ok: true`
6. 端到端：`curl -X POST http://localhost:8000/api/video/extract -H 'Content-Type: application/json' -d '{"url":"<分享链接>"}'` → `source` 应为 `asr`，transcript 200+ 字真实口播

### 抖音 web API 反爬限制（已确认拿不到的字段）

| 字段 | 抖音返回 | 处理 |
|---|---|---|
| `statistics.play_count` | 恒为 `0` | 后端规范化为 `None`，前端 UI 不展示 |
| `author.mplatform_followers_count` | 恒为 `0` | 同上，前端 `!= null` 守卫 |
| `author.follower_count` | 永远 `null` | — |
| `author.followers_detail` | 永远 `null` | — |
| `digg_count`（点赞）| ✅ 真实 | 正常展示 |
| `comment_count` / `share_count` / `collect_count` | ✅ 真实 | schema 有，UI 未用 |

Demo 卡片（`frontend/public/demo/demo_*.json`）的 `follower_count` 是**手写演示数据**，会正常展示；真实 URL 解析时这些字段为 None 不显示。

---

## 开发规范（Superpowers TDD）

1. **写测试先于实现**：先写失败测试（RED），看到 FAIL，再实现（GREEN）
2. **每个 Task 完成后 commit**：不积攒（不用每次都推 GitHub，多做几步再统一推）
3. **完成标准**：必须运行验证命令看到 passed，不靠推断

---

## 本地运行方式

```bash
# 后端启动（要先 cd backend 并激活 venv）
cd backend && source .venv/bin/activate
uvicorn main:app --reload --port 8000

# 运行所有测试
cd backend && .venv/bin/pytest tests/ -v

# 手动脚本（需要真实 API Key）
python scripts/test_diagnosis_manual.py
python scripts/test_questionnaire_manual.py
python scripts/test_report_stream_manual.py

# 前端启动
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

**Demo 案例的完整链路**（核心：诊断走静态、问卷+报告走真实 AI）：

| 阶段 | 走哪 | 兜底 |
|---|---|---|
| 视频内容 + 诊断结果 | 预置 JSON（不调后端） | — |
| **个性化问卷生成** | `POST /api/questionnaire/generate`（真实 AI） | API 失败 → 用 JSON 里的 `questions` |
| **报告流式生成** | `POST /api/report/generate`（SSE，真实 AI 按用户答案个性化） | API 失败 → 前端 `simulateStream` 推预置 markdown |
| 分享页 | `GET /api/report/{id}`（真实存的报告） | `demo_X_xxxx` 前缀的 reportId → 渲染 `demoReports.ts` |

`frontend/lib/demoReports.ts` 持有 3 份预置 markdown 报告，**仅作演示崩溃兜底**，正常路径下不会出现。

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
| `backend/services/asr.py` | Whisper 转录（OPENAI_BASE_URL 中转兼容，自动补 `/v1`）|
| `backend/services/video_extractor.py` | URL 解析全链路（直连+兜底 API+短路缓存）|
| `backend/prompts/diagnosis.py` | 诊断 prompt |
| `backend/prompts/questionnaire.py` | 问卷 prompt（已质量验证）|
| `backend/prompts/report.py` | 报告 prompt |
| `backend/services/report_store.py` | 内存报告存储（重启丢失）|
| `frontend/next.config.js` | Next 反代配置：`/api/*` → 127.0.0.1:8000 |
| `frontend/public/demo/` | 3个 Demo 预缓存 JSON |
| `frontend/lib/api.ts` | 前端 API 调用封装（SSE 流式逻辑在此）|
| `frontend/lib/types.ts` | 前端 TypeScript 类型 |
| `docs/douyin-video-extract-spec.md` | URL 解析技术档案（直连+兜底策略、CDN 实测、ASR 配置）|
