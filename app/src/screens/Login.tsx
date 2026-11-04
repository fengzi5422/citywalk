import { useState } from 'react'
import { api } from '../core/api'
import type { Auth } from '../core/auth'
import { Back, Info } from '../components/Icons'

type Props = {
  onBack: () => void
  onDone: (auth: Auth) => void
}

export default function Login({ onBack, onDone }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (busy) return
    setError('')
    if (!email.trim()) return setError('先填邮箱')
    if (password.length < 8) return setError('密码至少 8 位')

    setBusy(true)
    const res =
      mode === 'login'
        ? await api.login(email.trim(), password)
        : await api.register(email.trim(), password)
    setBusy(false)

    if (!res) {
      setError(
        mode === 'login'
          ? '邮箱或密码不对，也可能是服务端未启动'
          : '注册没成功，检查邮箱格式、密码长度，或该邮箱已注册',
      )
      return
    }
    onDone(res)
  }

  return (
    <div className="page">
      <div className="nav" style={{ height: 48 }}>
        <button className="ic plain" onClick={onBack} aria-label="返回">
          <Back />
        </button>
        <span />
      </div>

      <div className="page-body">
        <div className="form">
          <h1 className="h-l" style={{ marginTop: 18 }}>
            {mode === 'login' ? '登录，让行程跟着你走' : '创建一个账号'}
          </h1>
          <p className="sub" style={{ marginTop: 8 }}>
            {mode === 'login'
              ? '登录后行程会同步到云端，换设备也能接着用。'
              : '只要邮箱和密码，不需要手机号。'}
          </p>

          <div className="field">
            <p className="lb">邮箱</p>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              spellCheck={false}
            />
          </div>

          <div className="field">
            <p className="lb">密码</p>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 位"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div className="alert" style={{ margin: '14px 0 0' }}>
              <span style={{ color: 'var(--warn)', marginTop: 1 }}><Info size={14} /></span>
              <p>{error}</p>
            </div>
          )}

          <div className="alert info" style={{ margin: '16px 0 0' }}>
            <span style={{ color: 'var(--green-deep)', marginTop: 1 }}><Info size={14} /></span>
            <p>
              演示版仅用于课程与自测，请不要使用你在其他网站的常用密码。
            </p>
          </div>
        </div>
      </div>

      <div className="footbtn">
        <button className="btn-primary" onClick={submit} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
          {busy ? '处理中…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
        <p className="note">
          {mode === 'login' ? (
            <>
              还没有账号？
              <button
                onClick={() => { setMode('register'); setError('') }}
                style={{ color: 'var(--green)', fontWeight: 600, marginLeft: 4 }}
              >
                去注册
              </button>
            </>
          ) : (
            <>
              已经有账号了？
              <button
                onClick={() => { setMode('login'); setError('') }}
                style={{ color: 'var(--green)', fontWeight: 600, marginLeft: 4 }}
              >
                去登录
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
