'use client'

import { useRouter } from 'next/navigation'
import { DEMO_CASES } from '@/lib/constants'

const SCENARIOS = [
  {
    icon: '⏳',
    title: '要付钱了，先等一下',
    desc: '看到课程/产品推荐，不确定值不值得买',
  },
  {
    icon: '💬',
    title: '听起来不对，但说不清哪里不对',
    desc: '某条视频让你有点情绪，但又无法反驳',
  },
  {
    icon: '👨‍👩‍👧',
    title: '家人发来一条视频，让你看看',
    desc: '长辈或朋友转来内容，你想帮他们判断',
  },
]

const TYPE_COLOR: Record<string, string> = {
  焦虑贩卖型: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  信息差收割型: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  矛盾挑起型: 'text-red-400 bg-red-400/10 border-red-400/30',
  伪科普软广型: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
}

export default function HomePage() {
  const router = useRouter()

  const handleDemoClick = async (demoId: string) => {
    const res = await fetch(`/demo/${demoId}.json`)
    const data = await res.json()
    sessionStorage.setItem('demoData', JSON.stringify(data))
    router.push(`/analyze/${demoId}`)
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white tracking-tight">长个心眼</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium border border-amber-500/30">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm text-[#888]">
          <button className="hover:text-white transition-colors">关于产品</button>
          <button className="hover:text-white transition-colors">使用教程</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-20 pb-12">
        <div className="text-xs font-medium text-amber-400 tracking-widest uppercase mb-5">
          AI 短视频内容分析工具
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-4 max-w-2xl">
          这条视频说的，<br />
          对<span className="text-amber-400">「你」</span>成立吗？
        </h1>
        <p className="text-[#666] text-sm sm:text-base max-w-md leading-relaxed mb-10">
          在被一条视频影响、做出决定之前<br />
          帮你想清楚——它对你的具体情况，究竟成不成立
        </p>

        {/* URL input — demo mode, non-functional */}
        <div className="w-full max-w-xl mb-3">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-[#444] text-sm cursor-not-allowed select-none">
              <span className="text-[#333] text-base">🔗</span>
              <span>粘贴任何平台视频链接，这里就是你的个人识别器</span>
            </div>
            <button
              onClick={() => alert('Demo 模式：请点击下方案例体验完整流程')}
              className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors whitespace-nowrap"
            >
              立刻分析
            </button>
          </div>
        </div>
        <p className="text-[#444] text-xs">
          推荐你来试试这些案例 ↓
        </p>
      </section>

      {/* Scenario cards */}
      <section className="px-6 pb-10 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SCENARIOS.map((s) => (
            <div
              key={s.title}
              className="flex gap-3 p-4 rounded-xl bg-[#141414] border border-[#1f1f1f] border-l-2 border-l-amber-500/60"
            >
              <span className="text-2xl mt-0.5 shrink-0">{s.icon}</span>
              <div>
                <p className="text-sm font-semibold text-white mb-1">{s.title}</p>
                <p className="text-xs text-[#666] leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Demo cases */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#888]">
            或者：详细了解这些真实案例
          </h2>
          <span className="text-xs text-amber-500/70">共 {DEMO_CASES.length} 个案例</span>
        </div>

        <div className="flex flex-col gap-3">
          {DEMO_CASES.map((c, i) => {
            const typeColor = TYPE_COLOR[c.label] ?? 'text-gray-400 bg-gray-400/10 border-gray-400/30'
            return (
              <button
                key={c.id}
                onClick={() => handleDemoClick(c.id)}
                className="group flex items-center gap-4 w-full text-left p-4 rounded-xl
                           bg-[#141414] border border-[#1f1f1f] hover:border-[#333]
                           hover:bg-[#1a1a1a] transition-all duration-200"
              >
                {/* Thumbnail placeholder */}
                <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-[#1f1f1f] flex items-center justify-center text-3xl border border-[#2a2a2a] overflow-hidden">
                  {c.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm sm:text-base leading-snug mb-1.5 truncate">
                    {c.title}
                  </p>
                  <p className="text-[#666] text-xs sm:text-sm leading-relaxed line-clamp-2">
                    {c.description}
                  </p>
                </div>

                {/* Badge + arrow */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeColor}`}>
                    {c.label}
                  </span>
                  <span className="text-xs text-[#444] group-hover:text-amber-400 transition-colors">
                    立刻体验 →
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
