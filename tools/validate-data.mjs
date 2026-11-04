/**
 * 内容数据体检：替换 places.json 后先跑一遍，避免坏数据把排程引擎搞崩。
 * 用法：node tools/validate-data.mjs
 * 退出码：0 通过，1 有错误。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const file = join(here, '..', 'app', 'src', 'data', 'places.json')

const DISTRICTS = ['老城片', '武侯片', '东郊片', '玉林片']
const CATEGORIES = ['sight', 'food', 'fun', 'rest']
const OPEN_STATES = ['confirmed', 'pending']
const INTEREST_TAGS = ['历史', '美食', '自然', '拍照', '购物', '演出', '夜游', '亲子', '茶馆', '室内']

const errors = []
const warnings = []
const err = (where, msg) => errors.push(`${where}: ${msg}`)
const warn = (where, msg) => warnings.push(`${where}: ${msg}`)

let data
try {
  data = JSON.parse(readFileSync(file, 'utf8'))
} catch (e) {
  console.error('无法读取或解析 places.json：', e.message)
  process.exit(1)
}

if (!Array.isArray(data) || data.length === 0) {
  console.error('places.json 必须是非空数组')
  process.exit(1)
}

const seen = new Set()
for (const [i, p] of data.entries()) {
  const w = `第 ${i + 1} 条${p?.id ? ` (${p.id})` : ''}`
  if (!p || typeof p !== 'object') { err(w, '不是对象'); continue }

  const req = ['id', 'name', 'category', 'district', 'lat', 'lng', 'duration', 'ticket', 'tags', 'reason', 'rating', 'priceLevel']
  for (const k of req) if (!(k in p)) err(w, `缺少字段 ${k}`)

  if (typeof p.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(p.id)) err(w, 'id 不合法')
  if (seen.has(p.id)) err(w, `id 重复：${p.id}`)
  seen.add(p.id)
  if (typeof p.name !== 'string' || !p.name.trim()) err(w, 'name 为空')

  if (!CATEGORIES.includes(p.category)) err(w, `category 非法：${p.category}`)
  if (!DISTRICTS.includes(p.district)) err(w, `district 不在片区表：${p.district}`)

  if (typeof p.lat !== 'number' || p.lat < 30.4 || p.lat > 31.0) err(w, `lat 超出成都范围：${p.lat}`)
  if (typeof p.lng !== 'number' || p.lng < 103.7 || p.lng > 104.5) err(w, `lng 超出成都范围：${p.lng}`)

  if (typeof p.duration !== 'number' || p.duration <= 0 || p.duration > 480) err(w, `duration 不合法：${p.duration}`)
  if (typeof p.ticket !== 'number' || p.ticket < 0) err(w, `ticket 不合法：${p.ticket}`)
  if (typeof p.rating !== 'number' || p.rating < 1 || p.rating > 5) err(w, `rating 不合法：${p.rating}`)
  if (![1, 2, 3].includes(p.priceLevel)) err(w, `priceLevel 不合法：${p.priceLevel}`)
  if (typeof p.indoor !== 'boolean') err(w, 'indoor 必须是布尔值')
  if ('needsBooking' in p && typeof p.needsBooking !== 'boolean') err(w, 'needsBooking 必须是布尔值')
  if (typeof p.reason !== 'string' || !p.reason.trim()) err(w, 'reason 为空')

  if (!Array.isArray(p.tags) || p.tags.length === 0) err(w, 'tags 必须是非空数组')
  else for (const t of p.tags) if (!INTEREST_TAGS.includes(t)) err(w, `未知兴趣标签：${t}`)

  if (p.open) {
    const o = p.open
    if (typeof o.start !== 'number' || o.start < 0 || o.start > 1440) err(w, `open.start 不合法：${o.start}`)
    if (typeof o.end !== 'number' || o.end < 0 || o.end > 1440) err(w, `open.end 不合法：${o.end}`)
    if (typeof o.start === 'number' && typeof o.end === 'number' && o.start >= o.end) err(w, 'open.start 必须小于 open.end')
    if ('lastEntry' in o && (o.lastEntry < o.start || o.lastEntry > o.end)) err(w, `lastEntry 超出营业区间：${o.lastEntry}`)
    if (!OPEN_STATES.includes(o.state)) err(w, `open.state 非法：${o.state}`)
    if ('closedOn' in o && (!Array.isArray(o.closedOn) || o.closedOn.some((d) => ![0, 1, 2, 3, 4, 5, 6].includes(d)))) {
      err(w, 'closedOn 必须是 0—6 的数组')
    }
    if (o.state === 'pending') warn(w, '开放时间待核实，排程会保守处理')
  } else {
    warn(w, '缺少 open 规则，排程将按全天可安排处理')
  }
}

// 交叉校验：片区数量与兴趣覆盖，避免替换数据后只剩一个片区
const usedDistricts = new Set(data.map((p) => p.district))
if (usedDistricts.size < 2) warn('整体', '地点集中在单一片区，片区聚类将失效')
const usedTags = new Set(data.flatMap((p) => p.tags || []))
if (usedTags.size < 4) warn('整体', '兴趣标签覆盖不足，个性化推荐区分度会下降')

console.log(`内容数据体检：${data.length} 个地点，${usedDistricts.size} 个片区，${usedTags.size} 类兴趣`)
for (const m of warnings) console.log(`  ⚠ ${m}`)
for (const m of errors) console.log(`  ✗ ${m}`)
console.log(`\n错误 ${errors.length}，提示 ${warnings.length}`)
if (errors.length) process.exit(1)
console.log('通过：字段完整、取值合法、坐标与时间均在合理范围。')
