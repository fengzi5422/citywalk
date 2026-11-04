import type {
  DayPlan, Pace, Place, PlanItem, PlanResult, Prefs, Transit, Unscheduled, UnscheduledReason,
} from './types'
import { dateLabel } from './time'

type PaceConf = {
  label: string
  /** 每天主要活动上限（不含餐饮） */
  maxActivities: number
  /** 当天最晚结束 */
  latestEnd: number
  /** 相邻两站可接受的最大交通时长 */
  maxTransit: number
  /** 项目间缓冲 */
  buffer: number
  /** 每日步行上限（米） */
  walkLimit: number
}

export const PACE_CONF: Record<Pace, PaceConf> = {
  easy: { label: '轻松', maxActivities: 2, latestEnd: 1200, maxTransit: 30, buffer: 20, walkLimit: 6000 },
  normal: { label: '标准', maxActivities: 3, latestEnd: 1260, maxTransit: 25, buffer: 15, walkLimit: 8000 },
  packed: { label: '紧凑', maxActivities: 4, latestEnd: 1320, maxTransit: 20, buffer: 10, walkLimit: 12000 },
}

/** 车站伪地点：只用于计算从到达站到第一站的交通，不参与推荐 */
export const STATION: Place = {
  id: 'p-station', name: '成都东站', category: 'sight', district: '',
  lat: 30.628, lng: 104.141, duration: 0, ticket: 0, tags: [], reason: '',
  indoor: false, rating: 4, priceLevel: 1,
}

const R = 6371000

export function distance(a: Place, b: Place) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la = (a.lat * Math.PI) / 180
  const lb = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * 交通耗时估算。
 * 这是替代实现：正式版应调用地图路径规划接口。
 * estimated 恒为 true，界面必须据此标注"估算"。
 */
export function transit(a: Place, b: Place): Transit {
  const d = distance(a, b)
  // 直线距离乘以路网绕行系数，比纯直线更接近实际步行距离
  const road = d * 1.35
  if (d <= 1600) {
    return { mode: 'walk', minutes: Math.max(4, Math.round(road / 75)), distance: Math.round(road), estimated: true }
  }
  if (d <= 7000) {
    return { mode: 'metro', minutes: Math.round(road / 320) + 14, distance: Math.round(road), estimated: true }
  }
  return { mode: 'bus', minutes: Math.round(road / 260) + 18, distance: Math.round(road), estimated: true }
}

export const transportLabel: Record<Transit['mode'], string> = {
  walk: '步行', metro: '地铁', bus: '公交',
}

/** 时段适配：餐饮只在饭点得高分，夜游类只在傍晚后得高分 */
function timeFit(p: Place, minute: number) {
  if (p.category === 'food') {
    const lunch = minute >= 660 && minute <= 810
    const dinner = minute >= 1020 && minute <= 1200
    return lunch || dinner ? 1 : 0.1
  }
  if (p.tags.includes('夜游')) return minute >= 1080 ? 1 : 0.25
  if (p.tags.includes('茶馆')) return minute >= 840 && minute <= 1110 ? 1 : 0.45
  if (p.tags.includes('亲子')) return minute <= 720 ? 1 : 0.5
  return 0.6
}

function score(p: Place, prefs: Prefs, minute: number, from: Place | null, preferred?: Set<string>) {
  const hits = p.tags.filter((t) => prefs.interests.includes(t)).length
  let s = Math.min(1, hits / 2) * 0.35
  s += ((p.rating - 4) / 0.8) * 0.15
  s += timeFit(p, minute) * 0.15
  s += p.ticket <= prefs.budget[1] * 0.25 ? 0.1 : 0.02
  s += p.indoor ? 0.03 : 0
  if (prefs.mustGo.includes(p.id)) s += 0.25
  // 套用路线模板时，模板里的地点优先
  if (preferred?.has(p.id)) s += 0.45
  if (from) {
    const d = distance(from, p)
    s += d < 1200 ? 0.12 : d < 3000 ? 0.06 : 0
  }
  return s
}

function isOpenOn(p: Place, weekday: number) {
  if (!p.open) return true
  return !(p.open.closedOn ?? []).includes(weekday)
}

/** 片区按"平均分 × 规模系数"排序，避免一个片区因为地点多就垄断所有天数 */
function rankDistricts(prefs: Prefs, places: Place[], preferred?: Set<string>) {
  const groups = new Map<string, Place[]>()
  for (const p of places) {
    if (!groups.has(p.district)) groups.set(p.district, [])
    groups.get(p.district)!.push(p)
  }
  return [...groups.entries()]
    .map(([name, list]) => {
      const avg = list.reduce((s, p) => s + score(p, prefs, 720, null, preferred), 0) / list.length
      return { name, list, rank: avg * Math.log2(1 + list.length) }
    })
    .sort((a, b) => b.rank - a.rank)
}

function dayWindow(dayIdx: number, prefs: Prefs) {
  const cfg = PACE_CONF[prefs.pace]
  let start = 540 // 09:00
  let end = cfg.latestEnd
  if (dayIdx === 0) start = Math.max(start, prefs.arrivalTime + 50)
  if (dayIdx === prefs.days - 1) end = Math.min(end, prefs.departureTime - 110)
  return { start, end }
}

export function generatePlan(
  prefs: Prefs,
  allPlaces: Place[],
  baseDate = new Date(),
  preferredIds: string[] = [],
): PlanResult {
  const cfg = PACE_CONF[prefs.pace]
  const weekdayOf = (i: number) => new Date(baseDate.getTime() + i * 86400000).getDay()
  const preferred = new Set(preferredIds)

  const districts = rankDistricts(prefs, allPlaces, preferred)

  // 有预约的那一天，片区以预约地点为准；其余天按排名依次分配，避免重复
  const fixedDays = new Map<number, string>()
  for (const b of prefs.bookings) {
    const p = allPlaces.find((x) => x.id === b.placeId)
    if (p && b.dayIndex < prefs.days) fixedDays.set(b.dayIndex, p.district)
  }
  const usedDistricts = new Set(fixedDays.values())
  const rest = districts.map((d) => d.name).filter((n) => !usedDistricts.has(n))
  let ri = 0
  const dayDistrict = Array.from({ length: prefs.days }, (_, i) => {
    if (fixedDays.has(i)) return fixedDays.get(i)!
    if (rest.length === 0) return districts[i % districts.length].name
    return rest[ri++ % rest.length]
  })

  const days: DayPlan[] = []
  const skipped: Unscheduled[] = []
  const warnings: string[] = []
  const used = new Set<string>()

  for (let d = 0; d < prefs.days; d++) {
    const win = dayWindow(d, prefs)
    const wd = weekdayOf(d)
    const district = dayDistrict[d]
    const items: PlanItem[] = []

    // 到达
    items.push({
      id: `arrival-${d}`,
      kind: 'arrival',
      name: `抵达 · ${prefs.arrivalPlace}`,
      start: prefs.arrivalTime,
      duration: 50,
      note: d === 0 ? '出站、寄存行李，留出缓冲' : undefined,
    })

    const pool = allPlaces.filter(
      (p) => p.district === district && isOpenOn(p, wd) && !prefs.bookings.some((b) => b.placeId === p.id),
    )

    // 当天预约
    const bookings = prefs.bookings
      .filter((b) => b.dayIndex === d)
      .map((b) => ({ place: allPlaces.find((p) => p.id === b.placeId)!, time: b.time }))
      .filter((x) => Boolean(x.place))
      .sort((a, b) => a.time - b.time)

    let cursor = win.start
    let last: Place | null = null
    let activities = 0
    let meals = 0
    let cost = 0
    let walk = 0

    const pushPlace = (p: Place, start: number, locked = false) => {
      const tr = last ? transit(last, p) : transit(STATION, p)
      const limit = p.open ? (p.open.lastEntry ?? p.open.end) : 1440
      const warning = p.open && p.open.state === 'pending'
        ? '营业信息待确认，出发前请核实'
        : start + p.duration > limit
          ? '到达时间接近停止入场'
          : undefined
      items.push({
        id: `item-${d}-${p.id}`,
        kind: p.category === 'food' ? 'meal' : 'place',
        placeId: p.id,
        name: p.name,
        start,
        duration: p.duration,
        note: p.reason,
        locked,
        warning,
        fromPrev: tr,
      })
      used.add(p.id)
      if (p.category !== 'food') activities += 1
      else meals += 1
      cost += p.ticket
      if (tr?.mode === 'walk') walk += tr.distance
      last = p
    }

    const tryPick = (minute: number): Place | null => {
      let best: Place | null = null
      let bestScore = -1
      for (const p of pool) {
        if (used.has(p.id)) continue
        if (p.category === 'food' && meals >= 2) continue
        if (p.category !== 'food' && activities >= cfg.maxActivities) continue
        const s = score(p, prefs, minute, last, preferred)
        if (s > bestScore) { best = p; bestScore = s }
      }
      return best
    }

    const fill = (from: number, to: number) => {
      let t = from
      let guard = 0
      while (guard++ < 12) {
        const cand = tryPick(t)
        if (!cand) break
        const tr = last ? transit(last, cand) : transit(STATION, cand)
        let arrive = t + (tr?.minutes ?? 0)
        if (cand.open && cand.open.start > arrive) arrive = cand.open.start
        const leave = arrive + cand.duration
        const limit = cand.open ? (cand.open.lastEntry ?? cand.open.end) : 1440

        if (leave > to) {
          skipped.push({ placeId: cand.id, name: cand.name, reason: 'time' })
          pool.splice(pool.indexOf(cand), 1)
          continue
        }
        if (leave > limit) {
          skipped.push({ placeId: cand.id, name: cand.name, reason: 'closed' })
          pool.splice(pool.indexOf(cand), 1)
          continue
        }
        if (cost + cand.ticket > prefs.budget[1] * prefs.days * 0.6) {
          skipped.push({ placeId: cand.id, name: cand.name, reason: 'budget' })
          pool.splice(pool.indexOf(cand), 1)
          continue
        }
        if (last && tr && tr.minutes > cfg.maxTransit) {
          skipped.push({ placeId: cand.id, name: cand.name, reason: 'far' })
          pool.splice(pool.indexOf(cand), 1)
          continue
        }

        pushPlace(cand, arrive)
        t = leave + cfg.buffer
        if (activities >= cfg.maxActivities && meals >= 1) break
      }
    }

    // 按预约切段填充
    for (const b of bookings) {
      const segEnd = Math.max(win.start, b.time - 25)
      if (segEnd - cursor >= 70) fill(cursor, segEnd)
      if (!isOpenOn(b.place, wd)) {
        warnings.push(`第 ${d + 1} 天的预约地点「${b.place.name}」当天闭馆，请改期。`)
        continue
      }
      pushPlace(b.place, b.time, true)
      cursor = b.time + b.place.duration + cfg.buffer
    }
    if (win.end - cursor >= 60) fill(cursor, win.end)

    // 最后一天补离开
    if (d === prefs.days - 1) {
      items.push({
        id: `departure-${d}`,
        kind: 'departure',
        name: `返程 · ${prefs.departurePlace}`,
        start: prefs.departureTime - 60,
        duration: 60,
        note: '预留取行李与进站时间',
      })
    }

    items.sort((a, b) => a.start - b.start)

    const transitTotal = items.reduce((s, i) => s + (i.fromPrev?.minutes ?? 0), 0)
    const endAt = items.reduce((s, i) => Math.max(s, i.start + i.duration), win.start)
    if (endAt > cfg.latestEnd) {
      warnings.push(`第 ${d + 1} 天的安排结束于 ${Math.floor(endAt / 60)}:${String(endAt % 60).padStart(2, '0')}，超出「${cfg.label}」节奏的收尾时间。`)
    }

    days.push({
      index: d,
      date: dateLabel(baseDate, d),
      district,
      items,
      summary: { activities, transit: transitTotal, walk: Math.round(walk / 100) / 10, cost },
    })
  }

  const assumptions = [
    prefs.lodgingAssumed
      ? `住宿尚未确定，按「${prefs.lodging}」片区估算出发与返回时间。`
      : `以「${prefs.lodging}」为每天的出发与返回点。`,
    '交通耗时按直线距离估算，未接入实时路况；出行前请以导航为准。',
    '门票与餐饮为估算值，不含往返大交通与住宿。',
  ]

  // 未安排去重，保留最有信息量的前 6 条
  const seen = new Set<string>()
  const unscheduled = skipped.filter((s) => {
    if (seen.has(s.placeId)) return false
    seen.add(s.placeId)
    return true
  }).slice(0, 6)

  if (unscheduled.some((u) => u.reason === 'closed')) {
    warnings.push('有地点因开放时间或最晚入场限制未能排入，已在下方列出。')
  }

  return { days, unscheduled, assumptions, warnings }
}

export const reasonText: Record<UnscheduledReason, string> = {
  time: '当天时间不足',
  closed: '开放时间冲突',
  far: '距离过远，交通不划算',
  budget: '超出预算',
  pending: '信息待确认',
}

export const paceHint: Record<Pace, string> = {
  easy: '每天约 2 个主要活动，留出茶馆和午休',
  normal: '每天约 3 个主要活动，节奏适中',
  packed: '每天约 4 个主要活动，尽量多看',
}

