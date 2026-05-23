'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { generateQuestionnaire } from '@/lib/api'
import type { VideoContent, DiagnosisResult, Question, QAPair } from '@/lib/types'

interface DemoData {
  videoContent: VideoContent
  diagnosis: DiagnosisResult
}

export default function ChatPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [data, setData] = useState<DemoData | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [textInput, setTextInput] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('demoData')
    if (!stored) { router.push('/'); return }
    const parsed: DemoData = JSON.parse(stored)
    setData(parsed)

    generateQuestionnaire(parsed.diagnosis.video_id, parsed.diagnosis)
      .then((qs) => setQuestions(qs))
      .catch(() => {
        // fallback: use questions from demo JSON if AI fails
        const demo = JSON.parse(stored)
        if (demo.questions) setQuestions(demo.questions)
      })
      .finally(() => setLoading(false))
  }, [id, router])

  const currentQ = questions[current]
  const isLast = current === questions.length - 1

  const handleChoice = useCallback((opt: string) => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: opt }))
    setTimeout(() => {
      if (isLast) return
      setCurrent((c) => c + 1)
      setTextInput('')
    }, 200)
  }, [currentQ, isLast])

  const handleTextNext = useCallback(() => {
    const val = textInput.trim()
    if (!val) return
    setAnswers((prev) => ({ ...prev, [currentQ.id]: val }))
    if (isLast) return
    setCurrent((c) => c + 1)
    setTextInput('')
  }, [textInput, currentQ, isLast])

  const handleSubmit = useCallback(() => {
    if (!data) return
    // Collect QAPairs
    const qaPairs: QAPair[] = questions.map((q) => ({
      question: q.text,
      answer: answers[q.id] ?? '（未作答）',
    }))

    const reportParams = {
      video_id: data.diagnosis.video_id,
      transcript: data.videoContent.transcript,
      title: data.videoContent.title,
      author: data.videoContent.author,
      diagnosis: data.diagnosis,
      answers: qaPairs,
      search_result: null,
    }
    sessionStorage.setItem('reportParams', JSON.stringify(reportParams))
    router.push('/report')
  }, [data, questions, answers, router])

  const hasAnsweredCurrent = currentQ ? (answers[currentQ.id] ?? '').length > 0 : false
  const allAnswered = questions.length > 0 && questions.every((q) => (answers[q.id] ?? '').length > 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[#555] text-sm">AI 正在生成个性化问题...</p>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-[#555] text-sm">
        加载失败，<button onClick={() => router.push('/')} className="text-amber-400 underline">返回首页</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
        <button
          onClick={() => router.push(`/analyze/${id}`)}
          className="text-[#888] hover:text-white transition-colors text-sm"
        >
          ← 返回
        </button>
        <span className="text-sm font-semibold text-white">个性化问卷</span>
        <span className="text-xs text-[#555]">{current + 1} / {questions.length}</span>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-10">

        {/* Progress bar */}
        <div className="h-1 w-full bg-[#1f1f1f] rounded-full mb-10 overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${((current + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="mb-8">
          <p className="text-xs text-amber-400/60 font-medium mb-3">问题 {current + 1}</p>
          <h2 className="text-xl font-bold text-white leading-snug">{currentQ.text}</h2>
        </div>

        {/* Answers */}
        {currentQ.type === 'choice' && currentQ.options && (
          <div className="flex flex-col gap-3 mb-8">
            {currentQ.options.map((opt) => {
              const selected = answers[currentQ.id] === opt
              return (
                <button
                  key={opt}
                  onClick={() => handleChoice(opt)}
                  className={`w-full text-left px-5 py-4 rounded-xl border text-sm font-medium transition-all duration-150
                    ${selected
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                      : 'bg-[#141414] border-[#2a2a2a] text-[#ccc] hover:border-[#444] hover:bg-[#1a1a1a]'
                    }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        )}

        {currentQ.type === 'text' && (
          <div className="mb-8">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="用自己的话说说..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-[#141414] border border-[#2a2a2a] text-[#f0f0f0]
                         placeholder-[#444] text-sm resize-none outline-none
                         focus:border-amber-500/50 transition-colors"
            />
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          {!isLast && currentQ.type === 'text' && (
            <button
              onClick={handleTextNext}
              disabled={!textInput.trim()}
              className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              下一题 →
            </button>
          )}

          {isLast && (
            <button
              onClick={handleSubmit}
              disabled={submitting || !hasAnsweredCurrent && currentQ.type === 'text' && !textInput.trim()}
              className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? '生成中...' : '生成我的分析报告 →'}
            </button>
          )}
        </div>

        {/* Already answered prev questions summary */}
        {current > 0 && (
          <div className="mt-10 pt-6 border-t border-[#1a1a1a]">
            <p className="text-xs text-[#444] mb-3">已回答</p>
            <div className="flex flex-col gap-2">
              {questions.slice(0, current).map((q) => (
                <div key={q.id} className="flex items-start gap-2 text-xs">
                  <span className="text-[#333] shrink-0 mt-0.5">Q{questions.indexOf(q) + 1}.</span>
                  <span className="text-[#555] flex-1 truncate">{q.text}</span>
                  <span className="text-[#888] shrink-0 max-w-[100px] truncate">{answers[q.id]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
