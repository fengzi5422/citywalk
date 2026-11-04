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
  preview: {
    // 生产构建预览：同源托管 dist 并把 /api 反代到后端，等价于 nginx 部署形态
    host: '127.0.0.1',
    port: 5180,
    proxy: { '/api': { target: 'http://127.0.0.1:5179', changeOrigin: true } },
  },
  // MapLibre 的 worker 走 ES module，需跳过预构建并指定 worker 格式
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['maplibre-gl'] },
  build: {
    target: 'es2020',
    // MapLibre 是按需加载的第三方大包（约 1MB），其余 chunk 都在 150KB 以内
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // 把体积最大的 MapLibre 单独拆包；地图组件按路由懒加载后，
        // 首屏只需要 react-vendor + 业务代码，旅行中打开地图才拉 maplibre。
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('maplibre') || id.includes('gl-matrix') || id.includes('earcut')) {
            return 'maplibre'
          }
          return 'vendor'
        },
      },
    },
  },
})
