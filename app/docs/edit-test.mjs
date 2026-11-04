import puppeteer from 'puppeteer-core'
const CHROME = 'C://Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'D://Users//3392//Desktop//wan//ly//app//shots//'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--force-device-scale-factor=2'],
  defaultViewport: { width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const shot = async (n) => { await sleep(420); await page.screenshot({ path: OUT + n + '.png' }); console.log('shot', n) }
const clickText = async (t) => {
  const ok = await page.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find((e) => (e.textContent || '').replace(/\s+/g, '').includes(x))
    if (el) { el.click(); return true } return false
  }, t)
  if (!ok) throw new Error('未找到: ' + t)
  await sleep(420)
}

await page.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle0' })
await sleep(400)
await clickText('为我安排两天')
await clickText('下一步'); await clickText('下一步')
await clickText('生成两天行程')
await sleep(2600)

// 打开第一张卡的更多操作
await page.evaluate(() => document.querySelector('.more')?.click())
await shot('30-ops-sheet')

// 下移
await clickText('下移一站')
await shot('31-after-move')

// 撤销
await page.evaluate(() => document.querySelector('.undo-bar')?.click())
await sleep(450)
await shot('32-after-undo')

// 移到第二天
await page.evaluate(() => document.querySelectorAll('.more')[1]?.click())
await sleep(400)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.opgrid button')].find((b) => b.textContent?.includes('移到第 2 天'))
  el?.click()
})
await shot('33-moved-to-day2')

// 锁定
await page.evaluate(() => document.querySelectorAll('.more')[0]?.click())
await sleep(380)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.opgrid button')].find((b) => b.textContent?.includes('锁定'))
  el?.click()
})
await shot('34-locked')

console.log('ERRORS:', errors.length)
errors.forEach((e) => console.log(' -', e))
await browser.close()
