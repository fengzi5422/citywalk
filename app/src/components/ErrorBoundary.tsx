import { Component, type ErrorInfo, type ReactNode } from 'react'

type State = { error: Error | null }

/**
 * 全局兜底：任何渲染异常都给出可操作的恢复页，而不是白屏。
 * 旅行场景中「白屏」等于产品不可用，所以提供两条恢复路径。
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 不接第三方监控，避免把行程内容上报出去；只留本机控制台
    console.error('[citywalk] 页面异常', error, info.componentStack)
  }

  private reload = () => {
    window.location.reload()
  }

  private resetLocal = () => {
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('citywalk.')) keys.push(k)
      }
      keys.forEach((k) => localStorage.removeItem(k))
    } catch {
      // 隐私模式下 localStorage 可能不可写，忽略即可
    }
    window.location.reload()
  }

  render() {
    const err = this.state.error
    if (!err) return this.props.children

    return (
      <div className="errpage">
        <div className="errpage-card">
          <div className="errpage-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="64" height="64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="2" opacity=".35" />
              <path d="M32 18v18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <circle cx="32" cy="44" r="2.6" fill="currentColor" />
            </svg>
          </div>
          <h1>页面出了点问题</h1>
          <p className="errpage-lead">
            本次渲染被中断了。你的行程保存在本机浏览器中，通常不会丢失。
          </p>
          <p className="errpage-sub">先试试重新加载；如果反复出现，可以只重置本机缓存数据。</p>

          <button className="btn-primary" onClick={this.reload}>重新加载</button>
          <button className="btn-ghost" onClick={this.resetLocal}>重置本机数据并重载</button>

          <details className="errpage-detail">
            <summary>查看技术信息</summary>
            <code>{err.message || String(err)}</code>
          </details>
        </div>
        <p className="errpage-foot">城市自由行 · 本地优先，数据由你掌握</p>
      </div>
    )
  }
}
