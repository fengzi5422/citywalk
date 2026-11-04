/**
 * 历史记录 / 版本快照 / 收藏上云 / 跨设备同步 端到端测试
 * 用法：node docs/history-sync-test.mjs
 * 前置：前端 5178、后端 5179 均已启动
 */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'D:\\Users\\3392\\Desktop\\wan\\ly\\app\\shots\\'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const email = `hs${Date.now()}@citywalk.app`
const password = 'demo12345'

let pass = 0
let fail = 0
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' | ' + extra : '')) }
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=2'],
  defaultViewport: { width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
})
const errors = []

async function click(page, text) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find((e) =>
      (e.textContent || '').replace(/\s+/g, '').includes(t))
    if (el) { el.click(); return true }
    return false
  }, text)
  if (!ok) throw new Error('未找到: ' + text)
  await sleep(430)
}

async function tab(page, i) {
  await page.evaluate((n) => document.querySelectorAll('.tab')[n]?.click(), i)
  await sleep(430)
}

async function shot(page, name) {
  await page.screenshot({ path: OUT + name + '.png' })
  console.log('shot', name)
}

async function createTrip(page) {
  await click(page, '为我安排两天')
  await click(page, '下一步')
  await click(page, '下一步')
  await click(page, '生成两天行程')
  await sleep(2600)
  await page.evaluate(() => document.querySelector('button[aria-label="返回"]')?.click())
  await sleep(400)
}

async function register(page) {
  await tab(page, 3)
  await click(page, '登录以同步行程')
  await click(page, '去注册')
  await page.type('.input[type="email"]', email, { delay: 5 })
  await page.type('.input[type="password"]', password, { delay: 5 })
  await click(page, '注册并登录')
  await sleep(1500)
}

async function login(page) {
  await tab(page, 3)
  await click(page, '登录以同步行程')
  await page.type('.input[type="email"]', email, { delay: 5 })
  await page.type('.input[type="password"]', password, { delay: 5 })
  await click(page, '登录')
  await sleep(1800)
}

const savedCount = (page) =>
  page.evaluate(() => {
    try { return (JSON.parse(localStorage.getItem('citywalk.saved.v1') || '[]') || []).length }
    catch { return -1 }
  })

// ---------- 设备 A：注册 → 建两份行程 → 收藏 ----------
const a = await browser.newPage()
a.on('pageerror', (e) => errors.push('A: ' + e.message))
await a.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle0' })
await sleep(400)

await register(a)
const whoA = await a.evaluate(() => document.querySelector('.authcard .email')?.textContent || '')
check('设备 A 注册登录成功', whoA.includes(email), whoA)

await tab(a, 0)
await createTrip(a)
await tab(a, 0)
await createTrip(a)
await sleep(2200)
const tripsA = await a.evaluate(() => document.querySelectorAll('.tripcard').length)
check('设备 A 有两份行程', tripsA === 2, 'got ' + tripsA)

// 收藏一个地点
await tab(a, 0)
await a.evaluate(() => document.querySelector('.place')?.click())
await sleep(450)
await a.evaluate(() => document.querySelector('button[aria-label="收藏"]')?.click())
await sleep(1600)
const savedA = await savedCount(a)
check('设备 A 收藏已写入本机', savedA === 1, 'got ' + savedA)
await a.evaluate(() => document.querySelector('button[aria-label="返回"]')?.click())
await sleep(400)

// ---------- 历史记录页 ----------
await tab(a, 3)
await click(a, '历史记录')
await sleep(1600)
const histA = await a.evaluate(() => document.body.innerText)
check('历史页出现创建事件', histA.includes('创建'))
check('事件已上报云端', histA.includes('已上云'))
check('历史页显示统计', histA.includes('条记录'))
await shot(a, '80-history')

// 版本快照
await a.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('查看版本'))
  el?.click()
})
await sleep(1400)
const verCount = await a.evaluate(() => document.querySelectorAll('.ver-item').length)
check('行程版本快照可读', verCount >= 1, 'got ' + verCount)
await shot(a, '81-versions')

// ---------- 设备 B：登录同一账号 ----------
const ctx = await browser.createBrowserContext()
const b = await ctx.newPage()
b.on('pageerror', (e) => errors.push('B: ' + e.message))
await b.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle0' })
await sleep(400)

await login(b)
const whoB = await b.evaluate(() => document.querySelector('.authcard .email')?.textContent || '')
check('设备 B 登录同一账号', whoB.includes(email), whoB)
await sleep(1200)

const savedB = await savedCount(b)
check('收藏已同步到设备 B', savedB === 1, 'got ' + savedB)

await tab(b, 1)
const tripsB = await b.evaluate(() => document.querySelectorAll('.tripcard').length)
check('设备 B 看到设备 A 的行程', tripsB === 2, 'got ' + tripsB)

await tab(b, 3)
await click(b, '历史记录')
await sleep(1000)
const histB = await b.evaluate(() => document.body.innerText)
check('设备 B 看到云端事件时间线', histB.includes('创建'))
await shot(b, '82-history-other-device')
await b.evaluate(() => document.querySelector('button[aria-label="返回"]')?.click())
await sleep(400)

// ---------- 设备 B 再建一份，设备 A 手动同步后应看到 ----------
await tab(b, 0)
await createTrip(b)
await sleep(2600)

await a.evaluate(() => document.querySelector('button[aria-label="立即同步"]')?.click())
await sleep(2200)
const tripsAAfter = await a.evaluate(() => {
  try { return (JSON.parse(localStorage.getItem('citywalk.trips.v1') || '[]') || []).length }
  catch { return -1 }
})
check('手动同步后设备 A 看到 3 份行程', tripsAAfter === 3, 'got ' + tripsAAfter)
await shot(a, '83-after-manual-sync')

console.log('\nERRORS:', errors.length)
errors.forEach((e) => console.log(' -', e))
console.log(`\n通过 ${pass}，失败 ${fail}`)
await browser.close()
if (fail || errors.length) process.exit(1)
