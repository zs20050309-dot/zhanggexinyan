# Plan 09: 前端问卷页

> **执行方式：** 逐步手动执行，每步在浏览器验证后再进行下一步。

**Goal:** `/chat` 页面展示动态问卷，逐题显示问题（含进度条），用户回答后提交进入报告页。支持选择题（点击即选）和填写题（文本输入）。

**Architecture:** 从 sessionStorage 读取 `diagnosis`，调用 `generateQuestionnaire()` 获取问题列表（Demo 模式下从 `demoQuestions` 直接读取跳过 API）；用户回答完毕后将 `answers` 写入 sessionStorage，跳转到 `/report`。

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS

---

### Task 1：创建 QuestionCard 组件

**Files:**
- Create: `frontend/components/QuestionCard.tsx`

- [ ] **Step 1: 创建 QuestionCard 组件**

创建 `frontend/components/QuestionCard.tsx`：

```tsx
'use client'

import type { Question } from '@/lib/types'

interface Props {
  question: Question
  current: number    // 1-based 当前题号
  total: number
  onAnswer: (answer: string) => void
  textValue: string
  onTextChange: (v: string) => void
}

export default function QuestionCard({
  question, current, total, onAnswer, textValue, onTextChange,
}: Props) {
  return (
    <div className="w-full max-w-xl mx-auto">
      {/* 进度信息 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-white/40">问题 {current} / {total}</span>
        <div className="flex-1 mx-4 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/50 rounded-full transition-all duration-500"
            style={{ width: `${(current / total) * 100}%` }}
          />
        </div>
      </div>

      {/* 问题文本 */}
      <h2 className="text-lg font-medium text-white/90 mb-6 leading-snug">
        {question.text}
      </h2>

      {/* 选择题选项 */}
      {question.type === 'choice' && question.options && (
        <div className="space-y-3">
          {question.options.map((opt) => (
            <button
              key={opt}
              onClick={() => onAnswer(opt)}
              className="w-full text-left px-4 py-3 rounded-xl border border-white/15
                         bg-white/5 text-sm text-white/80
                         hover:bg-white/10 hover:border-white/30
                         active:bg-white/20 transition-all"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* 填写题 */}
      {question.type === 'text' && (
        <div className="space-y-3">
          <textarea
            value={textValue}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="请简短描述（1-2句话即可）"
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15
                       text-sm text-white placeholder-white/30
                       outline-none focus:border-white/40 resize-none transition-colors"
          />
          <button
            onClick={() => onAnswer(textValue.trim())}
            disabled={!textValue.trim()}
            className="w-full py-3 rounded-xl bg-white text-black text-sm font-medium
                       disabled:opacity-40 disabled:cursor-not-allowed
                       hover:bg-white/90 transition-colors"
          >
            继续 →
          </button>
        </div>
      )}
    </div>
  )
}
```

---

### Task 2：创建问卷页

**Files:**
- Create: `frontend/app/chat/page.tsx`

- [ ] **Step 1: 创建 chat 目录及页面**

创建 `frontend/app/chat/page.tsx`：

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import QuestionCard from '@/components/QuestionCard'
import { generateQuestionnaire } from '@/lib/api'
import type { DiagnosisResult, Question, QAPair } from '@/lib/types'

export default function ChatPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<QAPair[]>([])
  const [textValue, setTextValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const diagnosisRaw = sessionStorage.getItem('diagnosis')
    if (!diagnosisRaw) {
      router.replace('/')
      return
    }

    // Demo 模式：直接用缓存的问题，跳过 API 调用
    const demoRaw = sessionStorage.getItem('demoQuestions')
    if (demoRaw) {
      setQuestions(JSON.parse(demoRaw))
      setLoading(false)
      return
    }

    // 正常模式：调用 API 生成问题
    const diagnosis: DiagnosisResult = JSON.parse(diagnosisRaw)
    generateQuestionnaire(diagnosis.video_id, diagnosis)
      .then((qs) => {
        setQuestions(qs)
        setLoading(false)
      })
      .catch(() => {
        setError('问题生成失败，请返回重试')
        setLoading(false)
      })
  }, [router])

  const handleAnswer = useCallback((answer: string) => {
    if (!answer) return
    const current = questions[currentIndex]
    const newAnswers = [...answers, { question: current.text, answer }]
    setAnswers(newAnswers)
    setTextValue('')

    const next = currentIndex + 1
    if (next >= questions.length) {
      // 全部回答完毕
      sessionStorage.setItem('answers', JSON.stringify(newAnswers))
      router.push('/report')
    } else {
      setCurrentIndex(next)
    }
  }, [answers, currentIndex, questions, router])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-white/40 text-sm animate-pulse">正在生成个性化问题...</p>
      </main>
    )
  }

  if (error || questions.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-sm">{error || '暂无问题'}</p>
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
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* 顶部说明 */}
      <div className="w-full max-w-xl mb-8 text-center">
        <p className="text-xs text-white/30">
          回答以下问题，帮助我们生成专属于你的分析
        </p>
      </div>

      <QuestionCard
        question={questions[currentIndex]}
        current={currentIndex + 1}
        total={questions.length}
        onAnswer={handleAnswer}
        textValue={textValue}
        onTextChange={setTextValue}
      />

      {/* 底部跳过（仅填写题显示） */}
      {questions[currentIndex]?.type === 'text' && (
        <button
          onClick={() => handleAnswer('（跳过）')}
          className="mt-6 text-xs text-white/25 hover:text-white/50 transition-colors"
        >
          跳过这题
        </button>
      )}
    </main>
  )
}
```

- [ ] **Step 2: 在浏览器验证问卷页**

通过 Demo 入口进入 analyze 页，点击"开始个性化分析"按钮。预期：
- 加载状态显示"正在生成个性化问题..."
- Demo 模式下立刻加载完毕，显示第一个问题
- 进度条显示"问题 1 / N"
- 选择题：点击选项立即进入下一题
- 填写题：输入文字后点"继续"按钮进入下一题
- 全部回答完毕后跳转到 `/report`（当前 404，正常）

- [ ] **Step 3: 验证 sessionStorage 为空时重定向**

直接访问 `http://localhost:3000/chat`，应跳转到首页。

- [ ] **Step 4: TypeScript 检查**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon/frontend
npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
cd /Users/ben99/Desktop/Vibecoding/dyhackthon
git add frontend/components/QuestionCard.tsx frontend/app/chat/
git commit -m "feat: add chat page with QuestionCard component and questionnaire flow"
```

---

**Plan 09 完成标准：**
- [ ] Demo 模式下问卷页正常加载，不调用后端 API
- [ ] 选择题点击即进入下一题，填写题需点确认按钮
- [ ] 进度条随答题进度正确更新
- [ ] 全部答完后 `answers` 写入 sessionStorage，跳转 `/report`
- [ ] 直接访问 `/chat` 时自动跳转首页
- [ ] `npx tsc --noEmit` 无错误
