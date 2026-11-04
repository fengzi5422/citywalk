import type { DayPlan, Place, PlanItem, Prefs } from '../core/types'
import { PACE_CONF, STATION, distance, transit } from '../core/scheduler'
import { fmt } from '../core/time'

/** 按顺序重算一天的时间：改一项，后面的全部跟着动。这是"改动即时可见"的基础。 */
export function recomputeDay(day: DayPlan, prefs: Prefs, places: Place[]): DayPlan {
  const cfg = PACE_CONF[prefs.pace]
  // 不重新排序：数组顺序就是用户看到的顺序，排序会抵消刚做的上下移动
  const items = day.items
  let cursor = items[0]?.start ?? 540
  let lastPlace: Place | null = null
  const out: PlanItem[] = []

  items.forEach((it, i) => {
    // 返程时间是硬约束，不参与顺延
    if (it.kind === 'departure') {
      out.push(it)
      return
    }
    const p = it.placeId ? places.find((x) => x.id === it.placeId) : undefined
    // 首站从车站出发，也要算交通
    const tr = p ? transit(lastPlace ?? STATION, p) : undefined
    const start = it.locked || i === 0 ? it.start : cursor + (tr?.minutes ?? 0)
    out.push({ ...it, start, fromPrev: tr })
    // 抵达项的时长本身已含缓冲，不再叠加，否则重算结果会比生成时晚 20 分钟
    cursor = start + it.duration + (it.kind === 'arrival' ? 0 : cfg.buffer)
    if (p) lastPlace = p
  })

  const walk = out.reduce((s, i) => s + (i.fromPrev?.mode === 'walk' ? i.fromPrev.distance : 0), 0)
  const transitTotal = out.reduce((s, i) => s + (i.fromPrev?.minutes ?? 0), 0)
  const cost = out.reduce((s, i) => {
    const p = i.placeId ? places.find((x) => x.id === i.placeId) : undefined
    return s + (p?.ticket ?? 0)
  }, 0)
  const activities = out.filter((i) => i.kind === 'place').length

  return {
    ...day,
    items: out,
    summary: { activities, transit: transitTotal, walk: Math.round(walk / 100) / 10, cost },
  }
}

/** 与日程冲突的提示，按项目逐条给 */
export function checkDay(day: DayPlan, places: Place[]): string[] {
  const msgs: string[] = []
  for (const it of day.items) {
    const p = it.placeId ? places.find((x) => x.id === it.placeId) : undefined
    if (!p?.open) continue
    const limit = p.open.lastEntry ?? p.open.end
    if (it.start + it.duration > limit) {
      msgs.push(`${it.name}：预计 ${fmt(it.start)} 到达，但 ${fmt(limit)} 停止入场`)
    }
    if (p.open.state === 'pending') msgs.push(`${p.name}：营业信息待确认`)
  }
  return msgs
}

/** 同日同类型的替换候选，按距离排序 */
export function findAlternatives(target: Place, places: Place[], usedIds: Set<string>, limit = 2): Place[] {
  const pool = places.filter(
    (p) => p.id !== target.id && !usedIds.has(p.id) && p.category === target.category,
  )
  if (pool.length <= limit) return pool
  return pool.sort((a, b) => distance(a, target) - distance(b, target)).slice(0, limit)
}

/** 把某一项换成另一个地点 */
export function replaceItem(day: DayPlan, itemId: string, next: Place): DayPlan {
  return {
    ...day,
    items: day.items.map((it) =>
      it.id === itemId
        ? { ...it, placeId: next.id, name: next.name, duration: next.duration, note: next.reason, warning: undefined }
        : it,
    ),
  }
}

/** 跳过某一项 */
export function skipItem(day: DayPlan, itemId: string): DayPlan {
  return { ...day, items: day.items.filter((it) => it.id !== itemId) }
}

/** 统计整趟行程的交通与花费 */
export function tripTotals(days: DayPlan[], places: Place[]) {
  let transit = 0
  let walk = 0
  let cost = 0
  let activities = 0
  for (const d of days) {
    transit += d.summary.transit
    walk += d.summary.walk
    cost += d.summary.cost
    activities += d.summary.activities
  }
  return { transit, walk: Math.round(walk * 10) / 10, cost, activities }
}


/** 上下移动：只与相邻的可移动项交换，跳过抵达与返程 */
export function moveItem(
  day: DayPlan, itemId: string, dir: -1 | 1, prefs: Prefs, places: Place[],
): DayPlan {
  const items = [...day.items]
  const idx = items.findIndex((i) => i.id === itemId)
  if (idx < 0 || items[idx].locked) return day

  let target = -1
  for (let i = idx + dir; i >= 0 && i < items.length; i += dir) {
    const k = items[i].kind
    if (k === 'arrival' || k === 'departure') break
    if (k === 'place' || k === 'meal') { target = i; break }
  }
  if (target < 0 || items[target].locked) return day

  ;[items[idx], items[target]] = [items[target], items[idx]]
  return recomputeDay({ ...day, items }, prefs, places)
}

/** 移到另一天：插在返程之前，两天分别重排 */
export function moveToDay(
  days: DayPlan[], fromIdx: number, itemId: string, toIdx: number, prefs: Prefs, places: Place[],
): DayPlan[] {
  if (fromIdx === toIdx) return days
  const from = days[fromIdx]
  const item = from.items.find((i) => i.id === itemId)
  if (!item || item.locked) return days

  const nextFrom = { ...from, items: from.items.filter((i) => i.id !== itemId) }
  const to = days[toIdx]
  const at = to.items.findIndex((i) => i.kind === 'departure')
  const moved = { ...item, id: `${item.id}-m${Date.now()}` }
  const nextTo = {
    ...to,
    items: at >= 0
      ? [...to.items.slice(0, at), moved, ...to.items.slice(at)]
      : [...to.items, moved],
  }

  return days.map((d, i) => {
    if (i === fromIdx) return recomputeDay(nextFrom, prefs, places)
    if (i === toIdx) return recomputeDay(nextTo, prefs, places)
    return d
  })
}

/** 锁定 / 解锁：锁定的项目不参与移动，时间也保持不变 */
export function toggleLock(day: DayPlan, itemId: string): DayPlan {
  return {
    ...day,
    items: day.items.map((i) => (i.id === itemId ? { ...i, locked: !i.locked } : i)),
  }
}
