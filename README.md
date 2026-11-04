# 城市自由行

面向国内城市 1—5 天自由行的行程规划与随行助手：选城市、填条件，得到一份路线合理、可随时修改、旅行中能直接用的按天日程。

## 目录

```
ly/
├── app/          前端：Vite + React + TypeScript
├── server/       后端：Fastify + node:sqlite
├── design/       设计稿（12 屏高保真）
├── output/       产品需求与规划设计文档
└── docker-compose.yml
```

## 本地开发

需要 Node 22.5+（后端用了内置的 `node:sqlite`）。

```bash
# 终端 1：后端
cd server
npm install
npm run dev            # http://127.0.0.1:5179

# 终端 2：前端
cd app
npm install
npm run dev            # http://127.0.0.1:5178
```

前端把 `/api` 代理到后端，无需配置跨域。

验证：

```bash
node server/scripts/smoke.mjs             # 后端接口，22 项
node app/docs/walkthrough.mjs             # 前端主流程截图
node app/docs/basemap-test.mjs            # 底图切换
node app/docs/edit-test.mjs               # 行程编辑
node app/docs/share-test.mjs              # 本地分享
node app/docs/share-remote-test.mjs       # 跨设备分享
node app/docs/auth-test.mjs               # 注册登录与云同步
node app/docs/feature-test.mjs            # 模板套用 / 行程复制 / 收藏批量加入
node app/docs/verify-tianditu-env.mjs     # 天地图默认底图（需先配 .env.local）
```

### 地图底图配置

地图用 MapLibre GL JS 渲染，底图可在「我的 → 底图」里切换：

| 模式 | 说明 |
| --- | --- |
| 示意图 | 自有 GeoJSON（片区、环线、道路、水系），无需 key，永远可用 |
| 天地图 | WMTS 真实街道底图（`vec_w` 底图 + `cva_w` 注记），需要浏览器端 key |

配置天地图：

```bash
cp app/.env.example app/.env.local
# 编辑 app/.env.local，填入 VITE_TIANDITU_TK=<浏览器端 tk>
```

- key 必须是**浏览器端**类型，并在天地图控制台把 `127.0.0.1` 与 `localhost` 都加入 Referer 白名单（两者是不同来源）；上线后还要加正式域名。
- 改完 `.env.local` 重启 `npm run dev`（Vite 通常会自动重启）。配了 key 时应用默认进入天地图模式，未配置则默认示意图。
- `.env.local` 已被 `.gitignore` 排除，key 不会进版本库。

验证 key：

```bash
node app/docs/verify-tianditu.mjs <tk>   # 单独验证 key / 白名单：z=10—14 瓦片 + 真实底图截图
node app/docs/verify-tianditu-env.mjs    # 不注入任何配置，验证默认启动就能出真实底图
```

若 key 被禁用或配额用尽，瓦片返回 403，页面会显示提示条并可一键「切回示意图」，其余功能不受影响。

## 部署到云服务器

### 方式一：Docker Compose

```bash
git clone <repo> && cd ly
cp server/.env.example .env

# 生成密钥并写进 .env（不要用默认值，生产会拒绝启动）
openssl rand -hex 32

docker compose up -d --build
```

- 前端：`http://<服务器IP>:8080`
- 接口：仅监听 `127.0.0.1:5179`，由 nginx 反代 `/api`
- 数据：挂载在 `./data`，容器重建不丢

### 方式二：手动部署

```bash
# 后端（建议用 systemd 或 pm2 托管）
cd server && npm ci --omit=dev
NODE_ENV=production JWT_SECRET=xxx HOST=0.0.0.0 node --experimental-sqlite src/index.js

# 前端静态文件
cd app && npm ci && npm run build   # 产物在 app/dist
```

把 `app/dist` 交给 nginx，`/api` 反代到后端端口，参考 `app/nginx.conf`。

### 上线前必做

- [ ] 设置强 `JWT_SECRET`（32 字节随机）
- [ ] `CORS_ORIGINS` 改成正式域名，去掉 localhost（同源部署可跳过）
- [ ] 配 HTTPS（Caddy 或 nginx + certbot）
- [ ] 确认数据卷 `./data` 已挂载，并做定时备份
- [ ] 天地图 key 的 Referer 白名单换成正式域名
- [ ] 地图页标注审图号

### 多端同时使用

前后端同源部署时（Docker Compose 默认形态），网页端与移动端 Web 都走同一个域名，nginx 把 `/api` 反代到后端，浏览器不触发跨域，`VITE_API_BASE` 留空即可。

若前端与后端分属不同域名（网页放 CDN、App 直连云服务器接口），需要：

```bash
# 构建前端时指定后端地址
VITE_API_BASE=https://api.example.com npm run build
```

同时把前端来源加进后端 `CORS_ORIGINS`（逗号分隔），并配置 HTTPS，否则浏览器会拦截请求。Compose 里已支持从 `.env` 读 `VITE_API_BASE`。

当前同步行为（部署后同样适用）：

| 行为 | 现状 |
| --- | --- |
| 登录后首次进入 | 拉取云端全部行程，与本机合并，取 `updatedAt` 较新者 |
| 本机修改 | 900ms 防抖后推送到云端 |
| 另一台设备已打开时 | **不会自动刷新**，需重新登录或重新进入才会看到 |
| 断网期间修改 | 只存本机；网络恢复后若没有新改动，不会自动补推 |
| 冲突 | 最后写入者胜，没有逐字段合并 |
| 收藏 | 只存本机，未上云，换设备会丢 |
| 登录凭证 | JWT 存本机，默认 30 天；无邮箱验证与找回密码 |

也就是说：**部署到云服务器后，多端「能随时使用」的骨架已经具备**（账号、云端库、同源反代、数据卷持久化都在）；但要做到「A 设备改完 B 设备立刻看到」，还需要补定时拉取 / 断网补推，并把收藏等轻量状态上云。

### 原生 App 与桌面

目前只有一套移动端 Web 界面（Vite + React），桌面浏览器打开会显示居中的手机框，功能完整但不是桌面布局。要得到真正的 App：

- **最快**：用 Capacitor 把 `app/dist` 包成 Android / iOS 壳，业务逻辑与同步代码不用改，只需在 `capacitor.config` 里配好后端域名与 CSP。
- **体验更好**：把 `app/src` 改成响应式布局，再配合 PWA 离线缓存。
- **按原规划重写**：交互验证完用 Flutter 按设计稿重写，同步层直接对接现有 `/api`。

三条路共用同一个后端和同一个数据库，不需要改服务端。

### 数据库与备份

- 数据文件：`./data/citywalk.db`（由 `DB_PATH` 指定），WAL 模式，单文件，容器重建不丢。
- 备份：直接复制该文件即可；建议每天定时 `cp` 到对象存储并保留多份。
- 限制：SQLite 是单机单文件，**不能起多个 api 副本共写**。流量上来后需换 PostgreSQL（表结构可平移，分享的 `owner_key` 等逻辑原样保留）。
- 生产启动会拒绝默认 `JWT_SECRET`；`CORS_ORIGINS` 要去掉 localhost。

## 功能状态

| 模块 | 状态 |
| --- | --- |
| 探索 / 城市 / 地点 | 已完成（20 个示例地点） |
| 创建行程与排程 | 已完成（锚点 + 片区聚类 + 贪心插入） |
| 行程编辑 | 已完成（换 / 跳 / 上移下移 / 换日 / 锁定 / 撤销） |
| 今天页 | 已完成 |
| 收藏 / 行程列表 | 已完成 |
| 地图底图 | 已完成（示意图 / 天地图双底图，可切换、失败自动降级） |
| 分享 | 已完成（服务端短链，可跨设备，可撤销） |
| 账号与多端同步 | 已完成（邮箱注册登录，本地优先 + 云端合并，冲突取较新） |
| 内容后台 | 未开始 |

## 已知限制

- 交通耗时是估算（直线 × 1.35 路网系数），未接入真实路径规划
- 天地图路径规划接口只支持驾车，不适用于市内步行场景
- 同步是"最后写入者胜"，没有逐字段合并；两台设备同时改同一份行程时，较旧的那份会被覆盖
- 前端未做邮箱验证与找回密码
- `node:sqlite` 是 Node 22 实验特性
- POI、营业时间、票价均为成都示例数据，未接入真实内容源
- 收藏、底图等本机设置未上云，换设备会丢；行程只有当前快照，没有版本历史与操作日志
- 没有原生 App，桌面端是手机框布局；SQLite 为单机单文件，不能起多个 api 副本共写
- 地图页审图号尚未正式标注，目前只有「底图 © 天地图」说明

## 版本

v0.1.0 · 2026.11
