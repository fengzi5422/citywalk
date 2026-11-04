/* 城市自由行 · Service Worker
 * 目标：旅行途中弱网 / 无网也能打开 App、查看已生成的行程。
 * 策略：
 *   - /api/*           网络优先且不缓存（账号、同步、分享必须走实时数据）
 *   - 页面导航         网络优先，失败回落缓存的 app shell
 *   - 静态资源         cache-first，带 hash 的产物可长期复用
 * 仅在正式构建（PROD）注册，开发环境不启用，避免干扰调试与自动化。
 */
const CACHE = 'citywalk-shell-v2'
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await cache.addAll(SHELL).catch(() => {})
    // 首次访问时 SW 尚未控制页面，带 hash 的构建产物不会被 fetch 拦截。
    // 因此在安装阶段解析 index.html 并主动预缓存首屏 JS/CSS，
    // 保证「装好就能离线打开」，而不是必须在线访问第二次。
    try {
      const html = await (await fetch('/index.html')).text()
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
      await Promise.all(assets.map((a) => cache.add(a).catch(() => {})))
    } catch {
      // 离线安装场景忽略，shell 缓存仍然可用
    }
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // 接口不做离线缓存：本地优先的数据在 localStorage 里，接口必须实时
  if (url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy)).catch(() => {})
          return res
        })
        .catch(async () => (await caches.match('/index.html')) || (await caches.match('/')) || Response.error()),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        }
        return res
      })
    }),
  )
})
