import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'D:\\Users\\3392\\Desktop\\wan\\ly\\app\\shots\\'
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

async function shot(name) {
  await sleep(400)
  await page.screenshot({ path: OUT + name + '.png' })
  console.log('shot', name)
}

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

await page.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle0' })
await sleep(400)

// 建一份行程
await clickText('为我安排两天')
await clickText('下一步')
await clickText('下一步')
await clickText('生成两天行程')
await sleep(2400)

// 行程页 → 返回列表 → 我的 → 填 key → 切天地图
await page.evaluate(() => document.querySelector('button[aria-label="返回"]')?.click())
await sleep(400)
await page.evaluate(() => document.querySelectorAll('.tab')[3]?.click())
await sleep(450)
await shot('14-me-basemap')

await page.type('.input', 'demo-key-for-layout-test', { delay: 8 })
await sleep(200)
await clickText('天地图')
await shot('15-me-tianditu')

// 行程 → 打开 → 地图
await page.evaluate(() => document.querySelectorAll('.tab')[1]?.click())
await sleep(450)
await page.evaluate(() => document.querySelector('.tripcard')?.click())
await sleep(500)
await clickText('地图')
await sleep(1500)
await shot('16-map-tianditu')

// 切回示意图，确认可逆
await page.evaluate(() => document.querySelector('button[aria-label="返回"]')?.click())
await sleep(400)
await page.evaluate(() => document.querySelectorAll('.tab')[3]?.click())
await sleep(400)
await clickText('示意图')
await page.evaluate(() => document.querySelectorAll('.tab')[1]?.click())
await sleep(400)
await page.evaluate(() => document.querySelector('.tripcard')?.click())
await sleep(450)
await clickText('地图')
await sleep(1200)
await shot('17-map-back')

console.log('ERRORS:', errors.length)
errors.forEach((e) => console.log(' -', e))
await browser.close()
