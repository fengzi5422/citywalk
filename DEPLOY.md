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

| 变量 | 生效时机 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | 后端运行期 | 32+ 字符随机值，`deploy.sh` 会校验；只由后端使用 |
| `CORS_ORIGINS` | 后端运行期 | 跨域白名单，精确匹配 Origin；纯网页同源可留默认 |
| `VITE_API_BASE` | **前端构建期** | 留空 = 同源 `/api`；混合部署填网页自己的 https 域名 |
| `VITE_TIANDITU_TK` | **前端构建期** | 浏览器端 key，受 Referer 白名单限制 |
| `VITE_TIANDITU_AUDIT_NO` | **前端构建期** | 天地图公示的审图号，网页与 App 填同一个 |
| `SHARE_TTL_DAYS` | 后端运行期 | 分享链接有效期，默认 7 |

> `VITE_*` 是 Vite **构建时**写进 JS 的常量，不是运行期配置：改了必须重新 `npm run build`（Compose 部署时重跑 `deploy.sh`），原生 App 还要 `npx cap sync android` 后重新打 APK。一份 `dist` / 一个 APK 只能有一个值。

### 网页 + App 混合部署怎么填

后端在服务器、前端既有浏览器又有原生 App 时，推荐**一份前端产物通吃两端**——把 `VITE_API_BASE` 填成「网页自己的域名」，而不是单独的 api 子域：

```bash
# 假设网页与 /api 都在 https://citywalk.example.com（nginx 把 /api 反代到 api 容器）
JWT_SECRET=<openssl rand -hex 32 的输出>
CORS_ORIGINS=https://citywalk.example.com,https://localhost,capacitor://localhost
VITE_API_BASE=https://citywalk.example.com
VITE_TIANDITU_TK=<浏览器端 key，白名单填 citywalk.example.com>
VITE_TIANDITU_AUDIT_NO=<天地图官网公示的审图号>
SHARE_TTL_DAYS=7
```

| 前端 | 请求链路 | 是否跨域 |
| --- | --- | --- |
| 浏览器 | `https://citywalk.example.com/api/...` → nginx → `api:5179` | 同源，不触发 CORS |
| Android App（origin `https://localhost`） | 同一绝对地址 → nginx → `api:5179` | 跨域，白名单需含 `https://localhost` |
| iOS App（origin `capacitor://localhost`） | 同上 | 跨域，白名单需含 `capacitor://localhost` |

要点：

- **App 必须 HTTPS**。Android 高版本默认禁止明文 HTTP，直接用 `http://123.57.92.56:8080` 会连不上；先把域名解析到该 IP，用 Caddy 或 nginx + certbot 配证书。
- **照抄模板里的 `CORS_ORIGINS=http://localhost:8080` 会让 App 返回 403**（后端按 Origin 精确匹配）。务必换成上表三个来源，不带路径、不带尾部斜杠。
- 若坚持让网页端留空 `VITE_API_BASE` 走同源反代，App 就必须单独构建一份注入绝对地址的产物，需维护两份 dist；不推荐。
- `JWT_SECRET` 只在后端，任何 `VITE_*` 里都不要放密钥（会被打进前端 JS，任何人可读）。

### 地图相关变量（网页与 App 的差异）

`VITE_TIANDITU_AUDIT_NO` 填天地图官网公示的审图号（形如 `GS(2025)xxxx号`）。网页与 App 展示的是同一份天地图底图，**填同一个值、没有平台区别**；地图角标与说明段由同一个组件渲染，两端都会显著标注来源与审图号。需要注意的是：按自然资源部与工信部关于规范 App 登载使用地图行为的通知，App 主办者除标注审图号外，还可能需履行地图审核程序与 ICP 备案，应用商店上架时常要求提供相关材料——这是**上线流程**的差异，不是变量值的差异。自有「示意图」不加载第三方瓦片，标注为「示意图 · 自有示例数据」。

`VITE_TIANDITU_TK` 才是真正有平台差异的一项：天地图 key 分浏览器端（校验 Referer 域名）、移动端（校验应用 ID / 包名与签名）、服务端（校验 IP 白名单）。本项目在 WebView 里直接拼 WMTS 瓦片 URL，浏览器端 key 在原生 App 里可能因 Referer 不匹配返回 403。可选做法：

1. **最省事**：App 端不注入 key，用离线示意图底图（默认降级，功能不受影响，也不涉及第三方瓦片标注）。
2. 在「我的 → 地图底图」里为 App 单独填入实测可用的 key（key 只存本机，不进备份文件）。
3. 由后端代理瓦片请求（服务端 key + 服务器 IP 白名单），网页与 App 都走自己的域名——需额外开发。

正式上线前请在天地图控制台按实际客户端类型分别建应用并实测，不要混用 key。

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

## 只有公网 IP、没有域名（阿里云 ECS）

适用：只有一个公网 IP（如 `123.57.92.56`），**没有域名**，要让任意浏览器和任意 App 从公网访问。统一用 `http://IP:8080` 作为唯一入口。

### 1. 放行端口（必做，最常漏）

- **阿里云控制台 → 安全组 → 入方向**：放行 TCP `8080`，来源 `0.0.0.0/0`（别只放行自己 IP）。
- **服务器系统防火墙**：
  ```bash
  # Ubuntu/Debian
  ufw allow 8080/tcp && ufw reload
  # CentOS / Alibaba Cloud Linux
  firewall-cmd --add-port=8080/tcp --permanent && firewall-cmd --reload
  ```
- Compose 里 `web` 已是 `"8080:80"`（监听所有网卡）；`api` 只绑 `127.0.0.1:5179`，不直接暴露，保持不动。

从**另一台机器或手机流量**验证，不要只在服务器上测：

```bash
curl http://123.57.92.56:8080/api/health
# 浏览器打开 http://123.57.92.56:8080
```

### 2. `.env`（IP 版，可直接抄）

```bash
JWT_SECRET=<openssl rand -hex 32 的输出>
CORS_ORIGINS=http://123.57.92.56:8080,https://localhost,http://localhost,capacitor://localhost
VITE_API_BASE=http://123.57.92.56:8080
VITE_TIANDITU_TK=
VITE_TIANDITU_AUDIT_NO=
SHARE_TTL_DAYS=7
```

`VITE_API_BASE` 填**网页自己的地址**：从 `http://123.57.92.56:8080` 打开的网页请求同地址 `/api` 仍算同源、不触发 CORS；App WebView 跨域直连，白名单里三个 App origin 已列出。一份 `dist` / 一个 APK 两端通用。

> 若网页端不在同一地址（前端放 CDN、或多人各自托管网页），来源无法枚举，把 `CORS_ORIGINS` 改成 `*`。本项目用 `Authorization` 头而非 cookie，通配不会泄露凭证，但接口会向任意站点开放。

### 3. App 端的两个明文开关（仓库已配好）

Android targetSdk 28+ 默认禁明文 HTTP，且 `https://localhost` 页面请求 `http://` 会被 mixed content 拦截。仓库已为此打开：

| 位置 | 配置 | 作用 |
| --- | --- | --- |
| `app/capacitor.config.json` | `android.allowMixedContent: true` | WebView 允许混合内容 |
| `app/android/app/src/main/AndroidManifest.xml` | `android:usesCleartextTraffic="true"` | 允许明文 HTTP |

改完必须 `npx cap sync android` 并**重打 APK**（配置写进包里，旧 APK 不会自动生效）。iOS 走 HTTP 还需另配 ATS，当前仓库未生成 iOS 工程。

### 4. 只部署后端、不跑前端容器

若服务器上只想要后端 API，在**服务器本地**把 `docker-compose.yml` 中 `api` 的 `"127.0.0.1:5179:5179"` 改成 `"5179:5179"`，并在安全组放行 5179；前端统一填 `VITE_API_BASE=http://123.57.92.56:5179`、`CORS_ORIGINS=*`。这会把后端直接暴露到公网、少了 nginx 这层，仅建议临时联调使用。

### 5. 风险与升级路径

- **明文 HTTP 的风险**：JWT 与行程内容不加密，公共 Wi-Fi 下可被嗅探，也没有服务端身份校验。适合原型、内测、可信网络；**正式公开服务强烈建议 HTTPS**。
- 大陆地域阿里云 ECS 用未备案域名访问 80/443 会被拦截，但 `IP:8080` 这类非标准端口通常不受影响；Let's Encrypt 的 HTTP-01 挑战需要 80 端口公网可达，在未备案大陆机器上可能签发失败。
- 无域名也能拿 HTTPS：① 申请一个便宜域名解析到该 IP，用 Caddy 自动签证书（推荐）；② 用 `sslip.io` / `nip.io` 泛解析域名（如 `123-57-92-56.sslip.io`）试 Let's Encrypt，但依赖公共服务可用性。
- 换成 HTTPS 后：把 `VITE_API_BASE` 改成 `https://...`、`CORS_ORIGINS` 换成对应来源，移除上面两个 Android 明文开关，重新 build / 打包。

### 常见问题补充

| 现象 | 排查 |
| --- | --- |
| 服务器本机 curl 通、外网打不开 | 阿里云安全组放行 8080，再查系统防火墙 |
| 浏览器能开、App 登录/同步失败 | 白名单缺 `https://localhost` / `capacitor://localhost`；或装的是旧 APK，未重打 |
| App 提示网络错误、连不上 | `usesCleartextTraffic` 或 `allowMixedContent` 未生效；确认用的是本版 APK |
| 换 IP 后所有端失效 | `VITE_API_BASE` 是构建期常量，IP 变了要重新 build + 重打 APK；这也是尽早换域名的原因 |

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
