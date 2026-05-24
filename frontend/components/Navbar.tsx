'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from './Logo'

// ─────────────────────────────────────────────────────────────
// Navbar — 全站统一框架。三种使用方式：
//  1. <Navbar variant="hero" />          首页：滚动后磨砂玻璃
//  2. <Navbar backTo="/" />              二级页面：返回按钮 + Logo 居中
//  3. <Navbar backTo="/" right={<...>}>  自定义右侧（如步骤指示器、按钮组）
// 中间区域固定显示精简 Logo（无 Beta tag），保持品牌一致。
// ─────────────────────────────────────────────────────────────

type Variant = 'hero' | 'inner'

interface NavbarProps {
  variant?: Variant
  backTo?: string
  backLabel?: string
  center?: React.ReactNode
  right?: React.ReactNode
}

export function Navbar({
  variant = 'inner',
  backTo,
  backLabel = '返回',
  center,
  right,
}: NavbarProps) {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (variant !== 'hero') return
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [variant])

  if (variant === 'hero') {
    return (
      <nav
        className={`fixed inset-x-0 top-0 z-50 h-16 transition-all duration-300 ${
          scrolled
            ? 'border-b border-white/[0.07] bg-[#080808]/88 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.03)]'
            : 'border-b border-white/[0.04] bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6 lg:px-10">
          <Logo />
          <div className="flex items-center gap-8 text-sm text-neutral-500">
            <button className="hover:text-white transition-colors duration-200">关于产品</button>
            <button className="hover:text-white transition-colors duration-200">使用教程</button>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="sticky top-0 z-40 h-16 border-b border-white/[0.06] bg-[#080808]/92 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-6 lg:px-10 gap-4">
        {/* Left: back button */}
        <div className="flex-1 min-w-0">
          {backTo ? (
            <button
              onClick={() => router.push(backTo)}
              className="group flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-sm"
            >
              <span className="inline-block group-hover:-translate-x-0.5 transition-transform">←</span>
              {backLabel}
            </button>
          ) : (
            <div />
          )}
        </div>

        {/* Center: Logo + optional page label */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => router.push('/')}
            className="hover:opacity-80 transition-opacity"
            aria-label="回到首页"
          >
            <Logo size="sm" showBeta={false} showText={false} />
          </button>
          {center}
        </div>

        {/* Right: custom content */}
        <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
          {right}
        </div>
      </div>
    </nav>
  )
}
