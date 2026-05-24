'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { generateQuestionnaire } from '@/lib/api'
import type { VideoContent, DiagnosisResult, Question, QAPair } from '@/lib/types'
import { Navbar } from '@/components/Navbar'
import { isDemoVideo, getDemoReport } from '@/lib/demoReports'

interface DemoData {
  videoContent: VideoContent
  diagnosis: DiagnosisResult
  questions?: Question[]
}

export default function ChatPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [demoData, setDemoData] = useState<DemoData | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionsSource, setQuestionsSource] = useState<'ai' | 'fallback'>('ai')
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [textInput, setTextInput] = useState('')
  const [direction, setDirection] = useState(1)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const stored = sessionStorage.getItem('demoData')
    if (!stored) { router.push('/'); return }

    const parsed: DemoData = JSON.parse(stored)
    setDemoData(parsed)

    // 主路径：调真实 AI 生成个性化问卷（demo 案例也走真实 API，因为我们有 transcript）
    // 兜底：如果 API 失败，用 JSON 里预置的 questions
    generateQuestionnaire(parsed.diagnosis.video_id, parsed.diagnosis)
      .then((res) => {
        setQuestions(res.questions)
        setQuestionsSource(res.source)
      })
      .catch(() => {
        if (parsed.questions?.length) {
          setQuestions(parsed.questions)
          setQuestionsSource('fallback')
        }
      })
      .finally(() => setLoading(false))
  }, [id, router])

  const currentQ = questions[current]
  const isLast = current === questions.length - 1
  const answeredCount = Object.keys(answers).length

  const goNext = useCallback(() => {
    setDirection(1)
    setCurrent((c) => c + 1)
    setTextInput('')
    setTimeout(() => textRef.current?.focus(), 100)
  }, [])

  const handleChoice = useCallback((opt: string) => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: opt }))
    if (!isLast) setTimeout(goNext, 260)
  }, [currentQ, isLast, goNext])

  const handleTextNext = useCallback(() => {
    const val = textInput.trim()
    if (!val) return
    setAnswers((prev) => ({ ...prev, [currentQ.id]: val }))
    if (!isLast) goNext()
  }, [textInput, currentQ, isLast, goNext])

  const handlePrev = useCallback(() => {
    if (current === 0) return
    setDirection(-1)
    setCurrent((c) => c - 1)
    setTextInput(answers[questions[current - 1]?.id] ?? '')
  }, [current, answers, questions])

  const handleSubmit = useCallback(() => {
    if (!demoData) return
    const finalAnswers = { ...answers }
    if (currentQ?.type === 'text' && textInput.trim()) {
      finalAnswers[currentQ.id] = textInput.trim()
    }

    const qaPairs: QAPair[] = questions.map((q) => ({
      question: q.text,
      answer: finalAnswers[q.id] ?? '（未作答）',
    }))

    // Demo 模式透传 cachedReport 给 /report 页，避免它再调后端
    const cachedReport = isDemoVideo(demoData.diagnosis.video_id)
      ? getDemoReport(demoData.diagnosis.video_id)
      : null

    sessionStorage.setItem('reportParams', JSON.stringify({
      video_id: demoData.diagnosis.video_id,
      transcript: demoData.videoContent.transcript,
      title: demoData.videoContent.title,
      author: demoData.videoContent.author,
      diagnosis: demoData.diagnosis,
      answers: qaPairs,
      search_result: null,
      cachedReport,
    }))
    router.push('/report')
  }, [demoData, questions, answers, currentQ, textInput, router])

  const hasCurrentAnswer = currentQ
    ? (answers[currentQ.id]?.length > 0) || (currentQ.type === 'text' && textInput.trim().length > 0)
    : false

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] relative overflow-hidden flex flex-col items-center justify-center gap-5">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-amber-500/[0.06] blur-[120px]" />
        </div>
        <div className="relative">
          <div className="w-12 h-12 border-2 border-amber-500/15 border-t-amber-500 rounded-full animate-spin" />
          <div className="absolute inset-0 w-12 h-12 rounded-full bg-amber-500/20 blur-2xl animate-pulse" />
        </div>
        <p className="relative text-sm text-neutral-500 font-medium">AI 正在为你生成个性化问题…</p>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center gap-4">
        <p className="text-neutral-500 text-sm">问题加载失败</p>
        <button onClick={() => router.push('/')} className="text-amber-400 text-sm underline underline-offset-2">
          返回首页
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] relative overflow-hidden flex flex-col">

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-amber-500/[0.045] blur-[120px]" />
      </div>

      <Navbar
        backTo={`/analyze/${id}`}
        backLabel="返回结果"
        center={
          <div className="hidden sm:flex items-center gap-1.5">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current
                    ? 'w-5 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]'
                    : i < current
                    ? 'w-1.5 bg-amber-500/40'
                    : 'w-1.5 bg-white/10'
                }`}
              />
            ))}
          </div>
        }
        right={
          <span className="text-xs text-neutral-500 tabular-nums">
            {current + 1} / {questions.length}
          </span>
        }
      />

      {/* Content */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">

          {/* Mobile-only step dots */}
          <div className="sm:hidden flex items-center justify-center gap-1.5 mb-6">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current
                    ? 'w-5 bg-amber-500'
                    : i < current
                    ? 'w-1.5 bg-amber-500/40'
                    : 'w-1.5 bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className="h-0.5 w-full bg-white/[0.06] rounded-full mb-10 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-500/80 to-amber-400 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"
              animate={{ width: `${(answeredCount / questions.length) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {/* Fallback notice — AI 不可用时柔和提示，不打断流程 */}
          {questionsSource === 'fallback' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 px-3 py-2 rounded-lg bg-amber-500/[0.05] border border-amber-500/15 flex items-center gap-2"
            >
              <span className="text-xs text-amber-400/80">⚠ AI 问卷生成暂时不可用，已使用通用问题</span>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: direction * 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -direction * 32 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {/* Question */}
              <div className="mb-8">
                <p className="text-xs font-semibold text-amber-400/70 tracking-widest uppercase mb-4 flex items-center gap-2">
                  <span className="w-4 h-px bg-amber-400/40" />
                  问题 {current + 1}
                </p>
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-snug tracking-tight">
                  {currentQ.text}
                </h2>
              </div>

              {/* Choice options */}
              {currentQ.type === 'choice' && currentQ.options && (
                <div className="flex flex-col gap-3">
                  {currentQ.options.map((opt, optIdx) => {
                    const sel = answers[currentQ.id] === opt
                    return (
                      <button
                        key={opt}
                        onClick={() => handleChoice(opt)}
                        className={`group relative w-full text-left px-5 py-4 rounded-2xl border text-sm font-medium transition-all duration-200 active:scale-[0.98] overflow-hidden
                          ${sel
                            ? 'bg-amber-500/12 border-amber-500/50 text-white shadow-[0_0_24px_rgba(245,158,11,0.10)]'
                            : 'bg-[#0f0f0f] border-white/[0.07] text-neutral-300 hover:border-white/[0.18] hover:text-white hover:bg-[#141414]'
                          }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            sel ? 'border-amber-500 bg-amber-500' : 'border-neutral-700 group-hover:border-neutral-500'
                          }`}>
                            {sel
                              ? <span className="w-1.5 h-1.5 rounded-full bg-black" />
                              : <span className="text-[10px] text-neutral-600 font-mono font-bold">{String.fromCharCode(65 + optIdx)}</span>
                            }
                          </span>
                          <span className="flex-1">{opt}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Text input */}
              {currentQ.type === 'text' && (
                <div>
                  <textarea
                    ref={textRef}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        isLast ? handleSubmit() : handleTextNext()
                      }
                    }}
                    placeholder="用自己的话说说..."
                    rows={4}
                    autoFocus
                    className="w-full px-5 py-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.07]
                               text-white placeholder-neutral-700 text-sm leading-relaxed resize-none outline-none
                               focus:border-amber-500/50 focus:bg-[#111] focus:shadow-[0_0_0_3px_rgba(245,158,11,0.08)]
                               transition-all duration-200"
                  />
                  <p className="text-xs text-neutral-700 mt-2 text-right">
                    {typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + Enter 继续
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={handlePrev}
              className={`flex items-center gap-1.5 text-sm transition-colors ${
                current === 0
                  ? 'text-neutral-800 cursor-default'
                  : 'text-neutral-500 hover:text-white'
              }`}
              disabled={current === 0}
            >
              ← 上一题
            </button>

            {isLast ? (
              <button
                onClick={handleSubmit}
                disabled={!hasCurrentAnswer}
                className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95
                           text-black font-bold text-sm transition-all duration-200
                           disabled:opacity-25 disabled:cursor-not-allowed
                           shadow-[0_4px_20px_rgba(245,158,11,0.30)]
                           hover:shadow-[0_8px_28px_rgba(245,158,11,0.40)]"
              >
                生成分析报告
                <span>→</span>
              </button>
            ) : (
              currentQ?.type === 'text' && (
                <button
                  onClick={handleTextNext}
                  disabled={!textInput.trim()}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-[#1a1a1a] hover:bg-[#222] active:scale-95
                             text-white font-semibold text-sm border border-white/[0.08] hover:border-white/[0.15]
                             transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  下一题 →
                </button>
              )
            )}
          </div>

          {/* Answered summary */}
          {current > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-12 pt-8 border-t border-white/[0.04]"
            >
              <p className="text-[11px] text-neutral-700 mb-4 uppercase tracking-widest font-semibold">已回答</p>
              <div className="flex flex-col gap-2">
                {questions.slice(0, current).map((q, qi) => (
                  <button
                    key={q.id}
                    onClick={() => { setDirection(-1); setCurrent(qi); setTextInput(answers[q.id] ?? '') }}
                    className="flex items-start gap-3 text-left group hover:bg-white/[0.02] rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                  >
                    <span className="text-[11px] text-neutral-700 shrink-0 mt-0.5 tabular-nums font-mono">Q{qi + 1}</span>
                    <span className="text-xs text-neutral-600 flex-1 truncate group-hover:text-neutral-400 transition-colors">{q.text}</span>
                    <span className="text-xs text-neutral-500 shrink-0 max-w-[110px] truncate">{answers[q.id]}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
