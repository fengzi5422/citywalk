import { CITY, DISTRICTS, PLACES } from '../data/places'
import { Back, Building, Bowl, Cup, Ticket } from '../components/Icons'
import { Skyline, gradOf } from '../components/Art'

type Props = {
  onBack: () => void
  onPlace: (id: string) => void
  onCreate: () => void
}

const CATS = [
  { key: 'sight', label: '景点', icon: <Building /> },
  { key: 'food', label: '美食', icon: <Bowl /> },
  { key: 'fun', label: '娱乐', icon: <Ticket /> },
  { key: 'rest', label: '休息', icon: <Cup /> },
]

export default function CityScreen({ onBack, onPlace, onCreate }: Props) {
  return (
    <div style={{ paddingBottom: 20 }}>
      <div className="citycover">
        <Skyline opacity={0.2} />
        <div className="nav" style={{ position: 'relative', zIndex: 3 }}>
          <button className="ic" onClick={onBack} aria-label="返回">
            <Back />
          </button>
          <span />
        </div>
        <div className="txt">
          <p className="k">{CITY.en}</p>
          <p className="n">{CITY.name}</p>
        </div>
      </div>

      <div className="pad">
        <p className="bodytext" style={{ margin: '14px 0 0' }}>{CITY.lead}</p>
        <div className="stats">
          <div><b>{PLACES.length}</b><span>地点</span></div>
          <div><b>8</b><span>路线</span></div>
          <div><b>{DISTRICTS.length}</b><span>片区</span></div>
          <div><b>2–3</b><span>建议天数</span></div>
        </div>
      </div>

      <div className="pad" style={{ marginTop: 4 }}>
        <div className="chips">
          {DISTRICTS.map((d, i) => (
            <span key={d} className={`chip${i === 0 ? ' on' : ''}`}>{d}</span>
          ))}
        </div>
      </div>

      <div className="pad" style={{ marginTop: 18 }}>
        <div className="block-title" style={{ marginTop: 0 }}>按类型找</div>
        <div className="catgrid">
          {CATS.map((c) => (
            <button key={c.key} className="cat">
              {c.icon}
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pad" style={{ marginTop: 18 }}>
        <div className="sec-row" style={{ margin: '0 0 10px' }}>
          <h2>路线模板</h2>
          <span>全部</span>
        </div>
        <button className="route" style={{ width: '100%' }} onClick={onCreate}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <b style={{ margin: 0 }}>老城两日 · 经典</b>
            <span style={{ fontSize: 11, color: 'var(--green)' }}>套用</span>
          </div>
          <span style={{ marginTop: 4, display: 'block' }}>D1 4 站 · D2 3 站 · 步行 7.4km · 含 2 处茶馆</span>
        </button>
      </div>

      <div className="pad" style={{ marginTop: 20 }}>
        <div className="sec-row" style={{ margin: '0 0 6px' }}>
          <h2>这一带值得去</h2>
          <span>按评分</span>
        </div>
        {PLACES.slice(0, 4).map((p) => (
          <button key={p.id} className="place" onClick={() => onPlace(p.id)}>
            <div className="pt" style={{ background: gradOf(p.id), width: 44, height: 44 }} />
            <div className="txt">
              <b>{p.name}</b>
              <span>{p.district} · {p.tags.join(' / ')}</span>
            </div>
            <div className="meta">{p.rating.toFixed(1)}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
