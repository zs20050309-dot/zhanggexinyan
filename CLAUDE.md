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
| AI | claude-opus-4-6（Anthropic SDK + 中转 relay） | — |
| ASR | OpenAI Whisper API（OPENAI_API_KEY + OPENAI_BASE_URL） | — |
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
│   ├── requirements.txt    # 依赖（含 curl_cffi，无 yt-dlp）
│   ├── main.py             # FastAPI 入口，含 /health
│   ├── models/schemas.py   # 所有 Pydantic 模型
│   ├── routers/            # 路由层（video/diagnosis/questionnaire/report/search）
│   ├── services/           # 服务层（ai_client/asr/video_extractor/report_store/search_client）
│   ├── prompts/            # Claude prompt 构建（diagnosis/questionnaire/report）
│   ├── tests/              # pytest 测试（27个测试，全部通过）
│   └── scripts/            # 手动测试脚本
├── frontend/
│   ├── public/demo/        # 3个 Demo 案例预缓存 JSON（demo_1/2/3.json）
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
| plan-02 | AI 客户端、诊断 prompt、诊断路由（全 mock）+ 真实 API 手动验证 | ✅ 完成 |
| plan-03 | CDN 脚本、ASR 测试、视频路由测试、Demo JSON 缓存 | ✅ 完成（见备注）|

```bash
# 当前测试状态验证
cd backend && .venv/bin/pytest tests/ -v
# 结果：27 passed in 0.04s
```

**Plan-03 CDN 备注（已深度排查，待后续解决）**：

CDN 解析代码逻辑完整，但当前开发环境无法访问 douyin.com / iesdouyin.com 的 HTTPS。

**根本原因**：Clash 对 douyin.com 走 `GEOIP,CN,DIRECT` 直连规则，但 DIRECT 路径下 TLS 握手全部 EOF 失败。bilibili.com 有显式 `DOMAIN-SUFFIX,bilibili.com,DIRECT` 规则且可以正常连接，说明两者 CDN 基础设施不同——Douyin CDN 节点会拒绝当前网络的直连 TLS 请求。

**已排除**：
- 不是 tls-client / httpx / curl 的 TLS 指纹问题（各种浏览器指纹均失败）
- 不是代理配置问题（bilibili 同样 DIRECT 但能通）
- 不是代码 bug（代码逻辑经过验证）

**待尝试的修复方向**：在 Clash 规则中给 Douyin 加专用代理组（不走 DIRECT），或换一个没有这个限制的网络环境（如关掉 Clash 的 fake-ip 模式，或切换到非 Clash 网络下测试）。

**不影响黑客松演示**：Demo 走预缓存 JSON，手动输入路径正常工作。

### 待完成（按顺序）

| Plan | 内容 |
|---|---|
| **plan-04** | **问卷模块 TDD** ← 下一步 |
| plan-05 | 报告生成 + SSE 流式 TDD |
| plan-06 | Tavily 搜索（加分项，低优先级） |
| plan-07 | 前端安装 + 首页 |
| plan-08 | 前端诊断结果页 |
| plan-09 | 前端问卷页 |
| plan-10 | 前端报告页 + 分享页 |

---

## AI 客户端配置（已解决）

`services/ai_client.py` 使用 **Anthropic SDK + 中转 relay**，已正常工作。

```python
# 当前实现（services/ai_client.py）
import anthropic

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
ANTHROPIC_BASE_URL=中转平台的API地址（如 https://api.xxx.com）
OPENAI_API_KEY=Whisper用的key（ASR服务）
OPENAI_BASE_URL=Whisper中转地址（可选）
TAVILY_API_KEY=搜索用（可选，plan-06才需要）
```

**已验证**：claude-opus-4-6 模型在中转 relay 上正常工作，4个诊断案例全部通过（78/82/8/52分，均在预期范围内）。

---

## 开发规范（Superpowers TDD）

1. **写测试先于实现**：先写失败测试（RED），看到 FAIL，再实现（GREEN）
2. **每个 Task 完成后 commit**：不积攒，做完立即提交（不用每次都推 GitHub，多做几步再统一推）
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
cd backend && .venv/bin/pytest tests/ -v

# 手动诊断测试（需要真实 API Key）
cd backend && source .venv/bin/activate
python scripts/test_diagnosis_manual.py

# CDN 解析测试（需要真实抖音链接，填入脚本 TEST_URL）
python scripts/test_cdn_extract.py

# 前端启动（需先 plan-07 完成后执行 npm install）
cd frontend && npm run dev
```

---

## 关键设计决策（勿改动方向）

- **视频解析**：CDN 直链解析（移动端 UA + iesdouyin API），不用 yt-dlp；代码已完整，网络通了就能用
- **Demo 演示**：3 个案例预缓存在 `frontend/public/demo/demo_1/2/3.json`，不依赖任何实时 API
- **可获取的视频元数据**：点赞/播放/评论/分享数、粉丝数、是否开通小店（with_shop_entry）、商业化等级（commerce_level 0-5）、认证标签（custom_verify）、是否广告（is_ad）
- **这些元数据已注入诊断 prompt**，让 AI 判断商业意图时有客观信号，不靠猜
- **报告用 SSE 流式输出**（plan-05/10）
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
| `backend/models/schemas.py` | 所有 Pydantic 数据模型 |
| `backend/services/ai_client.py` | Claude 调用层（Anthropic SDK + relay，已正常工作）|
| `backend/services/asr.py` | Whisper 转录（OpenAI SDK）|
| `backend/services/video_extractor.py` | CDN 解析实现（代码完整，待网络环境就绪）|
| `backend/prompts/diagnosis.py` | 诊断 prompt（含元数据注入逻辑）|
| `frontend/public/demo/` | 3个 Demo 预缓存 JSON |
| `frontend/lib/types.ts` | 前端 TypeScript 类型（与 schemas.py 同步）|
| `frontend/lib/api.ts` | 前端 API 调用封装（SSE 流式逻辑在此）|
