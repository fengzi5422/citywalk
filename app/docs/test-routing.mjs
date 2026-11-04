/** 探测天地图路径规划接口在浏览器端是否可用（CORS / 配额 / 返回结构） */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const tk = process.argv[2]?.trim()
if (!tk) { console.error('用法: node docs/test-routing.mjs <tk>'); process.exit(1) }

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'],
  defaultViewport: { width: 430, height: 900 },
})
const page = await browser.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 160)) })
await page.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle0' })

const report = await page.evaluate(async (key) => {
  const orig = '104.0420,30.6440' // 锦里
  const dest = '104.0430,30.6450' // 武侯祠
  const out = []

  async function probe(name, url) {
    const t0 = performance.now()
    try {
      const r = await fetch(url)
      const text = await r.text()
      let parsed = null
      try { parsed = JSON.parse(text) } catch { /* 非 JSON */ }
      const routes = parsed?.result?.routes
      out.push({
        name,
        status: r.status,
        type: r.headers.get('content-type') || '-',
        ms: Math.round(performance.now() - t0),
        bodyHead: text.slice(0, 220),
        routeCount: Array.isArray(routes) ? routes.length : null,
        first: routes?.[0]
          ? {
              distance: routes[0].distance,
              duration: routes[0].duration,
              keys: Object.keys(routes[0]).slice(0, 8),
            }
          : null,
        msg: parsed?.msg ?? parsed?.returncode ?? null,
      })
    } catch (e) {
      out.push({ name, status: 'ERR', ms: Math.round(performance.now() - t0), bodyHead: String(e).slice(0, 160) })
    }
  }

  const q = (o) => encodeURIComponent(JSON.stringify(o))

  await probe('drive+search', `https://api.tianditu.gov.cn/drive?postStr=${q({ orig, dest, style: '0' })}&type=search&tk=${key}`)
  await probe('bus+search', `https://api.tianditu.gov.cn/bus?postStr=${q({ orig, dest, style: '0' })}&type=search&tk=${key}`)
  await probe('walk+search', `https://api.tianditu.gov.cn/walk?postStr=${q({ orig, dest, style: '0' })}&type=search&tk=${key}`)

  return out
}, tk)

for (const r of report) {
  console.log('\n====', r.name, '====')
  console.log('status', r.status, '| type', r.type, '|', r.ms, 'ms')
  if (r.routeCount !== null) console.log('routes', r.routeCount, '| first', JSON.stringify(r.first))
  if (r.msg) console.log('msg', r.msg)
  console.log('body:', r.bodyHead)
}

await browser.close()
