// ─────────────────────────────────────────────────────────────
// Logo — "长个心眼" 品牌标识
// 设计语言：金色渐变眼睛 + 同心扫描环（审视/识破）
// 去掉传统色块底，让 SVG 直接呼吸；纯黑底场景下更精致
// ─────────────────────────────────────────────────────────────

type Size = 'sm' | 'md' | 'lg'

interface LogoProps {
  size?: Size
  showText?: boolean
}

const SIZE_MAP: Record<Size, { svg: number; text: string; gap: string }> = {
  sm: { svg: 24, text: 'text-sm', gap: 'gap-2' },
  md: { svg: 32, text: 'text-base', gap: 'gap-2.5' },
  lg: { svg: 44, text: 'text-xl', gap: 'gap-3' },
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const s = SIZE_MAP[size]
  return (
    <div className={`flex items-center ${s.gap} select-none`}>
      <svg
        width={s.svg}
        height={s.svg}
        viewBox="0 0 40 40"
        fill="none"
        className="shrink-0"
        aria-label="长个心眼"
      >
        <defs>
          <radialGradient id="iris-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="60%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </radialGradient>
          <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.35" />
          </linearGradient>
          <filter id="iris-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* outer scanning ring — 审视 */}
        <circle
          cx="20"
          cy="20"
          r="17"
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth="1.2"
          strokeDasharray="3 5"
          opacity="0.85"
        />
        {/* eye almond shape */}
        <path
          d="M5 20 C 10 11, 30 11, 35 20 C 30 29, 10 29, 5 20 Z"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* iris with radial gradient */}
        <circle
          cx="20"
          cy="20"
          r="5.5"
          fill="url(#iris-grad)"
          filter="url(#iris-glow)"
        />
        {/* pupil — 中心点 */}
        <circle cx="20" cy="20" r="2.1" fill="#1a0f00" />
        {/* highlight — 上方高光 */}
        <circle cx="21.5" cy="18.5" r="0.9" fill="#fff8e1" opacity="0.95" />
      </svg>
      {showText && (
        <span className={`font-bold text-white tracking-tight ${s.text}`}>
          长个心眼
        </span>
      )}
    </div>
  )
}
