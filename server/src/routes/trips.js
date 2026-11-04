import { getDb } from '../db.js'

const MAX_PAYLOAD = 256 * 1024

export default async function tripRoutes(app) {
  app.get('/api/trips', { preHandler: [app.authenticate] }, async (req) => {
    const db = getDb()
    const rows = db
      .prepare('SELECT id, title, city, payload, created_at, updated_at FROM trips WHERE user_id = ? ORDER BY updated_at DESC')
      .all(req.user.sub)
    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        city: r.city,
        trip: JSON.parse(r.payload),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    }
  })

  app.get('/api/trips/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const db = getDb()
    const row = db
      .prepare('SELECT id, title, city, payload, created_at, updated_at FROM trips WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.sub)
    if (!row) return reply.code(404).send({ ok: false, error: '行程不存在' })
    return {
      ok: true,
      data: {
        id: row.id,
        title: row.title,
        city: row.city,
        trip: JSON.parse(row.payload),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    }
  })

  /** 幂等写入：同一 id 重复提交就是更新 */
  app.put('/api/trips/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const id = String(req.params.id || '')
    const trip = req.body?.trip
    if (!id || !trip || typeof trip !== 'object') {
      return reply.code(400).send({ ok: false, error: '缺少行程数据' })
    }

    const payload = JSON.stringify(trip)
    if (Buffer.byteLength(payload) > MAX_PAYLOAD) {
      return reply.code(413).send({ ok: false, error: '行程数据过大' })
    }

    const db = getDb()
    const now = Date.now()
    const title = String(req.body?.title || trip.title || '未命名行程').slice(0, 80)
    const city = String(req.body?.city || trip.city || '').slice(0, 40)

    db.prepare(`
      INSERT INTO trips (id, user_id, title, city, payload, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        city = excluded.city,
        payload = excluded.payload,
        updated_at = excluded.updated_at
      WHERE trips.user_id = excluded.user_id
    `).run(id, req.user.sub, title, city, payload, now, now)

    return { ok: true, data: { id, updatedAt: now } }
  })

  app.delete('/api/trips/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const db = getDb()
    const r = db.prepare('DELETE FROM trips WHERE id = ? AND user_id = ?').run(req.params.id, req.user.sub)
    if (r.changes === 0) return reply.code(404).send({ ok: false, error: '行程不存在' })
    db.prepare('UPDATE shares SET revoked = 1 WHERE trip_id = ? AND user_id = ?').run(req.params.id, req.user.sub)
    return { ok: true, data: { deleted: 1 } }
  })
}
