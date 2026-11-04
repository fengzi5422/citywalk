import { useEffect, useState } from 'react'
import { getShare, type ShareSnapshot } from '../core/share'
import { fetchShare } from '../core/api'
import { fmt, short } from '../core/time'
import { Arrow, Info } from '../components/Icons'

type Props = {
  token: string
  onExit: () => void
}

export default function ShareView({ token, onExit }: Props) {
  // 先用本地缓存渲染，再向后端确认状态：后端说失效才是真失效，网络失败则保留本地
  const [snap, setSnap] = useState<ShareSnapshot | null>(() => getShare(token))
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let alive = true
    fetchShare(token).then(({ data, status }) => {
      if (!alive) return
      if (data) {
        setSnap({ ...(data.payload as unknown as ShareSnapshot), token, expiresAt: Number(data.expiresAt) })
      } else if (status === 404 || status === 410) {
        setSnap(null)
      }
      setChecked(true)
    })
    return () => {
      alive = false
    }
  }, [token])

  if (!checked && !snap) {
    return (
      <div className="page">
        <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="sub">正在打开分享…</p>
        </div>
      </div>
    )
  }

  if (!snap) {
    return (
      <div className="page">
        <div
          className="page-body"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 32px' }}
        >
          <h1 className="h-l" style={{ marginBottom: 12 }}>这份分享已失效</h1>
          <p className="sub" style={{ marginBottom: 8 }}>
            分享者可能撤销了链接，或者它已经超过 7 天有效期。
          </p>
          <p className="sub" style={{ marginBottom: 26 }}>
            你可以向分享者要一份新的链接，或者自己做一份。
          </p>
          <button className="btn-primary" onClick={onExit}>做我自己的行程</button>
        </div>
      </div>
    )
  }

  const s = snap
  const now = Date.now()
  if (s.expiresAt < now) {
    return (
      <div className="page">
        <div
          className="page-body"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 32px' }}
        >
          <h1 className="h-l" style={{ marginBottom: 12 }}>这份分享已过期</h1>
          <p className="sub" style={{ marginBottom: 26 }}>分享链接的有效期是 7 天，可以让对方重新生成一份。</p>
          <button className="btn-primary" onClick={onExit}>做我自己的行程</button>
        </div>
      </div>
    )
  }

  const daysLeft = Math.max(1, Math.round((s.expiresAt - now) / 86400000))

  return (
    <div className="page">
      <div className="page-body">
        <div className="share-hero">
          <p className="k">只读分享</p>
          <p className="n">{s.title}</p>
          <p className="m">
            {s.days.length} 天 · {s.totals.activities} 站 · 步行 {s.totals.walk}km
          </p>
        </div>

        <div className="pad" style={{ marginTop: 16 }}>
          <div className="alert info" style={{ margin: 0 }}>
            <span style={{ color: 'var(--green-deep)', marginTop: 1 }}><Info /></span>
            <p>
              这是分享者生成的只读快照，不可编辑。为避免泄露住址，<b>到达与离开的具体站点、住宿信息已被省略</b>。
            </p>
          </div>
        </div>

        {s.days.map((d, di) => (
          <div key={d.date + di}>
            <div className="pad">
              <div className="sec-row" style={{ marginBottom: 8 }}>
                <h2 style={{ fontSize: 14 }}>{d.date}</h2>
                <span>{d.district}</span>
              </div>
            </div>
            <div className="share-day">
              {d.items.map((i, ii) => (
                <div key={`${d.date}-${ii}`} className="share-item">
                  <span className="t">{fmt(i.start)}</span>
                  <span className="dot-line" />
                  <span className="n">{i.name}</span>
                  <span className="d">{short(i.duration)}</span>
                </div>
              ))}
              {d.items.length === 0 && (
                <p className="sub" style={{ padding: '6px 0' }}>这一天没有公开的安排。</p>
              )}
            </div>
          </div>
        ))}

        <div className="pad" style={{ marginTop: 18 }}>
          <div className="overview" style={{ margin: 0 }}>
            <div><b>{s.totals.activities}</b><span>景点</span></div>
            <div><b>{s.totals.transit}′</b><span>交通</span></div>
            <div><b>{s.totals.walk}km</b><span>步行</span></div>
            <div><b>￥{s.totals.cost}</b><span>预估</span></div>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            还剩 {daysLeft} 天有效期 · 分享者可随时撤销 · 信息为生成时的快照，出发前请以官方信息为准。
          </p>
        </div>

        <div style={{ padding: '24px 22px 28px' }}>
          <button className="btn-ghost" onClick={onExit}>
            我也想要一份这样的行程 <Arrow size={14} />
          </button>
          <p className="sub" style={{ textAlign: 'center', marginTop: 14, fontSize: 10.5 }}>
            由「城市自由行」生成 · 演示版不计费、不收集访问记录
          </p>
        </div>
      </div>
    </div>
  )
}
