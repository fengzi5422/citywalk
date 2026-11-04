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
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()) })

async function shot(name) {
  await sleep(320)
  await page.screenshot({ path: OUT + name + '.png' })
  console.log('shot', name)
}

async function clickText(text, tag = 'button') {
  const ok = await page.evaluate((t, g) => {
    const els = [...document.querySelectorAll(g)]
    const el = els.find((e) => (e.textContent || '').replace(/\s+/g, '').includes(t))
    if (el) { el.click(); return true }
    return false
  }, text, tag)
  if (!ok) throw new Error('未找到可点击元素: ' + text)
  await sleep(420)
}

await page.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle0' })
await sleep(500)
await shot('01-explore')

await clickText('为我安排两天')
await shot('02-create-1')

await clickText('下一步')
await shot('03-create-2')

await clickText('下一步')
await shot('04-create-3')

await clickText('生成两天行程')
await sleep(700)
await shot('05-generating')

await sleep(1800)
await shot('06-trip')

// 切到地图
await clickText('地图')
await shot('07-map')

// 点击地图上的第二个点位，验证选中联动
await page.evaluate(() => {
  const pins = document.querySelectorAll('.ml-pin')
  pins[1]?.click()
})
await sleep(620)
await shot('07b-map-pin2')

// 回到时间线，打开换一个
await clickText('时间线')
console.log('按钮:', await page.evaluate(() => [...document.querySelectorAll('button')].map(b => (b.textContent||'').trim().slice(0,8)).filter(Boolean).join(' | ')))
await clickText('换一个')
await shot('08-swap')

await page.evaluate(() => {
  const els = [...document.querySelectorAll('button')]
  const el = els.find((e) => (e.textContent || '').includes('取消'))
  el?.click()
})
await sleep(300)

// 开始旅行 → 今天页
await clickText('开始这趟旅行')
await shot('09-today')

// 完成一项
await clickText('已完成')
await shot('10-today-done')

// 今天页 → 行程页 → 行程列表
await page.evaluate(() => document.querySelector('button[aria-label="返回"]')?.click())
await sleep(450)
await page.evaluate(() => document.querySelector('button[aria-label="返回"]')?.click())
await sleep(450)

// 行程列表
await page.evaluate(() => {
  const els = [...document.querySelectorAll('.tab')]
  els[1]?.click()
})
await shot('11-list')

// 收藏空态
await page.evaluate(() => {
  const els = [...document.querySelectorAll('.tab')]
  els[2]?.click()
})
await shot('12-saved')

// 我的
await page.evaluate(() => {
  const els = [...document.querySelectorAll('.tab')]
  els[3]?.click()
})
await shot('13-me')

console.log('\nERRORS:', errors.length)
errors.slice(0, 12).forEach((e) => console.log(' -', e))

await browser.close()
