import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
    },
  },
})
