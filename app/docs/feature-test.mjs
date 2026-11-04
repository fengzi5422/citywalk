/** 模板套用、收藏批量加入、行程复制 三项功能验证 */
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

const shot = async (n) => { await sleep(430); await page.screenshot({ path: OUT + n + '.png' }); console.log('shot', n) }
const click = async (t) => {
  const ok = await page.evaluate((x) => {
    const el = [...document.querySelectorAll('button')].find((e) => (e.textContent || '').replace(/\s+/g, '').includes(x))
    if (el) { el.click(); return true } return false
  }, t)
  if (!ok) throw new Error('未找到: ' + t)
  await sleep(430)
}
const text = () => page.evaluate(() => document.body.innerText)

await page.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle0' })
await sleep(400)

// ---------- 1. 模板套用 ----------
console.log('1) 模板套用')
await click('老城两日')
await shot('70-template-create')
const t1 = await text()
console.log('   创建页提示:', t1.includes('套用「老城两日 · 经典」') ? '✓ 已套用' : '✗ 未套用')
console.log('   天数预填:', t1.includes('2 天') ? '✓' : '✗')

await click('下一步')
await click('下一步')
await click('生成两天行程')
await sleep(2600)

const tripText = await text()
const hit = ['武侯祠', '锦里', '宽窄巷子', '文殊院'].filter((n) => tripText.includes(n))
console.log('   模板地点命中:', hit.length, hit.join('、'))
await shot('71-template-result')

// ---------- 3. 行程复制（先做，避免被收藏打乱） ----------
console.log('2) 行程复制')
await page.evaluate(() => {
  const el = document.querySelector('.page-body')
  if (el) el.scrollTop = el.scrollHeight
})
await sleep(500)
await click('复制为新行程')
await sleep(700)
const afterClone = await text()
console.log('   副本标题:', afterClone.includes('副本') ? '✓' : '✗')
await shot('72-cloned')

// ---------- 2. 收藏批量加入 ----------
console.log('3) 收藏批量加入')
await page.evaluate(() => document.querySelector('button[aria-label="返回"]')?.click())
await sleep(400)
await page.evaluate(() => document.querySelectorAll('.tab')[0]?.click())
await sleep(500)

// 从精选列表进前两个地点并收藏（不依赖具体名字）
for (let i = 0; i < 2; i++) {
  const ok = await page.evaluate((idx) => {
    const el = document.querySelectorAll('.place')[idx]
    if (!el) return false
    el.click()
    return true
  }, i)
  await sleep(700)
  const onPlace = await page.evaluate(() => Boolean(document.querySelector('.dcover')))
  const title = await page.evaluate(() => document.querySelector('.dhead .t')?.textContent || '')
  console.log(`   进入第 ${i + 1} 个地点:`, ok && onPlace ? title : '失败')
  await page.evaluate(() => document.querySelector('button[aria-label="收藏"]')?.click())
  await sleep(400)
  const on = await page.evaluate(() => document.querySelector('.dbar .save')?.classList.contains('on'))
  console.log('   收藏状态:', on ? '已收藏' : '未收藏')
  await page.evaluate(() => document.querySelector('button[aria-label="返回"]')?.click())
  await sleep(500)
}

await page.evaluate(() => document.querySelectorAll('.tab')[2]?.click())
await sleep(500)
await shot('73-saved')
const savedText = await text()
console.log('   收藏数:', /(\d+) 个地点/.exec(savedText)?.[1] ?? '?')

await click('一起加入行程')
await sleep(400)
await shot('74-batch-sheet')
const sheetText = await text()
console.log('   弹层提示:', sheetText.includes('加入 2 个地点') ? '✓' : '✗')

await page.evaluate(() => document.querySelector('.sheet .opt')?.click())
await sleep(900)
await shot('75-after-batch')
const finalText = await text()
console.log('   加入后行程含宽窄巷子:', finalText.includes('宽窄巷子') ? '✓' : '✗')

console.log('\nERRORS:', errors.length)
errors.forEach((e) => console.log(' -', e))
await browser.close()
