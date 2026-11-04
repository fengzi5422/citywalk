import { CITY, DISTRICTS, PLACES } from '../data/places'
import type { Trip } from '../core/types'
import { Arrow, Chevron, Pin, Search } from '../components/Icons'
import { Skyline, Waves, gradOf } from '../components/Art'
import { TEMPLATES } from '../data/templates'
import { short } from '../core/time'

type Props = {
  trips: Trip[]
  onCity: () => void
  onPlace: (id: string) => void
  onCreate: (templateId?: string) => void
  onOpenTrip: (id: string) => void
}

export default function Explore({ trips, onCity, onPlace, onCreate, onOpenTrip }: Props) {
  const active = trips.find((t) => t.status === 'active') ?? trips.find((t) => t.status === 'ready')
  const featured = [...PLACES].sort((a, b) => b.rating - a.rating).slice(0, 3)

  return (
    <div style={{ paddingBottom: 18 }}>
      <div className="nav" style={{ height: 46 }}>
        <button className="loc" onClick={onCity}>
          <Pin size={15} /> {CITY.name} <Chevron />
        </button>
        <button className="ic plain" onClick={onCity} aria-label="搜索">
          <Search />
        </button>
      </div>

      <div className="pad">
        <h1 className="h-xl" style={{ marginTop: 4 }}>
          周末两天
          <br />
          在成都怎么走
        </h1>
        <p className="sub" style={{ marginTop: 9 }}>
          已收录 {PLACES.length} 个地点 · 8 条路线 · {DISTRICTS.length} 个片区
        </p>

        <div className="hero">
          <div className="glow" />
          <Skyline opacity={0.24} />
          <div className="hero-in">
            <p className="hero-kicker">{CITY.en} · 2 DAYS</p>
            <p className="hero-title">慢一点，也算把这座城走完</p>
            <div className="hero-tags">
              <span>历史人文</span>
              <span>美食</span>
              <span>夜游</span>
            </div>
            <button className="hero-btn" onClick={() => onCreate()}>
              为我安排两天 <Arrow />
            </button>
          </div>
        </div>
      </div>

      {active && (
        <div className="pad" style={{ marginTop: 14 }}>
          <button
            className="alert info"
            style={{ margin: 0, width: '100%', textAlign: 'left' }}
            onClick={() => onOpenTrip(active.id)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11.5, lineHeight: 1.6, color: 'var(--green-deep)' }}>
                <b>{active.title}</b> · {active.plan.days.length} 天行程已排好
              </span>
              <Arrow size={13} />
            </span>
          </button>
        </div>
      )}

      <div className="pad">
        <div className="sec-row">
          <h2>主题路线</h2>
          <span>全部 8 条</span>
        </div>
      </div>
      <div className="hscroll">
        {TEMPLATES.map((r) => (
          <button key={r.id} className="route" onClick={() => onCreate(r.id)}>
            <div className="thumb" style={{ background: r.grad }}>
              {r.id === 'tpl-food' ? <Waves /> : <Skyline opacity={0.2} />}
            </div>
            <b>{r.name}</b>
            <span>{r.summary}</span>
          </button>
        ))}
      </div>

      <div className="pad">
        <div className="sec-row">
          <h2>精选地点</h2>
          <span>更多</span>
        </div>
        {featured.map((p) => (
          <button key={p.id} className="place" onClick={() => onPlace(p.id)}>
            <div className="pt" style={{ background: gradOf(p.id) }} />
            <div className="txt">
              <b>{p.name}</b>
              <span>
                {p.tags[0]} · 建议 {short(p.duration)} · {p.ticket === 0 ? '免费' : `￥${p.ticket}`}
              </span>
            </div>
            <div className="meta">{p.rating.toFixed(1)}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
