import type { Trip } from './types'
import type { HistoryEvent } from './history'
import type { BaseMapSetting } from './mapConfig'

/**
 * 本机数据备份：用户可随时把自己的数据带走，不依赖服务器是否在线。
 * 备份只包含本机内容，不含密码；天地图 key 也不写入备份（属于设备级配置）。
 */
export interface BackupFile {
  app: 'citywalk'
  version: 1
  exportedAt: number
  trips: Trip[]
  saved: string[]
  history: HistoryEvent[]
  stateAt: number
}

export interface BackupInput {
  trips: Trip[]
  saved: string[]
  history: HistoryEvent[]
  stateAt: number
}

export function buildBackup(input: BackupInput): BackupFile {
  return {
    app: 'citywalk',
    version: 1,
    exportedAt: Date.now(),
    trips: input.trips,
    saved: input.saved,
    history: input.history,
    stateAt: input.stateAt,
  }
}

export function downloadBackup(b: BackupFile) {
  const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date(b.exportedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const name = `citywalk-backup-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}.json`
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 严格校验：宁可拒绝，也不要把本机数据覆盖成垃圾 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('不是合法的 JSON 文件')
  }
  if (!raw || typeof raw !== 'object') throw new Error('备份内容为空')
  const b = raw as Partial<BackupFile>
  if (b.app !== 'citywalk' || b.version !== 1) throw new Error('不是城市自由行的 v1 备份文件')
  if (!Array.isArray(b.trips) || !Array.isArray(b.saved) || !Array.isArray(b.history)) {
    throw new Error('备份缺少行程 / 收藏 / 历史数据')
  }
  if (!b.trips.every((t) => t && typeof t.id === 'string' && typeof t.updatedAt === 'number' && Array.isArray(t.plan?.days))) {
    throw new Error('备份中有损坏的行程，已拒绝导入')
  }
  if (!b.saved.every((s) => typeof s === 'string')) throw new Error('备份中的收藏数据不合法')
  if (!b.history.every((h) => h && typeof h.id === 'string' && typeof h.title === 'string')) {
    throw new Error('备份中的历史记录不合法')
  }
  return {
    app: 'citywalk',
    version: 1,
    exportedAt: Number(b.exportedAt) || Date.now(),
    trips: b.trips,
    saved: b.saved,
    history: b.history,
    stateAt: Number(b.stateAt) || 0,
  }
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file, 'utf-8')
  })
}

/** 导入采用保守合并：同 id 行程取较新者，收藏与历史取并集 */
export function mergeBackupTrips(current: Trip[], incoming: Trip[]): Trip[] {
  const map = new Map<string, Trip>(current.map((t) => [t.id, t]))
  for (const t of incoming) {
    const mine = map.get(t.id)
    if (!mine || t.updatedAt > mine.updatedAt) map.set(t.id, t)
  }
  return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}
