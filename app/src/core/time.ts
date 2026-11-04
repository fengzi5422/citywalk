export const pad = (n: number) => String(n).padStart(2, '0')

/** 分钟 → "14:05" */
export const fmt = (m: number) => {
  const v = ((m % 1440) + 1440) % 1440
  return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`
}

/** "14:05" → 分钟 */
export const parse = (s: string) => {
  const [h, mi] = s.split(':').map(Number)
  return h * 60 + (mi || 0)
}

/** 分钟 → "1 小时 30 分" */
export const human = (m: number) => {
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} 小时 ${r} 分` : `${h} 小时`
}

/** 分钟 → "1.5h" */
export const short = (m: number) => {
  const h = m / 60
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`
}

/** 日期标签 */
export const dateLabel = (base: Date, offset: number) => {
  const d = new Date(base.getTime() + offset * 86400000)
  const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 ${w}`
}
