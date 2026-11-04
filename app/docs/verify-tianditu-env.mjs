/**
 * 验证 .env.local 里的天地图 key 在「默认启动」下生效。
 *
 * 与 verify-tianditu.mjs 的区别：
 *   - verify-tianditu.mjs 用 evaluateOnNewDocument 主动把 tk 写进 localStorage，
 *     单独验证 key 本身 / Referer 白名单是否可用（需传参）；
 *   - 本脚本不注入任何 localStorage，完全依赖 Vite 读取 .env.local 后注入的
 *     import.meta.env.VITE_TIANDITU_TK，验证「配好 env → 直接打开页面」这条真实路径。
 *
 * 用法：node docs/verify-tianditu-env.mjs
 * 前置：先启动前端 npm run dev（改动 .env.local 后需重启）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(HERE, '../shots') + path.sep
const ENV_PATH = path.resolve(HERE, '../.env.local')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function readTk() {
  if (!fs.existsSync(ENV_PATH)) return ''
  const t = fs.readFileSync(ENV_PATH, 'utf8')
  const m = t.match(/^\s*VITE_TIANDITU_TK\s*=\s*(.+?)\s*$/m)
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : ''
}

const tk = readTk()
if (!tk) {
  console.error('未在 app/.env.local 找到 VITE_TIANDITU_TK，请参考 app/.env.example 配置')
  process.exit(1)
}
console.log(`已读取 .env.local 的 tk（长度 ${tk.length}，内容不回显）`)

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=2'],
  defaultViewport: { width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
})
const page = await browser.newPage()
const errors = []
const tiles = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('response', (r) => {
  const u = r.url()
  if (u.includes('tianditu.gov.cn')) tiles.push({ status: r.status(), kind: u.includes('/cva_') ? 'cva' : 'vec' })
})
page.on('requestfailed', (r) => {
  if (r.url().includes('tianditu.gov.cn')) tiles.push({ status: 'FAIL', kind: 'vec' })
})

await page.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle0' })
await sleep(400)

// 关键断言：没有外部注入，localStorage 是干净的
const injected = await page.evaluate(() => localStorage.getItem('citywalk.basemap.v1'))
console.log('默认 localStorage 底图设置:', injected === null ? '空 → 使用 .env.local 默认值' : '已存在（非纯净上下文）')

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
await sleep(2400)
await page.screenshot({ path: OUT + '22-map-env-default.png' })
console.log('shot 22-map-env-default')

const ok = tiles.filter((t) => t.status === 200).length
const bad = tiles.filter((t) => t.status !== 200)
console.log(`\n天地图瓦片请求：成功 ${ok} / 共 ${tiles.length}，失败 ${bad.length}`)
bad.slice(0, 5).forEach((t) => console.log('  失败:', t.status, t.kind))
const failBar = await page.evaluate(() => !!document.querySelector('.mapfail'))
console.log('页面降级提示条:', failBar ? '出现（异常）' : '未出现（正常）')
console.log('页面错误:', errors.length)
errors.forEach((e) => console.log(' -', e))

const pass = ok > 0 && bad.length === 0 && !failBar && errors.length === 0 && injected === null
console.log('\n判定:', pass ? 'PASS —— .env.local 的 key 在默认启动下生效，真实底图正常' : 'FAIL')
await browser.close()
process.exit(pass ? 0 : 1)
