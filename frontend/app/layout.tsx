import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '长个心眼 — AI短视频内容分析',
  description: '这条视频说的，对「你」成立吗？在被短视频影响之前，先看清它的逻辑。',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[#0f0f0f] text-[#f0f0f0]">
        {children}
      </body>
    </html>
  )
}
