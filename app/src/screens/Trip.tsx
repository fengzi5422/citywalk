import { Fragment, useMemo, useState } from 'react'
import { PLACES } from '../data/places'
import type { DayPlan, PlanItem, Trip } from '../core/types'
import type { BaseMapSetting } from '../core/mapConfig'
import { checkDay, findAlternatives, moveItem, moveToDay, recomputeDay, replaceItem, skipItem, toggleLock, tripTotals } from '../core/day'
import { PACE_CONF, transportLabel } from '../core/scheduler'
import { fmt, short } from '../core/time'
import { Arrow, Back, Check, Clock, List, Map, Share, Warn } from '../components/Icons'
import { gradOf } from '../components/Art'
import DayMap from '../components/DayMap'
import {
  activeShareOf, createShare, previewShare, revokeShare, shareLink, sharePayload, shareText,
  type ShareSnapshot,
} from '../core/share'
import { api } from '../core/api'

type Props = {
  trip: Trip
  basemap: BaseMapSetting
  onBasemapChange?: (next: BaseMapSetting) => void
  onBack: () => void
  onUpdate: (fn: (t: Trip) => Trip) => void
  onStart: () => void
  onPlace: (id: string) => void
}

export default function TripScreen({ trip, basemap, onBasemapChange, onBack, onUpdate, onStart, onPlace }: Props) {
  const [dayIdx, setDayIdx] = useState(0)
  const [view, setView] = useState<'timeline' | 'map'>('timeline')
  const [sheet, setSheet] = useState<PlanItem | null>(null)
  const [ops, setOps] = useState<PlanItem | null>(null)
  const [history, setHistory] = useState<DayPlan[][]>([])
  const [shareOpen, setShareOpen] = useState(false)
  const [share, setShare] = useState<ShareSnapshot | null>(() => activeShareOf(trip.id))
  const [toast, setToast] = useState('')

  const day = trip.plan.days[dayIdx]
  const totals = useMemo(() => tripTotals(trip.plan.days, PLACES), [trip])
  const conflicts = day ? checkDay(day, PLACES) : []

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 1800)
  }

  const applyDays = (next: DayPlan[], snap?: DayPlan[]) => {
    setHistory((h) => [...h, snap ?? trip.plan.days].slice(-12))
    onUpdate((t) => ({ ...t, plan: { ...t.plan, days: next } }))
  }

  const applyDay = (next: DayPlan) =>
    applyDays(trip.plan.days.map((d, i) => (i === dayIdx ? next : d)))

  const undo = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    onUpdate((t) => ({ ...t, plan: { ...t.plan, days: prev } }))
    flash('已撤销上一步')
  }

  const doMove = (item: PlanItem, dir: -1 | 1) => {
    if (!day) return
    applyDay(moveItem(day, item.id, dir, trip.prefs, PLACES))
    setOps(null)
    flash(dir === -1 ? '已上移一站' : '已下移一站')
  }

  const doMoveToDay = (item: PlanItem, to: number) => {
    applyDays(moveToDay(trip.plan.days, dayIdx, item.id, to, trip.prefs, PLACES))
    setOps(null)
    flash(`已移到第 ${to + 1} 天`)
  }

  const genShare = async () => {
    const local = createShare(trip)
    const remote = await api.createShare(trip.id, sharePayload(local))
    if (remote) {
      setShare({
        ...local,
        token: remote.token,
        expiresAt: remote.expiresAt,
        ownerKey: remote.ownerKey,
        remote: true,
      })
      flash('链接已生成，7 天内有效，可跨设备打开')
    } else {
      setShare(local)
      flash('服务端不可用，已生成本机链接')
    }
  }

  const copyLinkNow = async () => {
    if (!share) return
    try {
      await navigator.clipboard.writeText(shareLink(share.token))
      flash('链接已复制')
    } catch {
      flash('复制失败，请长按链接手动复制')
    }
  }

  const copyTextNow = async () => {
    const snap = share ?? previewShare(trip)
    try {
      await navigator.clipboard.writeText(shareText(snap))
      flash('文字已复制，可直接粘贴到聊天')
    } catch {
      flash('复制失败')
    }
  }

  const doRevoke = async () => {
    if (!share) return
    if (share.remote) await api.revokeShare(share.token, share.ownerKey ?? '')
    revokeShare(share.token)
    setShare(null)
    flash('链接已撤销，立即失效')
  }

  const doLock = (item: PlanItem) => {
    if (!day) return
    applyDay(toggleLock(day, item.id))
    setOps(null)
    flash(item.locked ? '已解锁，可以继续调整' : '已锁定，时间和顺序都不再变')
  }

  const handleReplace = (item: PlanItem, placeId: string) => {
    const next = PLACES.find((p) => p.id === placeId)
    if (!next || !day) return
    const replaced = replaceItem(day, item.id, next)
    applyDay(recomputeDay(replaced, trip.prefs, PLACES))
    setSheet(null)
    flash(`已换成「${next.name}」，后续时间已顺延`)
  }

  const handleSkip = (item: PlanItem) => {
    if (!day) return
    applyDay(recomputeDay(skipItem(day, item.id), trip.prefs, PLACES))
    setSheet(null)
    flash('已跳过，剩余行程已重算')
  }

  if (!day) return null

  const target = sheet ? PLACES.find((p) => p.id === sheet.placeId) : undefined
  const usedIds = new Set(
    trip.plan.days.flatMap((d) => d.items.map((i) => i.placeId).filter(Boolean) as string[]),
  )
  const alts = target ? findAlternatives(target, PLACES, usedIds) : []

  return (
    <div className="page">
      <div className="nav" style={{ height: 46 }}>
        <button className="ic plain" onClick={onBack} aria-label="返回">
          <Back />
        </button>
        <div className="viewswitch">
          <button className={view === 'timeline' ? 'on' : ''} onClick={() => setView('timeline')}>
            <List size={13} /> 时间线
          </button>
          <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>
            <Map size={13} /> 地图
          </button>
        </div>
        <button
          className="ic plain"
          onClick={() => setShareOpen(true)}
          aria-label="分享"
        >
          <Share />
        </button>
      </div>

      <div className="page-body">
        <div className="trip-head">
          <div className="trip-top">
            <div className="t">{trip.title}</div>
            <div className="save-state">
              <Check size={10} /> 已保存
            </div>
          </div>
          <div className="daytabs">
            {trip.plan.days.map((d, i) => (
              <button
                key={d.index}
                className={`daytab${i === dayIdx ? ' on' : ''}`}
                onClick={() => setDayIdx(i)}
              >
                <b>{d.date.split(' ')[0]}</b>
                <span>{d.summary.activities} 站 · {d.district}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="overview">
          <div><b>{day.summary.activities}</b><span>活动</span></div>
          <div><b>{day.summary.transit}′</b><span>交通</span></div>
          <div><b>{day.summary.walk}km</b><span>步行</span></div>
          <div><b>￥{day.summary.cost}</b><span>预估</span></div>
        </div>

        {history.length > 0 && (
          <div className="pad" style={{ marginTop: 8 }}>
            <button className="undo-bar" onClick={undo}>
              ↺ 撤销上一步（还有 {history.length} 步可退）
            </button>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="alert">
            <span style={{ color: 'var(--warn)', marginTop: 1 }}><Warn /></span>
            <p>
              <b>需要留意：</b>
              {conflicts[0]}
              {conflicts.length > 1 ? `（另有 ${conflicts.length - 1} 项）` : ''}
            </p>
          </div>
        )}

        {view === 'timeline' ? (
          <div className="timeline">
            {day.items.map((it) => (
              <Fragment key={it.id}>
                {it.fromPrev && (
                  <div className="transit">
                    <Arrow size={11} />
                    {transportLabel[it.fromPrev.mode]} {it.fromPrev.minutes} 分钟 ·{' '}
                    {it.fromPrev.distance}m
                    {it.fromPrev.estimated ? '（估算）' : ''}
                  </div>
                )}
                <div className="tl-item">
                  <div className="tl-time">{fmt(it.start)}</div>
                  <div className="tl-rail">
                    <span
                      className={`node${it.kind === 'arrival' || it.kind === 'departure' ? ' hollow' : it.kind === 'meal' ? ' c' : ''}`}
                    />
                    <span className="line" />
                  </div>
                  <div className={`tl-card${it.kind === 'arrival' || it.kind === 'departure' ? ' plain' : ''}`}>
                    <div className="n" style={it.kind === 'arrival' || it.kind === 'departure' ? { fontSize: 13 } : undefined}>
                      {it.name}
                    </div>
                    {it.note && <div className="why" style={{ marginBottom: 8 }}>{it.note}</div>}
                    {it.kind !== 'arrival' && it.kind !== 'departure' && (
                      <div className="foot">
                        <span className="tg g">{short(it.duration)}</span>
                        {it.locked && <span className="tg c">已锁定</span>}
                        <span className="tg">
                          {PLACES.find((p) => p.id === it.placeId)?.ticket === 0
                            ? '免费'
                            : `￥${PLACES.find((p) => p.id === it.placeId)?.ticket ?? 0}`}
                        </span>
                        <button className="swap" onClick={() => setSheet(it)}>
                          换一个
                        </button>
                        <button className="more" onClick={() => setOps(it)} aria-label="更多操作">
                          ⋯
                        </button>
                      </div>
                    )}
                    {it.warning && <div className="warnline">{it.warning}</div>}
                  </div>
                </div>
              </Fragment>
            ))}
            <div className="tl-item" style={{ opacity: 0.55 }}>
              <div className="tl-time">
                {fmt(
                  day.items.reduce((m, i) => Math.max(m, i.start + i.duration), 0),
                )}
              </div>
              <div className="tl-rail"><span className="node hollow" /></div>
              <div className="tl-card plain">
                <div className="n" style={{ fontSize: 13 }}>之后自由安排</div>
              </div>
            </div>
            <div style={{ height: 6 }} />
          </div>
        ) : (
          <DayMap day={day} onPlace={onPlace} basemap={basemap} onBasemapChange={onBasemapChange} />
        )}

        {trip.plan.unscheduled.length > 0 && (
          <>
            <div className="pad">
              <div className="block-title">这次没排进去</div>
            </div>
            <div className="unsched">
              {trip.plan.unscheduled.map((u) => (
                <div key={u.placeId} className="row">
                  <span>{u.name}</span>
                  <span className="rs">
                    {u.reason === 'time' ? '时间不足' : u.reason === 'closed' ? '开放冲突' : u.reason === 'budget' ? '超预算' : u.reason === 'far' ? '距离过远' : '待确认'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="pad">
          <div className="block-title">本次安排的前提</div>
        </div>
        <ul className="assume">
          {trip.plan.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
          <li>节奏：{PACE_CONF[trip.prefs.pace].label}，每天约 {PACE_CONF[trip.prefs.pace].maxActivities} 个主要活动。</li>
        </ul>

        <div style={{ height: 10 }} />
      </div>

      <div className="footbtn">
        <button className="btn-primary" onClick={onStart}>
          {trip.status === 'active' ? '继续使用今天页' : '开始这趟旅行'}
        </button>
      </div>

      {shareOpen && (
        <>
          <div className="scrim" onClick={() => setShareOpen(false)} />
          <div className="sheet">
            <div className="grab" />
            <h3>分享这份行程</h3>
            <p className="desc">
              只读快照，对方不能修改。已省略到达与离开的具体站点、住宿信息与私人备注。
            </p>

            {share ? (
              <>
                <div className="linkbox">{shareLink(share.token)}</div>
                <p className="hint">
                  7 天内有效 · 撤销后立即失效 · {share.remote ? '可跨设备打开' : '仅本机有效'}
                </p>
                <div className="sheet-actions">
                  <button className="btn-quiet" style={{ color: 'var(--warn)' }} onClick={doRevoke}>
                    撤销链接
                  </button>
                  <button className="btn-primary" style={{ flex: 1.2 }} onClick={copyLinkNow}>
                    复制链接
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="share-preview">
                  {trip.plan.days.map((d) => (
                    <div key={d.index} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 5 }}>
                        {d.date} · {d.district}
                      </div>
                      {d.items.filter((i) => i.placeId).map((i) => (
                        <div key={i.id} className="share-line">
                          <span className="n">{fmt(i.start)}</span>
                          {i.name}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="sheet-actions">
                  <button className="btn-quiet" onClick={copyTextNow}>复制文字</button>
                  <button className="btn-primary" style={{ flex: 1.2 }} onClick={genShare}>
                    生成链接
                  </button>
                </div>
              </>
            )}
            <p className="sheet-note">
              {share?.remote
                ? '链接由服务端生成，可在任意设备打开；撤销后立即失效，访问次数会被记录。'
                : '服务端不可用，当前链接只在本机有效。'}
            </p>
          </div>
        </>
      )}

      {ops && (
        <>
          <div className="scrim" onClick={() => setOps(null)} />
          <div className="sheet">
            <div className="grab" />
            <h3>{ops.name}</h3>
            <p className="desc">
              调整后当天其余安排会自动顺延。锁定后该项目的时间与顺序都不再变动。
            </p>
            <div className="opgrid">
              <button onClick={() => doMove(ops, -1)} disabled={Boolean(ops.locked)}>上移一站</button>
              <button onClick={() => doMove(ops, 1)} disabled={Boolean(ops.locked)}>下移一站</button>
              {trip.plan.days.map((d, i) =>
                i === dayIdx ? null : (
                  <button key={d.index} onClick={() => doMoveToDay(ops, i)} disabled={Boolean(ops.locked)}>
                    移到第 {i + 1} 天
                  </button>
                ),
              )}
              <button onClick={() => doLock(ops)}>{ops.locked ? '解锁' : '锁定时间'}</button>
              <button onClick={() => { setSheet(ops); setOps(null) }}>换一个地点</button>
              <button className="danger" onClick={() => { handleSkip(ops); setOps(null) }}>跳过这一站</button>
            </div>
            <div className="sheet-actions">
              <button className="btn-quiet" onClick={() => setOps(null)}>取消</button>
            </div>
          </div>
        </>
      )}

      {sheet && target && (
        <>
          <div className="scrim" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="grab" />
            <h3>换掉「{sheet.name}」</h3>
            <p className="desc">
              替换后会重算当天剩余时间。已预约的项目不会被自动改动。
            </p>
            {alts.length === 0 && <p className="desc">附近没有合适的同类地点，可以换一天或直接跳过。</p>}
            {alts.map((a) => (
              <button key={a.id} className="opt reco" onClick={() => handleReplace(sheet, a.id)}>
                <span className="oi" style={{ background: gradOf(a.id) }} />
                <span>
                  <b>{a.name}</b>
                  <span>{a.district} · 建议 {short(a.duration)} · {a.ticket === 0 ? '免费' : `￥${a.ticket}`}</span>
                </span>
              </button>
            ))}
            <button className="opt" onClick={() => handleSkip(sheet)}>
              <span className="oi">
                <Clock size={14} />
              </span>
              <span>
                <b>跳过这一站</b>
                <span>保留已完成记录，只重算剩余安排</span>
              </span>
            </button>
            <div className="sheet-actions">
              <button className="btn-quiet" onClick={() => setSheet(null)}>取消</button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div
          style={{
            position: 'absolute', left: '50%', bottom: 268, transform: 'translateX(-50%)',
            background: 'rgba(26,26,23,.9)', color: '#fff', fontSize: 12, padding: '9px 14px',
            borderRadius: 999, zIndex: 60, whiteSpace: 'nowrap', maxWidth: '88%',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
