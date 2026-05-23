# 技术规范文档 v1.0
## 抖音内容识别器
黑客松技术基准文档 | 开发期间所有技术决策以本文档为准

---

## 一、技术决策总览（已定，不再讨论）

| 决策项 | 选定方案 | 理由 |
|---|---|---|
| 前后端架构 | FastAPI（后端）+ Next.js 14（前端） | AI调用链路长，FastAPI async更稳；yt-dlp是Python生态 |
| AI模型 | Claude claude-sonnet-4-6 (`claude-sonnet-4-6`) | 全程统一，推理质量高，减少配置复杂度 |
| ASR | OpenAI Whisper API | 准确率高，中文支持好，调用简单 |
| 视频解析 | yt-dlp（主）+ 手动粘贴（降级） | 开源，抖音支持最稳定 |
| 实时搜索 | Tavily API | 国内稳定性优于Perplexity，专为AI应用设计 |
| 报告存储 | 内存字典 + UUID | 黑客松25小时内无需持久化，零运维 |
| 问卷模式 | 伪动态（一次性生成全部问题）→ 真动态（有时间再升级） | 保底MVP质量，不卡进度 |
| 前端框架 | Next.js 14 App Router + Tailwind CSS | 快速开发，App Router支持流式渲染 |
| 部署 | 本地运行（后端 localhost:8000，前端 localhost:3000）→ 有时间再上云 | 黑客松现场优先保证稳定 |

---

## 二、项目目录结构

```
dyhackthon/
├── docs/
│   ├── tech_spec.md          ← 本文档
│   ├── prep.md               ← 赛题
│   ├── dev_planning_v1.md    ← 宏观规划
│   └── product_design_doc_v2.md ← 产品设计
├── backend/                  ← FastAPI服务，运行在 :8000
│   ├── main.py               ← 应用入口
│   ├── requirements.txt
│   ├── .env.example
│   ├── models/
│   │   └── schemas.py        ← 所有Pydantic数据模型（API合约）
│   ├── routers/
│   │   ├── video.py          ← /api/video/*
│   │   ├── diagnosis.py      ← /api/diagnosis
│   │   ├── questionnaire.py  ← /api/questionnaire/*
│   │   ├── report.py         ← /api/report/*
│   │   └── search.py         ← /api/search
│   ├── services/
│   │   ├── video_extractor.py  ← yt-dlp封装
│   │   ├── asr.py              ← Whisper API调用
│   │   ├── ai_client.py        ← Claude API封装
│   │   ├── search_client.py    ← Tavily API调用
│   │   └── report_store.py     ← 内存存储 + UUID
│   └── prompts/
│       ├── diagnosis.py        ← 诊断Prompt模板
│       ├── questionnaire.py    ← 问卷Prompt模板
│       └── report.py           ← 报告Prompt模板
├── frontend/                 ← Next.js 14，运行在 :3000
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx           ← 首页：链接输入 + Demo入口
│   │   ├── analyze/
│   │   │   └── page.tsx       ← 诊断结果页
│   │   ├── chat/
│   │   │   └── page.tsx       ← 动态问卷页
│   │   ├── report/[id]/
│   │   │   └── page.tsx       ← 个人报告页
│   │   └── share/[id]/
│   │       └── page.tsx       ← 分享报告页（隐去个人信息）
│   ├── components/
│   │   ├── ui/                ← 基础UI组件
│   │   ├── VideoInput.tsx     ← 链接输入框 + 提交
│   │   ├── DiagnosisCard.tsx  ← 类型标签 + 风险仪表盘
│   │   ├── RiskGauge.tsx      ← 风险评分可视化
│   │   ├── QuestionCard.tsx   ← 单题显示（选择/填写）
│   │   └── ReportView.tsx     ← Markdown报告渲染
│   ├── lib/
│   │   ├── api.ts             ← 后端API客户端（所有请求统一在这里）
│   │   ├── types.ts           ← TypeScript类型（与schemas.py对应）
│   │   └── constants.ts       ← Demo案例数据 + 配置常量
│   └── public/demo/           ← 预置Demo案例的缓存JSON
└── prompts/                  ← Prompt工程工作台（Markdown格式，方便调试）
    ├── diagnosis_v1.md
    ├── questionnaire_v1.md
    └── report_v1.md
```

---

## 三、完整API接口规范

### 基础约定

- Base URL: `http://localhost:8000`
- 所有请求/响应均为 JSON
- 报告生成接口使用 SSE 流式输出
- 错误统一格式：`{ "error": "错误描述", "code": "ERROR_CODE" }`

### 3.1 视频解析模块

#### `POST /api/video/extract`

将抖音视频链接解析为结构化内容。

**Request:**
```json
{
  "url": "https://v.douyin.com/xxxxx"
}
```

**Response (200):**
```json
{
  "video_id": "uuid-v4",
  "transcript": "视频语音转文字内容...",
  "title": "视频标题",
  "author": "账号名称",
  "likes": 12345,
  "comments": 678,
  "shares": 90,
  "duration_seconds": 67,
  "source": "asr"
}
```

`source` 字段值：`"asr"`（语音转录）| `"subtitle"`（字幕降级）| `"manual"`（手动输入降级）

**Response (422) - 链接无法解析时不报错，返回降级提示：**
```json
{
  "error": "视频解析失败，请手动粘贴视频内容",
  "code": "EXTRACT_FAILED",
  "fallback_available": true
}
```

#### `POST /api/video/manual`

链接解析失败时的降级入口。

**Request:**
```json
{
  "title": "视频标题（必填）",
  "text": "用户粘贴的视频文字内容（必填）",
  "author": "账号名（可选）"
}
```

**Response:** 同上，`source` 为 `"manual"`，`video_id` 新生成。

---

### 3.2 诊断模块

#### `POST /api/diagnosis`

AI内容诊断，识别类型和风险评分。

**Request:**
```json
{
  "video_id": "uuid-v4",
  "transcript": "...",
  "title": "...",
  "author": "...",
  "likes": 12345
}
```

**Response (200):**
```json
{
  "video_id": "uuid-v4",
  "types": ["anxiety_selling"],
  "types_display": ["焦虑贩卖型"],
  "risk_score": 72,
  "risk_level": "high",
  "core_issue": "视频用'大三'这个时间节点制造了普遍性焦虑，但完全没说明结论成立需要哪些前提",
  "missing_premises": [
    "专业方向（理工科/文科/艺术的实习节奏完全不同）",
    "个人规划（考研/就业/出国路径不同）",
    "已有经验积累"
  ],
  "emotional_manipulation": "反复使用'废了''完了'等绝对化词汇",
  "commercial_intent": "主页有求职培训课程链接",
  "needs_realtime_search": false,
  "search_query": null
}
```

**类型枚举值：**
- `anxiety_selling` 焦虑贩卖型
- `conflict_provoking` 矛盾挑起型
- `info_gap_harvesting` 信息差收割型
- `pseudo_science_ad` 伪科普软广型

**风险等级：**
- `low` (0-30) | `medium` (31-60) | `high` (61-85) | `critical` (86-100)

---

### 3.3 问卷模块

#### `POST /api/questionnaire/generate`

伪动态模式：根据诊断结果一次性生成3-5个问题。

**Request:**
```json
{
  "video_id": "uuid-v4",
  "diagnosis": { /* DiagnosisResult对象 */ }
}
```

**Response (200):**
```json
{
  "questions": [
    {
      "id": 1,
      "text": "你现在是什么学历阶段？",
      "type": "choice",
      "options": ["大一大二", "大三大四", "研究生", "已工作"]
    },
    {
      "id": 2,
      "text": "你的目标方向是？",
      "type": "choice",
      "options": ["就业", "考研/出国", "创业", "还没想好"]
    },
    {
      "id": 3,
      "text": "你目前有实习/相关项目经验吗？",
      "type": "choice",
      "options": ["有，比较丰富", "有，但不多", "在找中", "完全没有"]
    },
    {
      "id": 4,
      "text": "看完这个视频，你当时第一反应是什么？（简短描述即可）",
      "type": "text",
      "options": null
    }
  ]
}
```

#### `POST /api/questionnaire/next`（真动态，加分项）

**Request:**
```json
{
  "video_id": "uuid-v4",
  "diagnosis": { /* DiagnosisResult */ },
  "conversation": [
    { "question": "...", "answer": "..." }
  ],
  "latest_answer": "大三，目标就业"
}
```

**Response (200):**
```json
{
  "action": "ask",
  "question": {
    "id": 2,
    "text": "你的专业方向是？",
    "type": "choice",
    "options": ["理工科", "商科/经管", "文史哲", "艺术/设计"]
  }
}
```
或：
```json
{
  "action": "finish",
  "finish_reason": "已获取足够信息生成个性化报告"
}
```

---

### 3.4 报告模块

#### `POST /api/report/generate`

流式生成个性化分析报告（SSE）。

**Request:**
```json
{
  "video_id": "uuid-v4",
  "transcript": "...",
  "title": "...",
  "author": "...",
  "diagnosis": { /* DiagnosisResult */ },
  "answers": [
    { "question": "你现在是什么学历阶段？", "answer": "大三大四" },
    { "question": "你的目标方向是？", "answer": "考研/出国" }
  ],
  "search_result": null
}
```

**Response: SSE流（Content-Type: text/event-stream）**

每个事件：
```
data: {"type": "chunk", "content": "## 视频内容解析\n\n"}

data: {"type": "chunk", "content": "这条视频通过..."}

data: {"type": "done", "report_id": "uuid-v4"}
```

最后一个事件的 `report_id` 可用于后续分享。

#### `GET /api/report/{report_id}`

获取已生成的报告（用于分享页）。

**Response (200):**
```json
{
  "report_id": "uuid-v4",
  "content": "## 视频内容解析\n\n...",
  "video_title": "大三不找实习就废了",
  "diagnosis_types": ["anxiety_selling"],
  "created_at": "2025-05-23T10:00:00Z"
}
```

**Response (404):**
```json
{ "error": "报告不存在或已过期", "code": "REPORT_NOT_FOUND" }
```

---

### 3.5 搜索模块

#### `POST /api/search`

实时搜索（仅信息差收割型触发）。

**Request:**
```json
{
  "query": "image2 AI设计师失业 2025",
  "context": "视频声称image2发布后设计师将全面失业"
}
```

**Response (200):**
```json
{
  "summary": "image2于2025年发布，确实对批量执行类设计工作产生冲击...",
  "sources": ["来源1标题", "来源2标题"],
  "retrieved_at": "2025-05-23T10:05:00Z"
}
```

---

## 四、数据模型定义

> 完整Pydantic定义见 `backend/models/schemas.py`，TypeScript定义见 `frontend/lib/types.ts`

### 核心模型关系图

```
VideoContent
  └── video_id, transcript, title, author, likes, source

DiagnosisResult
  └── video_id, types[], risk_score, risk_level
  └── core_issue, missing_premises[], emotional_manipulation
  └── commercial_intent, needs_realtime_search, search_query

Question
  └── id, text, type("choice"|"text"), options[]

QAPair
  └── question, answer

SearchResult
  └── summary, sources[], retrieved_at

ReportRequest
  └── video_id, transcript, title, author
  └── diagnosis: DiagnosisResult
  └── answers: QAPair[]
  └── search_result: SearchResult | null

SavedReport
  └── report_id, content, video_title, diagnosis_types[]
  └── created_at
```

---

## 五、各服务实现细节

### 5.1 视频解析服务（video_extractor.py）

```python
# 调用方式
result = await extract_video(url: str) -> VideoContent | None

# 实现逻辑
1. 调用 yt-dlp 下载视频信息和音频
   - yt_dlp.YoutubeDL(opts).extract_info(url)
   - 提取：title, uploader, like_count, comment_count, duration
   - 下载音频文件到临时目录（/tmp/）
2. 将音频路径传给 ASR 服务
3. 清理临时文件
4. 返回 VideoContent

# 降级逻辑
- yt-dlp 抛出异常 → 返回 None → 路由层触发 EXTRACT_FAILED 响应
```

**yt-dlp 关键参数：**
```python
YDL_OPTS = {
    'format': 'bestaudio/best',
    'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
    }],
    'outtmpl': '/tmp/%(id)s.%(ext)s',
    'quiet': True,
    'no_warnings': True,
}
```

### 5.2 ASR服务（asr.py）

```python
# 调用方式
transcript = await transcribe(audio_path: str) -> str

# 实现逻辑
client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
with open(audio_path, 'rb') as f:
    result = await client.audio.transcriptions.create(
        model="whisper-1",
        file=f,
        language="zh"
    )
return result.text
```

### 5.3 AI客户端（ai_client.py）

```python
# 非流式调用（诊断 + 问卷）
response = await call_claude(
    system: str,
    user: str,
    expect_json: bool = False
) -> str | dict

# 流式调用（报告生成）
async def stream_claude(system: str, user: str) -> AsyncIterator[str]

# 实现要点
- 所有调用使用 anthropic.AsyncAnthropic
- expect_json=True 时：自动重试解析，最多3次
- 超时设置：60秒
- 模型：claude-sonnet-4-6
- max_tokens：诊断1024，问卷1024，报告4096
```

### 5.4 报告存储（report_store.py）

```python
# 全局内存存储
_store: dict[str, SavedReport] = {}

def save_report(content: str, video_title: str, types: list[str]) -> str:
    report_id = str(uuid.uuid4())[:8]  # 8位短ID，方便分享
    _store[report_id] = SavedReport(...)
    return report_id

def get_report(report_id: str) -> SavedReport | None:
    return _store.get(report_id)
```

---

## 六、Prompt设计规范

> 完整Prompt见 `backend/prompts/` 目录和 `prompts/` 工作台文件

### 6.1 通用规范

- 所有Prompt使用中文
- 要求JSON输出的Prompt必须在系统消息中明确声明格式，并提供示例
- 不在Prompt中要求"markdown代码块"包裹JSON（容易导致解析失败）
- 评分类数字必须给锚定案例（防止模型随意打分）

### 6.2 诊断Prompt结构

```
[系统角色] 专业内容批判性分析专家
[分析维度] 6个维度（论点前提/情绪词/适用范围/商业意图/时效性初判/类型归因）
[锚定案例] 每种风险等级各1个参考案例及对应分数
[反例说明] 不应被识别为操控性内容的情况
[输出格式] 严格JSON，提供完整字段示例
```

### 6.3 问卷Prompt结构

```
[系统角色] 帮助用户分析视频的AI助手
[已知信息] 诊断结果（类型+风险评分+核心问题）
[任务约束] 问题数限制/类型比例/停止条件/禁止内容
[输出格式] 问题数组JSON（一次性生成全部，伪动态模式）
```

### 6.4 报告Prompt结构

```
[系统角色] 帮助用户理性分析视频的AI助手
[输入信息] 视频文字稿（截断至3000字）+ 诊断结果 + 用户背景 + 搜索结果
[生成要求] 四个章节各自的具体要求
[个性化约束] 每章节必须引用用户具体背景，禁止"大多数人"等模糊表述
[语气要求] 口语化/用"你"不用"您"/不说教
[输出格式] 标准Markdown，四章节固定标题
```

---

## 七、前端状态管理

### 页面间数据传递方案

黑客松场景下用 `sessionStorage` 传递数据（不用 Redux/Zustand，避免过度设计）：

```typescript
// 存储流程
sessionStorage.setItem('videoContent', JSON.stringify(videoContent))
sessionStorage.setItem('diagnosis', JSON.stringify(diagnosis))
sessionStorage.setItem('answers', JSON.stringify(answers))
sessionStorage.setItem('reportId', reportId)

// 每个页面从 sessionStorage 读取前序数据
```

### 页面状态机

```
首页（/）
  ├── 空状态：显示产品介绍 + 三个Demo入口
  ├── 加载中：链接解析 + ASR转录（15-30秒，显示进度）
  └── 成功：跳转到 /analyze

诊断结果页（/analyze）
  ├── 从 sessionStorage 读取 videoContent + diagnosis
  ├── 展示：类型标签 + 风险仪表盘 + 核心问题
  └── 点击"开始个性化分析" → 跳转 /chat

问卷页（/chat）
  ├── 从 sessionStorage 读取 diagnosis
  ├── 请求 /api/questionnaire/generate
  ├── 问题逐个展示，用户逐个回答
  └── 全部回答完成 → 跳转 /report/[id]（先生成再跳转）

报告页（/report/[id]）
  ├── 从 sessionStorage 读取 answers + 已有数据
  ├── 请求 /api/report/generate（SSE流式）
  ├── 边生成边渲染 Markdown
  └── 完成后显示分享按钮

分享页（/share/[id]）
  └── 请求 /api/report/[id]
  └── 展示隐去个人背景的报告 + 引导新用户输入自己的情况
```

---

## 八、Demo案例数据

预置三个案例，对应的完整数据（视频内容 + 诊断结果 + 问卷 + 报告）提前生成并缓存到 `frontend/public/demo/` 目录。

| ID | 标题 | 类型 | 展示重点 |
|---|---|---|---|
| `demo_1` | 大三不找实习就废了 | anxiety_selling | 个性化问卷 + 前提缺失分析 |
| `demo_2` | image2出来设计师全失业 | info_gap_harvesting | 实时搜索 + 事实核查 |
| `demo_3` | 医生秘密护肤法 | pseudo_science_ad | 来源可信度 + 商业意图识别 |

Demo案例在首页点击后跳过视频解析和ASR，直接从缓存JSON中加载数据，确保现场演示稳定。

---

## 九、错误处理规范

### 后端统一错误处理

```python
# main.py 中注册全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": "服务异常，请重试", "code": "INTERNAL_ERROR"}
    )
```

### 各模块降级策略

| 模块 | 失败情况 | 降级方案 |
|---|---|---|
| 视频解析 | yt-dlp报错 | 返回EXTRACT_FAILED，前端展示手动输入入口 |
| ASR | Whisper超时 | 返回空transcript，用title作为分析输入 |
| 实时搜索 | Tavily超时/失败 | search_result为null，报告中该章节跳过 |
| 问卷生成 | Claude返回非JSON | 使用内置兜底问题集（按类型各3个） |
| 报告生成 | 流式中断 | 前端显示已接收的部分内容 + 错误提示 |

---

## 十、开发顺序与验收标准

### Phase 1：地基（0-6h）
- [ ] **P1.1** backend 本地启动，`GET /health` 返回200
- [ ] **P1.2** 诊断Prompt调试完成，手动测试三个案例均输出合法JSON
- [ ] **P1.3** frontend 本地启动，首页可访问
- [ ] **P1.4** yt-dlp能解析一条抖音链接（或确认失败，切降级方案）

### Phase 2：核心链路（6-14h）
- [ ] **P2.1** 完整链路跑通：链接输入 → ASR → 诊断 → 结果页展示
- [ ] **P2.2** 问卷页：一次性生成问题，用户逐个回答，全程可用
- [ ] **P2.3** 报告生成：流式输出，Markdown渲染正常
- [ ] **P2.4** 三个Demo案例缓存数据准备完毕

### Phase 3：体验打磨（14-20h）
- [ ] **P3.1** 流式输出在前端显示正常（不闪烁，不截断）
- [ ] **P3.2** 报告分享链接可生成，分享页可访问
- [ ] **P3.3** 移动端基本可用（不崩溃）
- [ ] **P3.4** 实时搜索接入（信息差收割型触发）

### Phase 4：提交准备（20-25h）
- [ ] **P4.1** Demo Video录制（3分钟）
- [ ] **P4.2** Pitch Deck完成（9页）
- [ ] **P4.3** GitHub代码整理
- [ ] **P4.4** 游园会海报提交（22:30截止）

---

## 十一、环境配置

### 后端 `.env` 必填项

```
ANTHROPIC_API_KEY=sk-ant-...        # Claude API Key
OPENAI_API_KEY=sk-...               # Whisper API Key
TAVILY_API_KEY=tvly-...             # 搜索 API Key（可选，仅信息差收割型需要）
```

### 前端 `.env.local` 必填项

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 本地启动命令

```bash
# 后端
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000

# 前端
cd frontend && npm install && npm run dev
```

---

*文档版本 v1.0 | 技术规范基准，开发期间以本文档为准*
*更新时请注明版本号和修改原因*
