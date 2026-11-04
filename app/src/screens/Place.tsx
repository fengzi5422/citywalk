import { useState } from 'react'
import { PLACES } from '../data/places'
import type { Trip } from '../core/types'
import { Back, Bookmark, Check, Info, Pin } from '../components/Icons'
import { gradOf, Skyline } from '../components/Art'
import { fmt, short } from '../core/time'

type Props = {
  placeId: string
  saved: boolean
  trips: Trip[]
  onToggleSave: () => void
  onBack: () => void
  onAdd: (tripId: string, placeId: string) => void
  onOpenTrip: (id: string) => void
}

export default function PlaceScreen({ placeId, saved, trips, onToggleSave, onBack, onAdd, onOpenTrip }: Props) {
  const [sheet, setSheet] = useState(false)
  const place = PLACES.find((p) => p.id === placeId)
  if (!place) return null

  const openText = place.open
    ? `${fmt(place.open.start)}–${fmt(place.open.end)}`
    : '全天'
  const closed = place.open?.closedOn?.length
    ? `周${['日', '一', '二', '三', '四', '五', '六'][place.open.closedOn[0]]}闭馆`
    : ''
  const lastEntry = place.open?.lastEntry ? `${fmt(place.open.lastEntry)} 停止入场` : closed

  return (
    <div className="page">
      <div className="page-body">
        <div className="dcover">
          <Skyline opacity={0.2} />
          <div className="nav" style={{ position: 'relative', zIndex: 2 }}>
            <button className="ic" onClick={onBack} aria-label="返回">
              <Back />
            </button>
            <span />
          </div>
          <div className="badge">
            {place.category === 'food' ? '美食' : place.category === 'fun' ? '娱乐' : place.category === 'rest' ? '休息' : '景点'} · {place.district}
          </div>
        </div>

        <div className="dhead">
          <div className="t">{place.name}</div>
          <div className="m">
            <span>建议停留 {short(place.duration)}</span>
            <span className="dot" />
            <span>{place.indoor ? '室内' : '室外'}</span>
            <span className="dot" />
            <span>评分 {place.rating.toFixed(1)}</span>
          </div>
        </div>

        <div className="infobox">
          <div className="inforow">
            <span className="k">开放时间</span>
            <span className={`v${place.open?.state === 'pending' ? ' warn' : ''}`}>
              {place.open?.state === 'pending' ? '待确认' : openText}
            </span>
          </div>
          <div className="inforow">
            <span className="k">门票</span>
            <span className="v">{place.ticket === 0 ? '免费' : `￥${place.ticket}`}</span>
          </div>
          <div className="inforow">
            <span className="k">是否需要预约</span>
            <span className="v">{place.needsBooking ? '需要，建议提前 1 天' : '不需要'}</span>
          </div>
          <div className="inforow">
            <span className="k">{place.open?.lastEntry ? '最晚入场' : '备注'}</span>
            <span className="v warn">{lastEntry || place.open?.note || '—'}</span>
          </div>
        </div>

        <div className="src">
          <span className="ok">
            <Check size={12} />
          </span>
          信息更新于 11-01 · 来源：官方渠道（演示数据）
        </div>

        <p className="bodytext">
          <b>为什么安排在这里</b>
          <br />
          {place.reason}
        </p>

        <div style={{ margin: '14px 22px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {place.tags.map((t) => (
            <span key={t} className="tag line">{t}</span>
          ))}
          {place.needsBooking && <span className="tag clay">需预约</span>}
        </div>

        <div className="alert info" style={{ marginTop: 16 }}>
          <span style={{ color: 'var(--green-deep)', marginTop: 1 }}>
            <Info />
          </span>
          <p>
            <b>演示版说明：</b>当前不接入实时营业数据与地图导航，开放时间与耗时均为示例值，出发前请以官方信息为准。
          </p>
        </div>
      </div>

      <div className="dbar">
        <button className={`save${saved ? ' on' : ''}`} onClick={onToggleSave} aria-label="收藏">
          <Bookmark />
        </button>
        <button className="add" onClick={() => setSheet(true)}>
          加入行程
        </button>
      </div>

      {sheet && (
        <>
          <div className="scrim" onClick={() => setSheet(false)} />
          <div className="sheet">
            <div className="grab" />
            <h3>加入哪个行程</h3>
            <p className="desc">加入后会排在当天下午 16:00，你可以再拖动调整。</p>
            {trips.length === 0 && (
              <p className="desc">还没有行程。先创建一份，再回来加入地点。</p>
            )}
            {trips.map((t) => (
              <button
                key={t.id}
                className="opt"
                onClick={() => {
                  onAdd(t.id, place.id)
                  setSheet(false)
                  onOpenTrip(t.id)
                }}
              >
                <span className="oi">
                  <Pin size={14} />
                </span>
                <span>
                  <b>{t.title}</b>
                  <span>{t.plan.days.length} 天 · {t.status === 'active' ? '进行中' : '已排好'}</span>
                </span>
              </button>
            ))}
            <div className="sheet-actions">
              <button className="btn-quiet" onClick={() => setSheet(false)}>取消</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
