'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
})

const TYPES = [
  {
    key: 'anxiety_selling',
    name: '焦虑贩卖型',
    color: 'from-amber-500/[0.08]',
    accent: 'border-amber-500/30',
    text: 'text-amber-400',
    desc: '省略关键前提 + 绝对化表述 + 恐惧驱动行动',
    example: '"大三还没实习？你已经输了" — 没说不同专业的实习节奏完全不同，只用"输了"制造紧迫感',
  },
  {
    key: 'conflict_provoking',
    name: '矛盾挑起型',
    color: 'from-red-500/[0.08]',
    accent: 'border-red-500/30',
    text: 'text-red-400',
    desc: '绝对化群体评判 + 非此即彼 + 愤怒获取流量',
    example: '"所有 X 都是 Y" — 用非黑即白的标签制造对立，把复杂问题简化成站队',
  },
  {
    key: 'info_gap_harvesting',
    name: '信息差收割型',
    color: 'from-cyan-500/[0.08]',
    accent: 'border-cyan-500/30',
    text: 'text-cyan-400',
    desc: '真实事件锚点 + 夸大影响 + FOMO + 付费出口',
    example: '"AI 已经取代了 X 行业" — 用真实事件夸大成系统性威胁，最后推付费课/咨询',
  },
  {
    key: 'pseudo_science_ad',
    name: '伪科普软广型',
    color: 'from-purple-500/[0.08]',
    accent: 'border-purple-500/30',
    text: 'text-purple-400',
    desc: '权威话术包装 + 隐性商业目的 + 制造信任感',
    example: '"皮肤科医生教你护肤" — 用专业身份做信任滤镜，最终引导购买特定产品',
  },
]

const STEPS = [
  {
    n: '01',
    title: '粘贴抖音视频链接',
    body: '从抖音 App 复制分享链接，粘进首页输入框。我们会自动拉取视频内容、口播文字稿、账号信息。',
  },
  {
    n: '02',
    title: 'AI 识别内容操控类型',
    body: '~10 秒生成诊断：内容属于上述 4 种类型中的哪些、操控风险评分、视频省略了哪些关键前提。',
  },
  {
    n: '03',
    title: '回答 4-5 个个性化问题',
    body: 'AI 根据视频类型生成针对你的问题——专业方向、当前阶段、看完的第一反应。',
  },
  {
    n: '04',
    title: '收到为你定制的分析报告',
    body: '基于你的具体回答，告诉你这条视频对"你"的情况成不成立，哪些前提你具备，哪些不具备。',
  },
]

export default function GuidePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#080808] text-white relative overflow-hidden">
      <Navbar
        backTo="/"
        backLabel="返回首页"
        center={<span className="text-sm font-semibold text-white hidden sm:block">使用教程</span>}
      />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-amber-500/[0.06] blur-[140px]" />
      </div>

      {/* Faint grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 100%)',
        }}
      />

      <div className="relative max-w-3xl mx-auto px-6 lg:px-8 pt-20 pb-32">

        {/* ── Hero ── */}
        <motion.div {...fade(0)} className="text-center mb-24">
          <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-[0.2em] mb-5">
            Why · How · What
          </p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-6">
            短视频时代的<br className="sm:hidden" />
            <span className="text-amber-400">认知防御工具</span>
          </h1>
          <p className="text-base text-neutral-400 max-w-lg mx-auto leading-relaxed">
            抖音每天用算法把"对你最有冲击力"的内容推到你眼前。
            <br />
            但很多内容并不是"事实"，而是被精心设计的「情绪操控」。
          </p>
        </motion.div>

        {/* ── 这工具做什么 ── */}
        <motion.section {...fade(0.05)} className="mb-24">
          <h2 className="text-2xl font-black mb-4">这个工具做什么？</h2>
          <p className="text-neutral-400 leading-relaxed mb-3">
            你看完一条视频，心里突然焦虑、愤怒、想立刻行动？
            那很可能是视频在用某种叙事技巧操控你的情绪——而不是因为它说的是事实。
          </p>
          <p className="text-neutral-400 leading-relaxed">
            <span className="text-white font-semibold">长个心眼</span>
            会把一条抖音视频拆开看：它属于哪种操控类型、省略了哪些关键前提、
            最重要的——<span className="text-amber-400">它说的事对"你的具体情况"到底成不成立</span>。
          </p>
        </motion.section>

        {/* ── 4 种内容类型 ── */}
        <motion.section {...fade(0.05)} className="mb-24">
          <h2 className="text-2xl font-black mb-2">我们识别的 4 种内容类型</h2>
          <p className="text-sm text-neutral-500 mb-8">这是我们目前覆盖的主要操控模式。每种都有典型修辞结构。</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {TYPES.map((t, i) => (
              <motion.div
                key={t.key}
                {...fade(0.05 + i * 0.05)}
                className={`relative p-5 rounded-2xl bg-gradient-to-br ${t.color} to-[#0c0c0c] border ${t.accent} hover:border-opacity-60 transition-colors`}
              >
                <div className={`text-xs font-bold ${t.text} mb-2 tracking-wider uppercase`}>
                  {t.key.replace(/_/g, ' ')}
                </div>
                <h3 className="text-lg font-black text-white mb-2">{t.name}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed mb-3">{t.desc}</p>
                <p className="text-xs text-neutral-400 leading-relaxed italic border-l-2 border-white/10 pl-3">
                  例：{t.example}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── 使用流程 ── */}
        <motion.section {...fade(0.05)} className="mb-24">
          <h2 className="text-2xl font-black mb-2">怎么使用？</h2>
          <p className="text-sm text-neutral-500 mb-8">整个流程约 1-2 分钟。</p>
          <div className="space-y-3">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                {...fade(0.05 + i * 0.04)}
                className="flex gap-5 p-5 rounded-2xl bg-[#0f0f0f] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
              >
                <div className="shrink-0">
                  <span className="text-3xl font-black text-amber-500/30 font-mono tabular-nums">{s.n}</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-1.5">{s.title}</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">{s.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── 关于诚实 ── */}
        <motion.section {...fade(0.05)} className="mb-24">
          <h2 className="text-2xl font-black mb-4">我们不做什么</h2>
          <div className="space-y-2.5 text-sm text-neutral-400 leading-relaxed">
            <p>· 我们<span className="text-white">不会</span>说"这条视频是假的"——我们只指出它的叙事结构</p>
            <p>· 我们<span className="text-white">不会</span>替你做决定——只帮你看清自己的处境与视频里隐含的前提</p>
            <p>· 我们<span className="text-white">不会</span>抓取视频以外的隐私——只读你主动粘的链接</p>
            <p>· AI 也会出错——把我们的报告当作一个"第二视角"，不是最终答案</p>
          </div>
        </motion.section>

        {/* ── CTA ── */}
        <motion.div {...fade(0.05)} className="text-center">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95
                       text-black font-bold text-sm transition-all duration-200
                       shadow-[0_8px_28px_rgba(245,158,11,0.35)]
                       hover:shadow-[0_12px_36px_rgba(245,158,11,0.45)]"
          >
            开始分析一条视频
            <span>→</span>
          </button>
          <p className="text-xs text-neutral-600 mt-4">不收集账号，不需要登录</p>
        </motion.div>
      </div>
    </div>
  )
}
