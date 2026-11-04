/**
 * 后端接口客户端。
 * 默认走同源 /api（开发时由 Vite 代理到 127.0.0.1:5179）；
 * 部署到云服务器时用 VITE_API_BASE 指向独立域名。
 */
const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

async function req<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(BASE + path, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {}),
      },
    })
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

export const api = {
  health: () => req<{ service: string; version: string }>('/api/health'),

  createShare: (tripId: string, payload: unknown) =>
    req<RemoteShare>('/api/shares', { method: 'POST', body: JSON.stringify({ tripId, payload }) }),

  getShare: (token: string) =>
    req<{ payload: Record<string, unknown>; createdAt: number; expiresAt: number; views: number }>(
      `/api/shares/${encodeURIComponent(token)}`,
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
