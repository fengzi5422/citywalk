# 城市自由行

面向国内城市 1—5 天自由行的行程规划与随行助手：选城市、填条件，得到一份路线合理、可随时修改、旅行中能直接用的按天日程。

**当前状态：v0.9.0 · 候选交付版。** 前端（含 PWA 离线、合规文本、数据备份、账号注销、桌面宽屏）、后端（账号 / 同步 / 历史 / 版本 / 分享）、内容数据体检、部署与运维脚本、全套自动化验收均已就绪，可作为产品交付使用。正式上线前仍需替换真实 POI 内容、申请并标注审图号、配置 HTTPS 与强密钥——清单见「上线前必做」。

## 目录

```
ly/
├── app/                 前端：Vite + React + TypeScript
│   ├── public/          PWA manifest / Service Worker / 图标
│   ├── src/             界面、排程引擎、同步与备份
│   ├── docs/            端到端与验收脚本、RESOURCES.md
│   ├── Dockerfile       多阶段构建
│   └── nginx.conf       静态托管 + /api 反代
├── server/              后端：Fastify + node:sqlite
│   ├── src/routes/      账号 / 行程 / 分享 / 历史
│   └── scripts/         接口冒烟测试
├── design/              12 屏高保真设计稿
├── output/              产品需求与规划设计（Markdown / DOCX）
├── tools/               图标生成、内容数据体检
├── scripts/             部署 / 备份 / 恢复
├── .env.example         部署环境变量模板
├── docker-compose.yml
├── DEPLOY.md            服务器 clone 即部署手册
└── README.md
```

相关文档：`DEPLOY.md`（从 GitHub clone 到服务器直接部署）、`output/20261103-travelapp/stage3/城市自由行App产品需求与规划设计.docx`（需求与规划）、`design/城市自由行-App设计稿-v1.html`（高保真设计稿）、`app/docs/RESOURCES.md`（正式资源清单与替代方案）。

## 本地开发

需要 Node 22.5+（后端用了内置的 `node:sqlite`）。

```bash
# 终端 1：后端
cd server && npm install && npm run dev       # http://127.0.0.1:5179

# 终端 2：前端
cd app && npm install && npm run dev         # http://127.0.0.1:5178

# 终端 3（可选）：生产预览，用于 PWA / 离线验收
cd app && npm run build && npm run preview   # http://127.0.0.1:5180
```

前端把 `/api` 代理到后端，无需配置跨域；`dev` 与 `preview` 都已内置反代。

## 验证与验收

后端接口（需后端在 5179 运行）：

| 命令 | 覆盖 | 结果 |
| --- | --- | --- |
| `node server/scripts/smoke.mjs` | 注册登录 / 行程 / 分享 22 项 | PASS |
| `node server/scripts/smoke-history.mjs` | 事件 / 版本快照 / 收藏状态 31 项 | PASS |
| `node server/scripts/smoke-account.mjs` | 账号注销与数据清理 17 项 | PASS |
| `npm --prefix app run validate:data` | 20 个地点、4 片区、10 类兴趣，0 错误 | PASS |

前端端到端（需 dev 5178 + 后端 5179；除标注外均为 0 页面 JS 错误）：

| 命令 | 覆盖 |
| --- | --- |
| `node app/docs/walkthrough.mjs` | 主流程 13 屏截图回归 |
| `node app/docs/basemap-test.mjs` | 示意图 / 天地图双底图切换 |
| `node app/docs/edit-test.mjs` | 替换 / 跳过 / 上下移 / 换日 / 锁定 / 撤销 |
| `node app/docs/share-test.mjs` | 本地分享、撤销与失效 |
| `node app/docs/share-remote-test.mjs` | 服务端短链跨设备打开与撤销 |
| `node app/docs/auth-test.mjs` | 注册登录与云同步 |
| `node app/docs/feature-test.mjs` | 模板套用 / 行程复制 / 批量收藏加入 |
| `node app/docs/history-sync-test.mjs` | 历史 / 版本 / 收藏跨设备同步 12 项 PASS |
| `node app/docs/delivery-test.mjs` | 交付验收：合规文本、备份导入导出、离线条 13 项 PASS |
| `node app/docs/verify-tianditu-env.mjs` | `.env.local` 默认启动下天地图 24/24 瓦片 PASS |

生产构建 / PWA（需 `npm run build` + `npm run preview` 5180）：

| 命令 | 覆盖 |
| --- | --- |
| `node app/docs/pwa-test.mjs` | 按需分包、SW 离线可用、同源反代、桌面宽屏 11 项 PASS |

> 改后端代码后**必须重启后端**，否则测试跑的仍是旧进程。

## 地图底图配置

地图用 MapLibre GL JS 渲染，底图可在「我的 → 底图」里切换：

| 模式 | 说明 |
| --- | --- |
| 示意图 | 自有 GeoJSON（片区、环线、道路、水系），无需 key，永远可用 |
| 天地图 | WMTS 真实街道底图（`vec_w` + `cva_w` 注记），需要浏览器端 key |

```bash
cp app/.env.example app/.env.local
# 编辑 app/.env.local：
#   VITE_TIANDITU_TK=<浏览器端 tk>
#   VITE_TIANDITU_AUDIT_NO=<正式审图号，正式发布前必填>
```

- key 必须是**浏览器端**类型，并在天地图控制台把 `127.0.0.1` 与 `localhost` 都加入 Referer 白名单（两者是不同来源）；上线后换成正式域名。
- 审图号通过 `VITE_TIANDITU_AUDIT_NO` 注入，地图页会自动标注；**未配置时会明确提示「正式发布前须申请并标注」**，不会预置编造编号。
- 配了 key 时默认进入天地图模式，未配置则默认示意图；瓦片返回 403 时页面提示并可一键「切回示意图」，其余功能不受影响。
- `.env.local` / `.env` 均被 `.gitignore` 排除，key 不会进版本库。

单独验证 key：`node app/docs/verify-tianditu.mjs <tk>`。

> 天地图路径规划接口已实测放弃：`/drive` 需 Web 服务权限且仅驾车，`/walk` / `/bus` 不适用。因此交通耗时为**估算**（直线距离 × 1.35 路网系数），界面显式标注「估算」，不提供导航。

## 部署到云服务器

**完整步骤见 [DEPLOY.md](DEPLOY.md)**：从 GitHub clone 到服务器直接跑起来，目标服务器 `zz@123.57.92.56`。仓库已包含完整后端 `server/`、Compose 编排、两个 Dockerfile、nginx 配置与运维脚本，服务器上无需本地打包或单独上传后端代码；本地只负责把代码推到 GitHub。

### 方式一：Docker Compose（推荐）

```bash
git clone https://github.com/fengzi5422/citywalk.git && cd citywalk
cp .env.example .env
openssl rand -hex 32          # 填入 .env 的 JWT_SECRET
bash scripts/deploy.sh        # 构建、启动、健康检查一条龙
```

等价于 `docker compose up -d --build`。部署后：

- 前端：`http://<服务器IP>:8080`
- 接口：仅监听 `127.0.0.1:5179`，由 nginx 反代 `/api`
- 数据：挂载在 `./data`，容器重建不丢

`.env` 支持 `JWT_SECRET`（必填，生产环境 <32 字符会拒绝启动）、`CORS_ORIGINS`、`VITE_API_BASE`、`VITE_TIANDITU_TK`、`VITE_TIANDITU_AUDIT_NO`、`SHARE_TTL_DAYS`；后三项会作为构建参数注入前端。

### 方式二：手动部署

```bash
cd server && npm ci --omit=dev
NODE_ENV=production JWT_SECRET=xxx HOST=0.0.0.0 node --experimental-sqlite src/index.js

cd app && npm ci && npm run build      # 产物在 app/dist
```

把 `app/dist` 交给 nginx，`/api` 反代到后端端口，参考 `app/nginx.conf`（已对 `sw.js` / `manifest` 设 no-cache）。

### 数据库、备份与运维

- 数据文件：`./data/citywalk.db`（`DB_PATH` 指定），WAL 模式，单文件，容器重建不丢。
- `./scripts/backup.sh`：容器内 `VACUUM INTO` 生成一致性快照到 `backups/`，保留最近 14 份。
- `./scripts/restore.sh backups/<file>.db`：停 `api` → 覆盖数据库 → 重启 → 健康检查。
- 建议用 cron 每天执行 `backup.sh` 并把 `backups/` 同步到对象存储。
- SQLite 是单机单文件，**不能起多个 api 副本共写**；流量上来后需换 PostgreSQL（表结构可平移）。

### 上线前必做

- [ ] 设置强 `JWT_SECRET`（32 字节随机；`deploy.sh` 会校验）
- [ ] `CORS_ORIGINS` 改成正式域名，去掉 localhost（同源部署可留空）
- [ ] 配 HTTPS（Caddy 或 nginx + certbot）
- [ ] 确认数据卷 `./data` 已挂载，并配置定时 `scripts/backup.sh`
- [ ] 天地图 key 的 Referer 白名单换成正式域名
- [ ] `VITE_TIANDITU_AUDIT_NO` 填入**真实审图号**（地图页会自动标注）
- [ ] 把 `app/src/data/places.json` 换成真实 POI，并跑 `validate:data`
- [ ] 前后端分离部署时填 `VITE_API_BASE` 并把前端来源加入 `CORS_ORIGINS`

## 多端、离线与同步

PWA 在生产构建下自动注册 Service Worker：可安装到主屏 / 桌面，离线仍能打开 App shell 查看已缓存的行程，`/api` 请求不缓存，联网后按既有同步逻辑补推。桌面浏览器宽屏（≥1100px）显示品牌侧栏，手机端保持原有布局。

前后端同源部署时（Compose 默认形态），网页端与移动端 Web 走同一域名，nginx 反代 `/api`，不触发跨域，`VITE_API_BASE` 留空即可。分属不同域名时：

```bash
VITE_API_BASE=https://api.example.com npm run build
```

同时把前端来源加进后端 `CORS_ORIGINS` 并配置 HTTPS。Compose 已支持从 `.env` 读取 `VITE_API_BASE`。

| 行为 | 现状 |
| --- | --- |
| 登录后首次进入 | 拉取云端全部行程 / 事件 / 收藏，与本机合并，取 `updatedAt` 较新者 |
| 本机修改 | 900ms 防抖后推送云端，失败 5s 自动重试 |
| 另一台设备已打开 | 30 秒定时拉取自动刷新，也支持「立即同步」 |
| 断网期间修改 | 只存本机并显示离线条，网络恢复（`online`）立刻补推 |
| 操作事件 | 创建 / 修改 / 删除 / 完成 / 登录全部记入事件时间线，离线攒着、联网补报 |
| 行程版本 | 每次写入自动留快照（最近 20 份），历史记录页可查看 |
| 收藏 | 已上云（`user_state`），跨设备同步，带时间戳冲突检测 |
| 冲突 | 最后写入者胜，没有逐字段合并 |
| 登录凭证 | JWT 存本机，默认 30 天；无邮箱验证与找回密码 |

**部署到云服务器后，App 端与网页端可随时使用**：账号、云端库、同源反代、数据卷持久化、30s 定时拉取、断网补推、收藏上云、事件时间线、版本快照、PWA 离线全部就绪。原生 App 仍可用 Capacitor 把 `app/dist` 包壳，业务逻辑与同步层不用改。

## 合规与数据可携带

- 「我的 → 条款与说明」提供完整的**用户协议 / 隐私政策 / 免责声明**，明确示例数据、估算耗时、不提供导航、正式发布需真实审图号等边界。
- 本地优先：不请求定位权限、不接广告 / 统计 SDK；未登录也能完整使用，行程先存本机。
- 备份导出 / 导入（JSON，不含密码与天地图 key），导入按 `updatedAt` 保守合并，可完整带走数据。
- 账号注销：`DELETE /api/me` 在事务里删除分享、事件、版本、收藏状态、行程与用户，旧 JWT 因用户不存在而立即失效。
- 全局 `ErrorBoundary` 兜底，异常时提供「重新加载」与「重置本机数据」，避免白屏。

## 功能状态

| 模块 | 状态 |
| --- | --- |
| 探索 / 城市 / 地点 | 已完成（20 个成都示例地点，外置 `places.json`） |
| 创建行程与排程 | 已完成（锚点 + 片区聚类 + 贪心插入 + 约束校验） |
| 行程编辑 | 已完成（换 / 跳 / 上移下移 / 换日 / 锁定 / 撤销） |
| 今天页 / 收藏 / 行程列表 | 已完成 |
| 地图底图 | 已完成（示意图 / 天地图双底图，可切换、失败自动降级） |
| 分享 | 已完成（服务端短链，跨设备，可撤销，7 天有效） |
| 账号与多端同步 | 已完成（邮箱注册登录，本地优先 + 云端合并，30s 拉取 + 断网补推） |
| 历史记录与版本 | 已完成（事件时间线、版本快照、收藏上云、跨设备可见） |
| PWA 与离线 | 已完成（可安装、离线 app shell、离线条、联网补推） |
| 桌面宽屏 / 错误兜底 | 已完成（≥1100px 品牌侧栏、ErrorBoundary） |
| 合规文本 / 备份 / 注销 | 已完成 |
| 部署运维 | 已完成（Compose / nginx / deploy / backup / restore） |
| 内容后台 | 未开始 |
| 原生 App | 未开始（可用 Capacitor 包壳，无需改服务端） |

## 已知限制

- 交通耗时是估算（直线 × 1.35 路网系数），未接入真实路径规划，不提供导航。
- 同步是「最后写入者胜」，没有逐字段合并；两台设备同时改同一份行程时较旧那份会被覆盖（30s 拉取 + 网络恢复补推已减小窗口）。
- 未做邮箱验证与找回密码；JWT 无状态，靠「用户不存在」使注销后的旧 token 失效。
- POI、营业时间、票价均为成都示例数据，已外置 `app/src/data/places.json` 并配套体检脚本，可直接替换。
- 审图号需正式申请后填入 `VITE_TIANDITU_AUDIT_NO`；未填时地图页明确提示，不会编造编号。
- 分享短链 7 天有效，匿名 `ownerKey` 可撤销；无账号也能创建 / 撤销。
- 没有原生 App；PWA 可安装但不是原生包。桌面端为宽屏侧栏 + 手机框布局，非独立桌面重构。
- `node:sqlite` 是 Node 22 实验特性；SQLite 单机单文件，不能起多个 api 副本共写。

## 版本

v0.9.0 · 候选交付版 · 2026.11
