# Plan 08: 前端诊断结果页

> **执行方式：** 逐步手动执行，每步在浏览器验证后再进行下一步。

**Goal:** `/analyze` 页面展示视频诊断结果，包含风险评分仪表盘、内容类型标签、核心问题说明，以及进入个性化分析的入口按钮。

**Architecture:** 读取 sessionStorage 中的 `videoContent` 和 `diagnosis`，纯前端渲染，无额外 API 调用。Demo 模式下同样从 sessionStorage 读取，行为一致。

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS

---

### Task 1：创建 RiskGauge 组件

**Files:**
- Create: `frontend/components/RiskGauge.tsx`

- [ ] **Step 1: 创建 RiskGauge 组件**

创建 `frontend/components/RiskGauge.tsx`：

```tsx
'use client'

interface Props {
  score: number  // 0-100
  level: 'low' | 'medium' | 'high' | 'critical'
}

const LEVEL_CONFIG = {
  low:      { label: '影响较低', color: '#4ade80', bg: 'bg-green-500/10',  border: 'border-green-500/30' },
  medium:   { label: '中等影响', color: '#facc15', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  high:     { label: '影响较高', color: '#f97316', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  critical: { label: '强烈影响', color: '#ef4444', bg: 'bg-red-500/10',    border: 'border-red-500/30' },
}

export default function RiskGauge({ score, level }: Props) {
  const config = LEVEL_CONFIG[level]
  // 半圆弧：stroke-dasharray 基于 circumference，半圆 = 半周长
  // radius=54, circumference=2πr≈339, 半圆≈169.6
  const HALF_CIRC = 169.6
  const filled = (score / 100) * HALF_CIRC

  return (
    <div className={`flex flex-col items-center p-6 rounded-2xl border ${config.bg} ${config.border}`}>
      {/* SVG 半圆仪表盘 */}
      <svg width="160" height="90" viewBox="0 0 160 90">
        {/* 背景弧 */}
        <path
          d="M 10 80 A 70 70 0 0 1 150 80"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* 进度弧 */}
        <path
          d="M 10 80 A 70 70 0 0 1 150 80"
          fill="none"
          stroke={config.color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${HALF_CIRC}`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        {/* 分数文字 */}
        <text x="80" y="72" textAnchor="middle" fill="white" fontSize="28" fontWeight="bold">
          {score}
        </text>
      </svg>

      {/* 风险等级标签 */}
      <div className="mt-2 text-sm font-medium" style={{ color: config.color }}>
        {config.label}
      </div>
      <div className="mt-1 text-xs text-white/40">操控风险评分（满分100）</div>
    </div>
  )
}
```

- [ ] **Step 2: 在浏览器确认样式（稍后随 analyze 页一起验证）**

---

### Task 2：创建诊断结果页

**Files:**
- Create: `frontend/app/analyze/page.tsx`

- [ ] **Step 1: 创建 analyze 目录及页面**

创建 `frontend/app/analyze/page.tsx`：

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import RiskGauge from '@/components/RiskGauge'
import type { VideoContent, DiagnosisResult } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  anxiety_selling:    '😰 焦虑贩卖型',
  info_gap_harvesting:'🎯 信息差收割型',
  conflict_provoking: '⚡ 矛盾挑起型',
  pseudo_science_ad:  '🔬 伪科普软广型',
}

const TYPE_COLORS: Record<string, string> = {
  anxiety_selling:    'bg-orange-500/15 border-orange-500/30 text-orange-300',
  info_gap_harvesting:'bg-blue-500/15   border-blue-500/30   text-blue-300',
  conflict_provoking: 'bg-red-500/15    border-red-500/30    text-red-300',
  pseudo_science_ad:  'bg-purple-500/15 border-purple-500/30 text-purple-300',
}

export default function AnalyzePage() {
  const router = useRouter()
  const [video, setVideo] = useState<VideoContent | null>(null)
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null)

  useEffect(() => {
    const v = sessionStorage.getItem('videoContent')
    const d = sessionStorage.getItem('diagnosis')
    if (!v || !d) {
      router.replace('/')
      return
    }
    setVideo(JSON.parse(v))
    setDiagnosis(JSON.parse(d))
  }, [router])

  if (!video || !diagnosis) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-white/40 text-sm">加载中...</p>
      </main>
    )
  }

  const handleStart = () => {
    router.push('/chat')
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">
      {/* 顶部导航 */}
      <div className="w-full max-w-2xl flex items-center mb-8">
        <button
          onClick={() => router.push('/')}
          className="text-white/40 text-sm hover:text-white/70 transition-colors"
        >
          ← 返回
        </button>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* 视频信息 */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-xs text-white/40 mb-1">正在分析</p>
          <p className="text-sm text-white/80 font-medium leading-snug line-clamp-2">
            {video.title || '（未知标题）'}
          </p>
          {video.author && (
            <p className="text-xs text-white/40 mt-1">@{video.author}</p>
          )}
        </div>

        {/* 风险评分 */}
        <div className="flex flex-col items-center">
          <RiskGauge score={diagnosis.risk_score} level={diagnosis.risk_level} />
        </div>

        {/* 内容类型标签 */}
        <div>
          <p className="text-xs text-white/40 mb-3">识别出的内容类型</p>
          <div className="flex flex-wrap gap-2">
            {diagnosis.types.map((type) => (
              <span
                key={type}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${TYPE_COLORS[type] ?? 'bg-white/10 border-white/20 text-white/60'}`}
              >
                {TYPE_LABELS[type] ?? type}
              </span>
            ))}
          </div>
        </div>

        {/* 核心问题 */}
        <div className="p-5 rounded-xl bg-white/5 border border-white/10">
          <p className="text-xs text-white/40 mb-2">核心问题</p>
          <p className="text-sm text-white/85 leading-relaxed">{diagnosis.core_issue}</p>
        </div>

        {/* 缺失前提 */}
        {diagnosis.missing_premises && diagnosis.missing_premises.length > 0 && (
          <div className="p-5 rounded-xl bg-white/5 border border-white/10">
            <p className="text-xs text-white/40 mb-3">这条视频省略了哪些重要前提？</p>
            <ul className="space-y-2">
              {diagnosis.missing_premises.map((premise, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/75">
                  <span className="text-white/30 mt-0.5">·</span>
                  <span>{premise}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 情绪操控 & 商业意图（可选字段） */}
        {(diagnosis.emotional_manipulation || diagnosis.commercial_intent) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {diagnosis.emotional_manipulation && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-white/40 mb-1">情绪操控手法</p>
                <p className="text-sm text-white/75">{diagnosis.emotional_manipulation}</p>
              </div>
            )}
            {diagnosis.commercial_intent && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-white/40 mb-1">商业意图</p>
                <p className="text-sm text-white/75">{diagnosis.commercial_intent}</p>
              </div>
            )}
          </div>
        )}

        {/* CTA 按钮 */}
        <button
          onClick={handleStart}
          className="w-full py-4 rounded-xl bg-white text-black font-semibold text-base
                     hover:bg-white/90 transition-colors"
        >
          开始个性化分析 →
        </button>

        <p className="text-center text-xs text-white/30">
          回答 3-5 个问题，得到专属于你情况的分析报告
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: 在浏览器测试 analyze 页面**

先通过首页 Demo 入口进入（点任意一个 Demo 卡片），验证：
- 看到视频标题
- 看到风险评分半圆仪表盘，数字正确
- 看到内容类型彩色标签
- 看到核心问题文本
- 看到缺失前提列表
- "开始个性化分析"按钮可点击（点击后进入 /chat，此时 /chat 不存在会跳 404，正常）

- [ ] **Step 3: 验证 sessionStorage 为空时重定向**

直接访问 `http://localhost:3000/analyze`（不经过首页），应立即跳转回首页。

- [ ] **Step 4: TypeScript 检查**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/frontend
npx tsc --noEmit
```

Expected: 无错误或只有与 `/chat` `/report` 页面不存在相关的非关键 warning。

- [ ] **Step 5: Commit**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon
git add frontend/components/RiskGauge.tsx frontend/app/analyze/
git commit -m "feat: add analyze page with RiskGauge component and diagnosis display"
```

---

**Plan 08 完成标准：**
- [ ] Demo 入口可完整跳转到 `/analyze` 页面并展示诊断结果
- [ ] RiskGauge 半圆仪表盘按分数填充，颜色与风险等级匹配
- [ ] 直接访问 `/analyze` 时自动跳转到首页
- [ ] `npx tsc --noEmit` 无 TypeScript 错误
