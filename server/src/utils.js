import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

/** 不含易混淆字符的短 ID */
export function shortId(len = 8) {
  const buf = randomBytes(len)
  let s = ''
  for (let i = 0; i < len; i++) s += ALPHABET[buf[i] % ALPHABET.length]
  return s
}

export function uid() {
  return randomBytes(12).toString('base64url')
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const key = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${key}`
}

export function verifyPassword(password, stored) {
  const [salt, key] = String(stored || '').split(':')
  if (!salt || !key) return false
  const hashed = scryptSync(password, salt, 64)
  const target = Buffer.from(key, 'hex')
  return hashed.length === target.length && timingSafeEqual(hashed, target)
}

const buckets = new Map()

/** 极简滑动窗口限流，够挡住暴力尝试 */
export function allow(key, limit, windowMs) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    return true
  }
  b.count += 1
  return b.count <= limit
}

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k)
}, 60_000).unref()

export const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim())
