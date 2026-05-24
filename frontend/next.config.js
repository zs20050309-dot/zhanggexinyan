/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000'

const nextConfig = {
  // 把 /api/* 在 Next dev server 端反代到后端 8000
  // 这样浏览器只跟 localhost:3000 通信，避开 VPN/Clash/系统代理对 localhost:8000 的拦截
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
