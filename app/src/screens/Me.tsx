import { useState } from 'react'
import type { Trip } from '../core/types'
import type { BaseMapSetting } from '../core/mapConfig'
import { Info, Pin } from '../components/Icons'

type Props = {
  trips: Trip[]
  basemap: BaseMapSetting
  onBasemapChange: (next: BaseMapSetting) => void
  onClear: () => void
}

export default function Me({ trips, basemap, onBasemapChange, onClear }: Props) {
  const [tk, setTk] = useState(basemap.tk)
  const [showTk, setShowTk] = useState(false)
  const [tip, setTip] = useState('')

  const useTdt = basemap.mode === 'tianditu' && basemap.tk.trim().length > 0

  const pickSchematic = () => {
    onBasemapChange({ mode: 'schematic', tk })
    setTip('')
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

  return (
    <div style={{ paddingBottom: 20 }}>
      <div className="list-head">
        <h2>我的</h2>
      </div>

      <div className="pad" style={{ marginTop: 14 }}>
        <div className="overview" style={{ margin: 0 }}>
          <div><b>{trips.length}</b><span>份行程</span></div>
          <div><b>{trips.filter((t) => t.status === 'active').length}</b><span>进行中</span></div>
          <div><b>1</b><span>座城市</span></div>
        </div>
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
          {tip && <p className="hint" style={{ color: 'var(--green)' }}>{tip}</p>}
          {useTdt && !tip && <p className="hint" style={{ color: 'var(--green)' }}>当前使用天地图底图。</p>}
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
            <span className="v">本机浏览器</span>
          </div>
          <div className="inforow">
            <span className="k">是否上传服务器</span>
            <span className="v">否</span>
          </div>
          <div className="inforow">
            <span className="k">定位权限</span>
            <span className="v">未请求</span>
          </div>
        </div>
        <p className="hint">换设备或清理浏览器数据会丢失行程。正式版会提供账号同步。</p>

        <button
          className="inputrow dashed"
          style={{ marginTop: 12, justifyContent: 'center', color: 'var(--warn)' }}
          onClick={onClear}
        >
          清空本机数据
        </button>
      </div>

      <div className="pad" style={{ marginTop: 22 }}>
        <p className="block-title" style={{ marginTop: 0 }}>关于</p>
        <div className="infobox" style={{ margin: 0 }}>
          <div className="inforow"><span className="k">版本</span><span className="v">v0.1.0 · 演示版</span></div>
          <div className="inforow"><span className="k">数据</span><span className="v">20 个示例地点</span></div>
          <div className="inforow"><span className="k">排程</span><span className="v">规则引擎 · 本地运算</span></div>
          <div className="inforow">
            <span className="k">地图</span>
            <span className="v">{useTdt ? '天地图 WMTS' : '自有示意数据'}</span>
          </div>
        </div>
      </div>

      <div className="alert info" style={{ marginTop: 16 }}>
        <span style={{ color: 'var(--green-deep)', marginTop: 1 }}><Info /></span>
        <p>
          <b>这是替代资源的开发版本。</b>开放时间、门票、交通耗时均为示例值，用于验证排程逻辑与交互；上线前需接入真实数据，并按规划文档第九章的合规清单逐项确认。
        </p>
      </div>

      <div className="pad" style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 11 }}>
        <Pin size={13} />
        一人一座城，一趟可执行的旅行
      </div>
    </div>
  )
}
