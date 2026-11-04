import { useState } from 'react'
import type { Trip } from '../core/types'
import type { Auth } from '../core/auth'
import { TYPE_LABEL, type HistoryEvent } from '../core/history'
import { api, type RemoteVersion } from '../core/api'

type Props = {
  events: HistoryEvent[]
  trips: Trip[]
  auth: Auth | null
  syncing: boolean
  onBack: () => void
  onOpenTrip: (id: string) => void
  onRefresh: () => void
}

function fmt(ts: number) {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function History({ events, trips, auth, syncing, onBack, onOpenTrip, onRefresh }: Props) {
  const [openTrip, setOpenTrip] = useState<string | null>(null)
  const [versions, setVersions] = useState<Record<string, RemoteVersion[]>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [detailText, setDetailText] = useState('')

  const synced = events.filter((e) => e.synced).length

  const toggleVersions = async (tripId: string) => {
    if (openTrip === tripId) { setOpenTrip(null); return }
    setOpenTrip(tripId)
    if (versions[tripId] || !auth) return
    setLoading(tripId)
    const list = await api.listVersions(tripId)
    setLoading(null)
    setVersions((v) => ({ ...v, [tripId]: list ?? [] }))
  }

  const showVersion = async (tripId: string, v: RemoteVersion) => {
    if (detail === v.id) { setDetail(null); return }
    const d = await api.getVersion(tripId, v.id)
    if (!d) return
    const t = d.trip
    const stops = t.plan?.days?.flatMap((day) => day.items?.filter((i) => i.placeId) ?? []) ?? []
    setDetail(v.id)
    setDetailText(`${t.plan?.days?.length ?? 0} 天 · ${stops.length} 站 · ${fmt(v.createdAt)} 保存`)
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <div className="list-head">
        <button className="ic plain" onClick={onBack} aria-label="返回">返回</button>
        <h2 style={{ flex: 1 }}>历史记录</h2>
        <button className="ic plain" onClick={onRefresh} aria-label="立即同步">同步</button>
      </div>

      <div className="pad" style={{ marginTop: 12 }}>
        <div className="overview hist-stat" style={{ margin: 0 }}>
          <div><b>{events.length}</b><span>条记录</span></div>
          <div><b>{synced}</b><span>已上云</span></div>
          <div><b>{trips.length}</b><span>份行程</span></div>
        </div>
        <p className="hint">
          {auth
            ? (syncing ? '正在同步…' : '登录后自动同步：每 30 秒拉取一次，断网恢复后自动补推。')
            : '当前未登录，记录只保存在本机浏览器；登录后会补报到云端，换设备也能看到。'}
        </p>
      </div>

      <div className="pad" style={{ marginTop: 18 }}>
        <p className="block-title" style={{ marginTop: 0 }}>操作时间线</p>
        {events.length === 0 && (
          <div className="empty">
            <b>还没有记录</b>
            <p>创建或修改行程后，这里会自动留下痕迹。</p>
          </div>
        )}
        <div className="hist-list">
          {events.map((e) => {
            const tripExists = Boolean(e.tripId && trips.some((t) => t.id === e.tripId))
            return (
              <button
                key={e.id}
                className={'hist-row' + (tripExists ? ' clickable' : '')}
                onClick={() => tripExists && onOpenTrip(e.tripId!)}
              >
                <span className="hist-dot" />
                <span className="hist-main">
                  <span className="hist-line">
                    <b className="hist-tag">{TYPE_LABEL[e.type] ?? '记录'}</b>
                    <span className="hist-title">{e.title}</span>
                  </span>
                  {e.detail && <span className="hist-detail">{e.detail}</span>}
                  <span className="hist-meta">
                    {fmt(e.createdAt)} · {e.synced ? '已上云' : '仅本机'}
                    {tripExists ? ' · 点击打开行程' : ''}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="pad" style={{ marginTop: 22 }}>
        <p className="block-title" style={{ marginTop: 0 }}>行程版本</p>
        <p className="hint">每次保存到云端都会留一份快照（每份行程最多 20 个版本），改错了可以回看。</p>
        {!auth && <p className="hint" style={{ color: 'var(--warn)' }}>登录后可查看云端版本快照。</p>}
        {trips.map((t) => (
          <div key={t.id} className="hist-ver">
            <button className="inputrow" onClick={() => toggleVersions(t.id)}>
              <span>{t.title}</span>
              <span style={{ color: 'var(--green)', fontSize: 12 }}>
                {openTrip === t.id ? '收起' : '查看版本'}
              </span>
            </button>
            {openTrip === t.id && (
              <div className="ver-box">
                {loading === t.id && <p className="hint">加载中…</p>}
                {!loading && !auth && <p className="hint">需要登录</p>}
                {!loading && auth && (versions[t.id] ?? []).length === 0 && <p className="hint">暂无版本</p>}
                {(versions[t.id] ?? []).map((v) => (
                  <button key={v.id} className="ver-item" onClick={() => showVersion(t.id, v)}>
                    <span>{fmt(v.createdAt)}</span>
                    <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{v.title}</span>
                    {detail === v.id && <span className="ver-detail">{detailText}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {trips.length === 0 && <p className="hint">还没有行程。</p>}
      </div>
    </div>
  )
}
