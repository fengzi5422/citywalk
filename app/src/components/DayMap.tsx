import { lazy, Suspense, useState } from 'react'
import { PLACES } from '../data/places'
import type { DayPlan } from '../core/types'
import { fmt, short } from '../core/time'
import { transportLabel } from '../core/scheduler'
import type { BaseMapSetting } from '../core/mapConfig'
import { AUDIT_NO } from '../core/mapConfig'

// 地图引擎体积较大，只有切到「地图」视图才加载，首屏不背这个包
const MapLibreMap = lazy(() => import('./MapLibreMap'))

type Props = {
  day: DayPlan
  onPlace: (id: string) => void
  basemap: BaseMapSetting
  onBasemapChange?: (next: BaseMapSetting) => void
}

export default function DayMap({ day, onPlace, basemap, onBasemapChange }: Props) {
  const [sel, setSel] = useState(0)
  const [tileFailed, setTileFailed] = useState(false)

  const pts = day.items
    .filter((i) => i.placeId)
    .map((i) => ({ item: i, place: PLACES.find((p) => p.id === i.placeId)! }))
    .filter((x) => x.place)

  const current = pts[sel]

  return (
    <div>
      <div className="mapwrap">
        <Suspense fallback={<div className="map-loading">正在加载地图…</div>}>
          <MapLibreMap day={day} selected={sel} onSelect={setSel} basemap={basemap} onTileFail={() => setTileFailed(true)} />
        </Suspense>
        <div className="mapscale">
          {useTdtActive(basemap)
            ? (AUDIT_NO ? `底图 © 天地图 · ${AUDIT_NO}` : '底图 © 天地图')
            : '示意图 · 自有示例数据'}
        </div>
      </div>

      {tileFailed && useTdtActive(basemap) && (
        <div className="mapfail">
          <span>底图瓦片加载失败，可能是 key 失效或配额用尽。</span>
          <button
            onClick={() => {
              setTileFailed(false)
              onBasemapChange?.({ mode: 'schematic', tk: basemap.tk })
            }}
          >
            切回示意图
          </button>
        </div>
      )}

      {current && (
        <div className="pad" style={{ marginTop: 10 }}>
          <button
            className="mapcard"
            onClick={() => onPlace(current.place.id)}
            style={{
              position: 'static', left: 'auto', right: 'auto', bottom: 'auto',
              width: '100%', boxShadow: 'none', border: '1px solid var(--line)', textAlign: 'left',
            }}
          >
            <span className="num" style={{ background: '#C7633B' }}>{sel + 1}</span>
            <span className="tx">
              <b>{current.place.name}</b>
              <span>{fmt(current.item.start)} 到达 · 建议 {short(current.item.duration)}</span>
            </span>
            <span className="go">详情</span>
          </button>
        </div>
      )}

      <div className="pad" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="block-title" style={{ margin: 0 }}>当天顺序</span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>可缩放拖拽 · 点编号切换</span>
        </div>
        {pts.map((p, i) => (
          <button
            key={p.item.id}
            className="place"
            style={{ padding: '10px 0' }}
            onClick={() => setSel(i)}
          >
            <div
              className="pt"
              style={{
                width: 34, height: 34, borderRadius: 9,
                background: i === sel ? '#C7633B' : 'var(--green-soft)',
                color: i === sel ? '#fff' : 'var(--green-deep)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600,
              }}
            >
              {i + 1}
            </div>
            <div className="txt" style={{ marginLeft: 2 }}>
              <b style={{ fontSize: 13 }}>{p.place.name}</b>
              <span style={{ fontSize: 11 }}>{fmt(p.item.start)} · {short(p.item.duration)}</span>
            </div>
            <div className="meta">
              {p.item.fromPrev ? `${transportLabel[p.item.fromPrev.mode]} ${p.item.fromPrev.minutes}′` : '起点'}
            </div>
          </button>
        ))}
      </div>

      <p className="assume" style={{ marginTop: 10 }}>
        {useTdtActive(basemap)
          ? `底图来自天地图（${AUDIT_NO ? `审图号 ${AUDIT_NO}` : '审图号以天地图官网公示为准，正式发布前须申请并标注'}）；点位、路线与耗时均为本应用示例数据与估算，不提供导航。`
          : '底图为自有示例数据（片区、环线、水系均为示意），不含第三方地图瓦片，也不提供导航。'}
      </p>
    </div>
  )
}

function useTdtActive(b: BaseMapSetting) {
  return b.mode === 'tianditu' && b.tk.trim().length > 0
}
