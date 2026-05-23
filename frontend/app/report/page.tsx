'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('reportParams')
    if (!stored) { router.push('/'); return }
    const p: ReportParams = JSON.parse(stored)
    setParams(p)
  }, [router])

  useEffect(() => {
    if (!params || startedRef.current) return
    startedRef.current = true

    streamReport(
      params,
      (chunk) => {
        setContent((prev) => prev + chunk)
        // Auto-scroll to bottom
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
      },
      (id) => {
        setReportId(id)
        setStatus('done')
      },
      () => {
        setStatus('error')
      }
    )
  }, [params])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareUrl = reportId
    ? `${window.location.origin}/share/${reportId}`
    : null

  const handleShare = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f] sticky top-0 bg-[#0f0f0f]/95 backdrop-blur-sm z-10">
        <button
          onClick={() => router.push('/')}
          className="text-[#888] hover:text-white transition-colors text-sm"
        >
          ← 首页
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">个性化分析报告</span>
          {status === 'streaming' && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              生成中
            </span>
          )}
          {status === 'done' && (
            <span className="text-xs text-green-400">✓ 完成</span>
          )}
        </div>
        <div className="flex gap-2">
          {status === 'done' && (
            <>
              <button
                onClick={handleCopy}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#1f1f1f] hover:bg-[#2a2a2a] text-[#888] hover:text-white transition-colors"
              >
                {copied ? '已复制' : '复制'}
              </button>
              {shareUrl && (
                <button
                  onClick={handleShare}
                  className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-medium transition-colors"
                >
                  分享
                </button>
              )}
            </>
          )}
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Video context */}
        {params && (
          <div className="mb-8 pb-6 border-b border-[#1a1a1a]">
            <p className="text-xs text-[#444] mb-1">{params.author}</p>
            <h1 className="text-lg font-bold text-white">{params.title}</h1>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {params.diagnosis.types_display.map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Report content */}
        {status === 'error' ? (
          <div className="text-center py-20">
            <p className="text-red-400 mb-4">报告生成失败，请重试</p>
            <button onClick={() => router.push('/')} className="text-sm text-amber-400 underline">
              返回首页
            </button>
          </div>
        ) : (
          <div className="report-content">
            <ReactMarkdown>{content || ' '}</ReactMarkdown>
            {status === 'streaming' && (
              <span className="inline-block w-2 h-4 bg-amber-500 opacity-70 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}

        {/* Done state */}
        {status === 'done' && (
          <div className="mt-10 pt-8 border-t border-[#1a1a1a] text-center">
            <p className="text-xs text-[#555] mb-5">
              报告已生成 · 报告编号 {reportId}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.push('/')}
                className="px-5 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#222] text-[#888] hover:text-white text-sm border border-[#2a2a2a] transition-colors"
              >
                分析另一个视频
              </button>
              {shareUrl && (
                <button
                  onClick={handleShare}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors"
                >
                  {copied ? '链接已复制 ✓' : '分享报告'}
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-10" />
      </div>
    </div>
  )
}
