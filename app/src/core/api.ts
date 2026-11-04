import { loadAuth, type Auth } from './auth'
import type { Trip } from './types'

/**
 * 后端接口客户端。
 * 默认走同源 /api（开发时由 Vite 代理到 127.0.0.1:5179）；
 * 部署到云服务器时用 VITE_API_BASE 指向独立域名。
 */
const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

async function req<T>(path: string, init?: RequestInit & { anonymous?: boolean }): Promise<T | null> {
  try {
    const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) }
    if (init?.body) headers['Content-Type'] = 'application/json'
    if (!init?.anonymous) {
      const a = loadAuth()
      if (a) headers.Authorization = `Bearer ${a.token}`
    }

    const res = await fetch(BASE + path, { ...init, headers })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T } | null
    if (!res.ok || !json?.ok) return null
    return (json.data ?? null) as T | null
  } catch {
    return null
  }
}

export interface RemoteShare {
  token: string
  path: string
  ownerKey: string
  expiresAt: number
  ttlDays: number
  bound: boolean
}

export interface RemoteTrip {
  id: string
  title: string
  city: string
  trip: Trip
  createdAt: number
  updatedAt: number
}

export interface RemoteEvent {
  id: string
  tripId: string | null
  type: string
  title: string
  detail: string | null
  createdAt: number
}

export interface RemoteVersion {
  id: string
  title: string
  createdAt: number
}

export interface UserState {
  saved: string[]
  [key: string]: unknown
}

export interface RemoteState {
  state: UserState
  updatedAt: number
}

export const api = {
  health: () => req<{ service: string; version: string }>('/api/health', { anonymous: true }),

  register: (email: string, password: string) =>
    req<Auth>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      anonymous: true,
    }),

  login: (email: string, password: string) =>
    req<Auth>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      anonymous: true,
    }),

  me: () => req<{ id: string; email: string }>('/api/me'),

  /** 注销账号：删除服务端全部关联数据，不可恢复 */
  deleteAccount: () => req<{ deleted: boolean }>('/api/me', { method: 'DELETE' }),

  listTrips: () => req<RemoteTrip[]>('/api/trips'),

  putTrip: (trip: Trip) =>
    req<{ id: string; updatedAt: number }>(`/api/trips/${encodeURIComponent(trip.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ title: trip.title, city: trip.city, trip }),
    }),

  deleteTrip: (id: string) =>
    req<{ deleted: number }>(`/api/trips/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  postEvents: (events: unknown[]) =>
    req<{ saved: number }>('/api/history', { method: 'POST', body: JSON.stringify({ events }) }),

  listHistory: (limit = 100) => req<RemoteEvent[]>(`/api/history?limit=${limit}`),

  listVersions: (tripId: string) =>
    req<RemoteVersion[]>(`/api/trips/${encodeURIComponent(tripId)}/versions`),

  getVersion: (tripId: string, vid: string) =>
    req<{ trip: Trip; createdAt: number }>(
      `/api/trips/${encodeURIComponent(tripId)}/versions/${encodeURIComponent(vid)}`,
    ),

  getState: () => req<RemoteState | null>('/api/state'),

  putState: (state: UserState, updatedAt: number) =>
    req<{ updatedAt: number }>('/api/state', {
      method: 'PUT',
      body: JSON.stringify({ state, updatedAt }),
    }),

  createShare: (tripId: string, payload: unknown) =>
    req<RemoteShare>('/api/shares', { method: 'POST', body: JSON.stringify({ tripId, payload }) }),

  getShare: (token: string) =>
    req<{ payload: Record<string, unknown>; createdAt: number; expiresAt: number; views: number }>(
      `/api/shares/${encodeURIComponent(token)}`,
      { anonymous: true },
    ),

  revokeShare: (token: string, ownerKey: string) =>
    req<{ revoked: number }>(`/api/shares/${encodeURIComponent(token)}`, {
      method: 'DELETE',
      body: JSON.stringify({ ownerKey }),
    }),
}

/** 后端是否可用，用于决定分享走服务端还是本地 */
export async function backendAvailable() {
  const h = await api.health()
  return Boolean(h?.service)
}

/** 分享读取需要区分"已撤销/过期"和"网络不可达"，所以单独返回状态码 */
export async function fetchShare(token: string): Promise<{ data: Record<string, unknown> | null; status: number }> {
  try {
    const res = await fetch(`${BASE}/api/shares/${encodeURIComponent(token)}`)
    const json = await res.json().catch(() => null)
    return { data: json?.ok ? json.data : null, status: res.status }
  } catch {
    return { data: null, status: 0 }
  }
}

/** 本地与云端合并：同 id 取 updatedAt 较新的那份 */
export function mergeTrips(local: Trip[], remote: RemoteTrip[]): Trip[] {
  const map = new Map<string, Trip>(local.map((t) => [t.id, t]))
  for (const r of remote) {
    if (!r?.trip?.id) continue
    const mine = map.get(r.id)
    if (!mine || r.updatedAt > mine.updatedAt) map.set(r.id, r.trip)
  }
  return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}
