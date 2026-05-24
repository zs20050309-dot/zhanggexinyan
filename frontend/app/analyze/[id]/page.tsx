'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import type { VideoContent, DiagnosisResult } from '@/lib/types'
import { Navbar } from '@/components/Navbar'

interface DemoData {
  videoContent: VideoContent
  diagnosis: DiagnosisResult
}

const RISK = {
  low: {
    label: '低风险',
    stroke: '#22c55e',
    glow: 'rgba(34,197,94,0.35)',
    ambient: 'rgba(34,197,94,0.10)',
    textCls: 'text-green-400',
    gradFrom: 'from-green-500/[0.07]',
    border: 'border-green-500/20',
  },
  medium: {
    label: '中风险',
    stroke: '#f59e0b',
    glow: 'rgba(245,158,11,0.35)',
    ambient: 'rgba(245,158,11,0.10)',
    textCls: 'text-amber-400',
    gradFrom: 'from-amber-500/[0.07]',
    border: 'border-amber-500/20',
  },
  high: {
    label: '高风险',
    stroke: '#ef4444',
    glow: 'rgba(239,68,68,0.35)',
    ambient: 'rgba(239,68,68,0.10)',
    textCls: 'text-red-400',
    gradFrom: 'from-red-500/[0.07]',
    border: 'border-red-500/20',
  },
  critical: {
    label: '极高风险',
    stroke: '#a855f7',
    glow: 'rgba(168,85,247,0.35)',
    ambient: 'rgba(168,85,247,0.10)',
    textCls: 'text-purple-400',
    gradFrom: 'from-purple-500/[0.07]',
    border: 'border-purple-500/20',
  },
} as const

const TYPE_DESC: Record<string, string> = {
  anxiety_selling:     '省略关键前提 + 绝对化表述 + 恐惧驱动行动',
  conflict_provoking:  '绝对化群体评判 + 非此即彼 + 愤怒获取流量',
  info_gap_harvesting: '真实事件锚点 + 夸大影响 + FOMO + 付费出口',
  pseudo_science_ad:   '权威话术包装 + 隐性商业目的 + 制造信任感',
}

const TYPE_ACCENT: Record<string, string> = {
  anxiety_selling:     'bg-amber-500/40',
  conflict_provoking:  'bg-red-500/40',
  info_gap_harvesting: 'bg-cyan-500/40',
  pseudo_science_ad:   'bg-purple-500/40',
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
        <circle
          cx="70" cy="70" r={r}
          fill="none" stroke="#1a1a1a" strokeWidth="10"
          strokeDasharray={`${arc} ${circ - arc}`}
          strokeLinecap="round"
        />
        <motion.circle
          cx="70" cy="70" r={r}
          fill="none" stroke={cfg.stroke} strokeWidth="10"
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${progress} ${circ - progress}` }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${cfg.glow})` }}
        />
      </svg>
      <div className="flex flex-col items-center justify-center z-10">
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className={`text-5xl font-black leading-none ${cfg.textCls}`}
          style={{ textShadow: `0 0 30px ${cfg.glow}` }}
        >
          {score}
        </motion.span>
        <span className="text-neutral-700 text-xs mt-1">/ 100</span>
      </div>
    </div>
  )
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
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
    <div className="min-h-screen bg-[#080808] relative overflow-hidden">

      {/* Risk-tinted ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[420px] rounded-full blur-[120px]"
          style={{ background: risk.ambient }}
        />
      </div>

      <Navbar
        backTo="/"
        backLabel="返回首页"
        center={<span className="text-sm font-semibold text-white hidden sm:block">视频分析结果</span>}
      />

      <div className="relative max-w-2xl mx-auto px-6 lg:px-8 py-12 pb-24">

        {/* Video title */}
        <motion.div {...fadeUp(0)} className="mb-10">
          <p className="text-xs font-medium text-neutral-600 uppercase tracking-wider mb-2">
            {videoContent.author}
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight mb-4">
            {videoContent.title}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-600">
            {videoContent.likes !== undefined && (
              <span className="flex items-center gap-1.5">
                <span>👍</span> {formatCount(videoContent.likes)} 点赞
              </span>
            )}
            {videoContent.play_count !== undefined && (
              <span className="flex items-center gap-1.5">
                <span>▶</span> {formatCount(videoContent.play_count)} 播放
              </span>
            )}
            {videoContent.follower_count !== undefined && (
              <span className="flex items-center gap-1.5">
                <span>👤</span> {formatCount(videoContent.follower_count)} 粉丝
              </span>
            )}
            {videoContent.with_shop_entry && (
              <span className="text-amber-500/70 flex items-center gap-1.5">🛒 已开通小店</span>
            )}
          </div>
          {/* Transcript source notice — 让用户知道当前分析所基于的数据完整度 */}
          {videoContent.source === 'subtitle' && (
            <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/[0.06] border border-amber-500/15">
              <span className="text-[11px] text-amber-400/80">
                ℹ 当前分析基于视频标题与话题标签（VPN 环境下无法拉取完整字幕）
              </span>
            </div>
          )}
          {videoContent.source === 'manual' && (
            <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-neutral-500/[0.06] border border-neutral-500/15">
              <span className="text-[11px] text-neutral-400">📝 当前分析基于你手动输入的文案</span>
            </div>
          )}
        </motion.div>

        {/* Risk score card */}
        <motion.div
          {...fadeUp(0.08)}
          className={`relative p-7 sm:p-8 rounded-3xl border ${risk.border} mb-6
                      bg-gradient-to-br ${risk.gradFrom} to-[#0c0c0c]
                      shadow-[0_0_80px_rgba(0,0,0,0.4)] overflow-hidden`}
        >
          {/* Subtle grid texture */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(${risk.stroke} 1px, transparent 1px), linear-gradient(90deg, ${risk.stroke} 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />
          <div className="relative flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
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
              <div
                key={type}
                className="flex items-start gap-4 p-4 rounded-2xl bg-[#0f0f0f] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
              >
                <div className={`w-1 self-stretch rounded-full ${TYPE_ACCENT[type] ?? 'bg-amber-500/40'} shrink-0`} />
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
          className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/[0.06] to-[#0c0c0c] border border-amber-500/15 mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-amber-500" />
            <p className="text-xs font-semibold text-amber-400/80 tracking-wide uppercase">核心操控逻辑</p>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">{diagnosis.core_issue}</p>
        </motion.div>

        {/* Missing premises */}
        {diagnosis.missing_premises.length > 0 && (
          <motion.div {...fadeUp(0.29)} className="mb-6">
            <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-widest mb-3">视频省略的关键前提</p>
            <div className="flex flex-col gap-2">
              {diagnosis.missing_premises.map((p, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#0f0f0f] border border-white/[0.05] hover:border-white/[0.1] transition-colors">
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
                <p className="flex items-center gap-1.5 text-xs text-amber-500/70 mb-2.5">
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
          className="relative p-8 rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.09] to-[#0c0c0c] text-center overflow-hidden"
        >
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-amber-500/10 blur-[80px] pointer-events-none" />
          <div className="relative">
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
          </div>
        </motion.div>

      </div>
    </div>
  )
}
