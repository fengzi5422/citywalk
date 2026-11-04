# 从 GitHub 部署到云服务器

本文面向「在服务器上把仓库 clone 下来直接跑起来」的场景。仓库已包含**完整后端**（`server/`：Fastify + `node:sqlite`，含 `package-lock.json`）、前端构建（`app/`）、`docker-compose.yml`、两个 Dockerfile、nginx 配置与运维脚本，服务器上不需要本地重新打包，也不需要单独上传后端代码。

本次目标服务器：`zz@123.57.92.56`（以下操作均在该服务器上执行；本地只负责把代码推到 GitHub）。

## 前置条件

- Linux 服务器，安装 Docker 与 Docker Compose 插件：`docker compose version` 可执行
- 已安装 git
- 开放 8080 端口（或自行修改 `docker-compose.yml` 的端口映射）
- 建议绑定域名并配置 HTTPS，见文末

## 首次部署

```bash
# 1. 登录服务器
ssh zz@123.57.92.56

# 2. 安装 Docker（若未安装，Ubuntu/Debian 示例）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# 3. 从 GitHub 拉取。用 HTTPS 即可，服务器无需配置 GitHub SSH key
git clone https://github.com/fengzi5422/citywalk.git
cd citywalk

# 4. 生成配置
cp .env.example .env
openssl rand -hex 32        # 复制输出，填到 .env 的 JWT_SECRET
vi .env                     # 按需填写下面表格中的项
```

`.env` 关键项：

| 变量 | 同源部署取值 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | **必填** | 32+ 字符随机值；`deploy.sh` 会校验，生产环境拒绝默认密钥 |
| `CORS_ORIGINS` | 保持默认 | 同源部署时浏览器不触发跨域，只有前后端分离才改成前端域名 |
| `VITE_API_BASE` | 留空 | 留空走 nginx 反代 `/api`；仅前后端分离时填后端地址 |
| `VITE_TIANDITU_TK` | 可选 | 浏览器端 key；需在天地图控制台把正式域名加入 Referer 白名单 |
| `VITE_TIANDITU_AUDIT_NO` | 正式发布必填 | 真实审图号；留空时地图页会明确提示，不会编造编号 |
| `SHARE_TTL_DAYS` | `7` | 分享链接有效期（天） |

```bash
# 5. 一键构建 + 启动 + 健康检查
bash scripts/deploy.sh
```

成功时输出 `✓ 部署完成：http://127.0.0.1:8080` 并打印健康检查 JSON。浏览器访问 `http://123.57.92.56:8080`（或你的域名）。

> `.env`、`data/`、`backups/` 都被 `.gitignore` 排除，不会进版本库；`git pull` 也不会覆盖它们。

## 验证

```bash
curl http://127.0.0.1:8080/api/health    # {"ok":true,"data":{"version":"0.9.0",...}}
docker compose ps                         # api 与 web 均为 Up
docker compose logs --tail=50 api         # 后端日志
```

网页端：打开首页 → 「我的 → 条款与说明」确认合规文本；地图页未配 key 时自动使用离线示意图，功能不受影响。

## 升级

```bash
cd citywalk
git pull
bash scripts/deploy.sh       # 重新构建镜像并启动，./data 数据卷不丢
```

## 备份与恢复

```bash
bash scripts/backup.sh                                    # backups/citywalk-YYYYmmdd-HHMMSS.db，保留最近 14 份
bash scripts/restore.sh backups/citywalk-20261104-193000.db
```

建议加入 crontab 并定期把 `backups/` 同步到对象存储：

```
0 3 * * * cd /root/citywalk && bash scripts/backup.sh >> backups/cron.log 2>&1
```

## 只跑后端（已有自己的前端托管时）

```bash
cd server
npm ci --omit=dev
NODE_ENV=production JWT_SECRET=<32+字符> HOST=0.0.0.0 PORT=5179 \
  DB_PATH=/var/lib/citywalk.db node --experimental-sqlite src/index.js
```

需要 Node 22.5+（`node:sqlite`），并自行用 systemd / pm2 托管、按需配置 `CORS_ORIGINS`。此模式下前端需通过 `VITE_API_BASE=https://api.example.com npm run build` 指向后端地址。

## 上线后建议

- 用域名 + HTTPS（Caddy 或 nginx + certbot）把 8080 反代到 443；JWT 走明文 HTTP 有泄露风险
- 防火墙只放行 80 / 443；`api` 容器已只监听 `127.0.0.1:5179`，不对外暴露
- 天地图 key 的 Referer 白名单换成正式域名，并填入真实审图号
- 把 `app/src/data/places.json` 换成真实 POI 后重跑 `bash scripts/deploy.sh`
- 单机 SQLite 不能起多个 `api` 副本共写；流量上来后需迁移 PostgreSQL

## 常见问题

| 现象 | 排查 |
| --- | --- |
| `deploy.sh` 提示 JWT_SECRET 未设置 | `.env` 填入 `openssl rand -hex 32` 的输出，不要带引号或空格 |
| `/api/health` 返回 502 | `docker compose logs api`；确认 api 容器 Up，nginx 反代目标为 `api:5179`（已配好） |
| 地图空白 | 未配 key 时用示意图；配了 key 检查 Referer 白名单与配额 |
| 升级后页面没变化 | `deploy.sh` 会重新 build；浏览器强刷或清除站点数据（SW 缓存） |
| `Permission denied` 执行脚本 | 用 `bash scripts/deploy.sh`；脚本在仓库中已带可执行位 |
| 数据库需要回滚 | `bash scripts/restore.sh <备份文件>`，脚本会停 api → 覆盖 → 重启 → 健康检查 |
