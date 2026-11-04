/** 账号注销与数据清理冒烟测试（需后端已在 5179 运行） */
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:5179'
let pass = 0
let fail = 0

function ok(name, cond, extra = '') {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name}${extra ? ' | ' + extra : ''}`)
  }
}

async function call(method, path, { token, body } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json, data: json?.data }
}

console.log('1) 注册并写入数据')
const email = `del-${Date.now()}@citywalk.app`
const reg = await call('POST', '/api/auth/register', { body: { email, password: 'test-pass-1234' } })
ok('注册成功', reg.status === 200 && Boolean(reg.data?.token))
const token = reg.data?.token
ok('拿到 token', Boolean(token))

const tripId = `trip-del-${Date.now()}`
const trip = {
  id: tripId, city: '成都', title: '待删除行程', createdAt: Date.now(), updatedAt: Date.now(),
  prefs: { city: '成都', days: 1, pace: 'easy', interests: [], budget: 500, bookings: [] },
  plan: { days: [] }, status: 'ready', done: [], skipped: [],
}
ok('写入行程', (await call('PUT', `/api/trips/${tripId}`, { token, body: { trip, title: trip.title, city: trip.city } })).status === 200)
ok('上报事件', (await call('POST', '/api/history', { token, body: { id: `ev-del-${Date.now()}`, type: 'create', title: '创建行程' } })).status === 200)
ok('写入收藏状态', (await call('PUT', '/api/state', { token, body: { state: { saved: ['p-1'] }, updatedAt: Date.now() } })).status === 200)
ok('创建分享', (await call('POST', '/api/shares', { token, body: { tripId, payload: { title: '待删除' } } })).status === 200)

const before = await call('GET', '/api/trips', { token })
ok('注销前能看到 1 份行程', Array.isArray(before.data) && before.data.length === 1, JSON.stringify(before.data))

console.log('2) 注销')
const del = await call('DELETE', '/api/me', { token })
ok('注销返回 200', del.status === 200, JSON.stringify(del.json))
ok('返回 deleted: true', del.data?.deleted === true)

console.log('3) 注销后凭证与数据')
ok('旧 token 访问 /api/me 返回 401', (await call('GET', '/api/me', { token })).status === 401)
ok('旧 token 访问 /api/trips 返回 401', (await call('GET', '/api/trips', { token })).status === 401)
ok('旧密码登录返回 401', (await call('POST', '/api/auth/login', { body: { email, password: 'test-pass-1234' } })).status === 401)
ok('未登录注销返回 401', (await call('DELETE', '/api/me')).status === 401)

console.log('4) 同邮箱可重新注册且数据干净')
const reg2 = await call('POST', '/api/auth/register', { body: { email, password: 'test-pass-1234' } })
ok('重新注册成功', reg2.status === 200 && Boolean(reg2.data?.token))
const token2 = reg2.data?.token
const after = await call('GET', '/api/trips', { token: token2 })
ok('新账号行程为空', Array.isArray(after.data) && after.data.length === 0, JSON.stringify(after.data))
const hist = await call('GET', '/api/history', { token: token2 })
ok('新账号事件为空', Array.isArray(hist.data) && hist.data.length === 0, JSON.stringify(hist.data))
const state = await call('GET', '/api/state', { token: token2 })
ok('新账号收藏状态为空', state.data === null || state.data?.state?.saved?.length === 0, JSON.stringify(state.data))

console.log(`\n通过 ${pass}，失败 ${fail}`)
if (fail) process.exit(1)
