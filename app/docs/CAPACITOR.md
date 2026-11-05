# 打包原生 App（Capacitor）

网页版本身已是 PWA，可「添加到主屏」离线使用；若需要真正的 Android APK / AAB（应用商店、桌面图标、独立 WebView），用本目录下的 Capacitor 工程。iOS 工程需在 macOS + Xcode 上生成。

原生壳复用同一套前端代码与同一个后端 `/api`，不需要改业务逻辑。

## 工程位置与配置

| 文件 | 说明 |
| --- | --- |
| `app/capacitor.config.json` | `appId=com.fengzi5422.citywalk`、`appName=城市自由行`、`webDir=dist` |
| `app/android/` | Android 原生工程（已入库，含 Gradle wrapper） |
| `app/android/app/src/main/assets/public/` | 由 `cap sync` 从 `dist` 复制的前端资源 |

关键适配（已改好，勿回退）：

- **Service Worker**：`src/main.tsx` 检测到 Capacitor 环境（全局 `window.Capacitor`）时跳过 SW 注册，避免 WebView 里的缓存妨碍版本更新；网页端 PWA 仍正常注册。
- **CORS**：`server/src/config.js` 默认白名单已含 `https://localhost`（Android WebView 默认 origin）与 `capacitor://localhost`（iOS）。若你在 `.env` 里自定义了 `CORS_ORIGINS`，需要手动把这两项加进去。
- **API 地址**：见下一节，这是打包时最容易漏的一步。

## 后端地址（重要）

Capacitor WebView 加载的是本地 `index.html`，origin 是 `https://localhost`，**相对路径 `/api` 不会指向你的服务器**。所以打包前必须用 `VITE_API_BASE` 注入后端公网地址：

```bash
cd app
VITE_API_BASE=https://api.example.com npm run build   # 不含尾部斜杠
npx cap sync android
```

- 不设置 `VITE_API_BASE` 时，App 仍可离线使用（行程、收藏、历史都存在本机），但登录 / 云同步 / 分享短链不可用。
- 正式后端建议 HTTPS；服务器部署见根目录 `DEPLOY.md`。若后端与网页同源，原生 App 仍要填绝对地址（因为 WebView 不共享该域名）。
- 后端 `CORS_ORIGINS` 必须允许 `https://localhost`（Android）与 `capacitor://localhost`（iOS）。
- **仅公网 IP / HTTP 部署**：仓库已为这种场景在 `capacitor.config.json` 设 `android.allowMixedContent: true`，并在 `AndroidManifest.xml` 的 `<application>` 设 `android:usesCleartextTraffic="true"`。前者允许 `https://localhost` 页面请求 `http://` 接口（否则 WebView 按 mixed content 拦截），后者允许 Android 发起明文 HTTP（否则 targetSdk 28+ 直接拒绝）。**配好 HTTPS、把 `VITE_API_BASE` 换成 https 后，建议把这两项移除**，避免长期降低安全性；iOS 如需 HTTP 还要另配 ATS。

## 环境要求

| 项 | 版本 | 本机位置（示例） |
| --- | --- | --- |
| Node | 22.5+ | 已装 22.22.2 |
| JDK | 17+（工程按 21 编译） | `D:/software/JDK` 或 Android Studio 自带 `jbr` |
| Android SDK | platform 36 / build-tools 36 | `D:/software/andriod_data/sdk` |
| Gradle | wrapper 自动下载 8.14.3 | `app/android/gradlew` |

## 构建 Debug APK

**已在本机验证通过**：JDK 21 + Android SDK 36 + Gradle 8.13，`BUILD SUCCESSFUL`，产物约 4.4MB，包内含 `index.html`、JS/CSS、manifest 与 SW。

```bash
cd app
npm run build && npx cap sync android
cd android
JAVA_HOME="D:/software/JDK" \
ANDROID_HOME="D:/software/andriod_data/sdk" \
ANDROID_SDK_ROOT="D:/software/andriod_data/sdk" \
./gradlew assembleDebug --no-daemon
```

> wrapper 已把发行版改为 `bin` 包、并把 `networkTimeout` 调到 120s，降低首次下载超时的概率。若所在网络仍无法访问 `services.gradle.org`，可直接调用已缓存的 Gradle 绕过 wrapper：
>
> ```bash
> "<GRADLE_USER_HOME>/wrapper/dists/gradle-8.13-bin/5xuhj0ry160q40clulazy9h7d/gradle-8.13/bin/gradle" assembleDebug --no-daemon
> ```
>
> 本机 Gradle 缓存与工程都在 D 盘，无需在 C 盘安装任何额外环境。构建前请确保构建盘有数 GB 可用空间（首次解压发行版与依赖约需 1–2GB）。

产物：`app/android/app/build/outputs/apk/debug/app-debug.apk`；交付副本放在 `app/release/`（APK 不入库）。

启动图标由 `tools/gen-icons.py` 生成（`python tools/gen-icons.py` 会同时刷新 PWA 图标与 Android 五档密度的 `ic_launcher` / `ic_launcher_round` / 自适应前景层），背景色在 `res/values/ic_launcher_background.xml`。

安装到手机 / 模拟器：

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

> Windows 也可用 Android Studio 打开 `app/android` 目录，点 Run 直接装到设备。

## 发布正式包

1. 生成签名密钥（**不要入库**，`.gitignore` 已排除 `*.keystore` / `*.jks`）：
   ```bash
   keytool -genkey -v -keystore citywalk-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias citywalk
   ```
2. 在 `app/android/app/build.gradle` 配 `signingConfigs` 与 `buildTypes.release`。
3. 构建：
   ```bash
   ./gradlew assembleRelease      # APK
   ./gradlew bundleRelease        # AAB（Google Play 推荐）
   ```
4. 上架前把 `app/src/data/places.json` 换成真实 POI，填好 `VITE_TIANDITU_TK` / `VITE_TIANDITU_AUDIT_NO`，并确认隐私政策与权限说明（本应用只申请 `INTERNET`，不请求定位）。

## iOS

需在 macOS + Xcode 环境：

```bash
cd app
npm install @capacitor/ios@8.6.0
npx cap add ios
npx cap sync ios
npx cap open ios     # 在 Xcode 里配置签名并归档
```

## 已知限制

- Debug APK 使用调试签名，仅用于自测与分发，不能上架。
- 原生壳没有接入推送、相机、定位等原生能力（产品也不需要）；地图瓦片与登录同步需要网络。
- 前端内容随 APK 打包，更新前端需重新构建并发布新版本；行程数据存本机，升级 APK 不会丢失。
- `*.apk` / `*.aab` 与签名文件都不入库，交付时单独提供产物文件。
