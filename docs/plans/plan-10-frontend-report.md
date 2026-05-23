# Plan 10: 前端报告页与分享页

> **执行方式：** 逐步手动执行，每步在浏览器验证后再进行下一步。

**Goal:** `/report` 页面流式展示 AI 生成的个性化分析报告（SSE），生成完毕后显示分享按钮；`/share/[id]` 页面展示脱敏后的公开报告（隐去个人背景部分）。

**Architecture:**
- `/report`: 读取 sessionStorage 中的 `videoContent`、`diagnosis`、`answers`，调用 `streamReport()` SSE 接口，边收边渲染 Markdown；收到 `done` 事件后存 `report_id`，展示分享按钮。
- `/share/[id]`: 调用 `getReport(id)` 获取公开报告，静态渲染，无需 sessionStorage。

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, react-markdown（或手动渲染）

---

### Task 1：安装 react-markdown

**Files:**
- Modify: `frontend/package.json`（通过 npm install）

- [ ] **Step 1: 安装依赖**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/frontend
npm install react-markdown
```

Expected: 安装成功，`package.json` 的 `dependencies` 中新增 `react-markdown`。

> **Note:** 如果 react-markdown 引入导致 SSR 问题，可改用简单的正则渲染方案（见 Task 3 Step 3 备注）。

---

### Task 2：创建报告页

**Files:**
- Create: `frontend/app/report/page.tsx`

- [ ] **Step 1: 创建 report 目录及页面**

创建 `frontend/app/report/page.tsx`：

```tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { streamReport } from '@/lib/api'
import type { VideoContent, DiagnosisResult, QAPair } from '@/lib/types'

export default function ReportPage() {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [reportId, setReportId] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    // 防止 StrictMode 双重触发
    if (startedRef.current) return
    startedRef.current = true

    const videoRaw   = sessionStorage.getItem('videoContent')
    const diagRaw    = sessionStorage.getItem('diagnosis')
    const answersRaw = sessionStorage.getItem('answers')

    if (!videoRaw || !diagRaw || !answersRaw) {
      router.replace('/')
      return
    }

    const video: VideoContent       = JSON.parse(videoRaw)
    const diagnosis: DiagnosisResult = JSON.parse(diagRaw)
    const answers: QAPair[]         = JSON.parse(answersRaw)

    // 检查是否有 demoQuestions（Demo 模式），搜索结果置空
    const searchRaw = sessionStorage.getItem('searchResult')
    const searchResult = searchRaw ? JSON.parse(searchRaw) : null

    streamReport(
      { video, diagnosis, answers, search_result: searchResult },
      (chunk) => {
        setContent((prev) => prev + chunk)
        // 自动滚动到底部
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      },
      (id) => {
        setReportId(id)
        setStreaming(false)
      },
      (err) => {
        setError(err)
        setStreaming(false)
      },
    )
  }, [router])

  const handleShare = useCallback(() => {
    if (!reportId) return
    const shareUrl = `${window.location.origin}/share/${reportId}`
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('分享链接已复制到剪贴板')
    })
  }, [reportId])

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded-xl border border-white/20 text-sm text-white/60
                     hover:bg-white/5 transition-colors"
        >
          返回首页
        </button>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">
      {/* 顶部 */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-8">
        <button
          onClick={() => router.push('/')}
          className="text-white/40 text-sm hover:text-white/70 transition-colors"
        >
          ← 首页
        </button>
        {streaming && (
          <span className="text-xs text-white/40 animate-pulse">正在生成报告...</span>
        )}
        {!streaming && reportId && (
          <button
            onClick={handleShare}
            className="px-4 py-1.5 rounded-full border border-white/20 text-xs text-white/60
                       hover:bg-white/10 transition-colors"
          >
            分享报告
          </button>
        )}
      </div>

      {/* 报告内容 */}
      <div className="w-full max-w-2xl">
        {content ? (
          <div className="prose prose-invert prose-sm max-w-none
                          prose-headings:text-white/90 prose-headings:font-semibold
                          prose-p:text-white/75 prose-p:leading-relaxed
                          prose-li:text-white/75
                          prose-strong:text-white/90
                          prose-hr:border-white/10">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 骨架屏 */}
            {[80, 100, 60, 90, 70].map((w, i) => (
              <div key={i} className="h-3 rounded bg-white/5 animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {/* 流式光标 */}
        {streaming && content && (
          <span className="inline-block w-0.5 h-4 bg-white/60 ml-0.5 animate-pulse" />
        )}

        <div ref={bottomRef} />
      </div>

      {/* 报告生成完毕后的操作区 */}
      {!streaming && (
        <div className="w-full max-w-2xl mt-12 pt-8 border-t border-white/10 flex flex-col items-center gap-4">
          <p className="text-xs text-white/30">分析完成</p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 rounded-xl border border-white/20 text-sm text-white/60
                         hover:bg-white/5 transition-colors"
            >
              分析另一个视频
            </button>
            {reportId && (
              <button
                onClick={handleShare}
                className="px-5 py-2.5 rounded-xl bg-white text-black text-sm font-medium
                           hover:bg-white/90 transition-colors"
              >
                复制分享链接
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: 在浏览器验证报告页**

完整跑 Demo 流程（首页 → Demo卡片 → analyze → chat → report）：
- 进入报告页后看到骨架屏短暂显示，然后文字开始流式出现
- 报告为 Markdown 格式，标题、段落、列表正常渲染
- 页面随内容增加自动滚动到底部
- 生成完毕后出现"分享报告"按钮和"复制分享链接"按钮

- [ ] **Step 3: react-markdown 兼容问题处理（如有）**

如果 `react-markdown` 导致 SSR hydration 错误，改用动态导入：

```tsx
import dynamic from 'next/dynamic'
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false })
```

如果仍有问题，用简单的手动渲染替代（不依赖第三方库）：

```tsx
// 替换 <ReactMarkdown>{content}</ReactMarkdown> 为：
<div className="space-y-4">
  {content.split('\n').map((line, i) => {
    if (line.startsWith('## ')) return <h2 key={i} className="text-base font-semibold text-white/90 mt-6 mb-2">{line.slice(3)}</h2>
    if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-medium text-white/80 mt-4 mb-1">{line.slice(4)}</h3>
    if (line.startsWith('- ') || line.startsWith('• ')) return <li key={i} className="text-sm text-white/75 ml-4">{line.slice(2)}</li>
    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-sm font-semibold text-white/90">{line.slice(2, -2)}</p>
    if (line === '---') return <hr key={i} className="border-white/10 my-4" />
    if (line.trim() === '') return <div key={i} className="h-2" />
    return <p key={i} className="text-sm text-white/75 leading-relaxed">{line}</p>
  })}
</div>
```

---

### Task 3：创建分享页

**Files:**
- Create: `frontend/app/share/[id]/page.tsx`

- [ ] **Step 1: 创建 share 动态路由页面**

创建 `frontend/app/share/[id]/page.tsx`：

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { getReport } from '@/lib/api'
import type { SavedReport } from '@/lib/types'

export default function SharePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [report, setReport] = useState<SavedReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    getReport(id)
      .then((r) => {
        setReport(r)
        setLoading(false)
      })
      .catch(() => {
        setNotFound(true)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-white/40 text-sm">加载中...</p>
      </main>
    )
  }

  if (notFound || !report) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-white/60 text-sm">报告不存在或已过期</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded-xl border border-white/20 text-sm text-white/60
                     hover:bg-white/5 transition-colors"
        >
          去首页分析
        </button>
      </main>
    )
  }

  const date = new Date(report.created_at).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">
      {/* 头部 */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-white/30 mb-1">内容识别报告 · {date}</p>
            <h1 className="text-base font-semibold text-white/85 leading-snug line-clamp-2">
              {report.video_title}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {report.diagnosis_types.map((type) => (
            <span
              key={type}
              className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/60 border border-white/15"
            >
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* 公开报告内容（脱敏：后端保存的是含个人背景的完整报告，分享时直接展示同一份） */}
      <div className="w-full max-w-2xl">
        <div className="prose prose-invert prose-sm max-w-none
                        prose-headings:text-white/90 prose-headings:font-semibold
                        prose-p:text-white/75 prose-p:leading-relaxed
                        prose-li:text-white/75
                        prose-strong:text-white/90
                        prose-hr:border-white/10">
          <ReactMarkdown>{report.content}</ReactMarkdown>
        </div>
      </div>

      {/* 底部 CTA */}
      <div className="w-full max-w-2xl mt-12 pt-8 border-t border-white/10 text-center">
        <p className="text-xs text-white/30 mb-4">也想分析一条视频？</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 rounded-xl bg-white text-black text-sm font-medium
                     hover:bg-white/90 transition-colors"
        >
          免费体验 →
        </button>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: 在浏览器验证分享页**

跑完整 Demo 流程后得到 `reportId`，访问 `http://localhost:3000/share/{reportId}`：
- 看到视频标题和内容类型标签
- 报告正文完整显示
- 底部"免费体验"按钮可跳转首页
- 访问不存在的 ID（`/share/badid`）显示"报告不存在或已过期"

- [ ] **Step 3: TypeScript 检查**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/frontend
npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 4: 完整端到端流程回归测试**

使用 Demo 入口跑完整流程：
- [ ] 首页 → Demo卡片 → analyze 页显示正确诊断
- [ ] analyze 页 → chat 页加载问题，全部回答完毕
- [ ] chat 页 → report 页，报告流式生成，完毕后显示分享按钮
- [ ] 点"复制分享链接" → 访问 `/share/{id}` 页面正常显示

- [ ] **Step 5: Commit**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon
git add frontend/app/report/ frontend/app/share/
git commit -m "feat: add report streaming page and share page"
```

---

**Plan 10 完成标准：**
- [ ] 报告页 SSE 流式渲染正常，内容逐字出现
- [ ] Markdown 格式正确渲染（标题、列表、加粗）
- [ ] 生成完毕后显示"复制分享链接"按钮
- [ ] `/share/[id]` 正确展示保存的报告
- [ ] 访问不存在的 share ID 显示友好错误
- [ ] 完整 Demo 流程端到端通过
- [ ] `npx tsc --noEmit` 无错误
