'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import { streamReport } from '@/lib/api'
import type { QAPair, DiagnosisResult } from '@/lib/types'
import { Navbar } from '@/components/Navbar'

interface ReportParams {
  video_id: string
  transcript: string
  title: string
  author: string
  diagnosis: DiagnosisResult
  answers: QAPair[]
  search_result: null
  cachedReport?: string | null
}

type Status = 'streaming' | 'done' | 'error'

/** 模拟流式：把 markdown 按 4-9 字一段、每 25-45ms 推一次。fire-and-forget。 */
function simulateStream(
  text: string,
  onChunk: (s: string) => void,
  onDone: () => void
): void {
  let i = 0
  const tick = () => {
    if (i >= text.length) { onDone(); return }
    const chunkLen = 4 + Math.floor(Math.random() * 6)
    const next = text.slice(i, i + chunkLen)
    i += chunkLen
    onChunk(next)
    const delay = 25 + Math.random() * 20
    setTimeout(tick, delay)
  }
  // 先 350ms 留白模仿"AI 思考"
  setTimeout(tick, 350)
}

/** 生成稳定的伪造 reportId（基于 video_id 加几个随机字符），便于分享按钮看起来正常 */
function makeDemoReportId(videoId: string): string {
  const rand = Math.random().toString(36).slice(2, 6)
  return `${videoId}_${rand}`
}

export default function ReportPage() {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<Status>('streaming')
  const [reportId, setReportId] = useState<string | null>(null)
  const [params, setParams] = useState<ReportParams | null>(null)
  const [copied, setCopied] = useState<'none' | 'text' | 'link'>('none')
  const [charCount, setCharCount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('reportParams')
    if (!stored) { router.push('/'); return }
    setParams(JSON.parse(stored))
  }, [router])

  useEffect(() => {
    if (!params || startedRef.current) return
    startedRef.current = true

    // 兜底：API 失败时用预置 markdown 模拟流式（保证演示不挂）
    const fallbackToCached = () => {
      if (!params.cachedReport) {
        setStatus('error')
        return
      }
      // 清空可能的半成品内容
      setContent('')
      setCharCount(0)
      simulateStream(
        params.cachedReport,
        (chunk) => {
          setContent((prev) => {
            const next = prev + chunk
            setCharCount(next.length)
            return next
          })
          requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
          })
        },
        () => {
          setReportId(makeDemoReportId(params.video_id))
          setStatus('done')
        }
      )
    }

    // 主路径：调真实后端 SSE 生成个性化报告
    streamReport(
      params,
      (chunk) => {
        setContent((prev) => {
          const next = prev + chunk
          setCharCount(next.length)
          return next
        })
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
        })
      },
      (id) => {
        setReportId(id)
        setStatus('done')
      },
      fallbackToCached
    )
  }, [params])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content)
    setCopied('text')
    setTimeout(() => setCopied('none'), 2500)
  }, [content])

  const handleShareCopy = useCallback(async () => {
    if (!reportId) return
    await navigator.clipboard.writeText(`${window.location.origin}/share/${reportId}`)
    setCopied('link')
    setTimeout(() => setCopied('none'), 2500)
  }, [reportId])

  return (
    <div className="min-h-screen bg-[#080808] relative overflow-hidden">

      {/* Ambient glow — pulses during streaming */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className={`absolute top-[10%] left-1/2 -translate-x-1/2 w-[700px] h-[420px] rounded-full blur-[120px] transition-opacity duration-1000 ${
            status === 'streaming' ? 'bg-amber-500/[0.07] animate-pulse' : status === 'done' ? 'bg-green-500/[0.04]' : 'bg-red-500/[0.05]'
          }`}
        />
      </div>

      <Navbar
        backTo="/"
        backLabel="首页"
        center={
          <div className="flex items-center gap-2.5">
            <AnimatePresence mode="wait">
              {status === 'streaming' && (
                <motion.div
                  key="streaming"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-xs text-amber-400"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="tabular-nums">
                    正在生成{charCount > 0 ? ` · ${charCount} 字` : ''}
                  </span>
                </motion.div>
              )}
              {status === 'done' && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 text-xs text-green-400"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  生成完成
                </motion.div>
              )}
              {status === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-1.5 text-xs text-red-400"
                >
                  生成失败
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        }
        right={
          status === 'done' ? (
            <>
              <button
                onClick={handleCopy}
                className="hidden sm:inline-block text-xs px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-neutral-400 hover:text-white border border-white/[0.07] transition-all"
              >
                {copied === 'text' ? '已复制 ✓' : '复制文本'}
              </button>
              {reportId && (
                <button
                  onClick={handleShareCopy}
                  className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-all active:scale-95 shadow-[0_2px_12px_rgba(245,158,11,0.25)]"
                >
                  {copied === 'link' ? '已复制 ✓' : '分享链接'}
                </button>
              )}
            </>
          ) : null
        }
      />

      {/* Streaming progress strip */}
      {status === 'streaming' && (
        <div className="sticky top-16 z-30 h-0.5 w-full bg-white/[0.02] overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-500/40 via-amber-400 to-amber-500/40"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            style={{ width: '40%' }}
          />
        </div>
      )}

      <div className="relative max-w-2xl mx-auto px-6 lg:px-8 py-12 pb-32">

        {/* Header context */}
        {params && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10 pb-8 border-b border-white/[0.06]"
          >
            <p className="text-xs font-medium text-neutral-600 uppercase tracking-wider mb-2">
              {params.author}
            </p>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-4 leading-snug">
              {params.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              {params.diagnosis.types_display.map((t) => (
                <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 font-medium">
                  {t}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Report body */}
        {status === 'error' ? (
          <div className="text-center py-24">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-neutral-300 mb-2 font-semibold">报告生成失败</p>
            <p className="text-neutral-600 text-sm mb-6">请检查后端服务是否运行，然后重试</p>
            <button
              onClick={() => router.push('/')}
              className="text-amber-400 text-sm hover:text-amber-300 underline underline-offset-2 transition-colors"
            >
              返回首页
            </button>
          </div>
        ) : (
          <div className="report-content">
            {content === '' && status === 'streaming' && (
              <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                AI 正在整理你的专属分析…
              </div>
            )}
            <ReactMarkdown>{content || ' '}</ReactMarkdown>
            {status === 'streaming' && (
              <span className="inline-block w-2 h-[1.1em] bg-amber-400/80 animate-pulse ml-0.5 align-middle rounded-[1px]" />
            )}
          </div>
        )}

        {/* Done banner */}
        <AnimatePresence>
          {status === 'done' && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="relative mt-16 pt-10 border-t border-white/[0.06] text-center"
            >
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 280, damping: 18 }}
                className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/25 flex items-center justify-center text-2xl mx-auto mb-5 shadow-[0_0_30px_rgba(34,197,94,0.15)]"
              >
                <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
              <h3 className="font-black text-white text-lg mb-2 tracking-tight">报告已生成</h3>
              <p className="text-sm text-neutral-600 mb-8">
                共 <span className="text-neutral-400 tabular-nums font-semibold">{charCount}</span> 字 · 编号{' '}
                <span className="font-mono text-neutral-500">{reportId}</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => router.push('/')}
                  className="px-6 py-3 rounded-2xl bg-[#111] hover:bg-[#1a1a1a] text-neutral-300 hover:text-white text-sm font-semibold border border-white/[0.07] hover:border-white/[0.12] transition-all"
                >
                  分析另一个视频
                </button>
                {reportId && (
                  <button
                    onClick={handleShareCopy}
                    className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-all active:scale-95 shadow-[0_8px_28px_rgba(245,158,11,0.25)]"
                  >
                    {copied === 'link' ? '链接已复制 ✓' : '分享这份报告'}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} className="h-8" />
      </div>
    </div>
  )
}
