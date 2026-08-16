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
      '/home': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/train': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
