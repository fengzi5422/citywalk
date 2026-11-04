import { useEffect, useRef, useState } from 'react'
import { PLACES } from './data/places'
import { generatePlan } from './core/scheduler'
import { recomputeDay } from './core/day'
import { dateLabel } from './core/time'
import { findTemplate } from './data/templates'
import { loadBaseMap, saveBaseMap, type BaseMapSetting } from './core/mapConfig'
import { clearAuth, loadAuth, saveAuth, type Auth } from './core/auth'
import { api, mergeTrips } from './core/api'
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
import Login from './screens/Login'
import ShareView from './screens/ShareView'

export type Route =
  | { name: 'explore' }
  | { name: 'list' }
  | { name: 'saved' }
  | { name: 'me' }
  | { name: 'city' }
  | { name: 'place'; id: string }
  | { name: 'create'; templateId?: string }
  | { name: 'trip'; id: string }
  | { name: 'today'; id: string }
  | { name: 'login' }

const TRIPS_KEY = 'citywalk.trips.v1'
const SAVED_KEY = 'citywalk.saved.v1'

function readShareToken(): string | null {
  const m = location.hash.match(/^#\/s\/([a-z0-9]+)/i)
  return m ? m[1] : null
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
  const pushedAt = useRef<Map<string, number>>(new Map())

  const updateBasemap = (next: BaseMapSetting) => {
    setBasemap(next)
    saveBaseMap(next)
  }

  useEffect(() => {
    localStorage.setItem(TRIPS_KEY, JSON.stringify(trips))
  }, [trips])
  useEffect(() => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved))
  }, [saved])

  // 分享链接走 hash：#/s/<token>，优先于应用内路由
  const [shareToken, setShareToken] = useState<string | null>(() => readShareToken())
  useEffect(() => {
    const onHash = () => setShareToken(readShareToken())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (r: Route) => setRoute(r)

  // 登录后把本地与云端合并，冲突取 updatedAt 较新的那份
  const handleLogin = async (a: Auth) => {
    saveAuth(a)
    setAuth(a)
    setSyncing(true)
    const remote = await api.listTrips()
    setSyncing(false)
    if (remote) {
      remote.forEach((r) => pushedAt.current.set(r.id, r.updatedAt))
      setTrips((local) => mergeTrips(local, remote))
    }
    setRoute({ name: 'me' })
  }

  const handleLogout = () => {
    clearAuth()
    setAuth(null)
    pushedAt.current.clear()
  }

  // 本地改动延迟推送，避免每敲一下就发一次请求
  useEffect(() => {
    if (!auth) return
    const timer = setTimeout(async () => {
      setSyncing(true)
      for (const trip of trips) {
        if ((pushedAt.current.get(trip.id) ?? 0) >= trip.updatedAt) continue
        const ok = await api.putTrip(trip)
        if (ok) pushedAt.current.set(trip.id, trip.updatedAt)
      }
      setSyncing(false)
    }, 900)
    return () => clearTimeout(timer)
  }, [trips, auth])
  const activeTab: TabKey = ['explore', 'list', 'saved', 'me'].includes(route.name)
    ? (route.name as TabKey)
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
      <div className="phone">
        <StatusBar />
        <div className="screen">
          <ShareView
            token={shareToken}
            onExit={() => {
              history.replaceState(null, '', location.pathname)
              setShareToken(null)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="phone">
      <StatusBar />

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

        {route.name === 'me' && (
          <Me
            trips={trips}
            auth={auth}
            syncing={syncing}
            onLogin={() => go({ name: 'login' })}
            onLogout={handleLogout}
            basemap={basemap}
            onBasemapChange={updateBasemap}
            onClear={() => {
              if (confirm('清空本机保存的行程与收藏？此操作不可恢复。')) {
                setTrips([])
                setSaved([])
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
  )
}
