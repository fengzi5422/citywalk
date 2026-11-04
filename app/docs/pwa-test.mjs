/**
 * 生产构建验收：同源反代 + PWA + 离线可用 + 按需分包 + 桌面宽屏
 * 前置：npm run build 已完成；npm run preview（5180，/api 反代到 5179 后端）
 * 用法：node docs/pwa-test.mjs
 */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'D:\\Users\\3392\\Desktop\\wan\\ly\\app\\shots\\'
const BASE = 'http://127.0.0.1:5180'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0
let fail = 0
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' | ' + extra : '')) }
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=2'],
  defaultViewport: { width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
})
const errors = []
const assets = []

const page = await browser.newPage()
page.on('pageerror', (e) => errors.push(e.message))
page.on('response', (r) => {
  if (r.url().includes('/assets/')) assets.push(r.url().split('/').pop())
})

console.log('1) 生产构建首屏与分包')
await page.goto(BASE + '/', { waitUntil: 'networkidle0' })
await sleep(900)
check('首屏正常渲染', (await page.$('.phone')) !== null)
check('页面标题正确', (await page.title()).includes('城市自由行'))
const manifest = await page.evaluate(async () => {
  const r = await fetch('/manifest.webmanifest')
  const j = await r.json().catch(() => ({}))
  return { status: r.status, name: j.name, icons: j.icons?.length ?? 0 }
})
check('manifest 可读取', manifest.status === 200 && String(manifest.name).includes('城市自由行'), JSON.stringify(manifest))
check('manifest 含图标', manifest.icons >= 2, 'icons=' + manifest.icons)
check('首屏未加载地图大包（按需分包生效）', !assets.some((a) => a.startsWith('maplibre-')), assets.filter((a) => a.startsWith('maplibre-')).join(','))
await page.screenshot({ path: OUT + '90-pwa-online.png' })

console.log('2) Service Worker 与离线可用')
let swReady = false
for (let i = 0; i < 24; i++) {
  swReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    const reg = await navigator.serviceWorker.ready
    return Boolean(reg.active && navigator.serviceWorker.controller)
  }).catch(() => false)
  if (swReady) break
  await sleep(500)
}
check('SW 已激活并接管页面', swReady)

await page.setOfflineMode(true)
await sleep(200)
await page.reload({ waitUntil: 'domcontentloaded' })
await sleep(1400)
const bodyText = await page.evaluate(() => document.body.innerText || '')
check('离线仍能打开 App', (await page.$('.phone')) !== null && bodyText.length > 80, 'len=' + bodyText.length)
check('显示离线状态条', (await page.$('.offline-bar')) !== null)
await page.screenshot({ path: OUT + '91-pwa-offline.png' })
await page.setOfflineMode(false)

console.log('3) 接口同源反代')
const health = await page.evaluate(async () => {
  const r = await fetch('/api/health')
  const j = await r.json().catch(() => ({}))
  return { status: r.status, service: j?.data?.service }
})
check('/api/health 经反代返回 200', health.status === 200 && health.service === 'citywalk-server', JSON.stringify(health))

console.log('4) 桌面宽屏')
const desk = await browser.newPage()
await desk.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
await desk.goto(BASE + '/', { waitUntil: 'networkidle0' })
const aside = await desk.evaluate(() => {
  const el = document.querySelector('.desk-aside')
  return el ? getComputedStyle(el).display !== 'none' : false
})
check('宽屏展示桌面侧栏', aside)
await desk.screenshot({ path: OUT + '92-desktop.png' })

check('全程无页面 JS 错误', errors.length === 0, errors.join(' | '))

await browser.close()
console.log(`\nERRORS: ${fail}`)
console.log(`通过 ${pass}，失败 ${fail}`)
if (fail) process.exit(1)
