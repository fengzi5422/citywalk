/**
 * 交付验收：合规文本、数据导出/导入、离线提示、版本信息
 * 前置：前端 dev server 在 5178
 * 用法：node docs/delivery-test.mjs
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = 'D:\\Users\\3392\\Desktop\\wan\\ly\\app\\shots\\'
const DL = path.join(OUT, 'downloads')
const BASE = 'http://127.0.0.1:5178'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0
let fail = 0
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' | ' + extra : '')) }
}

fs.mkdirSync(DL, { recursive: true })
for (const f of fs.readdirSync(DL)) fs.rmSync(path.join(DL, f), { force: true })

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=2'],
  defaultViewport: { width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
})
const errors = []
const page = await browser.newPage()
page.on('pageerror', (e) => errors.push(e.message))

async function tab(n) {
  await page.evaluate((i) => document.querySelectorAll('.tabbar button')[i]?.click(), n)
  await sleep(500)
}
async function clickText(t) {
  await page.evaluate((txt) => {
    const el = [...document.querySelectorAll('button')].find((e) => (e.textContent || '').includes(txt))
    el?.click()
  }, t)
  await sleep(480)
}
const body = () => page.evaluate(() => document.body.innerText || '')

await page.goto(BASE + '/', { waitUntil: 'networkidle0' })
await sleep(500)

console.log('1) 我的页与条款入口')
await tab(3)
let txt = await body()
check('打开我的页', txt.includes('数据与隐私'))
check('版本号为候选交付版', txt.includes('v0.9.0'), txt.slice(0, 120))
check('条款与说明入口存在', txt.includes('用户协议') && txt.includes('隐私政策') && txt.includes('免责声明'))

console.log('2) 三份合规文本')
await clickText('用户协议')
txt = await body()
check('用户协议内容完整', txt.includes('服务性质') && txt.includes('账号') && txt.includes('分享链接'))
await clickText('隐私政策')
txt = await body()
check('隐私政策内容完整', txt.includes('我们收集什么') && txt.includes('我们不收集什么') && txt.includes('注销'))
await clickText('免责声明')
txt = await body()
check('免责声明内容完整', txt.includes('内容为示例数据') && txt.includes('不提供导航') && txt.includes('审图号'))
await page.screenshot({ path: OUT + '93-legal.png' })
await page.evaluate(() => document.querySelector('button[aria-label="返回"]')?.click())
await sleep(450)

console.log('3) 数据导出')
await tab(3)
const cdp = await page.createCDPSession()
await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL })
await clickText('导出本机备份')
await sleep(1300)
const files = fs.readdirSync(DL).filter((f) => f.endsWith('.json'))
check('生成 JSON 备份文件', files.length === 1, files.join(','))
let parsed = null
if (files.length) {
  try { parsed = JSON.parse(fs.readFileSync(path.join(DL, files[0]), 'utf8')) } catch { /* 留给下一项报错 */ }
}
check('备份结构合法', Boolean(parsed && parsed.app === 'citywalk' && parsed.version === 1 && Array.isArray(parsed.trips)), JSON.stringify(parsed)?.slice(0, 160))
check('备份不含密码与天地图 key', Boolean(parsed) && !JSON.stringify(parsed).includes('VITE_TIANDITU_TK') && !('password' in (parsed || {})))

console.log('4) 数据导入')
if (parsed) {
  const fake = {
    ...parsed,
    exportedAt: Date.now(),
    trips: [],
    saved: ['p-panda'],
    history: [],
  }
  const p = path.join(DL, 'import-test.json')
  fs.writeFileSync(p, JSON.stringify(fake))
  const input = await page.$('input[type="file"]')
  await input.uploadFile(p)
  await sleep(800)
  const tip = await page.evaluate(() => document.querySelector('.me-tip')?.textContent || '')
  check('导入给出成功提示', tip.includes('已导入'), tip)
} else {
  check('导入给出成功提示', false, '前置导出失败')
}
await page.screenshot({ path: OUT + '94-backup.png' })

console.log('5) 离线状态条')
await page.evaluate(() => window.dispatchEvent(new Event('offline')))
await sleep(350)
check('离线时显示提示条', (await page.$('.offline-bar')) !== null)
await page.evaluate(() => window.dispatchEvent(new Event('online')))
await sleep(350)
check('恢复在线后提示条消失', (await page.$('.offline-bar')) === null)

check('全程无页面 JS 错误', errors.length === 0, errors.join(' | '))

await browser.close()
console.log(`\nERRORS: ${fail}`)
console.log(`通过 ${pass}，失败 ${fail}`)
if (fail) process.exit(1)
