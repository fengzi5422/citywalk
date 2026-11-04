import { Bookmark, Calendar, Compass, User } from './Icons'

export function StatusBar() {
  return (
    <div className="statusbar">
      <span>9:41</span>
      <span className="sb-right">
        <svg width="17" height="11" viewBox="0 0 17 11">
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="4.5" y="5" width="3" height="6" rx="1" />
          <rect x="9" y="3" width="3" height="8" rx="1" />
          <rect x="13.5" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 11">
          <path d="M8 10.4 5.4 7.7a3.8 3.8 0 0 1 5.2 0Z" />
          <path d="M2.7 4.9a7.6 7.6 0 0 1 10.6 0l-1.4 1.5a5.5 5.5 0 0 0-7.8 0Z" />
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12">
          <rect x="0.5" y="0.5" width="21" height="11" rx="3.2" stroke="currentColor" fill="none" opacity=".35" />
          <rect x="2" y="2" width="16.5" height="8" rx="1.6" />
          <path d="M23 4.2v3.6a2.4 2.4 0 0 0 0-3.6Z" opacity=".4" />
        </svg>
      </span>
    </div>
  )
}

export type TabKey = 'explore' | 'list' | 'saved' | 'me'

export function TabBar({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  const items: { key: TabKey; label: string; icon: JSX.Element }[] = [
    { key: 'explore', label: '探索', icon: <Compass size={21} /> },
    { key: 'list', label: '行程', icon: <Calendar size={21} /> },
    { key: 'saved', label: '收藏', icon: <Bookmark size={21} /> },
    { key: 'me', label: '我的', icon: <User size={21} /> },
  ]
  return (
    <nav className="tabbar">
      {items.map((it) => (
        <button
          key={it.key}
          className={`tab${active === it.key ? ' on' : ''}`}
          onClick={() => onChange(it.key)}
        >
          {it.icon}
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  )
}
