const KEY = 'citywalk.auth.v1'

export interface AuthUser {
  id: string
  email: string
}

export interface Auth {
  token: string
  user: AuthUser
}

export function loadAuth(): Auth | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const a = JSON.parse(raw) as Auth
    return a?.token ? a : null
  } catch {
    return null
  }
}

export function saveAuth(a: Auth) {
  localStorage.setItem(KEY, JSON.stringify(a))
}

export function clearAuth() {
  localStorage.removeItem(KEY)
}
