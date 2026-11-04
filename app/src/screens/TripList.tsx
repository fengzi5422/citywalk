import type { Trip } from '../core/types'
import { Plus } from '../components/Icons'
import { MiniSkyline } from '../components/Art'
import { tripTotals } from '../core/day'
import { PLACES } from '../data/places'

type Props = {
  trips: Trip[]
  onOpen: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

export default function TripList({ trips, onOpen, onCreate }: Props) {
  const active = trips.filter((t) => t.status === 'active' || t.status === 'ready')
  const others = trips.filter((t) => !active.some((a) => a.id === t.id))
  const GRADS = [
    'linear-gradient(150deg,#1D6357,#7AAE93)',
    'linear-gradient(150deg,#B4703F,#DDB08A)',
    'linear-gradient(150deg,#4A6B7C,#9BB6C2)',
  ]
  const grad = (id: string) => GRADS[Math.abs(id.charCodeAt(1) || 0) % GRADS.length]

  return (
    <div style={{ paddingBottom: 20 }}>
      <div className="list-head">
        <h2>行程</h2>
        <button className="ic plain" onClick={onCreate} aria-label="新建">
          <Plus />
        </button>
      </div>

      {trips.length === 0 && (
        <div className="empty">
          <b>还没有行程</b>
          <p>选一座城市，填两个时间，<br />系统会排出一份可以照着走的日程。</p>
          <button className="btn-primary" onClick={onCreate}>创建第一份行程</button>
        </div>
      )}

      {active.length > 0 && (
        <>
          <div className="pad"><p className="block-title">进行中</p></div>
          {active.map((t) => {
            const totals = tripTotals(t.plan.days, PLACES)
            const stops = t.plan.days.flatMap((d) => d.items.filter((i) => i.placeId))
            const pct = stops.length ? Math.round((t.done.length / stops.length) * 100) : 0
            return (
              <button key={t.id} className="tripcard wide" onClick={() => onOpen(t.id)}>
                <div className="cover" style={{ background: grad(t.id) }}>
                  <MiniSkyline />
                </div>
                <div className="info">
                  <b>{t.title}</b>
                  <div className="meta">
                    {t.plan.days[0]?.date.split(' ')[0]} 起 · {totals.activities} 站 · ￥{totals.cost}
                  </div>
                  <div className="bar2"><i style={{ width: `${pct}%` }} /></div>
                </div>
                <div className="right">
                  {t.status === 'active' ? '进行中' : '已排好'}
                  <br />
                  {t.done.length} / {stops.length}
                </div>
              </button>
            )
          })}
        </>
      )}

      {others.length > 0 && (
        <>
          <div className="pad"><p className="block-title">更早的行程</p></div>
          {others.map((t) => (
            <button key={t.id} className="tripcard wide" onClick={() => onOpen(t.id)}>
              <div className="cover" style={{ background: grad(t.id), width: 44, height: 52 }}>
                <MiniSkyline w={44} h={52} />
              </div>
              <div className="info">
                <b style={{ fontSize: 13.5 }}>{t.title}</b>
                <div className="meta">
                  {t.plan.days.length} 天 · {t.plan.days[0]?.district}
                </div>
              </div>
              <div className="right">{t.prefs.pace === 'easy' ? '轻松' : t.prefs.pace === 'normal' ? '标准' : '紧凑'}</div>
            </button>
          ))}
        </>
      )}
    </div>
  )
}
