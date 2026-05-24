// ─────────────────────────────────────────────────────────────
// Logo — SVG eye + magnifier brand mark
// 全站统一品牌组件。size: 'sm' (导航栏内嵌) | 'md' (默认)。
// ─────────────────────────────────────────────────────────────

type Size = 'sm' | 'md'

interface LogoProps {
  size?: Size
  showBeta?: boolean
  showText?: boolean
}

const SIZE_MAP: Record<Size, { box: string; icon: number; text: string }> = {
  sm: { box: 'w-7 h-7 rounded-lg', icon: 16, text: 'text-sm' },
  md: { box: 'w-9 h-9 rounded-xl', icon: 20, text: 'text-base' },
}

export function Logo({ size = 'md', showBeta = true, showText = true }: LogoProps) {
  const s = SIZE_MAP[size]
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div
        className={`${s.box} bg-amber-500 flex items-center justify-center shrink-0 shadow-[0_0_22px_rgba(245,158,11,0.45)]`}
      >
        <svg width={s.icon} height={s.icon} viewBox="0 0 20 20" fill="none">
          <path
            d="M2 10 C5 5, 15 5, 18 10 C15 15, 5 15, 2 10Z"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="10" cy="10" r="2.5" fill="white" />
          <line
            x1="13.5"
            y1="13.5"
            x2="17"
            y2="17"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {showText && (
        <span className={`font-bold text-white tracking-tight ${s.text}`}>
          长个心眼
        </span>
      )}
      {showBeta && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-amber-500/40 text-amber-400 bg-amber-500/10 font-mono">
          Beta
        </span>
      )}
    </div>
  )
}
