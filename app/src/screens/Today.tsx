import { useState } from 'react'
import { PLACES } from '../data/places'
import type { PlanItem, Trip } from '../core/types'
import { findAlternatives, recomputeDay, replaceItem } from '../core/day'
import { transportLabel } from '../core/scheduler'
import { fmt, short } from '../core/time'
import { Arrow, Back, Clock, Map } from '../components/Icons'

type Props = {
  trip: Trip
  onBack: () => void
  onUpdate: (fn: (t: Trip) => Trip) => void
}

export default function Today({ trip, onBack, onUpdate }: Props) {
  const [sheet, setSheet] = useState<PlanItem | null>(null)
  const [toast, setToast] = useState('')

  const day = trip.plan.days[0]
  const stops = day.items.filter((i) => i.placeId)
  const doneIds = trip.done
  const skipIds = trip.skipped
  const pending = stops.filter((i) => !doneIds.includes(i.id) && !skipIds.includes(i.id))
  const next = pending[0]
  const pct = stops.length ? Math.round((doneIds.length / stops.length) * 100) : 0

  const flash = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(''), 1900)
  }

  const complete = (id: string) => {
    onUpdate((t) => ({ ...t, done: [...t.done, id] }))
    flash('已标记完成')
  }
  const skip = (id: string) => {
    onUpdate((t) => ({ ...t, skipped: [...t.skipped, id] }))
    flash('已跳过这一站')
  }
  const replace = (item: PlanItem, placeId: string) => {
    const place = PLACES.find((p) => p.id === placeId)
    if (!place) return
    onUpdate((t) => ({
      ...t,
      plan: {
        ...t.plan,
        days: t.plan.days.map((d, i) =>
          i === 0 ? recomputeDay(replaceItem(d, item.id, place), t.prefs, PLACES) : d,
        ),
      },
    }))
    setSheet(null)
    flash(`已换成「${place.name}」`)
  }

  const usedIds = new Set(trip.plan.days.flatMap((d) => d.items.map((i) => i.placeId).filter(Boolean) as string[]))
  const target = sheet ? PLACES.find((p) => p.id === sheet.placeId) : undefined
  const alts = target ? findAlternatives(target, PLACES, usedIds) : []

  return (
    <div className="page">
      <div className="nav" style={{ height: 46 }}>
        <button className="ic plain" onClick={onBack} aria-label="返回">
          <Back />
        </button>
        <div className="ttl" style={{ fontSize: 14 }}>{trip.city} · 今天</div>
        <span style={{ width: 34 }} />
      </div>

      <div className="page-body">
        <div className="today-head">
          <p className="d">{day.date} · 第 1 天</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <p className="t">今天</p>
            <span style={{ fontSize: 11, color: 'var(--clay)', fontWeight: 500 }}>
              {pending.length ? `还剩 ${pending.length - 1} 站` : '今天的安排都完成了'}
            </span>
          </div>
          <div className="progress">
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            <span>{doneIds.length} / {stops.length} 完成</span>
          </div>
        </div>

        {next ? (
          <div className="next">
            <div className="glow2" />
            <p className="k">下一站</p>
            <p className="n">{next.name}</p>
            <p className="m">
              {next.fromPrev
                ? `${transportLabel[next.fromPrev.mode]} ${next.fromPrev.minutes} 分钟 · ${next.fromPrev.distance}m`
                : '从当前位置出发'}
              {' · '}
              {fmt(next.start)} 到达
            </p>
            <div className="countdown">
              <Clock /> 建议 {fmt(Math.max(0, next.start - (next.fromPrev?.minutes ?? 0) - 5))} 出发
            </div>
            <div className="next-actions">
              <button className="go" onClick={() => flash('演示版不接入导航，正式版将跳转地图 App')}>
                <Map size={16} /> 导航过去
              </button>
              <button className="sec" onClick={() => complete(next.id)}>已完成</button>
            </div>
          </div>
        ) : (
          <div className="alert info" style={{ marginTop: 16 }}>
            <p><b>今天的行程已全部完成。</b>晚上可以回到行程页，把这一天存成回忆。</p>
          </div>
        )}

        {next && (
          <div className="quickrow">
            <button onClick={() => skip(next.id)}>跳过这站</button>
            <button onClick={() => setSheet(next)}>换一站</button>
            <button onClick={() => flash('可在行程页调整剩余安排')}>改剩余</button>
          </div>
        )}

        <div className="rest">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="block-title" style={{ margin: 0 }}>今日剩余</span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{Math.max(0, pending.length - 1)} 项</span>
          </div>
          {pending.slice(1).map((it) => (
            <div key={it.id} className="r-row">
              <div className="tt">{fmt(it.start)}</div>
              <div className="rn">{it.name}</div>
              <div className="rd">{short(it.duration)}</div>
            </div>
          ))}
          {pending.length <= 1 && (
            <p className="hint" style={{ padding: '10px 0' }}>后面没有安排了，可以自由活动。</p>
          )}
        </div>

        <div className="overview" style={{ margin: '18px 22px 0' }}>
          <div><b>{day.summary.transit}′</b><span>交通</span></div>
          <div><b>{day.summary.walk}km</b><span>步行</span></div>
          <div><b>￥{day.summary.cost}</b><span>预估</span></div>
        </div>

        <div className="alert info" style={{ marginTop: 14 }}>
          <span style={{ color: 'var(--green-deep)', marginTop: 1 }}><Clock /></span>
          <p>
            <b>今天的小提示：</b>如果下雨，可以在行程页把剩余安排换成室内；地图为示意图，导航请用手机地图 App。
          </p>
        </div>

        <div style={{ height: 20 }} />
      </div>

      {sheet && target && (
        <>
          <div className="scrim" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="grab" />
            <h3>换掉「{sheet.name}」</h3>
            <p className="desc">替换只影响今天剩下的安排，已完成的记录不会变。</p>
            {alts.map((a) => (
              <button key={a.id} className="opt reco" onClick={() => replace(sheet, a.id)}>
                <span className="oi"><Arrow size={14} /></span>
                <span>
                  <b>{a.name}</b>
                  <span>{a.district} · 建议 {short(a.duration)} · {a.ticket === 0 ? '免费' : `￥${a.ticket}`}</span>
                </span>
              </button>
            ))}
            <button className="opt" onClick={() => { skip(sheet.id); setSheet(null) }}>
              <span className="oi"><Clock size={14} /></span>
              <span><b>跳过这一站</b><span>不影响后面的时间</span></span>
            </button>
            <div className="sheet-actions">
              <button className="btn-quiet" onClick={() => setSheet(null)}>取消</button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div
          style={{
            position: 'absolute', left: '50%', bottom: 40, transform: 'translateX(-50%)',
            background: 'rgba(26,26,23,.9)', color: '#fff', fontSize: 12, padding: '9px 14px',
            borderRadius: 999, zIndex: 60, whiteSpace: 'nowrap', maxWidth: '88%',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
