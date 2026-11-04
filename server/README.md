# 后端服务

Fastify + `node:sqlite`，无原生依赖，单机可跑。

## 本地运行

```bash
cd server
npm install
npm run dev        # http://127.0.0.1:5179
node scripts/smoke.mjs   # 冒烟测试，22 项
```

数据库文件在 `data/citywalk.db`，首次启动自动建表。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | 5179 | 监听端口 |
| `HOST` | 127.0.0.1 | 生产容器里设 `0.0.0.0` |
| `DB_PATH` | `data/citywalk.db` | SQLite 文件路径 |
| `JWT_SECRET` | 开发默认值 | **生产必须设置**，否则启动直接报错 |
| `JWT_EXPIRES_IN` | 30d | 登录有效期 |
| `CORS_ORIGINS` | `http://127.0.0.1:5178,http://localhost:5178` | 前端来源白名单，逗号分隔 |
| `SHARE_TTL_DAYS` | 7 | 分享链接有效期 |
| `MAX_SHARE_BYTES` | 65536 | 单条分享体积上限 |
| `NODE_ENV` | - | `production` 时日志级别与安全校验生效 |

## 接口

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/health` | 否 | 健康检查 |
| POST | `/api/auth/register` | 否 | 注册，返回 JWT |
| POST | `/api/auth/login` | 否 | 登录，返回 JWT |
| GET | `/api/me` | 是 | 当前用户 |
| GET | `/api/trips` | 是 | 我的行程列表 |
| GET | `/api/trips/:id` | 是 | 单个行程 |
| PUT | `/api/trips/:id` | 是 | 幂等写入（upsert） |
| DELETE | `/api/trips/:id` | 是 | 删除行程，同时撤销其分享 |
| POST | `/api/shares` | 可选 | 创建分享；登录则绑定账号，未登录返回 `ownerKey` |
| GET | `/api/shares/:token` | 否 | 公开读取，撤销/过期返回 410 |
| DELETE | `/api/shares/:token` | 可选 | 撤销：登录用户校验归属，匿名用户校验 `ownerKey` |
| GET | `/api/shares` | 是 | 我创建过的分享 |

响应统一为 `{ ok: true, data }` 或 `{ ok: false, error }`。

## 数据表

- `users`：id / email / password_hash（scrypt）/ created_at
- `trips`：id / user_id / title / city / payload(JSON) / 时间戳
- `shares`：token / trip_id / user_id(可空) / owner_key / payload / expires_at / revoked / views

## 安全措施

- 密码用 scrypt + 随机盐，校验用 `timingSafeEqual`
- 登录、注册、分享创建、分享读取都有内存级限流
- 分享体积上限 64KB，行程上限 256KB
- 匿名分享用 `ownerKey` 撤销，`ownerKey` 只在创建时返回一次
- 生产环境未设置 `JWT_SECRET` 会直接拒绝启动

## 已知限制

- 限流是单进程内存计数，多实例部署需要换成 Redis
- `node:sqlite` 是 Node 22 的实验特性，启动需带 `--experimental-sqlite`
- 没有邮箱验证与找回密码
