import { getDb } from '../db.js'
import { allow, uid } from '../utils.js'

const MAX_EVENT_BYTES = 2048
const MAX_STATE_BYTES = 32 * 1024
const MAX_VERSIONS_PER_TRIP = 20

/** 写一条事件；id 由客户端生成，重复上报自动忽略 */
export function recordEvent(db, userId, e) {
  const info = db.prepare(`
    INSERT OR IGNORE INTO events (id, user_id, trip_id, type, title, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(e.id || uid()).slice(0, 64),
    userId,
    e.tripId ? String(e.tripId).slice(0, 64) : null,
    String(e.type || 'edit').slice(0, 24),
    String(e.title || '').slice(0, 120),
    e.detail ? String(e.detail).slice(0, 240) : null,
    Number(e.createdAt) || Date.now(),
  )
  return info.changes === 1
}

/** 留一份行程版本快照，并只保留最近 N 份，避免库无限膨胀 */
export function saveVersion(db, userId, tripId, title, payload) {
  db.prepare(`
    INSERT INTO trip_versions (id, user_id, trip_id, title, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uid(), userId, tripId, String(title).slice(0, 80), payload, Date.now())

  db.prepare(`
    DELETE FROM trip_versions
    WHERE trip_id = ? AND user_id = ? AND id NOT IN (
      SELECT id FROM trip_versions
      WHERE trip_id = ? AND user_id = ?
      ORDER BY created_at DESC LIMIT ?
    )
  `).run(tripId, userId, tripId, userId, MAX_VERSIONS_PER_TRIP)
}

export default async function historyRoutes(app) {
  /** 上报事件：支持单条或批量，离线补报复用同一 id 去重 */
  app.post('/api/history', { preHandler: [app.authenticate] }, async (req, reply) => {
    const raw = req.body?.events ?? (req.body ? [req.body] : [])
    const list = Array.isArray(raw) ? raw : []
    if (list.length === 0 || list.length > 50) {
      return reply.code(400).send({ ok: false, error: '事件数量不合法' })
    }
    if (!allow(`history:${req.user.sub}`, 120, 60_000)) {
      return reply.code(429).send({ ok: false, error: '上报太频繁' })
    }
    const db = getDb()
    let saved = 0
    for (const e of list) {
      if (!e || typeof e.title !== 'string') continue
      if (Buffer.byteLength(JSON.stringify(e)) > MAX_EVENT_BYTES) continue
      if (recordEvent(db, req.user.sub, e)) saved++
    }
    return { ok: true, data: { saved } }
  })

  /** 事件时间线 */
  app.get('/api/history', { preHandler: [app.authenticate] }, async (req) => {
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 100))
    const db = getDb()
    const rows = db
      .prepare('SELECT id, trip_id, type, title, detail, created_at FROM events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(req.user.sub, limit)
    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        tripId: r.trip_id,
        type: r.type,
        title: r.title,
        detail: r.detail,
        createdAt: r.created_at,
      })),
    }
  })

  /** 某行程的版本列表 */
  app.get('/api/trips/:id/versions', { preHandler: [app.authenticate] }, async (req) => {
    const db = getDb()
    const rows = db
      .prepare('SELECT id, title, created_at FROM trip_versions WHERE user_id = ? AND trip_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(req.user.sub, req.params.id, MAX_VERSIONS_PER_TRIP)
    return { ok: true, data: rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at })) }
  })

  /** 版本详情（可还原成 Trip） */
  app.get('/api/trips/:id/versions/:vid', { preHandler: [app.authenticate] }, async (req, reply) => {
    const db = getDb()
    const row = db
      .prepare('SELECT payload, created_at FROM trip_versions WHERE id = ? AND user_id = ? AND trip_id = ?')
      .get(req.params.vid, req.user.sub, req.params.id)
    if (!row) return reply.code(404).send({ ok: false, error: '版本不存在' })
    return { ok: true, data: { trip: JSON.parse(row.payload), createdAt: row.created_at } }
  })

  /** 轻量状态：收藏等 */
  app.get('/api/state', { preHandler: [app.authenticate] }, async (req) => {
    const db = getDb()
    const row = db.prepare('SELECT payload, updated_at FROM user_state WHERE user_id = ?').get(req.user.sub)
    if (!row) return { ok: true, data: null }
    return { ok: true, data: { state: JSON.parse(row.payload), updatedAt: row.updated_at } }
  })

  app.put('/api/state', { preHandler: [app.authenticate] }, async (req, reply) => {
    const state = req.body?.state
    const updatedAt = Number(req.body?.updatedAt) || Date.now()
    if (!state || typeof state !== 'object') {
      return reply.code(400).send({ ok: false, error: '缺少状态数据' })
    }
    const payload = JSON.stringify(state)
    if (Buffer.byteLength(payload) > MAX_STATE_BYTES) {
      return reply.code(413).send({ ok: false, error: '状态数据过大' })
    }
    const db = getDb()
    db.prepare(`
      INSERT INTO user_state (user_id, payload, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at
      WHERE user_state.updated_at <= excluded.updated_at
    `).run(req.user.sub, payload, updatedAt)
    return { ok: true, data: { updatedAt } }
  })
}
