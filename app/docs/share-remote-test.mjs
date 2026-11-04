/** 验证分享能否跨"设备"打开：新浏览器上下文没有本地缓存，数据只能来自服务端 */
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'D:\\Users\\3392\\Desktop\\wan\\ly\\app\\shots\\'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--force-device-scale-factor=2'],
  defaultViewport: { width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
})

const errors = []

// —— A：创建并分享 ——
const a = await browser.newPage()
a.on('pageerror', (e) => errors.push('A: ' + e.message))
await a.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle0' })
await sleep(400)

async function click(page, text) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find((e) => (e.textContent || '').replace(/\s+/g, '').includes(t))
    if (el) { el.click(); return true }
    return false
  }, text)
  if (!ok) throw new Error('未找到: ' + text)
  await sleep(430)
}

await click(a, '为我安排两天')
await click(a, '下一步'); await click(a, '下一步')
await click(a, '生成两天行程')
await sleep(2600)

await a.evaluate(() => document.querySelector('button[aria-label="分享"]')?.click())
await sleep(400)
await click(a, '生成链接')
await sleep(900)
await a.screenshot({ path: OUT + '50-share-remote.png' })

const link = await a.evaluate(() => document.querySelector('.linkbox')?.textContent?.trim() || '')
const hint = await a.evaluate(() => document.querySelector('.sheet .hint')?.textContent?.trim() || '')
console.log('link =', link)
console.log('hint =', hint)
if (!link.includes('#/s/')) throw new Error('没有生成有效链接')

// —— B：干净上下文，模拟另一台设备 ——
const ctx = await browser.createBrowserContext()
const b = await ctx.newPage()
b.on('pageerror', (e) => errors.push('B: ' + e.message))
await b.goto(link, { waitUntil: 'networkidle0' })
await sleep(900)
await b.screenshot({ path: OUT + '51-share-other-device.png' })

const shown = await b.evaluate(() => ({
  title: document.querySelector('.share-hero .n')?.textContent || '',
  days: document.querySelectorAll('.share-day').length,
  failed: document.body.textContent?.includes('已失效') || false,
}))
console.log('另一台设备看到:', JSON.stringify(shown))

// —— A：撤销 ——
await a.bringToFront()
await a.evaluate(() => document.querySelector('.scrim')?.click())
await sleep(300)
await a.evaluate(() => document.querySelector('button[aria-label="分享"]')?.click())
await sleep(400)
await click(a, '撤销链接')
await sleep(800)

// —— B：刷新后应失效 ——
await b.reload({ waitUntil: 'networkidle0' })
await sleep(800)
await b.screenshot({ path: OUT + '52-share-after-revoke.png' })
const afterRevoke = await b.evaluate(() => document.body.textContent?.includes('已失效') || false)
console.log('撤销后另一台设备显示失效:', afterRevoke)

console.log('\nERRORS:', errors.length)
errors.forEach((e) => console.log(' -', e))
await browser.close()
