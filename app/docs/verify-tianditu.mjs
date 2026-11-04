/**
 * 天地图 key 验证 + 真实底图截图
 * 用法：node docs/verify-tianditu.mjs <你的 tk>
 *
 * 用浏览器上下文请求瓦片，Referer 与页面一致，能真实反映白名单是否生效。
 */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'D:\\Users\\3392\\Desktop\\wan\\ly\\app\\shots\\'
const tk = (process.argv[2] || '').trim()

if (!tk) {
  console.error('用法: node docs/verify-tianditu.mjs <tk>')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=2'],
  defaultViewport: { width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle0' })
await sleep(300)

// ---- 1. 直接请求瓦片，验证 key 与白名单 ----
const tileReport = await page.evaluate(async (key) => {
  const lng = 104.0655
  const lat = 30.663
  const out = []
  for (const z of [10, 11, 12, 13, 14]) {
    const n = 2 ** z
    const x = Math.floor(((lng + 180) / 360) * n)
    const y = Math.floor(
      ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n,
    )
    for (const layer of ['vec', 'cva']) {
      const url =
        `https://t0.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
        `&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles` +
        `&TILECOL=${x}&TILEROW=${y}&TILEMATRIX=${z}&tk=${encodeURIComponent(key)}`
      try {
        const r = await fetch(url)
        const buf = await r.arrayBuffer()
        out.push({ z, layer, status: r.status, type: r.headers.get('content-type') || '-', size: buf.byteLength })
      } catch (e) {
        out.push({ z, layer, status: 'ERR', type: String(e).slice(0, 40), size: 0 })
      }
    }
  }
  return out
}, tk)

console.log('层级  图层  状态  类型                 大小')
for (const r of tileReport) {
  console.log(
    String(r.z).padStart(4),
    String(r.layer).padEnd(5),
    String(r.status).padStart(5),
    String(r.type).padEnd(20),
    r.size,
  )
}

const okTiles = tileReport.filter((r) => r.status === 200 && r.size > 1000)
console.log(`\n可用瓦片 ${okTiles.length} / ${tileReport.length}`)
if (okTiles.length === 0) {
  console.log('\n判定：key 不可用。常见原因——')
  console.log('  1. Referer 白名单里没有 127.0.0.1（或只加了 localhost）')
  console.log('  2. key 类型选了「服务端」而不是「浏览器端」')
  console.log('  3. 复制时带了空格，或少了字符')
}

// ---- 2. 注入配置，看真实底图 ----
await page.evaluateOnNewDocument((key) => {
  localStorage.setItem('citywalk.basemap.v1', JSON.stringify({ mode: 'tianditu', tk: key }))
}, tk)
await page.reload({ waitUntil: 'networkidle0' })
await sleep(600)

async function clickText(text) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find((e) =>
      (e.textContent || '').replace(/\s+/g, '').includes(t))
    if (el) { el.click(); return true }
    return false
  }, text)
  if (!ok) throw new Error('未找到: ' + text)
  await sleep(420)
}

await clickText('为我安排两天')
await clickText('下一步')
await clickText('下一步')
await clickText('生成两天行程')
await sleep(2600)

await page.evaluate(() => document.querySelector('button[aria-label="返回"]')?.click())
await sleep(350)
await page.evaluate(() => document.querySelector('.tripcard')?.click())
await sleep(450)
await clickText('地图')
await sleep(2200)
await page.screenshot({ path: OUT + '20-map-tianditu-real.png' })
console.log('shot 20-map-tianditu-real')

// 放大地图看细节
await page.evaluate(() => {
  const el = document.querySelector('.mlmap canvas')
  el?.dispatchEvent(new WheelEvent('wheel', { deltaY: -400, bubbles: true }))
})
await sleep(1400)
await page.screenshot({ path: OUT + '21-map-tianditu-zoom.png' })
console.log('shot 21-map-tianditu-zoom')

console.log('\nERRORS:', errors.length)
errors.forEach((e) => console.log(' -', e))

await browser.close()
