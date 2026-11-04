import { useEffect, useMemo, useRef, useState } from 'react'
import { GeoJSONSource, Map as MlMap, Marker } from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { PLACES } from '../data/places'
import type { DayPlan } from '../core/types'
import { tiandituTiles, type BaseMapSetting } from '../core/mapConfig'

type Props = {
  day: DayPlan
  selected: number
  onSelect: (i: number) => void
  basemap: BaseMapSetting
  onTileFail?: () => void
}

function ring(cx: number, cy: number, rx: number, ry: number, n = 48) {
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
  }
  return pts
}

/** 不规则轮廓，避免片区看起来像气泡 */
function blob(cx: number, cy: number, rx: number, ry: number, seed = 0, n = 56) {
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const w = 1 + 0.1 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 5 + seed * 2.4)
    pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w])
  }
  return pts
}

/** 屏幕距离过近的点相互推开，保证编号可见 */
function spread(pts: { x: number; y: number }[], minDist = 34) {
  const off = pts.map(() => [0, 0] as [number, number])
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x
      const dy = pts[i].y - pts[j].y
      const d = Math.hypot(dx, dy)
      if (d < minDist) {
        const a = d < 0.5 ? Math.PI / 4 : Math.atan2(dy, dx)
        const push = (minDist - d) / 2 + 2
        off[i][0] += Math.cos(a) * push
        off[i][1] += Math.sin(a) * push
        off[j][0] -= Math.cos(a) * push
        off[j][1] -= Math.sin(a) * push
      }
    }
  }
  return off
}

const DISTRICTS: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: '老城片' }, geometry: { type: 'Polygon', coordinates: [blob(104.065, 30.663, 0.019, 0.016, 1.2)] } },
    { type: 'Feature', properties: { name: '武侯片' }, geometry: { type: 'Polygon', coordinates: [blob(104.038, 30.649, 0.014, 0.011, 2.7)] } },
    { type: 'Feature', properties: { name: '东郊片' }, geometry: { type: 'Polygon', coordinates: [blob(104.112, 30.692, 0.016, 0.016, 0.4)] } },
    { type: 'Feature', properties: { name: '玉林片' }, geometry: { type: 'Polygon', coordinates: [blob(104.062, 30.632, 0.011, 0.009, 3.1)] } },
  ],
}

const ROADS: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { kind: 'ring2' }, geometry: { type: 'LineString', coordinates: ring(104.065, 30.663, 0.039, 0.032, 64) } },
    { type: 'Feature', properties: { kind: 'ring1' }, geometry: { type: 'LineString', coordinates: ring(104.065, 30.663, 0.0195, 0.0165, 64) } },
    { type: 'Feature', properties: { kind: 'main' }, geometry: { type: 'LineString', coordinates: [[104.026, 30.6572], [104.104, 30.656]] } },
    { type: 'Feature', properties: { kind: 'main' }, geometry: { type: 'LineString', coordinates: [[104.0642, 30.622], [104.0665, 30.69]] } },
    { type: 'Feature', properties: { kind: 'main' }, geometry: { type: 'LineString', coordinates: [[104.041, 30.676], [104.088, 30.648]] } },
    { type: 'Feature', properties: { kind: 'sub' }, geometry: { type: 'LineString', coordinates: [[104.03, 30.64], [104.1, 30.672]] } },
  ],
}

const WATER: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [[104.028, 30.681], [104.043, 30.67], [104.055, 30.66], [104.068, 30.65], [104.082, 30.638], [104.096, 30.629]],
      },
    },
  ],
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/** 路线图层：两种底图共用同一份 source id */
const ROUTE_LAYERS = [
  {
    id: 'route-halo', type: 'line' as const, source: 'route',
    paint: { 'line-color': '#FFFFFF', 'line-width': 6, 'line-opacity': 0.85 },
    layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
  },
  {
    id: 'route-line', type: 'line' as const, source: 'route',
    paint: { 'line-color': '#C7633B', 'line-width': 2.6, 'line-dasharray': [1.6, 1.4] },
    layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
  },
]

function schematicStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      districts: { type: 'geojson', data: DISTRICTS },
      roads: { type: 'geojson', data: ROADS },
      water: { type: 'geojson', data: WATER },
      route: { type: 'geojson', data: EMPTY },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#EFEDE5' } },
      { id: 'districts', type: 'fill', source: 'districts', paint: { 'fill-color': '#CFE0C6', 'fill-opacity': 0.8 } },
      { id: 'water', type: 'line', source: 'water', paint: { 'line-color': '#BFD6D2', 'line-width': 14, 'line-blur': 1 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
      { id: 'road-sub', type: 'line', source: 'roads', filter: ['==', ['get', 'kind'], 'sub'], paint: { 'line-color': '#FDFBF6', 'line-width': 6 } },
      { id: 'road-main', type: 'line', source: 'roads', filter: ['==', ['get', 'kind'], 'main'], paint: { 'line-color': '#FDFBF6', 'line-width': 9 } },
      { id: 'road-ring1', type: 'line', source: 'roads', filter: ['==', ['get', 'kind'], 'ring1'], paint: { 'line-color': '#FDFBF6', 'line-width': 10 } },
      { id: 'road-ring2', type: 'line', source: 'roads', filter: ['==', ['get', 'kind'], 'ring2'], paint: { 'line-color': '#FFFFFF', 'line-width': 13 } },
      ...ROUTE_LAYERS,
    ],
  }
}

function tiandituStyle(tk: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      'tdt-vec': {
        type: 'raster',
        tiles: [tiandituTiles('vec', tk)],
        tileSize: 256,
        attribution: '© 天地图',
      },
      'tdt-cva': {
        type: 'raster',
        tiles: [tiandituTiles('cva', tk)],
        tileSize: 256,
      },
      route: { type: 'geojson', data: EMPTY },
    },
    layers: [
      { id: 'tdt-vec', type: 'raster', source: 'tdt-vec' },
      { id: 'tdt-cva', type: 'raster', source: 'tdt-cva' },
      ...ROUTE_LAYERS,
    ],
  }
}

export default function MapLibreMap({ day, selected, onSelect, basemap, onTileFail }: Props) {
  const holder = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MlMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onTileFailRef = useRef(onTileFail)
  onTileFailRef.current = onTileFail

  const useTdt = basemap.mode === 'tianditu' && basemap.tk.trim().length > 0
  const style = useMemo(
    () => (useTdt ? tiandituStyle(basemap.tk.trim()) : schematicStyle()),
    [useTdt, basemap.tk],
  )

  const pts = day.items
    .filter((i) => i.placeId)
    .map((i) => ({ item: i, place: PLACES.find((p) => p.id === i.placeId)! }))
    .filter((x) => x.place)

  // 初始化 / 切换底图时重建
  useEffect(() => {
    if (!holder.current) return
    const m = new MlMap({
      container: holder.current,
      style,
      center: [104.065, 30.663],
      zoom: useTdt ? 12 : 11.6,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    })
    m.touchZoomRotate.disableRotation()

    // 底图瓦片连续失败时通知上层，避免用户只看到一片空白
    if (useTdt) {
      let fails = 0
      m.on('error', (e: unknown) => {
        const msg = String((e as { error?: { message?: string } })?.error?.message ?? '')
        if (msg.includes('403') || msg.includes('tianditu')) {
          fails += 1
          if (fails === 3) onTileFailRef.current?.()
        }
      })
    }

    setMap(m)

    return () => {
      markersRef.current.forEach((x) => x.remove())
      markersRef.current = []
      m.remove()
      setMap(null)
    }
  }, [style, useTdt])

  // 点位与路线
  useEffect(() => {
    if (!map) return

    const draw = () => {
      markersRef.current.forEach((x) => x.remove())
      markersRef.current = []

      if (pts.length > 0) {
        const lngs = pts.map((p) => p.place.lng)
        const lats = pts.map((p) => p.place.lat)
        const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
        const cLat = (Math.min(...lats) + Math.max(...lats)) / 2
        // 点位跨度极小时不能直接用 fitBounds，否则会放大到街道级
        const span = Math.max(
          Math.max(...lngs) - Math.min(...lngs),
          Math.max(...lats) - Math.min(...lats),
          0.0009,
        )
        const zoom = span < 0.004 ? 12.9 : span < 0.01 ? 12.4 : span < 0.03 ? 11.9 : span < 0.08 ? 11 : 10
        map.jumpTo({ center: [cLng, cLat], zoom })
      }

      const screen = pts.map((p) => map.project([p.place.lng, p.place.lat]))
      // 真实底图本身提供了空间参考，互推距离收窄，避免点位偏离真实位置
      const offs = spread(screen, useTdt ? 24 : 34)

      pts.forEach((p, i) => {
        const el = document.createElement('button')
        el.className = 'ml-pin'
        el.type = 'button'
        el.setAttribute('aria-label', p.place.name)
        el.innerHTML = `<span>${i + 1}</span>`
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelectRef.current(i)
        })
        const marker = new Marker({ element: el, anchor: 'center', offset: offs[i] })
          .setLngLat([p.place.lng, p.place.lat])
          .addTo(map)
        markersRef.current.push(marker)
      })

      const route: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: pts.length > 1
          ? [{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: pts.map((p, i) => {
                  const s = screen[i]
                  const ll = map.unproject([s.x + offs[i][0], s.y + offs[i][1]])
                  return [ll.lng, ll.lat]
                }),
              },
            }]
          : [],
      }
      const src = map.getSource('route') as GeoJSONSource | undefined
      src?.setData(route)
    }

    if (map.loaded()) draw()
    else map.once('load', draw)
  }, [map, day.index, pts.length])

  // 选中态
  useEffect(() => {
    if (!map) return
    markersRef.current.forEach((m, i) => {
      m.getElement().classList.toggle('on', i === selected)
    })
    const p = pts[selected]
    if (p) map.easeTo({ center: [p.place.lng, p.place.lat], duration: 320, zoom: map.getZoom() })
  }, [map, selected])

  return <div ref={holder} className="mlmap" />
}
