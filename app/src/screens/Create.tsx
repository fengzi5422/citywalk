import { useEffect, useState } from 'react'
import { INTEREST_TAGS, PLACES } from '../data/places'
import { findTemplate } from '../data/templates'
import type { Pace, Prefs } from '../core/types'
import { PACE_CONF, paceHint } from '../core/scheduler'
import { Back, Check, Clock } from '../components/Icons'

type Props = {
  templateId?: string | null
  onBack: () => void
  onDone: (prefs: Prefs, start: Date, templateId?: string | null) => void
}

const START = new Date(Date.now() + 86400000)
const dlabel = (offset: number) => {
  const d = new Date(START.getTime() + offset * 86400000)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

const PACES: Pace[] = ['easy', 'normal', 'packed']
const ARRIVALS = [9 * 60, 11 * 60, 14 * 60]
const DEPARTURES = [15 * 60, 17 * 60, 19 * 60]

export default function Create({ templateId, onBack, onDone }: Props) {
  const tpl = findTemplate(templateId)
  const [step, setStep] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>({
    city: '成都',
    days: tpl?.days ?? 2,
    pace: tpl?.pace ?? 'easy',
    arrivalTime: 11 * 60,
    arrivalPlace: '成都东站',
    departureTime: 17 * 60,
    departurePlace: '成都东站',
    interests: tpl?.interests ?? ['历史', '美食'],
    budget: [300, 600],
    mustGo: ['p-museum'],
    bookings: [{ placeId: 'p-museum', dayIndex: 1, time: 10 * 60 }],
    lodging: '春熙路片区',
    lodgingAssumed: true,
  })

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }))

  const toggleInterest = (t: string) =>
    setPrefs((p) => {
      if (p.interests.includes(t)) return { ...p, interests: p.interests.filter((x) => x !== t) }
      if (p.interests.length >= 5) return p
      return { ...p, interests: [...p.interests, t] }
    })

  useEffect(() => {
    if (!generating) return
    const t = setTimeout(() => onDone(prefs, START, templateId ?? null), 1700)
    return () => clearTimeout(t)
  }, [generating])

  if (generating) return <Generating />

  return (
    <div className="page">
      <div className="nav" style={{ height: 48 }}>
        <button className="ic plain" onClick={() => (step === 0 ? onBack() : setStep(step - 1))}>
          <Back />
        </button>
        <div className="ttl">创建行程</div>
        <div className="step">{step + 1} / 3</div>
      </div>
      <div className="steps">
        <i className="on" />
        <i className={step >= 1 ? 'on' : ''} />
        <i className={step >= 2 ? 'on' : ''} />
      </div>

      <div className="page-body">
        <div className="form">
          {step === 0 && (
            <>
              <h1 className="h-l" style={{ marginTop: 20 }}>先说说这趟旅行</h1>
              <p className="sub" style={{ marginTop: 6 }}>
                {tpl ? `套用「${tpl.name}」，下面已按模板填好，可以改。` : '只填必填项也能出稿，其余可以之后补。'}
              </p>

              <div className="field">
                <p className="lb">目的地</p>
                <div className="inputrow">
                  <span>成都</span>
                  <span className="r">已支持</span>
                </div>
              </div>

              <div className="field">
                <p className="lb">日期</p>
                <div className="inputrow">
                  <span>{dlabel(0)} — {dlabel(1)}</span>
                  <span className="r">2 天</span>
                </div>
              </div>

              <div className="field">
                <p className="lb">旅行节奏</p>
                <div className="seg">
                  {PACES.map((p) => (
                    <button
                      key={p}
                      className={`s${prefs.pace === p ? ' on' : ''}`}
                      onClick={() => set('pace', p)}
                    >
                      <b>{PACE_CONF[p].label}</b>
                      <span>{PACE_CONF[p].maxActivities} 个主要活动</span>
                    </button>
                  ))}
                </div>
                <p className="hint">{paceHint[prefs.pace]}。</p>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="h-l" style={{ marginTop: 20 }}>什么时候到，什么时候走</h1>
              <p className="sub" style={{ marginTop: 6 }}>这两个时间决定了每天真正能用的小时数。</p>

              <div className="field">
                <p className="lb">到达</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {ARRIVALS.map((t) => (
                    <button
                      key={t}
                      className={`inputrow${prefs.arrivalTime === t ? '' : ' dashed'}`}
                      style={{
                        flex: 1,
                        background: prefs.arrivalTime === t ? 'var(--green-soft)' : '#fff',
                        justifyContent: 'center',
                      }}
                      onClick={() => set('arrivalTime', t)}
                    >
                      <span>{String(Math.floor(t / 60)).padStart(2, '0')}:00</span>
                    </button>
                  ))}
                </div>
                <p className="hint">到达地点：成都东站。出站与寄存按 50 分钟预留。</p>
              </div>

              <div className="field">
                <p className="lb">离开</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {DEPARTURES.map((t) => (
                    <button
                      key={t}
                      className={`inputrow${prefs.departureTime === t ? '' : ' dashed'}`}
                      style={{
                        flex: 1,
                        background: prefs.departureTime === t ? 'var(--green-soft)' : '#fff',
                        justifyContent: 'center',
                      }}
                      onClick={() => set('departureTime', t)}
                    >
                      <span>{String(Math.floor(t / 60)).padStart(2, '0')}:00</span>
                    </button>
                  ))}
                </div>
                <p className="hint">最后一天会预留 60 分钟前往车站。</p>
              </div>

              <div className="field">
                <p className="lb">住宿</p>
                <button className="inputrow dashed" onClick={() => set('lodgingAssumed', !prefs.lodgingAssumed)}>
                  <span style={{ color: prefs.lodgingAssumed ? 'var(--ink-3)' : 'var(--ink)' }}>
                    {prefs.lodgingAssumed ? '还没定' : prefs.lodging}
                  </span>
                  <span className="r">{prefs.lodgingAssumed ? '按春熙路估算' : '已确定'}</span>
                </button>
                <p className="hint">
                  {prefs.lodgingAssumed
                    ? '选「还没定」时，结果页会写明按春熙路片区估算。'
                    : '每天从春熙路出发、回到春熙路。'}
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="h-l" style={{ marginTop: 20 }}>你想怎么玩</h1>
              <p className="sub" style={{ marginTop: 6 }}>多选，最多五个（已选 {prefs.interests.length}）。</p>

              <div className="field">
                <p className="lb">兴趣</p>
                <div className="tags">
                  {INTEREST_TAGS.map((t) => {
                    const on = prefs.interests.includes(t)
                    return (
                      <button key={t} className={`t2${on ? ' on' : ''}`} onClick={() => toggleInterest(t)}>
                        {t}
                        {on && (
                          <span className="d">
                            <i className="f" /><i className="f" /><i />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="field">
                <p className="lb">人均预算（不含住宿与大交通）</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([[300, 600], [600, 1000], [1000, 2000]] as [number, number][]).map((b) => (
                    <button
                      key={b[0]}
                      className={`inputrow${prefs.budget[0] === b[0] ? '' : ' dashed'}`}
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        background: prefs.budget[0] === b[0] ? 'var(--green-soft)' : '#fff',
                        fontSize: 12.5,
                      }}
                      onClick={() => set('budget', b)}
                    >
                      <span>￥{b[0]}–{b[1]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <p className="lb">必去</p>
                {prefs.mustGo.length === 0 && <p className="hint">还没有必去的地点，可以在地点页加入。</p>}
                {prefs.mustGo.map((id) => {
                  const p = PLACES.find((x) => x.id === id)
                  if (!p) return null
                  return (
                    <div key={id} className="picked">
                      <div className="l">
                        <b>{p.name}</b>
                        <span>已加入 · 建议 {Math.round(p.duration / 60 * 10) / 10} 小时</span>
                      </div>
                      <button
                        className="x"
                        onClick={() => set('mustGo', prefs.mustGo.filter((x) => x !== id))}
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="field">
                <p className="lb">已预约</p>
                {prefs.bookings.length === 0 && <p className="hint">没有已预约项目时，系统可以自由重排。</p>}
                {prefs.bookings.map((b) => {
                  const p = PLACES.find((x) => x.id === b.placeId)
                  if (!p) return null
                  return (
                    <div
                      key={b.placeId}
                      className="picked"
                      style={{ background: '#fbf7f0', borderColor: '#ede2ce' }}
                    >
                      <div className="l">
                        <b>{p.name} · 第 {b.dayIndex + 1} 天 {String(Math.floor(b.time / 60)).padStart(2, '0')}:00</b>
                        <span>该时段会被锁定，不参与重排</span>
                      </div>
                      <button
                        className="x"
                        onClick={() => {
                          set('bookings', [])
                          set('mustGo', prefs.mustGo.filter((x) => x !== b.placeId))
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="footbtn">
        {step < 2 ? (
          <button className="btn-primary" onClick={() => setStep(step + 1)}>
            下一步 · {step === 0 ? '填时间' : '选偏好'}
          </button>
        ) : (
          <>
            <button className="btn-primary" onClick={() => setGenerating(true)}>
              生成两天行程
            </button>
            <p className="note">预计 15 秒 · 当前为本地演示，实际约 1.7 秒</p>
          </>
        )}
      </div>
    </div>
  )
}

function Generating() {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setPct((p) => Math.min(98, p + 4)), 55)
    return () => clearInterval(t)
  }, [])

  const stage = pct < 34 ? 0 : pct < 72 ? 1 : 2
  const steps = [
    '从候选地点中筛出符合偏好的组合',
    '计算片区之间的步行与公交耗时',
    '核对第二天的预约场次与闭馆时间',
    '生成备选与未安排清单',
  ]

  return (
    <div className="page">
      <div className="generating">
        <div className="ring">
          <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="48" cy="48" r="42" fill="none" stroke="#E8E4DB" strokeWidth="6" />
            <circle
              cx="48" cy="48" r="42" fill="none" stroke="#17564E" strokeWidth="6"
              strokeLinecap="round" strokeDasharray="264"
              strokeDashoffset={264 * (1 - pct / 100)}
              style={{ transition: 'stroke-dashoffset .2s linear' }}
            />
          </svg>
          <div className="pct">{pct}%</div>
        </div>
        <h3 style={{ fontSize: 19, fontWeight: 600, marginBottom: 10 }}>正在排出两天的路线</h3>
        <p className="sub" style={{ textAlign: 'center' }}>
          已按片区把候选地点分组，
          <br />
          正在检查开放时间与预约场次。
        </p>

        <div className="gensteps">
          {steps.map((s, i) => (
            <div key={s} className={`genstep ${i < stage ? 'done' : i === stage ? 'now' : 'todo'}`}>
              <span className="tick">{i < stage ? <Check size={9} /> : null}</span>
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
