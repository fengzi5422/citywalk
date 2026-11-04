import type { Trip } from './types'
import { fmt } from './time'

/** 分享快照：只读、脱敏、可撤销 */
export interface ShareItem {
  name: string
  start: number
  duration: number
  kind: 'place' | 'meal'
}

export interface ShareDay {
  date: string
  district: string
  items: ShareItem[]
}

export interface ShareSnapshot {
  token: string
  tripId: string
  title: string
  city: string
  createdAt: number
  expiresAt: number
  revoked: boolean
  days: ShareDay[]
  totals: { activities: number; transit: number; walk: number; cost: number }
  /** 服务端分享才有：撤销凭证 */
  ownerKey?: string
  /** 是否为服务端分享（决定能否跨设备打开） */
  remote?: boolean
}

const KEY = 'citywalk.shares.v1'

export function loadShares(): Record<string, ShareSnapshot> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, ShareSnapshot>) : {}
  } catch {
    return {}
  }
}

function persist(all: Record<string, ShareSnapshot>) {
  localStorage.setItem(KEY, JSON.stringify(all))
}

const rand = () => Math.random().toString(36).slice(2, 10)

/**
 * 生成快照。
 * 脱敏规则：不写入抵达/返程站点、不含住宿信息、不含私人备注与票号，
 * 只保留"哪一天、几点、去哪、待多久"。
 */
function buildSnapshot(trip: Trip, ttlDays: number): ShareSnapshot {
  const days: ShareDay[] = trip.plan.days.map((d) => ({
    date: d.date,
    district: d.district,
    items: d.items
      .filter((i) => i.kind === 'place' || i.kind === 'meal')
      .map((i) => ({
        name: i.name,
        start: i.start,
        duration: i.duration,
        kind: i.kind as 'place' | 'meal',
      })),
  }))

  const totals = trip.plan.days.reduce(
    (acc, d) => ({
      activities: acc.activities + d.summary.activities,
      transit: acc.transit + d.summary.transit,
      walk: acc.walk + d.summary.walk,
      cost: acc.cost + d.summary.cost,
    }),
    { activities: 0, transit: 0, walk: 0, cost: 0 },
  )
  totals.walk = Math.round(totals.walk * 10) / 10

  return {
    token: rand(),
    tripId: trip.id,
    title: trip.title,
    city: trip.city,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlDays * 86400000,
    revoked: false,
    days,
    totals,
  }
}

/** 只生成、不落地，用于文案预览 */
export function previewShare(trip: Trip): ShareSnapshot {
  return buildSnapshot(trip, 7)
}

export function createShare(trip: Trip, ttlDays = 7): ShareSnapshot {
  const snap = buildSnapshot(trip, ttlDays)
  const all = loadShares()
  // 同一份行程只保留最新一条有效分享
  for (const [k, v] of Object.entries(all)) {
    if (v.tripId === trip.id && !v.revoked) {
      all[k] = { ...v, revoked: true }
    }
  }
  all[snap.token] = snap
  persist(all)
  return snap
}

export function revokeShare(token: string) {
  const all = loadShares()
  if (all[token]) {
    all[token] = { ...all[token], revoked: true }
    persist(all)
  }
}

export function getShare(token: string): ShareSnapshot | null {
  const s = loadShares()[token]
  return s ?? null
}

export function activeShareOf(tripId: string): ShareSnapshot | null {
  const all = loadShares()
  const now = Date.now()
  return (
    Object.values(all).find(
      (s) => s.tripId === tripId && !s.revoked && s.expiresAt > now,
    ) ?? null
  )
}

export function shareLink(token: string) {
  return `${location.origin}${location.pathname}#/s/${token}`
}

/** 纯文本版，方便直接粘到聊天窗口 */
export function shareText(s: ShareSnapshot) {
  const lines: string[] = [`${s.title}`, '']
  for (const d of s.days) {
    lines.push(d.date)
    for (const i of d.items) {
      lines.push(`  ${fmt(i.start)}  ${i.name}  ${i.duration >= 60 ? `${Math.round((i.duration / 60) * 10) / 10}h` : `${i.duration}min`}`)
    }
    lines.push('')
  }
  lines.push(
    `共 ${s.days.length} 天 · ${s.totals.activities} 站 · 交通 ${s.totals.transit} 分钟 · 预估 ¥${s.totals.cost}`,
  )
  lines.push('— 由「城市自由行」生成，仅供同行者参考')
  return lines.join('\n')
}


/** 只取内容部分，作为服务端存储的载荷 */
export function sharePayload(s: ShareSnapshot) {
  return { title: s.title, city: s.city, days: s.days, totals: s.totals }
}
