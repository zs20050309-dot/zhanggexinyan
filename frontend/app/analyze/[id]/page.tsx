'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import type { VideoContent, DiagnosisResult } from '@/lib/types'

interface DemoData {
  videoContent: VideoContent
  diagnosis: DiagnosisResult
}

const RISK = {
  low:      { label: '低风险',   stroke: '#22c55e', glow: 'rgba(34,197,94,0.35)',   textCls: 'text-green-400',  gradFrom: 'from-green-500/[0.07]',  border: 'border-green-500/20'  },
  medium:   { label: '中风险',   stroke: '#f59e0b', glow: 'rgba(245,158,11,0.35)',  textCls: 'text-amber-400',  gradFrom: 'from-amber-500/[0.07]',  border: 'border-amber-500/20'  },
  high:     { label: '高风险',   stroke: '#ef4444', glow: 'rgba(239,68,68,0.35)',   textCls: 'text-red-400',    gradFrom: 'from-red-500/[0.07]',    border: 'border-red-500/20'    },
  critical: { label: '极高风险', stroke: '#a855f7', glow: 'rgba(168,85,247,0.35)',  textCls: 'text-purple-400', gradFrom: 'from-purple-500/[0.07]', border: 'border-purple-500/20' },
} as const

const TYPE_DESC: Record<string, string> = {
  anxiety_selling:     '省略关键前提 + 绝对化表述 + 恐惧驱动行动',
  conflict_provoking:  '绝对化群体评判 + 非此即彼 + 愤怒获取流量',
  info_gap_harvesting: '真实事件锚点 + 夸大影响 + FOMO + 付费出口',
  pseudo_science_ad:   '权威话术包装 + 隐性商业目的 + 制造信任感',
}

function formatCount(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function RiskGauge({ score, level }: { score: number; level: string }) {
  const cfg = RISK[level as keyof typeof RISK] ?? RISK.medium
  const r = 52
  const circ = 2 * Math.PI * r
  const arc = circ * 0.75
  const progress = Math.min(score / 100, 1) * arc

  return (
    <div className="relative flex items-center justify-center w-44 h-44 shrink-0">
      <svg viewBox="0 0 140 140" className="absolute inset-0 w-full h-full" style={{ transform: 'rotate(135deg)' }}>
        {/* Track */}
        <circle
          cx="70" cy="70" r={r}
          fill="none" stroke="#1a1a1a" strokeWidth="10"
          strokeDasharray={`${arc} ${circ - arc}`}
          strokeLinecap="round"
        />
        {/* Progress */}
        <circle
          cx="70" cy="70" r={r}
          fill="none" stroke={cfg.stroke} strokeWidth="10"
          strokeDasharray={`${progress} ${circ - progress}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${cfg.glow})`, transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="flex flex-col items-center justify-center z-10">
        <span className={`text-5xl font-black leading-none ${cfg.textCls}`} style={{ textShadow: `0 0 30px ${cfg.glow}` }}>
          {score}
        </span>
        <span className="text-neutral-700 text-xs mt-1">/ 100</span>
      </div>
    </div>
  )
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] },
})

export default function AnalyzePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DemoData | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('demoData')
    if (stored) {
      setData(JSON.parse(stored))
      return
    }
    fetch(`/demo/${id}.json`)
      .then((r) => r.json())
      .then((d) => { sessionStorage.setItem('demoData', JSON.stringify(d)); setData(d) })
      .catch(() => router.push('/'))
  }, [id, router])

  if (!data) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const { diagnosis, videoContent } = data
  const risk = RISK[diagnosis.risk_level as keyof typeof RISK] ?? RISK.medium

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 h-16 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6 lg:px-10">
          <button
            onClick={() => router.push('/')}
            className="group flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-sm"
          >
            <span className="inline-block group-hover:-translate-x-0.5 transition-transform">←</span>
            返回首页
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
              <span className="text-black font-black text-[9px] leading-none select-none">眼</span>
            </div>
            <span className="text-sm font-semibold text-white hidden sm:block">视频分析结果</span>
          </div>
          <div className="w-24" />
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 lg:px-8 py-12 pb-24">

        {/* Video title */}
        <motion.div {...fadeUp(0)} className="mb-10">
          <p className="text-xs font-medium text-neutral-600 uppercase tracking-wider mb-2">
            {videoContent.author}
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight mb-4">
            {videoContent.title}
          </h1>
          <div className="flex flex-wrap gap-4 text-xs text-neutral-600">
            {videoContent.likes !== undefined && (
              <span className="flex items-center gap-1">
                <span>👍</span> {formatCount(videoContent.likes)} 点赞
              </span>
            )}
            {videoContent.play_count !== undefined && (
              <span className="flex items-center gap-1">
                <span>▶</span> {formatCount(videoContent.play_count)} 播放
              </span>
            )}
            {videoContent.follower_count !== undefined && (
              <span className="flex items-center gap-1">
                <span>👤</span> {formatCount(videoContent.follower_count)} 粉丝
              </span>
            )}
            {videoContent.with_shop_entry && (
              <span className="text-amber-500/60">🛒 已开通小店</span>
            )}
          </div>
        </motion.div>

        {/* Risk score card */}
        <motion.div
          {...fadeUp(0.08)}
          className={`p-7 sm:p-8 rounded-3xl border ${risk.border} mb-6
                      bg-gradient-to-br ${risk.gradFrom} to-[#0c0c0c]
                      shadow-[0_0_80px_rgba(0,0,0,0.4)]`}
        >
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
            <RiskGauge score={diagnosis.risk_score} level={diagnosis.risk_level} />
            <div className="text-center sm:text-left">
              <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full border mb-4 ${risk.border} ${risk.textCls}`}>
                {risk.label}
              </span>
              <h2 className="text-xl font-black text-white mb-2 tracking-tight">操控风险评分</h2>
              <p className="text-sm text-neutral-500 leading-relaxed max-w-[260px]">
                综合视频的修辞结构、情绪策略和省略信息综合评估得出
              </p>
            </div>
          </div>
        </motion.div>

        {/* Content types */}
        <motion.div {...fadeUp(0.15)} className="mb-6">
          <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-widest mb-3">识别到的内容类型</p>
          <div className="flex flex-col gap-2.5">
            {diagnosis.types.map((type, i) => (
              <div key={type} className="flex items-start gap-4 p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.06]">
                <div className="w-1 self-stretch rounded-full bg-amber-500/40 shrink-0" />
                <div>
                  <p className="font-bold text-white text-sm mb-1">{diagnosis.types_display[i]}</p>
                  <p className="text-xs text-neutral-600 leading-relaxed">{TYPE_DESC[type] ?? ''}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Core issue */}
        <motion.div
          {...fadeUp(0.22)}
          className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/[0.05] to-[#0c0c0c] border border-amber-500/15 mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-amber-500" />
            <p className="text-xs font-semibold text-amber-400/70 tracking-wide">核心操控逻辑</p>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">{diagnosis.core_issue}</p>
        </motion.div>

        {/* Missing premises */}
        {diagnosis.missing_premises.length > 0 && (
          <motion.div {...fadeUp(0.29)} className="mb-6">
            <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-widest mb-3">视频省略的关键前提</p>
            <div className="flex flex-col gap-2">
              {diagnosis.missing_premises.map((p, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#0f0f0f] border border-white/[0.05]">
                  <span className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-amber-500/20 flex items-center justify-center text-amber-400 text-[10px] font-black shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-neutral-400 leading-relaxed">{p}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Manipulation + commercial */}
        {(diagnosis.emotional_manipulation || diagnosis.commercial_intent) && (
          <motion.div {...fadeUp(0.36)} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {diagnosis.emotional_manipulation && (
              <div className="p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.05]">
                <p className="flex items-center gap-1.5 text-xs text-neutral-600 mb-2.5">
                  <span>🎭</span> 情绪操控手法
                </p>
                <p className="text-sm text-neutral-400 leading-relaxed">{diagnosis.emotional_manipulation}</p>
              </div>
            )}
            {diagnosis.commercial_intent && (
              <div className="p-4 rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.04] to-[#0c0c0c]">
                <p className="flex items-center gap-1.5 text-xs text-amber-500/60 mb-2.5">
                  <span>💰</span> 商业意图
                </p>
                <p className="text-sm text-neutral-400 leading-relaxed">{diagnosis.commercial_intent}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* CTA */}
        <motion.div
          {...fadeUp(0.43)}
          className="p-8 rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.09] to-[#0c0c0c] text-center"
        >
          <div className="text-3xl mb-4">🔍</div>
          <h3 className="text-xl font-black text-white tracking-tight mb-2">这条视频，对你具体成立吗？</h3>
          <p className="text-sm text-neutral-500 leading-relaxed mb-7 max-w-xs mx-auto">
            回答 3–5 个问题，AI 根据你的真实背景生成一份专属分析报告
          </p>
          <button
            onClick={() => router.push(`/chat/${id}`)}
            className="px-8 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95
                       text-black font-bold text-base transition-all duration-200
                       shadow-[0_8px_32px_rgba(245,158,11,0.28)]
                       hover:shadow-[0_8px_40px_rgba(245,158,11,0.40)]"
          >
            开始个性化分析 →
          </button>
        </motion.div>

      </div>
    </div>
  )
}
