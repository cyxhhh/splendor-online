# 璀璨宝石本地与联机版

## 启动联机服务

在项目目录执行：

```powershell
npm.cmd start
```

默认服务地址：`http://localhost:8787`。同一局域网的玩家需要在浏览器打开主机的局域网地址，例如 `http://192.168.1.20:8787`。主机可以在 Windows 防火墙提示时允许 Node.js 通过专用网络访问。

## 创建/加入房间

1. 打开页面，切换到“联网对战”。
2. 输入名字，创建房间并把 6 位房间码发给其他玩家。
3. 其他玩家输入同一个房间码加入。房主点击开始。
4. 房间上限支持 2–4 人；进行中的房间可在连接短暂中断后自动重连。

页面用 WebSocket 同步回合状态。直接双击 `index.html` 时只适用于本机连接；局域网玩家应使用上面的 HTTP 地址打开页面。跨互联网游玩需要把此服务部署到可访问的服务器，并通过 HTTPS/WSS 提供页面和连接。

## 配置

- `PORT`：监听端口，默认 `8787`
- `HOST`：监听地址，默认 `0.0.0.0`


## 公网联网对战（Render）

项目已包含 `Dockerfile` 与 `render.yaml`，可部署为带 HTTPS/WSS 的公网服务：

1. 将项目推送到你的 GitHub 仓库（不要提交 `.jdk21`、`.gradle`、`node_modules`、APK 等本机生成目录）。
2. 在 Render 控制台创建 Blueprint 并连接该仓库，Render 会读取 `render.yaml` 自动构建。
3. 部署完成后复制 Render 给出的 `https://<服务名>.onrender.com` 地址。
4. 在 APK 的“联网对战”里把这个地址填入服务器地址栏。客户端会自动改用 `wss://` 建立加密 WebSocket 连接。

当前配置使用 Render Free 方案，适合先验证公网对局。Free 服务空闲 15 分钟后会休眠，唤醒通常需要约一分钟；活动中的连接通过 WebSocket 心跳保持。房间和对局状态目前保存在单个服务进程内，服务重启/重新部署会清空房间；要长期稳定运营，下一步需采用常驻实例并把房间状态持久化或迁入共享存储。
## Android App

Android Studio is not required to build the debug APK if Java 21 and Android SDK are installed. From PowerShell in the project folder:

```powershell
$env:JAVA_HOME="$PWD\.jdk21\jdk-21.0.12.1+1"
$env:ANDROID_HOME="E:\android_toolchain\sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:GRADLE_USER_HOME="$PWD\.gradle"
.\android\gradlew.bat -p android assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`. The app opens full screen in landscape. To use online play, start the Node room server on a reachable computer, choose online play in the app, and enter its LAN or public address (for example `http://192.168.1.20:8787`). Cross-network play still needs a publicly reachable server.



