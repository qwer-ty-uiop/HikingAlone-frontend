import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    // 500kB 默认阈值针对首屏包；唯一超限的 maplibre chunk（969kB min / 255kB gzip）已随
    // 路线页懒加载移出首屏（见 App.tsx），只在实际打开地图时下载，故阈值放宽到 1000kB
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // 按大依赖拆 vendor chunk：应用代码迭代只重新下载业务 chunk，稳定的第三方库
        // 走浏览器长缓存；多 chunk 并行下载也快于单个 1.7MB 大包
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('maplibre-gl')) return 'maplibre' // WebGL 地图引擎，体量最大单独拆
          if (id.includes('framer-motion')) return 'framer-motion'
          if (id.includes('@phosphor-icons') || id.includes('lucide-react')) return 'icons'
          return 'vendor' // react / react-dom / @tmcw/togeojson 等
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // 后端 context-path 为 /，接口路径直达
      // bypass：浏览器直接刷新 SPA 子路由（Accept 含 text/html）时不转发后端，
      // 而是返回 index.html 走前端路由；fetch 请求（Accept: */*）正常代理到后端。
      '/home': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/train': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/routes': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      // 身体数据：/body 既是前端页面路由也是 API 前缀，与 /train 同款 bypass
      '/body': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      // 2026-10 功能批次：日记/每日打卡/装备/心愿单/目标/成就/统计/知识库，
      // 均为「页面路由即 API 前缀」，与 /body 同款 bypass
      '/journal': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/daily': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/gear': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/wish': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/goal': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/achievement': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/stats': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/knowledge': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      // 个人中心驾驶舱：/profile 既是页面路由也是 API 前缀，与 /body 同款 bypass
      '/profile': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        bypass: (req) =>
          req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      // 用户模块：纯 API，无前端路由，无需 bypass（/user 页面不存在，浏览器刷新只会 404 到 index.html，属预期）
      '/user': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // 邮箱验证码：纯 API，无需 bypass
      '/email': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // 天地图瓦片代理：dev 环境把 /tdt/DataServer 转发到天地图，
      // 线上由 nginx proxy_cache 永久缓存（瓦片不可变，缓存后不再消耗天地图每日配额）
      '/tdt': {
        target: 'https://t0.tianditu.gov.cn',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/tdt/, ''),
      },
    },
  },
})
