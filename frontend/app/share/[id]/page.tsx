'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { motion } from 'framer-motion'
import { getReport } from '@/lib/api'
import type { SavedReport } from '@/lib/types'
import { Navbar } from '@/components/Navbar'
import { Logo } from '@/components/Logo'
import { getDemoReport } from '@/lib/demoReports'
import { DEMO_CASES } from '@/lib/constants'

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; report: SavedReport }
  | { status: 'error'; message: string }

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function SharePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (!id) return

    // Demo 模式：reportId 形如 demo_1_xxxx，直接走预置 markdown
    const demoMatch = id.match(/^(demo_\d+)/)
    if (demoMatch) {
      const videoId = demoMatch[1]
      const content = getDemoReport(videoId)
      const meta = DEMO_CASES.find((c) => c.id === videoId)
      if (content && meta) {
        setState({
          status: 'ready',
          report: {
            report_id: id,
            content,
            video_title: meta.title,
            diagnosis_types: [meta.label],
            created_at: new Date().toISOString(),
          },
        })
        return
      }
    }

    // 真实模式：调后端
    getReport(id)
      .then((report) => setState({ status: 'ready', report }))
      .catch((err) => {
        const msg = (err && typeof err === 'object' && 'error' in err)
          ? String(err.error)
          : '报告不存在或已过期'
        setState({ status: 'error', message: msg })
      })
  }, [id])

  /* ── Loading ── */
  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-[#080808] relative overflow-hidden flex flex-col items-center justify-center gap-5">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-amber-500/[0.06] blur-[120px]" />
        </div>
        <div className="relative w-10 h-10 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <p className="relative text-sm text-neutral-500">正在加载分享报告…</p>
      </div>
    )
  }

  /* ── Error ── */
  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col">
        <Navbar backTo="/" backLabel="首页" />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
          <div className="text-5xl mb-5">📭</div>
          <h1 className="text-xl font-black text-white mb-2 tracking-tight">报告未找到</h1>
          <p className="text-sm text-neutral-500 max-w-xs mx-auto mb-8">{state.message}</p>
          <button
            onClick={() => router.push('/')}
            className="px-7 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold text-sm transition-all shadow-[0_4px_20px_rgba(245,158,11,0.25)]"
          >
            去分析一个视频 →
          </button>
        </div>
      </div>
    )
  }

  const { report } = state

  return (
    <div className="min-h-screen bg-[#080808] relative overflow-hidden">

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[700px] h-[420px] rounded-full bg-amber-500/[0.05] blur-[120px]" />
      </div>

      <Navbar
        backTo="/"
        backLabel="首页"
        center={<span className="text-sm font-semibold text-white hidden sm:block">来自他人分享的报告</span>}
      />

      <div className="relative max-w-2xl mx-auto px-6 lg:px-8 py-12 pb-32">

        {/* Shared banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 px-4 py-3 rounded-2xl bg-amber-500/[0.06] border border-amber-500/20 flex items-center gap-3"
        >
          <span className="text-lg">🔗</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-400/80 font-semibold">这是一份来自他人的分享</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">由「长个心眼」AI 根据视频内容生成的个性化分析</p>
          </div>
        </motion.div>

        {/* Header context */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mb-10 pb-8 border-b border-white/[0.06]"
        >
          <p className="text-xs font-medium text-neutral-600 uppercase tracking-wider mb-2">
            分享于 {formatDate(report.created_at)}
          </p>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-4 leading-snug">
            {report.video_title}
          </h1>
          <div className="flex flex-wrap gap-2">
            {report.diagnosis_types.map((t) => (
              <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 font-medium">
                {t}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Report body */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="report-content"
        >
          <ReactMarkdown>{report.content}</ReactMarkdown>
        </motion.div>

        {/* CTA — invite to try */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative mt-16 p-8 rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.09] to-[#0c0c0c] text-center overflow-hidden"
        >
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-amber-500/10 blur-[80px] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-center mb-5">
              <Logo />
            </div>
            <h3 className="text-xl font-black text-white tracking-tight mb-2">看完了？换你来一份</h3>
            <p className="text-sm text-neutral-500 leading-relaxed mb-7 max-w-xs mx-auto">
              选一条让你犹豫的视频，AI 帮你分析它对你的具体情况是否成立
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-8 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95
                         text-black font-bold text-base transition-all duration-200
                         shadow-[0_8px_32px_rgba(245,158,11,0.28)]
                         hover:shadow-[0_8px_40px_rgba(245,158,11,0.40)]"
            >
              我也来分析一个 →
            </button>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="mt-10 text-center">
          <p className="text-[11px] text-neutral-700">
            报告编号 <span className="font-mono text-neutral-600">{report.report_id}</span> · Powered by 长个心眼
          </p>
        </div>
      </div>
    </div>
  )
}
