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
node server/scripts/smoke.mjs        # 后端接口，22 项
node app/docs/walkthrough.mjs        # 前端主流程截图
node app/docs/share-remote-test.mjs  # 跨设备分享
node app/docs/auth-test.mjs         # 注册登录与云同步
```

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
- [ ] `CORS_ORIGINS` 改成正式域名，去掉 localhost
- [ ] 配 HTTPS（Caddy 或 nginx + certbot）
- [ ] 备份 `data/citywalk.db`（SQLite 单文件，直接复制即可）
- [ ] 天地图 key 的 Referer 白名单换成正式域名
- [ ] 地图页标注审图号

## 功能状态

| 模块 | 状态 |
| --- | --- |
| 探索 / 城市 / 地点 | 已完成（20 个示例地点） |
| 创建行程与排程 | 已完成（锚点 + 片区聚类 + 贪心插入） |
| 行程编辑 | 已完成（换 / 跳 / 上移下移 / 换日 / 锁定 / 撤销） |
| 今天页 | 已完成 |
| 收藏 / 行程列表 | 已完成 |
| 分享 | 已完成（服务端短链，可跨设备，可撤销） |
| 账号与多端同步 | 已完成（邮箱注册登录，本地优先 + 云端合并，冲突取较新） |
| 内容后台 | 未开始 |

## 已知限制

- 交通耗时是估算（直线 × 1.35 路网系数），未接入真实路径规划
- 天地图路径规划接口只支持驾车，不适用于市内步行场景
- 同步是"最后写入者胜"，没有逐字段合并；两台设备同时改同一份行程时，较旧的那份会被覆盖
- 前端未做邮箱验证与找回密码
- `node:sqlite` 是 Node 22 实验特性

## 版本

v0.1.0 · 2026.11
