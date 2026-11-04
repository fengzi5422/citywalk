import { getDb } from '../db.js'
import { config } from '../config.js'
import { allow, shortId } from '../utils.js'

export default async function shareRoutes(app) {
  /**
   * 创建分享。
   * 登录用户会绑定账号；未登录也允许创建，但撤销需要创建时返回的 ownerKey。
   */
  app.post('/api/shares', async (req, reply) => {
    let userId = null
    try {
      await req.jwtVerify()
      userId = req.user.sub
    } catch {
      /* 匿名分享 */
    }

    const rateKey = userId || req.ip
    if (!allow(`share:${rateKey}`, 30, 60_000)) {
      return reply.code(429).send({ ok: false, error: '创建太频繁，请稍后再试' })
    }

    const tripId = String(req.body?.tripId || '')
    const payload = req.body?.payload
    if (!tripId || !payload || typeof payload !== 'object') {
      return reply.code(400).send({ ok: false, error: '缺少分享内容' })
    }

    const json = JSON.stringify(payload)
    if (Buffer.byteLength(json) > config.maxShareBytes) {
      return reply.code(413).send({ ok: false, error: '分享内容过大' })
    }

    const db = getDb()
    const token = shortId(8)
    const ownerKey = shortId(20)
    const now = Date.now()
    const expiresAt = now + config.shareTtlDays * 86400000

    if (userId) {
      db.prepare('UPDATE shares SET revoked = 1 WHERE trip_id = ? AND user_id = ? AND revoked = 0')
        .run(tripId, userId)
    }

    db.prepare(`
      INSERT INTO shares (token, trip_id, user_id, owner_key, payload, created_at, expires_at, revoked, views)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
    `).run(token, tripId, userId, ownerKey, json, now, expiresAt)

    return {
      ok: true,
      data: {
        token,
        path: `/s/${token}`,
        ownerKey,
        expiresAt,
        ttlDays: config.shareTtlDays,
        bound: Boolean(userId),
      },
    }
  })

  /** 公开读取：不需要登录，撤销或过期返回 410 */
  app.get('/api/shares/:token', async (req, reply) => {
    const ip = req.ip
    if (!allow(`view:${ip}`, 120, 60_000)) {
      return reply.code(429).send({ ok: false, error: '访问过于频繁' })
    }

    const db = getDb()
    const row = db
      .prepare('SELECT token, payload, created_at, expires_at, revoked, views FROM shares WHERE token = ?')
      .get(req.params.token)

    if (!row) return reply.code(404).send({ ok: false, error: '分享不存在' })
    if (row.revoked) return reply.code(410).send({ ok: false, error: '这份分享已被撤销' })
    if (row.expires_at < Date.now()) return reply.code(410).send({ ok: false, error: '这份分享已过期' })

    db.prepare('UPDATE shares SET views = views + 1 WHERE token = ?').run(req.params.token)

    return {
      ok: true,
      data: {
        payload: JSON.parse(row.payload),
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        views: row.views + 1,
      },
    }
  })

  /** 撤销：登录用户校验归属，匿名用户校验 ownerKey */
  app.delete('/api/shares/:token', async (req, reply) => {
    const db = getDb()
    const ownerKey = String(req.body?.ownerKey || req.query?.ownerKey || '')

    let userId = null
    try {
      await req.jwtVerify()
      userId = req.user.sub
    } catch {
      /* 允许 ownerKey 撤销 */
    }

    const row = db.prepare('SELECT token, user_id, owner_key FROM shares WHERE token = ?').get(req.params.token)
    if (!row) return reply.code(404).send({ ok: false, error: '分享不存在' })

    const byOwner = userId && row.user_id === userId
    const byKey = ownerKey && ownerKey === row.owner_key
    if (!byOwner && !byKey) {
      return reply.code(403).send({ ok: false, error: '无权撤销这份分享' })
    }

    db.prepare('UPDATE shares SET revoked = 1 WHERE token = ?').run(req.params.token)
    return { ok: true, data: { revoked: 1 } }
  })

  /** 我创建过的分享 */
  app.get('/api/shares', { preHandler: [app.authenticate] }, async (req) => {
    const db = getDb()
    const rows = db
      .prepare('SELECT token, trip_id, created_at, expires_at, revoked, views FROM shares WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
      .all(req.user.sub)
    return {
      ok: true,
      data: rows.map((r) => ({
        token: r.token,
        tripId: r.trip_id,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        revoked: Boolean(r.revoked),
        views: r.views,
        path: `/s/${r.token}`,
      })),
    }
  })
}
