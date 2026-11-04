import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

const env = process.env

export const config = {
  port: Number(env.PORT || 5179),
  host: env.HOST || '127.0.0.1',
  dbPath: env.DB_PATH ? resolve(env.DB_PATH) : resolve(here, '../data/citywalk.db'),
  jwtSecret: env.JWT_SECRET || 'dev-secret-change-before-deploy',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '30d',
  // 默认白名单含 Capacitor WebView 的 origin（Android 默认 https://localhost，iOS 为 capacitor://localhost），
  // 便于打包成原生 App 后直连后端；同源网页部署不触发 CORS，不受影响。
  corsOrigins: (env.CORS_ORIGINS ||
    'http://127.0.0.1:5178,http://localhost:5178,http://localhost,https://localhost,capacitor://localhost')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  isProd: env.NODE_ENV === 'production',
  /** 单条分享快照的最大体积，防止被当作免费存储 */
  maxShareBytes: Number(env.MAX_SHARE_BYTES || 64 * 1024),
  shareTtlDays: Number(env.SHARE_TTL_DAYS || 7),
}

if (config.isProd && config.jwtSecret.startsWith('dev-secret')) {
  throw new Error('生产环境必须设置 JWT_SECRET')
}
