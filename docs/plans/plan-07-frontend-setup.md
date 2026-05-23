# Plan 07: 前端环境搭建与首页

> **执行方式：** 逐步手动执行，每步在浏览器验证后再进行下一步。

**Goal:** Next.js 前端项目启动，首页可访问，包含链接输入框和三个 Demo 案例入口，视觉效果基本可用。

**Architecture:** Next.js 14 App Router，Tailwind CSS 样式，sessionStorage 管理页面间数据，`lib/api.ts` 统一管理后端调用。

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS

---

### Task 1：安装依赖并启动开发服务器

**Files:**
- Verify: `frontend/package.json`（已存在）
- Create: `frontend/.env.local`

- [ ] **Step 1: 安装 Node.js 依赖**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/frontend
npm install
```

Expected: 安装完成，出现 `node_modules/` 目录，无 ERROR。可能有少量 warning，忽略即可。

- [ ] **Step 2: 创建 .env.local**

```bash
cp .env.local.example .env.local
```

确认内容：
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

- [ ] **Step 3: 创建 postcss.config.js（Tailwind 必需）**

创建 `frontend/postcss.config.js`：

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 4: 创建全局 CSS 文件**

创建 `frontend/app/globals.css`：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  background-color: #0f0f0f;
  color: #f0f0f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

- [ ] **Step 5: 创建根布局文件**

创建 `frontend/app/layout.tsx`：

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '内容识别器 | 看清视频背后的逻辑',
  description: '在你被一条视频影响、做出决定之前，帮你真正想清楚——它对你的情况，究竟成不成立。',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[#0f0f0f] text-[#f0f0f0]">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 6: 启动开发服务器**

```bash
npm run dev
```

Expected:
```
▲ Next.js 14.x.x
- Local:    http://localhost:3000
- Ready in xxxx ms
```

打开浏览器访问 `http://localhost:3000`——此时会看到 404 或空白页，正常（页面还没创建）。

- [ ] **Step 7: 确认 TypeScript 编译无报错**

```bash
npx tsc --noEmit
```

Expected: 无输出（无错误）。

---

### Task 2：创建首页

**Files:**
- Create: `frontend/app/page.tsx`
- Create: `frontend/components/VideoInput.tsx`

- [ ] **Step 1: 写 VideoInput 组件测试（组件的行为约定）**

创建 `frontend/components/VideoInput.tsx`：

```tsx
'use client'

import { useState } from 'react'

interface Props {
  onSubmit: (url: string) => void
  isLoading: boolean
}

export default function VideoInput({ onSubmit, isLoading }: Props) {
  const [url, setUrl] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴抖音视频链接，或点击下方 Demo 直接体验"
          className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20
                     text-white placeholder-white/40 outline-none
                     focus:border-white/50 transition-colors text-sm"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="px-6 py-3 rounded-xl bg-white text-black font-medium text-sm
                     disabled:opacity-40 disabled:cursor-not-allowed
                     hover:bg-white/90 transition-colors whitespace-nowrap"
        >
          {isLoading ? '解析中...' : '开始分析'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: 创建首页**

创建 `frontend/app/page.tsx`：

```tsx
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import VideoInput from '@/components/VideoInput'
import { extractVideo, manualInput, diagnose } from '@/lib/api'
import { DEMO_CASES } from '@/lib/constants'
import type { VideoContent, DiagnosisResult, ApiError } from '@/lib/types'

type Step = 'idle' | 'extracting' | 'transcribing' | 'diagnosing' | 'error'

const STEP_MESSAGES: Record<Step, string> = {
  idle: '',
  extracting: '正在解析视频链接...',
  transcribing: '正在提取视频内容...',
  diagnosing: '正在分析视频内容（约5-10秒）...',
  error: '',
}

export default function HomePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualText, setManualText] = useState('')

  const processVideo = useCallback(async (video: VideoContent) => {
    setStep('diagnosing')
    const diagnosis = await diagnose(video)
    sessionStorage.setItem('videoContent', JSON.stringify(video))
    sessionStorage.setItem('diagnosis', JSON.stringify(diagnosis))
    router.push('/analyze')
  }, [router])

  const handleUrlSubmit = useCallback(async (url: string) => {
    setStep('extracting')
    setError(null)
    setShowManual(false)

    try {
      const video = await extractVideo(url)
      await processVideo(video)
    } catch (err: unknown) {
      const apiErr = err as ApiError
      if (apiErr.code === 'EXTRACT_FAILED' && apiErr.fallback_available) {
        setError('视频解析失败，请手动粘贴视频内容👇')
        setShowManual(true)
        setStep('idle')
      } else {
        setError(apiErr.error || '发生了未知错误，请重试')
        setStep('error')
      }
    }
  }, [processVideo])

  const handleManualSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualTitle.trim() || !manualText.trim()) return
    setStep('diagnosing')
    setError(null)
    try {
      const video = await manualInput(manualTitle, manualText)
      await processVideo(video)
    } catch (err: unknown) {
      const apiErr = err as ApiError
      setError(apiErr.error || '发生了未知错误，请重试')
      setStep('idle')
    }
  }, [manualTitle, manualText, processVideo])

  const handleDemoClick = useCallback((demoId: string) => {
    // Demo 案例直接从缓存加载，不调用 API
    const demoData = require(`@/public/demo/${demoId}.json`)
    sessionStorage.setItem('videoContent', JSON.stringify(demoData.videoContent))
    sessionStorage.setItem('diagnosis', JSON.stringify(demoData.diagnosis))
    sessionStorage.setItem('demoQuestions', JSON.stringify(demoData.questions))
    router.push('/analyze')
  }, [router])

  const isLoading = step !== 'idle' && step !== 'error'

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* 标题区 */}
      <div className="text-center mb-12 max-w-2xl">
        <h1 className="text-3xl font-bold mb-4 leading-tight">
          这条视频，对你成立吗？
        </h1>
        <p className="text-white/60 text-base leading-relaxed">
          在你被一条视频影响、做出决定之前<br/>
          帮你真正想清楚——它对你的具体情况，究竟成不成立
        </p>
      </div>

      {/* 输入区 */}
      <div className="w-full max-w-2xl mb-6">
        <VideoInput onSubmit={handleUrlSubmit} isLoading={isLoading} />
      </div>

      {/* 状态提示 */}
      {isLoading && (
        <p className="text-white/60 text-sm mb-4 animate-pulse">
          {STEP_MESSAGES[step]}
        </p>
      )}

      {/* 错误提示 */}
      {error && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}

      {/* 手动输入降级表单 */}
      {showManual && (
        <form onSubmit={handleManualSubmit}
          className="w-full max-w-2xl mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-white/60 text-xs mb-3">复制视频文字内容粘贴到下方：</p>
          <input
            type="text"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="视频标题（必填）"
            className="w-full mb-2 px-3 py-2 rounded-lg bg-white/10 text-sm
                       text-white placeholder-white/30 outline-none border border-white/10"
          />
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="视频文字内容（必填，粘贴字幕或描述）"
            rows={4}
            className="w-full mb-3 px-3 py-2 rounded-lg bg-white/10 text-sm
                       text-white placeholder-white/30 outline-none border border-white/10 resize-none"
          />
          <button type="submit" disabled={!manualTitle.trim() || !manualText.trim()}
            className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium
                       disabled:opacity-40">
            分析这个视频
          </button>
        </form>
      )}

      {/* Demo 案例 */}
      <div className="w-full max-w-2xl">
        <p className="text-white/30 text-xs text-center mb-4">— 或者直接体验预置案例 —</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DEMO_CASES.map((demo) => (
            <button
              key={demo.id}
              onClick={() => handleDemoClick(demo.id)}
              className="p-4 rounded-xl bg-white/5 border border-white/10 text-left
                         hover:bg-white/10 hover:border-white/20 transition-all group"
            >
              <div className="text-2xl mb-2">{demo.icon}</div>
              <div className="text-xs text-white/50 mb-1">{demo.label}</div>
              <div className="text-sm font-medium text-white/90 leading-snug">
                {demo.title}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 触发场景引导 */}
      <div className="mt-16 w-full max-w-2xl grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        {[
          { icon: '💰', text: '做决定之前，先问一下' },
          { icon: '👨‍👩‍👧', text: '帮你把话说清楚' },
          { icon: '🔁', text: '转发之前，一秒看清楚' },
        ].map(({ icon, text }) => (
          <div key={text} className="text-white/30 text-sm">
            <span className="text-lg">{icon}</span>
            <p className="mt-1">{text}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: 在浏览器查看首页**

访问 `http://localhost:3000`

Expected:
- 看到标题"这条视频，对你成立吗？"
- 看到链接输入框和"开始分析"按钮
- 看到三个 Demo 案例卡片
- 整体深色背景，排版正常

- [ ] **Step 4: 验证 TypeScript 无报错**

```bash
npx tsc --noEmit
```

如有类型错误，根据提示修复（常见：`require()` 在 TypeScript 中的用法，或 `@/public` 路径问题）。

Demo 加载部分如果报错，临时改为：

```tsx
const handleDemoClick = useCallback((demoId: string) => {
  // Demo 暂时用 fetch 加载
  fetch(`/demo/${demoId}.json`)
    .then(r => r.json())
    .then(data => {
      sessionStorage.setItem('videoContent', JSON.stringify(data.videoContent))
      sessionStorage.setItem('diagnosis', JSON.stringify(data.diagnosis))
      sessionStorage.setItem('demoQuestions', JSON.stringify(data.questions))
      router.push('/analyze')
    })
}, [router])
```

- [ ] **Step 5: Commit**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon
git add frontend/
git commit -m "feat: add frontend setup and home page with VideoInput component"
```

---

**Plan 07 完成标准：**
- [ ] `npm run dev` 启动无报错
- [ ] 浏览器访问 `http://localhost:3000` 看到首页完整布局
- [ ] 三个 Demo 案例卡片可见
- [ ] `npx tsc --noEmit` 无 TypeScript 错误
