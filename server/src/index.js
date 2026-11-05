import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { config } from './config.js'
import { initDb, closeDb, getDb } from './db.js'
import authRoutes from './routes/auth.js'
import tripRoutes from './routes/trips.js'
import shareRoutes from './routes/shares.js'
import historyRoutes from './routes/history.js'

const app = Fastify({
  logger: { level: config.isProd ? 'info' : 'warn' },
  trustProxy: true,
  bodyLimit: 512 * 1024,
})

await app.register(cors, {
  origin: (origin, cb) => {
    // 允许同源、白名单来源，以及无 Origin 的请求（本地开发 / 原生客户端）。
    // CORS_ORIGINS=* 用于前端来源无法枚举的公开部署（仅 IP 或多人各自托管网页端）；
    // 本项目用 Authorization 头而非 cookie，通配不会泄露凭证。
    if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) return cb(null, true)
    cb(new Error('来源不在白名单'), false)
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: false,
})

await app.register(jwt, {
  secret: config.jwtSecret,
  sign: { expiresIn: config.jwtExpiresIn },
})

app.decorate('authenticate', async function authenticate(req, reply) {
  try {
    await req.jwtVerify()
  } catch {
    return reply.code(401).send({ ok: false, error: '未登录或登录已过期' })
  }
  // JWT 是无状态的：账号注销后签名仍然有效，必须确认用户还存在，
  // 否则已注销的账号仍能用旧 token 继续读写接口。
  try {
    const exists = getDb().prepare('SELECT 1 FROM users WHERE id = ?').get(req.user.sub)
    if (!exists) return reply.code(401).send({ ok: false, error: '账号不存在或已注销' })
  } catch (err) {
    req.log.error(err)
    return reply.code(500).send({ ok: false, error: '服务器开小差了' })
  }
})

app.get('/api/health', async () => ({
  ok: true,
  data: {
    service: 'citywalk-server',
    version: '0.9.0',
    uptime: Math.round(process.uptime()),
    time: Date.now(),
  },
}))

await app.register(authRoutes)
await app.register(tripRoutes)
await app.register(shareRoutes)
await app.register(historyRoutes)

app.setNotFoundHandler((req, reply) => {
  reply.code(404).send({ ok: false, error: `没有这个接口：${req.method} ${req.url}` })
})

app.setErrorHandler((err, req, reply) => {
  const code = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500
  if (code >= 500) req.log.error(err)
  reply.code(code).send({
    ok: false,
    error: code >= 500 ? '服务器开小差了' : err.message,
  })
})

initDb()

const shutdown = async (signal) => {
  app.log.warn(`收到 ${signal}，准备退出`)
  await app.close()
  closeDb()
  process.exit(0)
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

try {
  await app.listen({ port: config.port, host: config.host })
  app.log.warn(`citywalk-server 已启动：http://${config.host}:${config.port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
