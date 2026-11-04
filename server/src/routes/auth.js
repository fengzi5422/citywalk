import { getDb } from '../db.js'
import { allow, hashPassword, isEmail, uid, verifyPassword } from '../utils.js'

const bad = (reply, code, msg) => reply.code(code).send({ ok: false, error: msg })

export default async function authRoutes(app) {
  app.post('/api/auth/register', async (req, reply) => {
    const ip = req.ip
    if (!allow(`reg:${ip}`, 10, 60_000)) return bad(reply, 429, '操作太频繁，请稍后再试')

    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    if (!isEmail(email)) return bad(reply, 400, '邮箱格式不对')
    if (password.length < 8) return bad(reply, 400, '密码至少 8 位')

    const db = getDb()
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (exists) return bad(reply, 409, '这个邮箱已经注册过了')

    const id = uid()
    db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(id, email, hashPassword(password), Date.now())

    const token = app.jwt.sign({ sub: id, email })
    return { ok: true, data: { token, user: { id, email } } }
  })

  app.post('/api/auth/login', async (req, reply) => {
    const ip = req.ip
    if (!allow(`login:${ip}`, 20, 60_000)) return bad(reply, 429, '尝试次数过多，请一分钟后再试')

    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')

    const db = getDb()
    const row = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email)
    if (!row || !verifyPassword(password, row.password_hash)) {
      return bad(reply, 401, '邮箱或密码不对')
    }

    const token = app.jwt.sign({ sub: row.id, email: row.email })
    return { ok: true, data: { token, user: { id: row.id, email: row.email } } }
  })

  app.get('/api/me', { preHandler: [app.authenticate] }, async (req) => {
    const db = getDb()
    const row = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(req.user.sub)
    if (!row) return { ok: false, error: '账号不存在' }
    return { ok: true, data: { id: row.id, email: row.email, createdAt: row.created_at } }
  })
}
