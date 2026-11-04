import puppeteer from 'puppeteer-core'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'D:\\Users\\3392\\Desktop\\wan\\ly\\app\\shots\\'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--force-device-scale-factor=2'],
  defaultViewport: { width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const shot = async (n) => { await sleep(450); await page.screenshot({ path: OUT + n + '.png' }); console.log('shot', n) }
const clickText = async (t) => {
  const ok = await page.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find((e) => (e.textContent || '').replace(/\s+/g, '').includes(x))
    if (el) { el.click(); return true } return false
  }, t)
  if (!ok) throw new Error('未找到: ' + t)
  await sleep(430)
}

await page.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle0' })
await sleep(400)
await clickText('为我安排两天')
await clickText('下一步'); await clickText('下一步')
await clickText('生成两天行程')
await sleep(2600)

// 打开分享面板
await page.evaluate(() => document.querySelector('button[aria-label="分享"]')?.click())
await shot('40-share-sheet')

// 生成链接
await clickText('生成链接')
await shot('41-share-link')

const link = await page.evaluate(() => document.querySelector('.linkbox')?.textContent?.trim() || '')
console.log('link =', link)

// 打开分享页
await page.goto(link, { waitUntil: 'networkidle0' })
await sleep(700)
await shot('42-share-view')

// 滚动到底
await page.evaluate(() => {
  const el = document.querySelector('.page-body')
  if (el) el.scrollTop = el.scrollHeight
})
await shot('43-share-bottom')

// 回行程页撤销
await page.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle0' })
await sleep(500)
await page.evaluate(() => document.querySelectorAll('.tab')[1]?.click())
await sleep(400)
await page.evaluate(() => document.querySelector('.tripcard')?.click())
await sleep(500)
await page.evaluate(() => document.querySelector('button[aria-label="分享"]')?.click())
await sleep(450)
const stillThere = await page.evaluate(() => Boolean(document.querySelector('.linkbox')))
console.log('撤销前仍有链接:', stillThere)
if (stillThere) {
  await clickText('撤销链接')
  await sleep(400)
}
await shot('44-share-revoked')

// 再打开旧链接
await page.goto(link, { waitUntil: 'networkidle0' })
await sleep(700)
await shot('45-share-invalid')

console.log('ERRORS:', errors.length)
errors.forEach((e) => console.log(' -', e))
await browser.close()
