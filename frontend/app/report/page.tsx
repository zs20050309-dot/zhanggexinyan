'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import { streamReport } from '@/lib/api'
import type { QAPair, DiagnosisResult } from '@/lib/types'

interface ReportParams {
  video_id: string
  transcript: string
  title: string
  author: string
  diagnosis: DiagnosisResult
  answers: QAPair[]
  search_result: null
}

type Status = 'streaming' | 'done' | 'error'

export default function ReportPage() {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<Status>('streaming')
  const [reportId, setReportId] = useState<string | null>(null)
  const [params, setParams] = useState<ReportParams | null>(null)
  const [copied, setCopied] = useState(false)
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
      () => setStatus('error')
    )
  }, [params])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }, [content])

  const handleShareCopy = useCallback(async () => {
    if (!reportId) return
    await navigator.clipboard.writeText(`${window.location.origin}/share/${reportId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }, [reportId])

  return (
    <div className="min-h-screen bg-[#080808]">

      {/* Navbar — sticky */}
      <nav className="sticky top-0 z-40 h-16 border-b border-white/[0.06] bg-[#080808]/92 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6 lg:px-10">
          <button
            onClick={() => router.push('/')}
            className="group flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-sm"
          >
            <span className="inline-block group-hover:-translate-x-0.5 transition-transform">←</span>
            首页
          </button>

          <div className="flex items-center gap-2.5">
            <AnimatePresence mode="wait">
              {status === 'streaming' && (
                <motion.div
                  key="streaming"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-xs text-amber-400"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  正在生成 {charCount > 0 ? `(${charCount} 字)` : ''}
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
            </AnimatePresence>
            <span className="text-sm font-semibold text-white hidden sm:block">个性化分析报告</span>
          </div>

          <div className="flex items-center gap-2">
            {status === 'done' && (
              <>
                <button
                  onClick={handleCopy}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-neutral-400 hover:text-white border border-white/[0.07] transition-all"
                >
                  {copied ? '已复制 ✓' : '复制文本'}
                </button>
                {reportId && (
                  <button
                    onClick={handleShareCopy}
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-all active:scale-95"
                  >
                    分享链接
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 lg:px-8 py-12 pb-32">

        {/* Header context */}
        {params && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="mb-10 pb-8 border-b border-white/[0.06]"
          >
            <p className="text-xs font-medium text-neutral-600 uppercase tracking-wider mb-2">
              {params.author}
            </p>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-4">
              {params.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              {params.diagnosis.types_display.map((t) => (
                <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
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
            <p className="text-neutral-400 mb-2">报告生成失败</p>
            <p className="text-neutral-600 text-sm mb-6">请检查后端服务是否运行，然后重试</p>
            <button onClick={() => router.push('/')} className="text-amber-400 text-sm underline underline-offset-2">
              返回首页
            </button>
          </div>
        ) : (
          <div className="report-content">
            <ReactMarkdown>{content || ' '}</ReactMarkdown>
            {status === 'streaming' && (
              <span className="inline-block w-2 h-[1.1em] bg-amber-400/70 animate-pulse ml-0.5 align-middle rounded-[1px]" />
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
              className="mt-16 pt-10 border-t border-white/[0.06] text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-xl mx-auto mb-5">
                ✓
              </div>
              <h3 className="font-black text-white text-lg mb-2 tracking-tight">报告已生成</h3>
              <p className="text-sm text-neutral-600 mb-8">
                共 {charCount} 字 · 报告编号 <span className="font-mono text-neutral-500">{reportId}</span>
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
                    className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-all active:scale-95 shadow-[0_4px_20px_rgba(245,158,11,0.2)]"
                  >
                    {copied ? '链接已复制 ✓' : '分享这份报告'}
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
