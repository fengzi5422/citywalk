/** 登录与云同步端到端测试：注册 → 建行程 → 换设备登录 → 看到同一份行程 */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'D:\\Users\\3392\\Desktop\\wan\\ly\\app\\shots\\'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const email = `u${Date.now()}@citywalk.app`
const password = 'demo12345'

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--force-device-scale-factor=2'],
  defaultViewport: { width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
})
const errors = []

async function click(page, text) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find((e) => (e.textContent || '').replace(/\s+/g, '').includes(t))
    if (el) { el.click(); return true }
    return false
  }, text)
  if (!ok) throw new Error('未找到: ' + text)
  await sleep(430)
}

async function goMe(page) {
  await page.evaluate(() => document.querySelectorAll('.tab')[3]?.click())
  await sleep(400)
}

// ---------- A：注册并建行程 ----------
const a = await browser.newPage()
a.on('pageerror', (e) => errors.push('A: ' + e.message))
await a.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle0' })
await sleep(400)

await goMe(a)
await a.screenshot({ path: OUT + '60-me-guest.png' })
await click(a, '登录以同步行程')
await a.screenshot({ path: OUT + '61-login.png' })

await click(a, '去注册')
await a.type('.input[type="email"]', email, { delay: 6 })
await a.type('.input[type="password"]', password, { delay: 6 })
await a.screenshot({ path: OUT + '62-register-filled.png' })
await click(a, '注册并登录')
await sleep(1200)
await a.screenshot({ path: OUT + '63-me-logged-in.png' })

const who = await a.evaluate(() => document.querySelector('.authcard .email')?.textContent || '')
console.log('登录后显示:', who)

// 建一份行程
await a.evaluate(() => document.querySelectorAll('.tab')[0]?.click())
await sleep(400)
await click(a, '为我安排两天')
await click(a, '下一步'); await click(a, '下一步')
await click(a, '生成两天行程')
await sleep(2600)
await a.evaluate(() => document.querySelector('button[aria-label="返回"]')?.click())
await sleep(400)
await goMe(a)
await sleep(2200)
await a.screenshot({ path: OUT + '64-synced.png' })
const syncText = await a.evaluate(() => document.querySelector('.authcard .sub')?.textContent || '')
console.log('同步状态:', syncText)

// ---------- B：另一台设备登录同一账号 ----------
const ctx = await browser.createBrowserContext()
const b = await ctx.newPage()
b.on('pageerror', (e) => errors.push('B: ' + e.message))
await b.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle0' })
await sleep(400)

await goMe(b)
await click(b, '登录以同步行程')
await b.type('.input[type="email"]', email, { delay: 6 })
await b.type('.input[type="password"]', password, { delay: 6 })
await click(b, '登录')
await sleep(1500)
await b.screenshot({ path: OUT + '65-other-device-login.png' })

await b.evaluate(() => document.querySelectorAll('.tab')[1]?.click())
await sleep(700)
await b.screenshot({ path: OUT + '66-other-device-trips.png' })

const cardCount = await b.evaluate(() => document.querySelectorAll('.tripcard').length)
const firstTitle = await b.evaluate(() => document.querySelector('.tripcard .info b')?.textContent || '')
console.log('另一台设备行程数:', cardCount, '| 首条:', firstTitle)

console.log('\nERRORS:', errors.length)
errors.forEach((e) => console.log(' -', e))
await browser.close()
