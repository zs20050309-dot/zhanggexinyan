'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { DEMO_CASES } from '@/lib/constants'
import { diagnose, extractVideo } from '@/lib/api'

const SCENARIOS = [
  {
    icon: '⏳',
    title: '要付钱了，先等一下',
    desc: '看到推荐课程或产品，不确定值不值得买，先确认它说的对你成立吗',
    accent: 'group-hover:border-amber-500/30',
    iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
  },
  {
    icon: '💭',
    title: '听起来不对，说不清哪里不对',
    desc: '某条视频让你有点情绪，但又找不到逻辑漏洞，需要一个客观视角',
    accent: 'group-hover:border-blue-500/30',
    iconBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  },
  {
    icon: '👨‍👩‍👧',
    title: '家人转来视频让你看看',
    desc: '朋友或长辈发来一条内容，你想帮他们理性判断真伪',
    accent: 'group-hover:border-purple-500/30',
    iconBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  },
]

const DEMO_THUMB_GRADIENT: Record<string, string> = {
  demo_1: 'from-amber-500/20 via-orange-800/10 to-[#0f0f0f]',
  demo_2: 'from-blue-500/20 via-indigo-800/10 to-[#0f0f0f]',
  demo_3: 'from-purple-500/20 via-pink-900/10 to-[#0f0f0f]',
}

const TYPE_BADGE: Record<string, string> = {
  '焦虑贩卖型':   'text-amber-400  bg-amber-400/10  border-amber-400/25',
  '信息差收割型': 'text-blue-400   bg-blue-400/10   border-blue-400/25',
  '矛盾挑起型':   'text-red-400    bg-red-400/10    border-red-400/25',
  '伪科普软广型': 'text-purple-400 bg-purple-400/10 border-purple-400/25',
}

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.25, 0.1, 0.25, 1] },
})

type AnalyzeStage = 'idle' | 'extracting' | 'diagnosing'

export default function HomePage() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [stage, setStage] = useState<AnalyzeStage>('idle')
  const [error, setError] = useState<string | null>(null)

  const isLoading = stage !== 'idle'

  const handleDemoClick = async (demoId: string) => {
    const res = await fetch(`/demo/${demoId}.json`)
    const data = await res.json()
    sessionStorage.setItem('demoData', JSON.stringify(data))
    router.push(`/analyze/${demoId}`)
  }

  const handleAnalyze = async () => {
    const value = input.trim()
    if (!value || isLoading) return

    setError(null)
    setStage('extracting')

    try {
      const videoContent = await extractVideo(value)
      setStage('diagnosing')
      const diagnosis = await diagnose(videoContent)

      sessionStorage.setItem(
        'demoData',
        JSON.stringify({ videoContent, diagnosis })
      )
      router.push(`/analyze/${videoContent.video_id}`)
    } catch (err: unknown) {
      const apiErr = err as { error?: string; code?: string; fallback_available?: boolean }
      if (apiErr?.code === 'EXTRACT_FAILED' && apiErr.fallback_available) {
        setError('链接解析失败，请粘贴完整分享文本，或改用下方 Demo 案例体验。')
      } else {
        setError(apiErr?.error || '分析失败，请检查后端是否已启动并重试。')
      }
      setStage('idle')
    }
  }

  const statusText =
    stage === 'extracting'
      ? '正在解析抖音链接…（通常 2-5 秒）'
      : stage === 'diagnosing'
        ? 'AI 正在诊断内容…'
        : null

  return (
    <motion.div className="min-h-screen bg-[#080808]">

      {/* ── Navbar ── */}
      <nav className="fixed inset-x-0 top-0 z-50 h-16 border-b border-white/[0.06] bg-[#080808]/85 backdrop-blur-xl">
        <motion.div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
              <span className="text-black font-black text-xs leading-none select-none">眼</span>
            </div>
            <span className="font-bold text-white tracking-tight text-base">长个心眼</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/25 select-none">
              Beta
            </span>
          </div>
          <div className="flex items-center gap-8 text-sm text-neutral-500">
            <button className="hover:text-white transition-colors duration-200">关于产品</button>
            <button className="hover:text-white transition-colors duration-200">使用教程</button>
          </div>
        </motion.div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-16">
        <motion.div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[720px] h-[520px] rounded-full bg-amber-500/[0.055] blur-[110px] -translate-y-12" />
        </motion.div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-10 text-center py-24">
          <motion.div {...fade(0.05)}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-wide mb-8 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              AI 短视频内容分析工具
            </span>
          </motion.div>

          <motion.h1
            {...fade(0.12)}
            className="text-5xl sm:text-6xl lg:text-[4.5rem] font-black text-white leading-[1.06] tracking-tight mb-6"
          >
            这条视频说的，
            <br />
            对
            <span
              className="text-amber-400 mx-1"
              style={{ textShadow: '0 0 70px rgba(245,158,11,0.45)' }}
            >
              「你」
            </span>
            成立吗？
          </motion.h1>

          <motion.p
            {...fade(0.2)}
            className="text-base sm:text-lg text-neutral-500 max-w-md mx-auto leading-relaxed mb-12"
          >
            在被一条视频影响、做出决定之前，<br className="hidden sm:block" />
            帮你想清楚——它对你的具体情况，究竟成不成立
          </motion.p>

          {/* Input bar */}
          <motion.div {...fade(0.28)} className="max-w-2xl mx-auto mb-5">
            <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#111] border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)]">
              <div className="flex flex-1 items-center gap-2.5 px-3 py-2.5 min-w-0">
                <svg className="w-4 h-4 shrink-0 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder="粘贴抖音分享链接或完整分享文本"
                  disabled={isLoading}
                  className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600 outline-none disabled:opacity-60"
                />
              </div>
              <button
                onClick={handleAnalyze}
                disabled={isLoading || !input.trim()}
                className="shrink-0 px-7 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm transition-all duration-200 whitespace-nowrap shadow-[0_4px_20px_rgba(245,158,11,0.3)]"
              >
                {isLoading ? '分析中…' : '立刻分析'}
              </button>
            </div>
            {statusText && (
              <p className="mt-3 text-xs text-amber-400/80 animate-pulse">{statusText}</p>
            )}
            {error && (
              <p className="mt-3 text-xs text-red-400/90 leading-relaxed">{error}</p>
            )}
          </motion.div>

          <motion.p {...fade(0.36)} className="text-neutral-700 text-sm">
            ↓ 或者选择下方案例，直接开始体验
          </motion.p>
        </div>
      </section>

      {/* ── Use-case scenarios ── */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pb-16">
        <div className="flex items-center gap-5 mb-8">
          <div className="h-px flex-1 bg-gradient-to-r from-white/[0.04] to-white/[0.08]" />
          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-[0.12em] shrink-0">你什么时候可以用它</p>
          <div className="h-px flex-1 bg-gradient-to-l from-white/[0.04] to-white/[0.08]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SCENARIOS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 + i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
              className={`group p-6 rounded-2xl bg-[#0f0f0f] border border-white/[0.06] transition-all duration-300 ${s.accent}`}
            >
              <motion.div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5 border ${s.iconBg}`}>
                {s.icon}
              </motion.div>
              <h3 className="font-semibold text-white text-sm leading-snug mb-2">{s.title}</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Demo cases ── */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pb-28">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-base font-bold text-white">精选案例</h2>
          <span className="text-xs text-neutral-600">{DEMO_CASES.length} 个 · 点击直接体验</span>
        </div>

        <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DEMO_CASES.map((c, i) => {
            const badge = TYPE_BADGE[c.label] ?? 'text-neutral-400 bg-neutral-400/10 border-neutral-400/25'
            const thumbGrad = DEMO_THUMB_GRADIENT[c.id] ?? 'from-neutral-500/10 to-[#0f0f0f]'
            return (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.52, delay: 0.7 + i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                onClick={() => handleDemoClick(c.id)}
                className="group text-left p-5 rounded-2xl bg-[#0f0f0f] border border-white/[0.06]
                           hover:border-amber-500/30 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_40px_rgba(245,158,11,0.06)]
                           active:scale-[0.98] transition-all duration-300"
              >
                <div className={`w-full aspect-video rounded-xl bg-gradient-to-br ${thumbGrad} mb-5 relative overflow-hidden border border-white/[0.05] group-hover:border-amber-500/15 transition-colors`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-5xl">{c.icon}</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>

                <div className="mb-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold inline-block ${badge}`}>
                    {c.label}
                  </span>
                </div>

                <h3 className="font-bold text-white text-sm leading-snug mb-2">{c.title}</h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-4">{c.description}</p>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 group-hover:text-amber-400 transition-colors duration-200">
                  开始分析
                  <span className="inline-block group-hover:translate-x-0.5 transition-transform duration-200">→</span>
                </div>
              </motion.button>
            )
          })}
        </motion.div>
      </section>
    </motion.div>
  )
}
