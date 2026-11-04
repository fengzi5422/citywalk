import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5178,
    // 开发时把 /api 转发到本地后端，避免跨域
    proxy: { '/api': { target: 'http://127.0.0.1:5179', changeOrigin: true } },
  },
  // MapLibre 的 worker 走 ES module，需跳过预构建并指定 worker 格式
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['maplibre-gl'] },
})
