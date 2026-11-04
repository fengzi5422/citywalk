import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { PLACES } from './data/places'
import { generatePlan } from './core/scheduler'
import { recomputeDay } from './core/day'
import { dateLabel } from './core/time'
import { findTemplate } from './data/templates'
import { loadBaseMap, saveBaseMap, type BaseMapSetting } from './core/mapConfig'
import { clearAuth, loadAuth, saveAuth, type Auth } from './core/auth'
import { api, mergeTrips } from './core/api'
import {
  appendHistory, loadHistory, makeEvent, mergeHistory, saveHistory,
  type HistoryEvent,
} from './core/history'
import { buildBackup, downloadBackup, mergeBackupTrips, parseBackup } from './core/backup'
import type { Prefs, Trip } from './core/types'
import { StatusBar, TabBar, type TabKey } from './components/Chrome'
import Explore from './screens/Explore'
import CityScreen from './screens/City'
import PlaceScreen from './screens/Place'
import Create from './screens/Create'
import TripScreen from './screens/Trip'
import Today from './screens/Today'
import TripList from './screens/TripList'
import Saved from './screens/Saved'
import Me from './screens/Me'
import History from './screens/History'
import Login from './screens/Login'
import ShareView from './screens/ShareView'
import Legal, { type LegalTab } from './screens/Legal'

export type Route =
  | { name: 'explore' }
  | { name: 'list' }
  | { name: 'saved' }
  | { name: 'me' }
  | { name: 'history' }
  | { name: 'legal'; tab?: LegalTab }
  | { name: 'city' }
  | { name: 'place'; id: string }
  | { name: 'create'; templateId?: string }
  | { name: 'trip'; id: string }
  | { name: 'today'; id: string }
  | { name: 'login' }

const TRIPS_KEY = 'citywalk.trips.v1'
const SAVED_KEY = 'citywalk.saved.v1'
const STATE_AT_KEY = 'citywalk.state.at.v1'
const PULL_INTERVAL = 30_000

function readShareToken(): string | null {
  const m = location.hash.match(/^#\/s\/([a-z0-9]+)/i)
  return m ? m[1] : null
}

/** 桌面宽屏时的展示性侧栏；手机端隐藏。模块级定义，避免重挂子树。 */
function DeskShell({ children }: { children: ReactNode }) {
  return (
    <div className="desk">
      <aside className="desk-aside" aria-hidden="true">
        <div className="desk-brand">
          <span className="desk-kicker">CITYWALK · 城市自由行</span>
          <h2>一座城，<br />慢慢走。</h2>
          <p>为国内城市 1—5 天自由行，生成一份路线合理、可随时修改、旅行中能直接用的按天日程。</p>
        </div>
        <div className="desk-points">
          <div><b>01</b><span><strong>路线合理</strong><em>片区聚类 + 时间约束，不把一天排成赶场</em></span></div>
          <div><b>02</b><span><strong>随时可改</strong><em>换一站、跳过、换天，后续时间自动顺延</em></span></div>
          <div><b>03</b><span><strong>旅行能用</strong><em>今天页、离线可开、记录持续保存</em></span></div>
        </div>
        <div className="desk-foot">
          <span>v0.9.0 · 候选交付版</span>
          <span>内容为成都示例数据，用于验证交互与排程</span>
        </div>
      </aside>
      {children}
    </div>
  )
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export default function App() {
  const [trips, setTrips] = useState<Trip[]>(() => load<Trip[]>(TRIPS_KEY, []))
  const [saved, setSaved] = useState<string[]>(() => load<string[]>(SAVED_KEY, []))
  const [basemap, setBasemap] = useState<BaseMapSetting>(() => loadBaseMap())
  const [route, setRoute] = useState<Route>({ name: 'explore' })
  const [auth, setAuth] = useState<Auth | null>(() => loadAuth())
  const [syncing, setSyncing] = useState(false)
  const [history, setHistory] = useState<HistoryEvent[]>(() => loadHistory())
  const [tick, setTick] = useState(0)
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const pushedAt = useRef<Map<string, number>>(new Map())
  const stateAtRef = useRef<number>(Number(localStorage.getItem(STATE_AT_KEY)) || 0)
  const pushedStateRef = useRef<string>('')
  const prevTrips = useRef<Map<string, { updatedAt: number; title: string }>>(new Map())
  const tripsInit = useRef(false)
  const lastSavedSig = useRef<string | null>(null)
  const skipTripDiff = useRef(false)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** 统一的同步触发源：定时、网络恢复、手动按钮、失败重试都走这里 */
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  const updateBasemap = (next: BaseMapSetting) => {
    setBasemap(next)
    saveBaseMap(next)
  }

  useEffect(() => { localStorage.setItem(TRIPS_KEY, JSON.stringify(trips)) }, [trips])
  useEffect(() => { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)) }, [saved])
  useEffect(() => { saveHistory(history) }, [history])

  // 离线改动也要记住时间戳，登录合并时才不会把本机较新的收藏覆盖掉
  // 用签名比对：首次运行与 StrictMode 双执行但内容未变时都不更新时间戳
  useEffect(() => {
    const sig = JSON.stringify(saved)
    if (lastSavedSig.current === sig) return
    const isFirst = lastSavedSig.current === null
    lastSavedSig.current = sig
    if (isFirst) return
    const at = Date.now()
    stateAtRef.current = at
    localStorage.setItem(STATE_AT_KEY, String(at))
  }, [saved])

  // 分享链接走 hash：#/s/<token>，优先于应用内路由
  const [shareToken, setShareToken] = useState<string | null>(() => readShareToken())
  useEffect(() => {
    const onHash = () => setShareToken(readShareToken())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (r: Route) => setRoute(r)

  // 对比行程快照生成操作历史；云端拉取回来的变化不重复记
  useEffect(() => {
    const skip = skipTripDiff.current
    skipTripDiff.current = false
    const prev = prevTrips.current
    const next = new Map(trips.map((t) => [t.id, { updatedAt: t.updatedAt, title: t.title }]))
    if (tripsInit.current && !skip) {
      const events: HistoryEvent[] = []
      for (const t of trips) {
        if (!prev.has(t.id)) {
          events.push(makeEvent({ type: 'create', tripId: t.id, title: `创建「${t.title}」`, detail: '本机生成' }))
        } else if (prev.get(t.id)!.updatedAt !== t.updatedAt) {
          events.push(makeEvent({ type: 'edit', tripId: t.id, title: `修改「${t.title}」`, detail: '日程已更新' }))
        }
      }
      for (const [id, info] of prev) {
        if (!next.has(id)) events.push(makeEvent({ type: 'delete', tripId: id, title: `删除「${info.title}」` }))
      }
      if (events.length) setHistory((h) => appendHistory(h, events))
    }
    tripsInit.current = true
    prevTrips.current = next
  }, [trips])

  // 登录后开启 30 秒定时拉取，并在网络恢复时立刻补一次
  useEffect(() => {
    if (!auth) return
    const id = setInterval(refresh, PULL_INTERVAL)
    const onOnline = () => refresh()
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(id)
      window.removeEventListener('online', onOnline)
    }
  }, [auth, refresh])

  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current)
  }, [])

  // 云端 → 本机：行程、事件时间线、收藏状态
  useEffect(() => {
    if (!auth) return
    let cancelled = false
    ;(async () => {
      const [remote, remoteHistory, remoteState] = await Promise.all([
        api.listTrips(), api.listHistory(100), api.getState(),
      ])
      if (cancelled) return
      if (remote) {
        remote.forEach((r) => pushedAt.current.set(r.id, r.updatedAt))
        setTrips((local) => {
          const merged = mergeTrips(local, remote)
          const same = merged.length === local.length &&
            merged.every((t, i) => t.id === local[i].id && t.updatedAt === local[i].updatedAt)
          if (same) return local
          skipTripDiff.current = true
          return merged
        })
      }
      if (remoteHistory) setHistory((h) => mergeHistory(h, remoteHistory))
      if (remoteState && remoteState.updatedAt > stateAtRef.current) {
        stateAtRef.current = remoteState.updatedAt
        localStorage.setItem(STATE_AT_KEY, String(remoteState.updatedAt))
        setSaved(Array.isArray(remoteState.state?.saved) ? remoteState.state.saved : [])
      }
    })()
    return () => { cancelled = true }
  }, [auth, tick])

  // 本机 → 云端：行程改动防抖推送，失败 5 秒后自动重试
  useEffect(() => {
    if (!auth) return
    const timer = setTimeout(async () => {
      setSyncing(true)
      let failed = false
      for (const trip of trips) {
        if ((pushedAt.current.get(trip.id) ?? 0) >= trip.updatedAt) continue
        const ok = await api.putTrip(trip)
        if (ok) pushedAt.current.set(trip.id, trip.updatedAt)
        else failed = true
      }
      setSyncing(false)
      if (failed) {
        if (retryTimer.current) clearTimeout(retryTimer.current)
        retryTimer.current = setTimeout(refresh, 5000)
      }
    }, 900)
    return () => clearTimeout(timer)
  }, [trips, auth, tick, refresh])

  // 本机 → 云端：操作事件补报（离线期间攒着，联网后自动补）
  useEffect(() => {
    if (!auth) return
    const pending = history.filter((e) => !e.synced).slice(0, 50)
    if (!pending.length) return
    const timer = setTimeout(async () => {
      const ok = await api.postEvents(pending)
      if (ok) {
        const ids = new Set(pending.map((e) => e.id))
        setHistory((h) => h.map((e) => (ids.has(e.id) ? { ...e, synced: true } : e)))
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [history, auth, tick])

  // 本机 → 云端：收藏等轻量状态
  useEffect(() => {
    if (!auth) return
    const sig = JSON.stringify(saved)
    if (sig === pushedStateRef.current) return
    const timer = setTimeout(async () => {
      const at = Date.now()
      const ok = await api.putState({ saved }, at)
      if (ok) {
        pushedStateRef.current = sig
        stateAtRef.current = at
        localStorage.setItem(STATE_AT_KEY, String(at))
      }
    }, 900)
    return () => clearTimeout(timer)
  }, [saved, auth, tick])

  // 登录后立刻合并一次，保证原有「换设备接着用」体验不变
  const handleLogin = async (a: Auth) => {
    saveAuth(a)
    setAuth(a)
    setSyncing(true)
    const [remote, remoteHistory, remoteState] = await Promise.all([
      api.listTrips(), api.listHistory(100), api.getState(),
    ])
    setSyncing(false)
    if (remote) {
      remote.forEach((r) => pushedAt.current.set(r.id, r.updatedAt))
      skipTripDiff.current = true
      setTrips((local) => mergeTrips(local, remote))
    }
    if (remoteHistory) setHistory((h) => mergeHistory(h, remoteHistory))
    if (remoteState && remoteState.updatedAt > stateAtRef.current) {
      stateAtRef.current = remoteState.updatedAt
      localStorage.setItem(STATE_AT_KEY, String(remoteState.updatedAt))
      setSaved(Array.isArray(remoteState.state?.saved) ? remoteState.state.saved : [])
    }
    setHistory((h) => appendHistory(h, [makeEvent({ type: 'login', title: '登录账号', detail: a.user.email })]))
    setRoute({ name: 'me' })
  }

  const handleLogout = () => {
    clearAuth()
    setAuth(null)
    pushedAt.current.clear()
    pushedStateRef.current = ''
    if (retryTimer.current) clearTimeout(retryTimer.current)
  }

  /** 导出本机完整备份（不含密码与天地图 key） */
  const handleExport = () => {
    downloadBackup(buildBackup({ trips, saved, history, stateAt: stateAtRef.current }))
  }

  /** 导入备份：保守合并，不会用较旧的数据覆盖本机较新的行程 */
  const handleImport = (text: string): { ok: boolean; message: string } => {
    try {
      const b = parseBackup(text)
      setTrips((cur) => mergeBackupTrips(cur, b.trips))
      setSaved((cur) => Array.from(new Set([...cur, ...b.saved])))
      setHistory((h) => appendHistory(h, b.history))
      return {
        ok: true,
        message: `已导入 ${b.trips.length} 份行程、${b.saved.length} 个收藏、${b.history.length} 条记录`,
      }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : '备份文件无法识别' }
    }
  }

  /** 注销账号：删除服务端全部关联数据，并清空本机数据 */
  const handleDeleteAccount = async (): Promise<boolean> => {
    const done = await api.deleteAccount()
    if (!done) return false
    clearAuth()
    setAuth(null)
    pushedAt.current.clear()
    pushedStateRef.current = ''
    setTrips([])
    setSaved([])
    setHistory([])
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('citywalk.')) keys.push(k)
      }
      keys.forEach((k) => localStorage.removeItem(k))
    } catch {
      // 隐私模式下忽略
    }
    setRoute({ name: 'me' })
    return true
  }

  const activeTab: TabKey =
    ['explore', 'list', 'saved', 'me'].includes(route.name)
      ? (route.name as TabKey)
      : route.name === 'history' || route.name === 'legal' ? 'me'
        : route.name === 'city' || route.name === 'place' || route.name === 'create'
          ? 'explore'
          : 'list'

  const showTab = ['explore', 'list', 'saved', 'me'].includes(route.name)

  const currentTrip =
    route.name === 'trip' || route.name === 'today'
      ? trips.find((t) => t.id === route.id)
      : undefined

  const createTrip = (prefs: Prefs, start: Date, templateId?: string | null) => {
    const tpl = findTemplate(templateId)
    const plan = generatePlan(prefs, PLACES, start, tpl?.placeIds ?? [])
    const trip: Trip = {
      id: `t${Date.now()}`,
      city: prefs.city,
      title: `${prefs.city} · ${prefs.days} 天`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      prefs,
      plan,
      status: 'ready',
      done: [],
      skipped: [],
    }
    setTrips((ts) => [trip, ...ts])
    setRoute({ name: 'trip', id: trip.id })
  }

  const updateTrip = (id: string, fn: (t: Trip) => Trip) => {
    setTrips((ts) => ts.map((t) => (t.id === id ? { ...fn(t), updatedAt: Date.now() } : t)))
  }

  const cloneTrip = (id: string) => {
    const src = trips.find((t) => t.id === id)
    if (!src) return
    const stamp = Date.now()
    const start = new Date(stamp + 86400000)
    const days = src.plan.days.map((d, i) => ({
      ...d,
      index: i,
      date: dateLabel(start, i),
      items: d.items.map((it, k) => ({ ...it, id: `${it.id}-c${stamp}-${k}` })),
    }))
    const copy: Trip = {
      ...src,
      id: `t${stamp}`,
      title: `${src.city} · ${src.plan.days.length} 天（副本）`,
      createdAt: stamp,
      updatedAt: stamp,
      status: 'ready',
      done: [],
      skipped: [],
      plan: { ...src.plan, days },
    }
    setTrips((ts) => [copy, ...ts])
    setRoute({ name: 'trip', id: copy.id })
  }

  const toggleSave = (id: string) =>
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const addManyToTrip = (tripId: string, placeIds: string[]) => {
    const picked = placeIds
      .map((id) => PLACES.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
    if (picked.length === 0) return

    updateTrip(tripId, (t) => {
      const day = t.plan.days[0]
      const at = day.items.findIndex((i) => i.kind === 'departure')
      const added = picked.map((place, idx) => ({
        id: `item-add-${place.id}-${Date.now()}-${idx}`,
        kind: place.category === 'food' ? ('meal' as const) : ('place' as const),
        placeId: place.id,
        name: place.name,
        start: 16 * 60,
        duration: place.duration,
        note: place.reason,
      }))
      const items = at >= 0
        ? [...day.items.slice(0, at), ...added, ...day.items.slice(at)]
        : [...day.items, ...added]
      const next = recomputeDay({ ...day, items }, t.prefs, PLACES)
      return {
        ...t,
        plan: { ...t.plan, days: t.plan.days.map((d, i) => (i === 0 ? next : d)) },
      }
    })
  }

  if (shareToken) {
    return (
      <DeskShell>
        <div className="phone">
          <StatusBar />
          {!online && <div className="offline-bar">当前离线 · 已缓存的内容仍可查看</div>}
          <div className="screen">
            <ShareView
              token={shareToken}
              onExit={() => {
                window.history.replaceState(null, '', location.pathname)
                setShareToken(null)
              }}
            />
          </div>
        </div>
      </DeskShell>
    )
  }

  return (
    <DeskShell>
      <div className="phone">
        <StatusBar />
        {!online && <div className="offline-bar">当前离线 · 改动先存本机，联网后自动同步</div>}

      <div className="screen">
        {route.name === 'explore' && (
          <Explore
            trips={trips}
            onCity={() => go({ name: 'city' })}
            onPlace={(id) => go({ name: 'place', id })}
            onCreate={(tid) => go({ name: 'create', templateId: tid })}
            onOpenTrip={(id) => go({ name: 'trip', id })}
          />
        )}

        {route.name === 'city' && (
          <CityScreen
            onBack={() => go({ name: 'explore' })}
            onPlace={(id) => go({ name: 'place', id })}
            onCreate={(tid) => go({ name: 'create', templateId: tid })}
          />
        )}

        {route.name === 'place' && (
          <PlaceScreen
            placeId={route.id}
            saved={saved.includes(route.id)}
            trips={trips}
            onToggleSave={() => toggleSave(route.id)}
            onBack={() => go({ name: 'explore' })}
            onAdd={(tripId, placeId) => addManyToTrip(tripId, [placeId])}
            onOpenTrip={(id) => go({ name: 'trip', id })}
          />
        )}

        {route.name === 'create' && (
          <Create
            templateId={route.templateId}
            onBack={() => go({ name: 'explore' })}
            onDone={createTrip}
          />
        )}

        {route.name === 'trip' && currentTrip && (
          <TripScreen
            trip={currentTrip}
            basemap={basemap}
            onBasemapChange={updateBasemap}
            onBack={() => go({ name: 'list' })}
            onUpdate={(fn) => updateTrip(currentTrip.id, fn)}
            onClone={() => cloneTrip(currentTrip.id)}
            onStart={() => {
              updateTrip(currentTrip.id, (t) => ({ ...t, status: 'active' }))
              go({ name: 'today', id: currentTrip.id })
            }}
            onPlace={(id) => go({ name: 'place', id })}
          />
        )}

        {route.name === 'today' && currentTrip && (
          <Today
            trip={currentTrip}
            onBack={() => go({ name: 'trip', id: currentTrip.id })}
            onUpdate={(fn) => updateTrip(currentTrip.id, fn)}
          />
        )}

        {route.name === 'list' && (
          <TripList
            trips={trips}
            onOpen={(id) => go({ name: 'trip', id })}
            onCreate={() => go({ name: 'create' })}
            onDelete={async (id) => {
              setTrips((ts) => ts.filter((t) => t.id !== id))
              pushedAt.current.delete(id)
              if (auth) await api.deleteTrip(id)
            }}
          />
        )}

        {route.name === 'saved' && (
          <Saved
            ids={saved}
            trips={trips}
            onPlace={(id) => go({ name: 'place', id })}
            onRemove={(id) => toggleSave(id)}
            onCreate={() => go({ name: 'create' })}
            onAddMany={addManyToTrip}
            onOpenTrip={(id) => go({ name: 'trip', id })}
          />
        )}

        {route.name === 'login' && (
          <Login onBack={() => go({ name: 'me' })} onDone={handleLogin} />
        )}

        {route.name === 'history' && (
          <History
            events={history}
            trips={trips}
            auth={auth}
            syncing={syncing}
            onBack={() => go({ name: 'me' })}
            onOpenTrip={(id) => go({ name: 'trip', id })}
            onRefresh={refresh}
          />
        )}

        {route.name === 'legal' && (
          <Legal tab={route.tab} onBack={() => go({ name: 'me' })} />
        )}

        {route.name === 'me' && (
          <Me
            trips={trips}
            auth={auth}
            syncing={syncing}
            historyCount={history.length}
            onLogin={() => go({ name: 'login' })}
            onLogout={handleLogout}
            onHistory={() => go({ name: 'history' })}
            onRefresh={refresh}
            onLegal={(tab) => go({ name: 'legal', tab })}
            onExport={handleExport}
            onImport={handleImport}
            onDeleteAccount={handleDeleteAccount}
            basemap={basemap}
            onBasemapChange={updateBasemap}
            onClear={() => {
              if (confirm('清空本机保存的行程与收藏？此操作不可恢复。')) {
                setTrips([])
                setSaved([])
                setHistory([])
              }
            }}
          />
        )}
      </div>

      {showTab && (
        <TabBar
          active={activeTab}
          onChange={(t) => go({ name: t } as Route)}
        />
      )}
      </div>
    </DeskShell>
  )
}
