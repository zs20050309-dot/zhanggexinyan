'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { VideoContent, DiagnosisResult } from '@/lib/types'

interface DemoData {
  videoContent: VideoContent
  diagnosis: DiagnosisResult
}

const RISK_CONFIG = {
  low:      { label: '低风险',   color: 'text-green-400',  bar: 'bg-green-500',  border: 'border-green-500/30'  },
  medium:   { label: '中风险',   color: 'text-amber-400',  bar: 'bg-amber-500',  border: 'border-amber-500/30'  },
  high:     { label: '高风险',   color: 'text-red-400',    bar: 'bg-red-500',    border: 'border-red-500/30'    },
  critical: { label: '极高风险', color: 'text-purple-400', bar: 'bg-purple-600', border: 'border-purple-500/30' },
} as const

const TYPE_DESC: Record<string, string> = {
  anxiety_selling:     '通过绝对化表述和省略关键前提，制造恐惧驱动决策',
  conflict_provoking:  '通过绝对化群体评判和非此即彼的逻辑，利用愤怒获取流量',
  info_gap_harvesting: '以真实事件为锚点，系统性夸大影响范围，利用FOMO心态收割',
  pseudo_science_ad:   '用权威身份或科学话术包装隐性商业目的，制造信任感',
}

export default function AnalyzePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DemoData | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('demoData')
    if (stored) {
      setData(JSON.parse(stored))
    } else {
      fetch(`/demo/${id}.json`)
        .then((r) => r.json())
        .then((d) => {
          sessionStorage.setItem('demoData', JSON.stringify(d))
          setData(d)
        })
        .catch(() => router.push('/'))
    }
  }, [id, router])

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-[#555]">
        加载中...
      </div>
    )
  }

  const { diagnosis, videoContent } = data
  const risk = RISK_CONFIG[diagnosis.risk_level] ?? RISK_CONFIG.medium

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-[#888] hover:text-white transition-colors text-sm"
        >
          ← 返回
        </button>
        <span className="text-sm font-semibold text-white">视频分析报告</span>
        <div className="w-16" />
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Video info */}
        <div className="mb-8">
          <p className="text-xs text-[#555] mb-1">{videoContent.author}</p>
          <h1 className="text-xl font-bold text-white leading-snug">{videoContent.title}</h1>
          {videoContent.likes !== undefined && (
            <div className="flex gap-4 mt-2 text-xs text-[#555]">
              <span>👍 {(videoContent.likes / 1000).toFixed(1)}k</span>
              {videoContent.play_count && <span>▶ {(videoContent.play_count / 10000).toFixed(0)}w 播放</span>}
              {videoContent.with_shop_entry && <span className="text-amber-500/70">🛒 已开小店</span>}
            </div>
          )}
        </div>

        {/* Risk score */}
        <div className={`p-5 rounded-2xl bg-[#141414] border ${risk.border} mb-6`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[#666]">操控风险评分</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1f1f1f] ${risk.color}`}>
              {risk.label}
            </span>
          </div>
          <div className="flex items-end gap-3 mb-3">
            <span className={`text-5xl font-black ${risk.color}`}>{diagnosis.risk_score}</span>
            <span className="text-[#555] text-sm mb-2">/ 100</span>
          </div>
          {/* Score bar */}
          <div className="h-1.5 w-full bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${risk.bar}`}
              style={{ width: `${diagnosis.risk_score}%` }}
            />
          </div>
        </div>

        {/* Content types */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-3">识别到的内容类型</p>
          <div className="flex flex-wrap gap-2">
            {diagnosis.types.map((type, i) => (
              <div key={type} className="px-3 py-2 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a]">
                <p className="text-sm font-semibold text-white mb-0.5">{diagnosis.types_display[i]}</p>
                <p className="text-xs text-[#666] leading-relaxed">{TYPE_DESC[type] ?? ''}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Core issue */}
        <div className="p-4 rounded-xl bg-[#141414] border border-[#2a2a2a] mb-6">
          <p className="text-xs font-semibold text-amber-400/70 mb-2">核心问题</p>
          <p className="text-sm text-[#ccc] leading-relaxed">{diagnosis.core_issue}</p>
        </div>

        {/* Missing premises */}
        {diagnosis.missing_premises.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-3">视频省略的关键前提</p>
            <ul className="flex flex-col gap-2">
              {diagnosis.missing_premises.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#aaa] leading-relaxed">
                  <span className="text-amber-500/60 mt-0.5 shrink-0">•</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Manipulation signals */}
        {(diagnosis.emotional_manipulation || diagnosis.commercial_intent) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {diagnosis.emotional_manipulation && (
              <div className="p-3 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a]">
                <p className="text-xs text-[#555] mb-1">情绪操控手法</p>
                <p className="text-xs text-[#aaa] leading-relaxed">{diagnosis.emotional_manipulation}</p>
              </div>
            )}
            {diagnosis.commercial_intent && (
              <div className="p-3 rounded-xl bg-[#1a1a1a] border border-amber-500/20">
                <p className="text-xs text-amber-500/60 mb-1">商业意图</p>
                <p className="text-xs text-[#aaa] leading-relaxed">{diagnosis.commercial_intent}</p>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 text-center">
          <p className="text-sm font-semibold text-white mb-1">这条视频，对你具体成立吗？</p>
          <p className="text-xs text-[#666] mb-4 leading-relaxed">
            回答 3-5 个问题，AI 会根据你的真实情况给出个性化分析
          </p>
          <button
            onClick={() => router.push(`/chat/${id}`)}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors"
          >
            开始个性化分析 →
          </button>
        </div>
      </div>
    </div>
  )
}
