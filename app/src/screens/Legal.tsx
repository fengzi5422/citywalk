import { useState } from 'react'
import { Back } from '../components/Icons'
import { Info, Shield, FileText } from '../components/Icons'

export type LegalTab = 'terms' | 'privacy' | 'disclaimer'

type Props = {
  tab?: LegalTab
  onBack: () => void
}

const TABS: { key: LegalTab; label: string }[] = [
  { key: 'terms', label: '用户协议' },
  { key: 'privacy', label: '隐私政策' },
  { key: 'disclaimer', label: '免责声明' },
]

/** 结构化文本：便于阅读，也便于后续替换为正式法务版本 */
function Terms() {
  return (
    <>
      <Sec n="01" title="服务性质">
        <p>本应用是城市自由行的行程规划与随行辅助工具，按你选择的天数、节奏与兴趣生成按天日程建议，并提供编辑、收藏、分享与历史记录功能。</p>
        <p>生成的日程属于<strong>参考建议</strong>，不构成交通、票务、导游、医疗、法律或任何专业意见。当前交付版本使用示例内容数据，请阅读「免责声明」。</p>
      </Sec>
      <Sec n="02" title="账号">
        <p>注册使用邮箱与密码，密码经 scrypt 加盐哈希后存储，服务端不保存明文。登录凭证（JWT）保存在你本机浏览器中，默认有效期 30 天。</p>
        <ul>
          <li>请妥善保管账号与密码，勿与他人共用；</li>
          <li>不得批量注册、冒用他人身份或尝试绕过鉴权与限流；</li>
          <li>你可以在「我的」页导出数据、注销账号并删除服务端全部记录。</li>
        </ul>
      </Sec>
      <Sec n="03" title="可接受使用">
        <p>你承诺不将本应用用于任何违法用途，不上传侵害他人权益的内容，不对服务进行抓取、压测、注入或拒绝服务攻击，也不利用分享功能传播违法或骚扰信息。</p>
      </Sec>
      <Sec n="04" title="内容与知识产权">
        <p>应用内的地点、描述、评分、营业时间、票价与推荐语为示例或自编内容；路线模板与界面设计由本项目提供。真实底图瓦片来自天地图，其权利归原权利人所有。</p>
        <p><strong>你创建、编辑的行程数据归你所有。</strong>本应用不会因你使用服务而取得你内容的所有权或授权。</p>
      </Sec>
      <Sec n="05" title="第三方服务">
        <p>天地图 WMTS 底图为可选能力，需你自行申请浏览器端 key 并遵守其服务条款与调用配额；key 只保存在本机浏览器，不上传本应用服务器。若部署到云服务，服务器由你或你的部署方运营。</p>
      </Sec>
      <Sec n="06" title="分享链接">
        <p>分享是你主动生成的<strong>只读、脱敏快照</strong>，默认 7 天有效、可随时撤销。任何拿到链接的人都能查看其中内容，请自行判断是否包含不宜公开的信息。匿名分享通过持有者密钥撤销，请妥善保存。</p>
      </Sec>
      <Sec n="07" title="变更、中断与终止">
        <p>我们可能因维护、升级或不可抗力暂停部分功能，并会尽量保留你的本机数据。你随时可以停止使用、导出备份并注销账号。条款如有更新，会在应用内公示新版本与生效日期。</p>
      </Sec>
      <Sec n="08" title="责任限制">
        <p>在法律允许的最大范围内，本应用对因依赖示例数据、第三方底图、网络中断或设备丢失而产生的间接损失不承担责任。出行决策请以官方渠道信息为准。</p>
      </Sec>
    </>
  )
}

function Privacy() {
  return (
    <>
      <Sec n="01" title="我们收集什么">
        <ul>
          <li><strong>账号：</strong>邮箱地址、密码散列（scrypt）、注册时间；</li>
          <li><strong>内容：</strong>你创建或编辑的行程、收藏、操作事件时间线、行程版本快照；</li>
          <li><strong>分享：</strong>你主动生成的只读快照、有效期、访问计数与撤销状态；</li>
          <li><strong>诊断：</strong>服务端仅保留运行日志与错误日志，不记录行程正文。</li>
        </ul>
      </Sec>
      <Sec n="02" title="本机存储">
        <p>行程、收藏、历史、底图设置、登录凭证与天地图 key 均保存在浏览器本地存储（localStorage），<strong>未登录时完全不上云</strong>。天地图 key 只留在本机，从不发送到本应用服务器。</p>
      </Sec>
      <Sec n="03" title="我们不收集什么">
        <p>不请求定位权限，不读取通讯录、相册或设备标识，不接入第三方统计、广告或用户画像 SDK，不出售或向第三方共享你的数据。</p>
      </Sec>
      <Sec n="04" title="数据存在哪里">
        <p>登录后数据同步到你（或部署方）自建服务器上的单文件 SQLite 数据库；同源部署时通过 nginx 反向代理访问接口。数据卷由部署方负责备份与访问控制。</p>
      </Sec>
      <Sec n="05" title="保留、导出与删除">
        <ul>
          <li><strong>导出：</strong>「我的」页可导出完整备份 JSON，自行保管；</li>
          <li><strong>清空：</strong>可只清除本机数据；</li>
          <li><strong>注销：</strong>注销账号会级联删除服务端的行程、收藏状态、事件、版本与分享记录；</li>
          <li>分享快照到期后失效，撤销后立即不可访问。</li>
        </ul>
      </Sec>
      <Sec n="06" title="安全措施">
        <p>密码使用 scrypt 加盐哈希与恒定时间比对；接口有频率限制与体积上限；生产环境强制设置独立 JWT_SECRET 并拒绝默认密钥；建议全程 HTTPS。任何系统都无法承诺绝对安全，请自行做好备份。</p>
      </Sec>
      <Sec n="07" title="未成年人">
        <p>未满 14 周岁的儿童请在监护人陪同下使用，并由监护人代为创建账号与作出隐私选择。</p>
      </Sec>
      <Sec n="08" title="联系我们">
        <p>本交付版本的运营主体与联系方式由部署方在正式发布时公示；在此之前，请以你获取本应用的渠道所提供的联系信息为准。</p>
      </Sec>
    </>
  )
}

function Disclaimer() {
  return (
    <>
      <Sec n="01" title="内容为示例数据">
        <p>当前版本内置 20 个成都示例地点，用于验证排程逻辑与交互。<strong>营业时间、闭馆日、最晚入场、门票、评分、建议停留时长、人均消费均为示意值</strong>，不代表实时经营信息，不可直接作为出行依据。</p>
      </Sec>
      <Sec n="02" title="交通为估算，不提供导航">
        <p>点与点之间的耗时按直线距离 × 1.35 路网系数估算，再按步行 / 公交 / 地铁规则换算。它<strong>不是真实路径规划</strong>，未接入实时路况、公交班次或步行导航；界面已标注「估算」。请以地图 App 与实际路况为准，并预留充足余量。</p>
      </Sec>
      <Sec n="03" title="出行前请自行核实">
        <p>务必通过景区 / 场馆官方渠道确认：开放时间与临时闭馆、预约与最晚入场、门票与优惠政策、天气与交通管制、演出场次、餐厅排队情况。本应用不会主动提醒这些变化。</p>
      </Sec>
      <Sec n="04" title="地图与测绘">
        <p>天地图底图为第三方 WMTS 瓦片，审图号以天地图官网公示为准；正式发布前必须申请并标注真实审图号。内置「示意图」为自有示意数据，不是测绘成果，不得用于导航、界线判定或任何法定用途。</p>
      </Sec>
      <Sec n="05" title="分享内容">
        <p>分享快照已剔除抵达、返程、住宿、私人备注与票号，但仍包含你安排的地点与时间，可能反映个人行踪。公开分享前请再次确认。</p>
      </Sec>
      <Sec n="06" title="风险与责任">
        <p>旅行存在天气、交通、人身与财产风险。请遵守当地法律法规与景区规定，注意人身安全，并自行购买必要保险。因依赖本应用示例数据或估算结果产生的损失，本应用不承担责任。遇紧急情况请联系当地官方救援与报警电话。</p>
      </Sec>
    </>
  )
}

function Sec({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="legal-sec">
      <h3><span>{n}</span>{title}</h3>
      <div className="legal-body">{children}</div>
    </section>
  )
}

export default function Legal({ tab = 'terms', onBack }: Props) {
  const [active, setActive] = useState<LegalTab>(tab)

  return (
    <div className="legal-page">
      <div className="legal-head">
        <button className="back" aria-label="返回" onClick={onBack}><Back /></button>
        <h2>条款与说明</h2>
        <span className="legal-date">2026-11-04</span>
      </div>

      <div className="legal-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={active === t.key ? 'on' : ''} onClick={() => setActive(t.key)}>
            {t.key === 'terms' && <FileText size={14} />}
            {t.key === 'privacy' && <Shield size={14} />}
            {t.key === 'disclaimer' && <Info size={14} />}
            {t.label}
          </button>
        ))}
      </div>

      <div className="legal-content" key={active}>
        <div className="legal-intro">
          {active === 'terms' && <p>使用本应用即表示你已阅读并同意以下条款。请以正式发布时运营主体公示的版本为准。</p>}
          {active === 'privacy' && <p>我们采用「本地优先」设计：数据默认留在你的设备上，登录后才同步到你自己的服务器。</p>}
          {active === 'disclaimer' && <p>在把本应用用于真实出行前，请先读完这份说明。</p>}
        </div>
        {active === 'terms' && <Terms />}
        {active === 'privacy' && <Privacy />}
        {active === 'disclaimer' && <Disclaimer />}
      </div>

      <p className="legal-foot">城市自由行 v0.9.0 · 候选交付版 · 生效日期 2026-11-04</p>
    </div>
  )
}
