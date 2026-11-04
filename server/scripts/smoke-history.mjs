/**
 * 历史记录 / 版本快照 / 用户状态 接口冒烟测试
 * 用法：node server/scripts/smoke-history.mjs
 * 前置：后端已启动（改动服务端代码后必须重启）
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:5179'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' | ' + extra : '')) }
}

async function call(path, opts = {}) {
  const { method = 'GET', token, body } = opts
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json, data: json?.data }
}

const email = `hist${Date.now()}@citywalk.app`
const password = 'Passw0rd!2026'

console.log('1) 健康检查')
{
  const r = await call('/api/health')
  ok('返回 200', r.status === 200)
  ok('服务名正确', r.data?.service === 'citywalk-server')
}

console.log('2) 注册')
let token = ''
{
  const r = await call('/api/auth/register', { method: 'POST', body: { email, password } })
  ok('返回 200', r.status === 200, JSON.stringify(r.json))
  token = r.data?.token || ''
  ok('拿到 token', Boolean(token))
}

console.log('3) 未登录访问历史')
{
  const r = await call('/api/history')
  ok('返回 401', r.status === 401)
}

console.log('4) 上报事件与离线补报去重')
{
  const ts = Date.now()
  const ev = {
    id: 'ev-fixed-' + ts, tripId: 'trip-h1', type: 'create',
    title: '创建行程', detail: '成都 · 2 天', createdAt: Date.now(),
  }
  const a = await call('/api/history', { method: 'POST', token, body: ev })
  ok('单条上报入库 1 条', a.status === 200 && a.data?.saved === 1, JSON.stringify(a.json))
  const b = await call('/api/history', { method: 'POST', token, body: ev })
  ok('同 id 补报不重复入库', b.data?.saved === 0, JSON.stringify(b.json))
  const c = await call('/api/history', {
    method: 'POST', token,
    body: { events: [
      { id: 'ev-b1-' + ts, type: 'edit', title: '调整日程', createdAt: Date.now() + 1 },
      { id: 'ev-b2-' + ts, type: 'done', title: '完成锦里', createdAt: Date.now() + 2 },
    ] },
  })
  ok('批量上报 2 条', c.data?.saved === 2)
  const l = await call('/api/history?limit=50', { token })
  const ids = (l.data || []).map((e) => e.id)
  ok('固定 id 只出现一次', ids.filter((x) => x.startsWith('ev-fixed-')).length === 1)
  ok('共 3 条事件', ids.length === 3, 'got ' + ids.length)
  ok('按时间倒序', l.data.length > 0 && l.data[0].createdAt >= l.data[l.data.length - 1].createdAt)
  ok('字段完整', typeof l.data[0].title === 'string' && typeof l.data[0].type === 'string')
}

console.log('5) 行程版本快照')
const tripId = 'trip-h-' + Date.now()
{
  const t1 = await call('/api/trips/' + tripId, {
    method: 'PUT', token,
    body: { title: '成都 · 2 天', city: '成都', trip: { id: tripId, title: '成都 · 2 天', v: 1 } },
  })
  ok('第一次写入 200', t1.status === 200)
  const t2 = await call('/api/trips/' + tripId, {
    method: 'PUT', token,
    body: { title: '成都 · 2 天', city: '成都', trip: { id: tripId, title: '成都 · 2 天', v: 2 } },
  })
  ok('第二次写入 200', t2.status === 200)
  const v = await call(`/api/trips/${tripId}/versions`, { token })
  ok('生成 2 个版本', (v.data || []).length === 2, 'got ' + (v.data || []).length)
  ok('版本含时间戳', typeof v.data?.[0]?.createdAt === 'number')
  const d = await call(`/api/trips/${tripId}/versions/${v.data[0].id}`, { token })
  ok('版本详情可还原行程', d.data?.trip?.id === tripId)
  ok('最新版本是 v2', d.data?.trip?.v === 2)
  const nf = await call(`/api/trips/${tripId}/versions/not-exist`, { token })
  ok('不存在的版本 404', nf.status === 404)
  const na = await call(`/api/trips/${tripId}/versions`, {})
  ok('未登录查版本 401', na.status === 401)
}

console.log('6) 版本数量上限')
{
  const lid = tripId + '-limit'
  for (let i = 0; i < 21; i++) {
    await call('/api/trips/' + lid, {
      method: 'PUT', token,
      body: { title: 'L', city: '成都', trip: { id: lid, v: i } },
    })
  }
  const v = await call(`/api/trips/${lid}/versions`, { token })
  ok('最多保留 20 份', (v.data || []).length === 20, 'got ' + (v.data || []).length)
}

console.log('7) 用户状态（收藏上云）')
{
  const e = await call('/api/state', { token })
  ok('初始为空', e.data === null)
  const p = await call('/api/state', {
    method: 'PUT', token, body: { state: { saved: ['p-1', 'p-2'] }, updatedAt: 1000 },
  })
  ok('写入成功', p.status === 200)
  const g = await call('/api/state', { token })
  ok('读到收藏', JSON.stringify(g.data?.state?.saved) === JSON.stringify(['p-1', 'p-2']))
  ok('带 updatedAt', g.data?.updatedAt === 1000)
  await call('/api/state', { method: 'PUT', token, body: { state: { saved: ['old'] }, updatedAt: 500 } })
  const g2 = await call('/api/state', { token })
  ok('较旧写入不覆盖', g2.data?.state?.saved?.[0] === 'p-1')
  await call('/api/state', { method: 'PUT', token, body: { state: { saved: ['new'] }, updatedAt: 2000 } })
  const g3 = await call('/api/state', { token })
  ok('较新写入生效', g3.data?.state?.saved?.[0] === 'new')
  const no = await call('/api/state', { method: 'PUT', body: { state: { saved: [] }, updatedAt: 3000 } })
  ok('未登录写入 401', no.status === 401)
  const big = await call('/api/state', {
    method: 'PUT', token, body: { state: { blob: 'x'.repeat(40000) }, updatedAt: 4000 },
  })
  ok('超大状态 413', big.status === 413)
}

console.log('8) 参数校验')
{
  const many = await call('/api/history', {
    method: 'POST', token,
    body: { events: Array.from({ length: 51 }, () => ({ title: 'x', id: 'z' })) },
  })
  ok('批量超过 50 返回 400', many.status === 400)
  const noauth = await call('/api/history', { method: 'POST', body: { title: 'x' } })
  ok('未登录上报 401', noauth.status === 401)
}

console.log(`\n通过 ${pass}，失败 ${fail}`)
if (fail) process.exit(1)
