import { useState } from 'react'
import { PLACES } from '../data/places'
import type { Trip } from '../core/types'
import { Arrow, Bookmark, Plus } from '../components/Icons'
import { gradOf } from '../components/Art'
import { short } from '../core/time'

type Props = {
  ids: string[]
  trips: Trip[]
  onPlace: (id: string) => void
  onRemove: (id: string) => void
  onCreate: () => void
  onAddMany: (tripId: string, placeIds: string[]) => void
  onOpenTrip: (id: string) => void
}

export default function Saved({ ids, trips, onPlace, onRemove, onCreate, onAddMany, onOpenTrip }: Props) {
  const [pending, setPending] = useState<string[] | null>(null)
  const list = PLACES.filter((p) => ids.includes(p.id))
  const targets = trips.filter((t) => t.status !== 'done')

  const choose = (tripId: string) => {
    if (!pending?.length) return
    onAddMany(tripId, pending)
    setPending(null)
    onOpenTrip(tripId)
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <div className="list-head">
        <h2>收藏</h2>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{list.length} 个地点</span>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <b>还没有收藏</b>
          <p>在地点页点右上角的书签，<br />下次做行程时可以直接找回来。</p>
          <button className="btn-primary" onClick={onCreate}>先去挑几个地点</button>
        </div>
      ) : (
        <>
          <div className="pad" style={{ marginTop: 4 }}>
            <button
              className="btn-ghost"
              style={{ height: 44 }}
              onClick={() => setPending(list.map((p) => p.id))}
            >
              把 {list.length} 个收藏一起加入行程 <Arrow size={14} />
            </button>
          </div>

          <div className="pad" style={{ marginTop: 8 }}>
            {list.map((p) => (
              <div key={p.id} className="place">
                <button
                  onClick={() => onPlace(p.id)}
                  style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, textAlign: 'left' }}
                >
                  <div className="pt" style={{ background: gradOf(p.id), width: 44, height: 44 }} />
                  <div className="txt">
                    <b>{p.name}</b>
                    <span>{p.district} · 建议 {short(p.duration)} · {p.ticket === 0 ? '免费' : `￥${p.ticket}`}</span>
                  </div>
                </button>
                <button
                  className="x"
                  onClick={() => setPending([p.id])}
                  aria-label="加入行程"
                  style={{ color: 'var(--green)', marginRight: 4 }}
                >
                  <Plus size={16} />
                </button>
                <button className="x" onClick={() => onRemove(p.id)} aria-label="取消收藏">
                  <Bookmark size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {pending && (
        <>
          <div className="scrim" onClick={() => setPending(null)} />
          <div className="sheet">
            <div className="grab" />
            <h3>加入 {pending.length > 1 ? `${pending.length} 个地点` : '这个地点'}</h3>
            <p className="desc">
              会追加到行程第一天的末尾，然后自动重排当天时间。你也可以之后再手动调整顺序。
            </p>
            {targets.length === 0 && (
              <p className="desc">还没有可以加入的行程，先去创建一份。</p>
            )}
            {targets.map((t) => (
              <button key={t.id} className="opt" onClick={() => choose(t.id)}>
                <span className="oi"><Arrow size={14} /></span>
                <span>
                  <b>{t.title}</b>
                  <span>{t.plan.days.length} 天 · {t.status === 'active' ? '进行中' : '已排好'}</span>
                </span>
              </button>
            ))}
            <div className="sheet-actions">
              <button className="btn-quiet" onClick={() => setPending(null)}>取消</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
