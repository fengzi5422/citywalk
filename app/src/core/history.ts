/** 本地操作历史：离线也记录，登录后补报到云端；同一 id 天然去重 */

export type HistoryType =
  | 'create' | 'edit' | 'clone' | 'delete'
  | 'start' | 'done' | 'skip' | 'share'
  | 'sync' | 'login'

export interface HistoryEvent {
  id: string
  tripId?: string
  type: HistoryType
  title: string
  detail?: string
  createdAt: number
  /** 是否已上报云端；本地产生的事件初始为 false */
  synced?: boolean
}

export interface RemoteEvent {
  id: string
  tripId: string | null
  type: string
  title: string
  detail: string | null
  createdAt: number
}

const KEY = 'citywalk.history.v1'
const MAX = 200

export function loadHistory(): HistoryEvent[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as HistoryEvent[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveHistory(list: HistoryEvent[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* 容量满时丢弃最旧的即可，不影响主流程 */
  }
}

let seq = 0
export function makeEvent(e: Omit<HistoryEvent, 'id' | 'createdAt' | 'synced'> & Partial<Pick<HistoryEvent, 'createdAt'>>): HistoryEvent {
  seq += 1
  return {
    id: `h${Date.now().toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: e.createdAt ?? Date.now(),
    synced: false,
    ...e,
  }
}

/** 追加并去重、限量、按时间倒序 */
export function appendHistory(list: HistoryEvent[], incoming: HistoryEvent[]): HistoryEvent[] {
  const map = new Map<string, HistoryEvent>(list.map((e) => [e.id, e]))
  for (const e of incoming) if (!map.has(e.id)) map.set(e.id, e)
  return [...map.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX)
}

/** 云端事件合入本地：按 id 覆盖并标记为已同步，本地未上报的保留 */
export function mergeHistory(local: HistoryEvent[], remote: RemoteEvent[]): HistoryEvent[] {
  const map = new Map<string, HistoryEvent>(local.map((e) => [e.id, e]))
  for (const r of remote) {
    if (!r?.id) continue
    map.set(r.id, {
      id: r.id,
      tripId: r.tripId ?? undefined,
      type: (r.type as HistoryType) || 'edit',
      title: r.title,
      detail: r.detail ?? undefined,
      createdAt: r.createdAt,
      synced: true,
    })
  }
  return [...map.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX)
}

export const TYPE_LABEL: Record<HistoryType, string> = {
  create: '创建',
  edit: '修改',
  clone: '复制',
  delete: '删除',
  start: '出发',
  done: '完成',
  skip: '跳过',
  share: '分享',
  sync: '同步',
  login: '登录',
}
