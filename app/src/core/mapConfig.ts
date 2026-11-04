/** 底图配置：示意图（自有数据）或天地图（真实瓦片） */

export type BaseMapMode = 'schematic' | 'tianditu'

export interface BaseMapSetting {
  mode: BaseMapMode
  /** 天地图浏览器端 key（tk）。仅保存在本机浏览器。 */
  tk: string
}

const KEY = 'citywalk.basemap.v1'

/** 若 .env.local 里配了 tk，首次打开直接进天地图；界面里的选择仍然优先 */
const ENV_TK = (import.meta.env.VITE_TIANDITU_TK ?? '').trim()

export const DEFAULT_BASEMAP: BaseMapSetting = ENV_TK
  ? { mode: 'tianditu', tk: ENV_TK }
  : { mode: 'schematic', tk: '' }

export function loadBaseMap(): BaseMapSetting {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_BASEMAP }
    const parsed = JSON.parse(raw) as Partial<BaseMapSetting>
    return {
      mode: parsed.mode === 'tianditu' ? 'tianditu' : 'schematic',
      tk: typeof parsed.tk === 'string' ? parsed.tk : '',
    }
  } catch {
    return { ...DEFAULT_BASEMAP }
  }
}

export function saveBaseMap(s: BaseMapSetting) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

/** 天地图 WMTS 瓦片地址。{x}/{y}/{z} 由 MapLibre 替换。 */
export function tiandituTiles(layer: 'vec' | 'cva', tk: string) {
  return `https://t0.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk=${encodeURIComponent(tk)}`
}
