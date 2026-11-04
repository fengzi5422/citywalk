import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// PWA：仅正式构建注册 Service Worker。
// 开发环境不注册，避免缓存干扰热更新与端到端测试。
// Capacitor 原生壳内也不注册：WebView 已内置本地静态资源，SW 缓存反而会妨碍版本更新。
const inCapacitor = typeof window !== 'undefined' && 'Capacitor' in window
if (import.meta.env.PROD && !inCapacitor && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 注册失败不影响使用，App 本身仍是本地优先
    })
  })
}
