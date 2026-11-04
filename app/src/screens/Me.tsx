import { useRef, useState, type ChangeEvent } from 'react'
import type { Trip } from '../core/types'
import type { BaseMapSetting } from '../core/mapConfig'
import type { Auth } from '../core/auth'
import type { LegalTab } from './Legal'
import { readFileAsText } from '../core/backup'
import { Arrow, Check, Info, Pin } from '../components/Icons'

type Props = {
  trips: Trip[]
  basemap: BaseMapSetting
  auth: Auth | null
  syncing: boolean
  historyCount: number
  onLogin: () => void
  onLogout: () => void
  onHistory: () => void
  onRefresh: () => void
  onLegal: (tab: LegalTab) => void
  onExport: () => void
  onImport: (text: string) => { ok: boolean; message: string }
  onDeleteAccount: () => Promise<boolean>
  onBasemapChange: (next: BaseMapSetting) => void
  onClear: () => void
}

export default function Me({
  trips, basemap, auth, syncing, historyCount,
  onLogin, onLogout, onHistory, onRefresh, onLegal, onExport, onImport, onDeleteAccount,
  onBasemapChange, onClear,
}: Props) {
  const [tk, setTk] = useState(basemap.tk)
  const [showTk, setShowTk] = useState(false)
  const [tip, setTip] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const useTdt = basemap.mode === 'tianditu' && basemap.tk.trim().length > 0

  const pickSchematic = () => {
    onBasemapChange({ mode: 'schematic', tk })
    setTip('已切换为示意图，离线也能打开。')
  }

  const pickTianditu = () => {
    const v = tk.trim()
    if (!v) {
      setTip('先填入天地图 key，再切换。')
      return
    }
    onBasemapChange({ mode: 'tianditu', tk: v })
    setTip('已切换，打开任意行程的地图即可查看。')
  }

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await readFileAsText(file)
      const r = onImport(text)
      setTip(r.message)
    } catch (err) {
      setTip(err instanceof Error ? err.message : '文件读取失败')
    }
    e.target.value = ''
  }

  const onDelete = async () => {
    if (!confirm('注销账号会删除服务端全部行程、收藏、历史与分享，并清空本机数据。此操作不可恢复，确定继续？')) return
    const done = await onDeleteAccount()
    setTip(done ? '账号已注销，本机数据已清空' : '注销失败：服务端不可用，请稍后重试')
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <div className="list-head">
        <h2>我的</h2>
      </div>

      {tip && <div className="me-tip" onClick={() => setTip('')}>{tip}</div>}

      <div className="pad" style={{ marginTop: 12 }}>
        {auth ? (
          <div className="authcard">
            <div className="l">
              <p className="email">{auth.user.email}</p>
              <p className="sub">
                {syncing ? '正在同步…' : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--green)' }}>
                    <Check size={11} /> 已同步 {trips.length} 份行程
                  </span>
                )}
              </p>
            </div>
            <button className="logout" onClick={onLogout}>退出</button>
          </div>
        ) : (
          <button className="authcard as-btn" onClick={onLogin}>
            <div className="l">
              <p className="email">登录以同步行程</p>
              <p className="sub">换设备也能接着用，分享链接更好管理</p>
            </div>
            <Arrow size={15} />
          </button>
        )}
      </div>

      <div className="pad" style={{ marginTop: 14 }}>
        <div className="overview" style={{ margin: 0 }}>
          <div><b>{trips.length}</b><span>份行程</span></div>
          <div><b>{trips.filter((t) => t.status === 'active').length}</b><span>进行中</span></div>
          <div><b>1</b><span>座城市</span></div>
        </div>
      </div>

      <div className="pad" style={{ marginTop: 22 }}>
        <p className="block-title" style={{ marginTop: 0 }}>记录与同步</p>
        <button className="inputrow" onClick={onHistory}>
          <span>历史记录</span>
          <span style={{ color: 'var(--green)', fontSize: 12 }}>{historyCount} 条 ›</span>
        </button>
        <button
          className="inputrow"
          onClick={onRefresh}
          disabled={!auth || syncing}
          style={{ opacity: (!auth || syncing) ? 0.5 : 1 }}
        >
          <span>{syncing ? '正在同步…' : '立即同步'}</span>
          <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{auth ? '拉取云端最新' : '需先登录'}</span>
        </button>
        <p className="hint">登录后每 30 秒自动拉取一次，网络恢复也会自动补推本机改动。</p>
      </div>

      <div className="pad" style={{ marginTop: 22 }}>
        <p className="block-title" style={{ marginTop: 0 }}>地图底图</p>

        <div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button className={`s${!useTdt ? ' on' : ''}`} onClick={pickSchematic}>
            <b>示意图</b>
            <span>自有数据 · 可离线</span>
          </button>
          <button className={`s${useTdt ? ' on' : ''}`} onClick={pickTianditu}>
            <b>天地图</b>
            <span>真实街道 · 需 key</span>
          </button>
        </div>

        <div className="field">
          <p className="lb">天地图 key（浏览器端 tk）</p>
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              style={{ paddingRight: 64 }}
              type={showTk ? 'text' : 'password'}
              value={tk}
              onChange={(e) => setTk(e.target.value)}
              placeholder="粘贴 32 位 key"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              onClick={() => setShowTk((v) => !v)}
              style={{
                position: 'absolute', right: 6, top: 6, height: 34, padding: '0 12px',
                fontSize: 12, color: 'var(--green)', borderRadius: 9, background: 'var(--paper)',
              }}
            >
              {showTk ? '隐藏' : '显示'}
            </button>
          </div>
          <p className="hint">
            在 <b>console.tianditu.gov.cn</b> 注册后创建应用，类型选「浏览器端」，把 <b>127.0.0.1</b> 加进白名单。key 只保存在本机浏览器。
          </p>
          {useTdt && <p className="hint" style={{ color: 'var(--green)' }}>当前使用天地图底图。</p>}
        </div>

        {useTdt && (
          <div className="alert info" style={{ margin: '14px 0 0' }}>
            <span style={{ color: 'var(--green-deep)', marginTop: 1 }}><Info /></span>
            <p>
              如果地图空白，多半是 key 未通过 referer 校验。确认白名单里有 <b>127.0.0.1</b>，或换成 <b>localhost</b> 再试。
            </p>
          </div>
        )}
      </div>

      <div className="pad" style={{ marginTop: 22 }}>
        <p className="block-title" style={{ marginTop: 0 }}>数据与隐私</p>
        <div className="infobox" style={{ margin: 0 }}>
          <div className="inforow">
            <span className="k">存储位置</span>
            <span className="v">{auth ? '本机 + 云端' : '本机浏览器'}</span>
          </div>
          <div className="inforow">
            <span className="k">是否上传服务器</span>
            <span className="v">{auth ? '已登录，自动同步' : '否'}</span>
          </div>
          <div className="inforow">
            <span className="k">定位权限</span>
            <span className="v">未请求</span>
          </div>
        </div>
        <p className="hint">
          {auth
            ? '行程在登录后自动同步到云端，本地保留一份副本；换设备登录同一账号即可看到。'
            : '未登录时数据只在本机；清理浏览器数据会丢失。登录后可跨设备同步。'}
        </p>

        <p className="block-title" style={{ marginTop: 18 }}>数据管理</p>
        <button className="inputrow" onClick={() => { onExport(); setTip('备份已下载到本机，请妥善保管') }}>
          <span>导出本机备份</span>
          <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>JSON ›</span>
        </button>
        <button className="inputrow" onClick={() => fileRef.current?.click()}>
          <span>导入备份</span>
          <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>保守合并 ›</span>
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onPickFile} />
        <p className="hint">备份包含行程、收藏与历史记录，不含密码与天地图 key。</p>

        <button
          className="inputrow dashed"
          style={{ marginTop: 12, justifyContent: 'center', color: 'var(--warn)' }}
          onClick={onClear}
        >
          清空本机数据
        </button>
        {auth && (
          <button
            className="inputrow dashed"
            style={{ marginTop: 10, justifyContent: 'center', color: 'var(--warn)' }}
            onClick={onDelete}
          >
            注销账号并删除云端数据
          </button>
        )}
      </div>

      <div className="pad" style={{ marginTop: 22 }}>
        <p className="block-title" style={{ marginTop: 0 }}>关于</p>
        <div className="infobox" style={{ margin: 0 }}>
          <div className="inforow"><span className="k">版本</span><span className="v">v0.9.0 · 候选交付版</span></div>
          <div className="inforow"><span className="k">数据</span><span className="v">20 个示例地点（成都）</span></div>
          <div className="inforow"><span className="k">排程</span><span className="v">规则引擎 · 本地运算</span></div>
          <div className="inforow">
            <span className="k">地图</span>
            <span className="v">{useTdt ? '天地图 WMTS' : '自有示意数据'}</span>
          </div>
        </div>
      </div>

      <div className="pad" style={{ marginTop: 18 }}>
        <p className="block-title" style={{ marginTop: 0 }}>条款与说明</p>
        <button className="inputrow" onClick={() => onLegal('terms')}>
          <span>用户协议</span><span style={{ color: 'var(--ink-3)', fontSize: 12 }}>›</span>
        </button>
        <button className="inputrow" onClick={() => onLegal('privacy')}>
          <span>隐私政策</span><span style={{ color: 'var(--ink-3)', fontSize: 12 }}>›</span>
        </button>
        <button className="inputrow" onClick={() => onLegal('disclaimer')}>
          <span>免责声明</span><span style={{ color: 'var(--ink-3)', fontSize: 12 }}>›</span>
        </button>
      </div>

      <div className="alert info" style={{ marginTop: 16 }}>
        <span style={{ color: 'var(--green-deep)', marginTop: 1 }}><Info /></span>
        <p>
          <b>本版本为候选交付版。</b>开放时间、门票、交通耗时均为示例值；正式发布前需接入真实内容数据、标注真实审图号，并完成合规清单确认。详见「免责声明」。
        </p>
      </div>

      <div className="pad" style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 11 }}>
        <Pin size={13} />
        一人一座城，一趟可执行的旅行
      </div>
    </div>
  )
}
