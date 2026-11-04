/**
 * 冒烟测试：健康检查 → 注册 → 登录 → 写行程 → 建分享 → 读分享 → 撤销 → 再读
 * 用法：node scripts/smoke.mjs [baseUrl]
 */
const base = process.argv[2] || 'http://127.0.0.1:5179'

let passed = 0
let failed = 0

async function call(method, path, { body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try { json = await res.json() } catch { /* 非 JSON */ }
  return { status: res.status, json }
}

function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.log(`  ✗ ${name} ${extra}`) }
}

const email = `t${Date.now()}@citywalk.app`
const password = 'demo12345'

console.log('1) 健康检查')
const health = await call('GET', '/api/health')
check('返回 200', health.status === 200, `got ${health.status}`)
check('服务名正确', health.json?.data?.service === 'citywalk-server')

console.log('2) 注册')
const reg = await call('POST', '/api/auth/register', { body: { email, password } })
check('返回 200', reg.status === 200, `got ${reg.status} ${JSON.stringify(reg.json)}`)
check('拿到 token', typeof reg.json?.data?.token === 'string')
const token = reg.json?.data?.token

console.log('3) 重复注册应被拒')
const dup = await call('POST', '/api/auth/register', { body: { email, password } })
check('返回 409', dup.status === 409, `got ${dup.status}`)

console.log('4) 弱密码应被拒')
const weak = await call('POST', '/api/auth/register', { body: { email: `w${Date.now()}@a.com`, password: '123' } })
check('返回 400', weak.status === 400, `got ${weak.status}`)

console.log('5) 登录')
const login = await call('POST', '/api/auth/login', { body: { email, password } })
check('返回 200', login.status === 200, `got ${login.status}`)
const token2 = login.json?.data?.token ?? token

console.log('6) 错误密码')
const badLogin = await call('POST', '/api/auth/login', { body: { email, password: 'wrongpass' } })
check('返回 401', badLogin.status === 401, `got ${badLogin.status}`)

console.log('7) 未登录访问行程')
const noAuth = await call('GET', '/api/trips')
check('返回 401', noAuth.status === 401, `got ${noAuth.status}`)

console.log('8) 写入行程')
const tripId = `t${Date.now()}`
const tripBody = {
  title: '成都 · 2 天',
  city: '成都',
  trip: { id: tripId, title: '成都 · 2 天', city: '成都', plan: { days: [] }, prefs: {} },
}
const put = await call('PUT', `/api/trips/${tripId}`, { body: tripBody, token: token2 })
check('返回 200', put.status === 200, `got ${put.status}`)

const list = await call('GET', '/api/trips', { token: token2 })
check('列表包含该行程', (list.json?.data ?? []).some((t) => t.id === tripId))
check('payload 可还原', list.json?.data?.[0]?.trip?.id === tripId)

console.log('9) 创建分享')
const share = await call('POST', '/api/shares', {
  token: token2,
  body: {
    tripId,
    payload: {
      title: '成都 · 2 天',
      city: '成都',
      days: [{ date: '11月5日 周四', district: '武侯片', items: [{ name: '锦里', start: 778, duration: 90, kind: 'place' }] }],
      totals: { activities: 1, transit: 30, walk: 1.2, cost: 0 },
    },
  },
})
check('返回 200', share.status === 200, `got ${share.status} ${JSON.stringify(share.json)}`)
const shareToken = share.json?.data?.token
const ownerKey = share.json?.data?.ownerKey
check('token 为 8 位', typeof shareToken === 'string' && shareToken.length === 8, shareToken)
check('返回撤销凭证', typeof ownerKey === 'string' && ownerKey.length >= 16)

console.log('10) 公开读取分享')
const read = await call('GET', `/api/shares/${shareToken}`)
check('无需登录可读', read.status === 200, `got ${read.status}`)
check('内容完整', read.json?.data?.payload?.days?.length === 1)
check('访问计数增加', read.json?.data?.views >= 1)

console.log('11) 撤销分享')
const revoke = await call('DELETE', `/api/shares/${shareToken}`, { body: { ownerKey } })
check('凭 ownerKey 撤销成功', revoke.status === 200, `got ${revoke.status}`)

const afterRevoke = await call('GET', `/api/shares/${shareToken}`)
check('撤销后返回 410', afterRevoke.status === 410, `got ${afterRevoke.status}`)

console.log('12) 没有凭证不能撤销')
const share2 = await call('POST', '/api/shares', {
  token: token2,
  body: { tripId, payload: { title: 'x', days: [] } },
})
const steal = await call('DELETE', `/api/shares/${share2.json?.data?.token}`, { body: { ownerKey: 'wrong' } })
check('返回 403', steal.status === 403, `got ${steal.status}`)

console.log('13) 不存在的分享')
const missing = await call('GET', '/api/shares/zzzzzzzz')
check('返回 404', missing.status === 404, `got ${missing.status}`)

console.log(`\n通过 ${passed}，失败 ${failed}`)
process.exit(failed === 0 ? 0 : 1)
