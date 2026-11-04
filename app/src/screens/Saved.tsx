import { PLACES } from '../data/places'
import { Bookmark } from '../components/Icons'
import { gradOf } from '../components/Art'
import { short } from '../core/time'

type Props = {
  ids: string[]
  onPlace: (id: string) => void
  onRemove: (id: string) => void
  onCreate: () => void
}

export default function Saved({ ids, onPlace, onRemove, onCreate }: Props) {
  const list = PLACES.filter((p) => ids.includes(p.id))

  return (
    <div style={{ paddingBottom: 20 }}>
      <div className="list-head">
        <h2>收藏</h2>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{list.length} 个地点</span>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <b>还没有收藏</b>
          <p>在地点页点右上角的书签，<br />下次做行程时可以直接找回来。</p>
          <button className="btn-primary" onClick={onCreate}>先去挑几个地点</button>
        </div>
      ) : (
        <div className="pad" style={{ marginTop: 8 }}>
          {list.map((p) => (
            <div key={p.id} className="place">
              <button
                onClick={() => onPlace(p.id)}
                style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, textAlign: 'left' }}
              >
                <div className="pt" style={{ background: gradOf(p.id), width: 44, height: 44 }} />
                <div className="txt">
                  <b>{p.name}</b>
                  <span>{p.district} · 建议 {short(p.duration)} · {p.ticket === 0 ? '免费' : `￥${p.ticket}`}</span>
                </div>
              </button>
              <button className="x" onClick={() => onRemove(p.id)} aria-label="取消收藏">
                <Bookmark size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
