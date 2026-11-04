import { useEffect, useState } from 'react'
import { PLACES } from './data/places'
import { generatePlan } from './core/scheduler'
import { loadBaseMap, saveBaseMap, type BaseMapSetting } from './core/mapConfig'
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
import ShareView from './screens/ShareView'

export type Route =
  | { name: 'explore' }
  | { name: 'list' }
  | { name: 'saved' }
  | { name: 'me' }
  | { name: 'city' }
  | { name: 'place'; id: string }
  | { name: 'create' }
  | { name: 'trip'; id: string }
  | { name: 'today'; id: string }

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

  const createTrip = (prefs: Prefs, start: Date) => {
    const plan = generatePlan(prefs, PLACES, start)
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

  const toggleSave = (id: string) =>
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const addToTrip = (tripId: string, placeId: string) => {
    const place = PLACES.find((p) => p.id === placeId)
    if (!place) return
    updateTrip(tripId, (t) => {
      const days = t.plan.days.map((d, i) =>
        i === 0
          ? {
              ...d,
              items: [
                ...d.items,
                {
                  id: `item-add-${placeId}-${Date.now()}`,
                  kind: place.category === 'food' ? ('meal' as const) : ('place' as const),
                  placeId: place.id,
                  name: place.name,
                  start: 16 * 60,
                  duration: place.duration,
                  note: place.reason,
                },
              ],
            }
          : d,
      )
      return { ...t, plan: { ...t.plan, days } }
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
            onCreate={() => go({ name: 'create' })}
            onOpenTrip={(id) => go({ name: 'trip', id })}
          />
        )}

        {route.name === 'city' && (
          <CityScreen
            onBack={() => go({ name: 'explore' })}
            onPlace={(id) => go({ name: 'place', id })}
            onCreate={() => go({ name: 'create' })}
          />
        )}

        {route.name === 'place' && (
          <PlaceScreen
            placeId={route.id}
            saved={saved.includes(route.id)}
            trips={trips}
            onToggleSave={() => toggleSave(route.id)}
            onBack={() => go({ name: 'explore' })}
            onAdd={addToTrip}
            onOpenTrip={(id) => go({ name: 'trip', id })}
          />
        )}

        {route.name === 'create' && (
          <Create onBack={() => go({ name: 'explore' })} onDone={createTrip} />
        )}

        {route.name === 'trip' && currentTrip && (
          <TripScreen
            trip={currentTrip}
            basemap={basemap}
            onBasemapChange={updateBasemap}
            onBack={() => go({ name: 'list' })}
            onUpdate={(fn) => updateTrip(currentTrip.id, fn)}
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
            onDelete={(id) => setTrips((ts) => ts.filter((t) => t.id !== id))}
          />
        )}

        {route.name === 'saved' && (
          <Saved
            ids={saved}
            onPlace={(id) => go({ name: 'place', id })}
            onRemove={(id) => toggleSave(id)}
            onCreate={() => go({ name: 'create' })}
          />
        )}

        {route.name === 'me' && (
          <Me
            trips={trips}
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
