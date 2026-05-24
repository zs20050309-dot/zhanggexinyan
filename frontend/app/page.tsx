'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { DEMO_CASES } from '@/lib/constants'
import { extractVideo, manualInput, diagnose } from '@/lib/api'
import type { VideoContent, DiagnosisResult, ApiError } from '@/lib/types'
import { Navbar } from '@/components/Navbar'

type Step = 'idle' | 'extracting' | 'diagnosing' | 'error'

const STEP_LABEL: Record<Step, string> = {
  idle: '',
  extracting: '正在解析视频 · 拉账号信息 · 听口播内容…',
  diagnosing: 'AI 正在诊断内容操控类型…',
  error: '',
}

// ─────────────────────────────────────────────────────────────
// Case thumbnail — real photo + theme tint overlay
// ─────────────────────────────────────────────────────────────
const CASE_THEMES: Record<string, {
  tint: string; grid: string; accent: string;
}> = {
  '焦虑贩卖型': {
    tint: 'linear-gradient(135deg, rgba(249,115,22,0.45) 0%, rgba(127,29,29,0.65) 100%)',
    grid: 'rgba(249,115,22,0.5)',
    accent: 'text-orange-300',
  },
  '信息差收割型': {
    tint: 'linear-gradient(135deg, rgba(6,182,212,0.35) 0%, rgba(8,47,73,0.6) 100%)',
    grid: 'rgba(6,182,212,0.5)',
    accent: 'text-cyan-300',
  },
  '伪科普软广型': {
    tint: 'linear-gradient(135deg, rgba(168,85,247,0.35) 0%, rgba(46,16,101,0.6) 100%)',
    grid: 'rgba(168,85,247,0.5)',
    accent: 'text-purple-300',
  },
}

function CaseThumbnail({ image, label }: { image: string; label: string }) {
  const t = CASE_THEMES[label] ?? CASE_THEMES['焦虑贩卖型']
  return (
    <div className="relative h-48 overflow-hidden bg-black">
      <img
        src={image}
        alt={label}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-110"
      />
      {/* Theme tint via mix-blend */}
      <div className="absolute inset-0 mix-blend-multiply opacity-80" style={{ background: t.tint }} />
      {/* Top/bottom darkening for legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/80" />
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-screen"
        style={{
          backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />
      {/* Top-left case tag */}
      <div className="absolute top-3 left-4 flex items-center gap-2">
        <span className={`text-[10px] uppercase tracking-[0.2em] font-mono ${t.accent} font-semibold drop-shadow`}>
          CASE STUDY
        </span>
      </div>
      {/* Bottom subtle scanline */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────
const SCENARIOS = [
  {
    num: '01',
    icon: '⏳',
    title: '要付钱了，先等一下',
    desc: '看到推荐课程或产品，不确定值不值得买，先确认它说的对你成立吗',
    iconColor: 'bg-amber-500/15 text-amber-400',
    hoverBorder: 'hover:border-amber-500/25',
  },
  {
    num: '02',
    icon: '💭',
    title: '听起来不对，说不清哪里不对',
    desc: '某条视频让你有点情绪，但又找不到逻辑漏洞，需要一个客观视角',
    iconColor: 'bg-blue-500/15 text-blue-400',
    hoverBorder: 'hover:border-blue-500/25',
  },
  {
    num: '03',
    icon: '👨‍👩‍👧',
    title: '家人转来视频让你看看',
    desc: '朋友或长辈发来一条内容，你想帮他们理性判断真伪',
    iconColor: 'bg-purple-500/15 text-purple-400',
    hoverBorder: 'hover:border-purple-500/25',
  },
]

const STEPS = [
  {
    num: '01',
    title: '识别话术类型',
    desc: 'AI 拆解视频的修辞结构，识别它属于哪一种操控话术',
    iconBg: 'bg-amber-500/12 text-amber-400 border-amber-500/30',
    iconSvg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3-3" />
      </svg>
    ),
  },
  {
    num: '02',
    title: '理解你的情况',
    desc: '回答 3-5 个 AI 针对视频内容生成的个性化问题',
    iconBg: 'bg-cyan-500/12 text-cyan-400 border-cyan-500/30',
    iconSvg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    num: '03',
    title: '生成专属判断',
    desc: '产出一份只对你成立的分析报告，告诉你这条视频值不值得听',
    iconBg: 'bg-purple-500/12 text-purple-400 border-purple-500/30',
    iconSvg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </svg>
    ),
  },
]

const CASE_EXTRA: Record<string, { questionCount: number; dimensions: string[] }> = {
  demo_1: { questionCount: 5, dimensions: ['目标受众匹配度', '时间压力真实性', '替代路径存在性'] },
  demo_2: { questionCount: 4, dimensions: ['职业影响范围', '时效性核实', '受影响程度评估'] },
  demo_3: { questionCount: 4, dimensions: ['信息来源可信度', '商业意图识别', '科学依据核查'] },
}

const TYPE_BADGE: Record<string, string> = {
  '焦虑贩卖型':   'text-amber-400  bg-amber-400/10  border-amber-400/25',
  '信息差收割型': 'text-cyan-400   bg-cyan-400/10   border-cyan-400/25',
  '矛盾挑起型':   'text-red-400    bg-red-400/10    border-red-400/25',
  '伪科普软广型': 'text-purple-400 bg-purple-400/10 border-purple-400/25',
}

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
})

// ─────────────────────────────────────────────────────────────
// Inline SVG noise texture — adds premium grain
// ─────────────────────────────────────────────────────────────
const NoiseTexture = () => (
  <svg className="pointer-events-none fixed inset-0 w-full h-full opacity-[0.025] mix-blend-overlay z-[1]" aria-hidden>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 9 0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#grain)" />
  </svg>
)

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter()
  const [inputFocused, setInputFocused] = useState(false)
  const [showDemoHint, setShowDemoHint] = useState(false)
  const [url, setUrl] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualText, setManualText] = useState('')
  const demoSectionRef = useRef<HTMLDivElement>(null)

  const saveAndNavigate = useCallback(
    (video: VideoContent, diagnosis: DiagnosisResult) => {
      sessionStorage.setItem(
        'demoData',
        JSON.stringify({ videoContent: video, diagnosis })
      )
      router.push(`/analyze/${video.video_id}`)
    },
    [router]
  )

  const handleDemoClick = async (demoId: string) => {
    const res = await fetch(`/demo/${demoId}.json`)
    const data = await res.json()
    sessionStorage.setItem('demoData', JSON.stringify(data))
    router.push(`/analyze/${demoId}`)
  }

  const handleUrlSubmit = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      setShowDemoHint(true)
      demoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setTimeout(() => setShowDemoHint(false), 4000)
      return
    }

    setStep('extracting')
    setError(null)
    setShowManual(false)

    try {
      const video = await extractVideo(trimmed)
      setStep('diagnosing')
      const diagnosis = await diagnose(video)
      saveAndNavigate(video, diagnosis)
    } catch (err: unknown) {
      const apiErr = err as ApiError
      const isNetworkError = err instanceof TypeError // fetch failed before response
      if (apiErr.code === 'EXTRACT_FAILED' && apiErr.fallback_available) {
        setError('链接解析失败（多为网络或代理问题）。请粘贴视频文案，或选下方 Demo 案例。')
        setShowManual(true)
        setStep('idle')
      } else if (isNetworkError) {
        setError(
          '连不上后端服务（localhost:8000）。请确认终端里跑着 ' +
          '`cd backend && source .venv/bin/activate && uvicorn main:app --port 8000`，' +
          '或选下方 Demo 案例（不需要后端）。'
        )
        setStep('error')
      } else {
        setError(apiErr.error || '分析失败，请稍后重试，或选下方 Demo 案例。')
        setStep('error')
      }
    }
  }, [url, saveAndNavigate])

  const handleManualSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!manualTitle.trim() || !manualText.trim()) return
      setStep('diagnosing')
      setError(null)
      try {
        const video = await manualInput(manualTitle.trim(), manualText.trim())
        const diagnosis = await diagnose(video)
        saveAndNavigate(video, diagnosis)
      } catch (err: unknown) {
        const apiErr = err as ApiError
        setError(apiErr.error || '诊断失败，请重试')
        setStep('idle')
      }
    },
    [manualTitle, manualText, saveAndNavigate]
  )

  return (
    <div className="min-h-screen bg-[#080808] relative">

      <NoiseTexture />
      <Navbar variant="hero" />

      {/* ── Hero ── */}
      <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-16">

        {/* Animated gradient orbs */}
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4 }}
            className="absolute top-[36%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[520px] rounded-full bg-amber-500/[0.08] blur-[120px]"
          />
          <motion.div
            animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[18%] left-[24%] w-[300px] h-[300px] rounded-full bg-orange-600/[0.06] blur-[90px]"
          />
          <motion.div
            animate={{ x: [0, -50, 0], y: [0, 40, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[52%] right-[20%] w-[280px] h-[280px] rounded-full bg-amber-400/[0.05] blur-[80px]"
          />
        </div>

        {/* Faint grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%)',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-10 text-center py-24">

          {/* Tag */}
          <motion.div {...fade(0.05)} className="mb-8">
            <span className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-wide select-none backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              AI 短视频内容分析工具
              <span className="text-amber-500/40">·</span>
              <span className="text-amber-500/70 font-mono text-[10px]">v0.1 Beta</span>
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            {...fade(0.12)}
            className="text-5xl sm:text-6xl lg:text-[5rem] font-black text-white leading-[1.22] tracking-tight mb-10"
          >
            <span className="block mb-2 sm:mb-3">这条视频说的，</span>
            <span className="block">
              对
              <span
                className="relative text-amber-400 mx-1.5 sm:mx-2 inline-block"
                style={{ textShadow: '0 0 70px rgba(245,158,11,0.55)' }}
              >
                「你」
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.7, duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                  className="absolute -bottom-1 left-1 right-1 h-[3px] bg-gradient-to-r from-amber-500/0 via-amber-400 to-amber-500/0 origin-left"
                />
              </span>
              成立吗？
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p {...fade(0.2)} className="text-base sm:text-lg text-neutral-500 max-w-md mx-auto leading-relaxed mb-12">
            在被一条视频影响、做出决定之前，<br className="hidden sm:block" />
            帮你想清楚——它对你的具体情况，究竟成不成立
          </motion.p>

          {/* Input bar — Douyin link extraction */}
          <motion.div {...fade(0.28)} className="max-w-2xl mx-auto mb-3">
            <div
              className={`flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#111] transition-all duration-300 ${
                inputFocused
                  ? 'border border-amber-500/50 shadow-[0_0_0_3px_rgba(245,158,11,0.10),0_20px_60px_rgba(0,0,0,0.5)]'
                  : 'border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)]'
              }`}
            >
              <div className="flex flex-1 items-center gap-2.5 px-4 py-2.5 min-w-0">
                <svg className="w-4 h-4 shrink-0 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  onKeyDown={(e) => e.key === 'Enter' && step === 'idle' && handleUrlSubmit()}
                  disabled={step !== 'idle'}
                  placeholder="粘贴抖音分享链接或完整分享文案"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-neutral-600 outline-none min-w-0"
                />
              </div>
              <button
                onClick={handleUrlSubmit}
                disabled={step !== 'idle'}
                className="group/btn relative shrink-0 px-7 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm transition-all duration-200 whitespace-nowrap shadow-[0_4px_20px_rgba(245,158,11,0.3)] overflow-hidden"
              >
                <span className="relative z-10">{step === 'idle' ? '立刻分析' : '分析中…'}</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
              </button>
            </div>
          </motion.div>

          <div className="max-w-2xl mx-auto space-y-3 mb-1">
            <AnimatePresence>
              {step !== 'idle' && STEP_LABEL[step] && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-amber-400/90 text-center font-medium"
                >
                  {STEP_LABEL[step]}
                </motion.p>
              )}
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-red-400/90 text-center leading-relaxed px-2"
                >
                  {error}
                </motion.p>
              )}
              {showManual && (
                <motion.form
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleManualSubmit}
                  className="p-4 rounded-xl bg-[#111] border border-white/[0.08] space-y-3 text-left"
                >
                  <p className="text-xs text-neutral-500">手动输入（跳过链接解析）</p>
                  <input
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="视频标题"
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/[0.08] text-sm text-white outline-none focus:border-amber-500/40"
                  />
                  <textarea
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="粘贴视频口播/字幕文字"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/[0.08] text-sm text-white outline-none focus:border-amber-500/40 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={step !== 'idle' || !manualTitle.trim() || !manualText.trim()}
                    className="w-full py-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-sm text-white font-medium disabled:opacity-40"
                  >
                    用手动内容继续分析
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          <div className="h-5 flex items-center justify-center">
            <AnimatePresence>
              {showDemoHint && !error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-xs text-amber-400/80 font-medium tracking-wide"
                >
                  请先粘贴抖音链接，或选下方 Demo 案例体验 ↓
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <motion.p {...fade(0.36)} className="text-neutral-700 text-sm mt-2">
            ↓ 或滚动到下方「精选案例」直接体验
          </motion.p>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-neutral-700"
        >
          <span className="text-[10px] uppercase tracking-[0.2em] font-mono">scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-px h-8 bg-gradient-to-b from-neutral-700 to-transparent"
          />
        </motion.div>
      </section>

      {/* ── How it works ── */}
      <section className="relative max-w-6xl mx-auto px-6 lg:px-10 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-xs font-semibold text-amber-400/70 uppercase tracking-[0.2em] mb-3">HOW IT WORKS</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            三步看清一条视频
          </h2>
        </motion.div>

        {/* Step cards — connected by a horizontal line */}
        <div className="relative">
          {/* Connection line (hidden on mobile) */}
          <div className="hidden md:block absolute top-[44px] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 relative">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.55, delay: i * 0.12, ease: [0.25, 0.1, 0.25, 1] }}
                className="relative flex flex-col items-center text-center px-4"
              >
                {/* Icon — sits on the line */}
                <div className={`relative z-10 w-[88px] h-[88px] rounded-2xl border-2 flex items-center justify-center bg-[#0c0c0c] ${s.iconBg} mb-5`}>
                  {s.iconSvg}
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#080808] border border-white/[0.1] flex items-center justify-center font-mono text-[10px] font-bold text-neutral-400">
                    {s.num}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-2 tracking-tight">{s.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed max-w-[230px]">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use-case scenarios ── */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-xs font-semibold text-amber-400/70 uppercase tracking-[0.2em] mb-3">USE CASES</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            你什么时候可以用它
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SCENARIOS.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.09, ease: [0.25, 0.1, 0.25, 1] }}
              className={`group relative p-6 rounded-2xl bg-[#0f0f0f] border border-white/[0.06] overflow-hidden transition-all duration-300 ${s.hoverBorder} hover:bg-[#111] hover:-translate-y-0.5`}
            >
              <span className="absolute -right-1 -top-5 text-[80px] font-black text-white/[0.03] select-none leading-none pointer-events-none">
                {s.num}
              </span>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-5 ${s.iconColor}`}>
                {s.icon}
              </div>
              <h3 className="font-semibold text-white text-sm leading-snug mb-2.5">{s.title}</h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-5">{s.desc}</p>
              <div className="flex items-center gap-1 text-xs font-medium text-amber-500/0 group-hover:text-amber-500/70 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                了解更多
                <span className="inline-block group-hover:translate-x-0.5 transition-transform">→</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Demo cases ── */}
      <section ref={demoSectionRef} className="max-w-6xl mx-auto px-6 lg:px-10 pb-20 scroll-mt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-xs font-semibold text-amber-400/70 uppercase tracking-[0.2em] mb-3">FEATURED CASES</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">精选案例</h2>
          <p className="text-sm text-neutral-600">{DEMO_CASES.length} 个真实案例 · 点击直接体验</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DEMO_CASES.map((c, i) => {
            const badge = TYPE_BADGE[c.label] ?? 'text-neutral-400 bg-neutral-400/10 border-neutral-400/25'
            const extra = CASE_EXTRA[c.id]
            return (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.52, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                onClick={() => handleDemoClick(c.id)}
                className="group text-left rounded-2xl bg-[#0f0f0f] border border-white/[0.06] overflow-hidden
                           hover:border-amber-500/30 hover:-translate-y-1
                           hover:shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_40px_rgba(245,158,11,0.08)]
                           active:scale-[0.98] transition-all duration-300"
              >
                <CaseThumbnail image={`/images/${c.id}.jpg`} label={c.label} />

                <div className="px-5 pt-4 pb-5">
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold inline-block mb-3 ${badge}`}>
                    {c.label}
                  </span>

                  <h3 className="font-bold text-white text-base leading-snug mb-2">{c.title}</h3>
                  <p className="text-xs text-neutral-600 leading-relaxed mb-3.5">{c.description}</p>

                  {extra && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {extra.dimensions.map((d) => (
                        <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-neutral-500 border border-white/[0.07]">
                          {d}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3.5 border-t border-white/[0.06]">
                    {extra ? (
                      <span className="text-xs text-neutral-700">
                        将揭示{' '}
                        <span className="text-amber-400 font-semibold">{extra.questionCount}</span>
                        {' '}个关键问题
                      </span>
                    ) : <span />}
                    <span className="text-xs font-semibold text-neutral-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all duration-200">
                      开始分析 →
                    </span>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative border-t border-white/[0.05] mt-12">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path d="M2 10 C5 5, 15 5, 18 10 C15 15, 5 15, 2 10Z" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
                <circle cx="10" cy="10" r="2.2" fill="#f59e0b" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white">长个心眼</p>
              <p className="text-[11px] text-neutral-600">字节黑客松 · 抖音 AI 创变者计划 Track 2</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs text-neutral-600">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              系统运行中
            </span>
            <span className="hidden sm:inline">Powered by Claude Opus 4.6</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
