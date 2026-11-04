import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { config } from './config.js'
import { initDb, closeDb } from './db.js'
import authRoutes from './routes/auth.js'
import tripRoutes from './routes/trips.js'
import shareRoutes from './routes/shares.js'

const app = Fastify({
  logger: { level: config.isProd ? 'info' : 'warn' },
  trustProxy: true,
  bodyLimit: 512 * 1024,
})

await app.register(cors, {
  origin: (origin, cb) => {
    // 允许同源、白名单来源；本地开发时也放行无 Origin 的请求
    if (!origin || config.corsOrigins.includes(origin)) return cb(null, true)
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
})

app.get('/api/health', async () => ({
  ok: true,
  data: {
    service: 'citywalk-server',
    version: '0.1.0',
    uptime: Math.round(process.uptime()),
    time: Date.now(),
  },
}))

await app.register(authRoutes)
await app.register(tripRoutes)
await app.register(shareRoutes)

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
