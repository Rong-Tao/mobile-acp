# mobile-acp  &nbsp; [English](README.md)

**手机上的 SSH Zed。** 通过 SSH 连接任意服务器，在手机上运行编程 Agent（Claude Code、Codex、Gemini CLI）——服务器端无需额外安装任何东西，只要有 sshd 即可。

<p align="center">
  <img src="docs/screens.svg" alt="应用截图" width="720" />
</p>

---

## 功能

- **30 秒配对服务器** — 服务器端跑一条命令，扫二维码，完成。App 在设备上生成 Ed25519 密钥对，自动将公钥追加到 `~/.ssh/authorized_keys`。
- **运行编程 Agent** — 通过 SSH 启动 Claude Code（或任何 ACP 兼容 Agent），实时流式输出思考过程、工具调用、授权弹窗。
- **文件浏览 & Git** — 真实的目录树和 `git status`/`diff`/`commit`，复用同一条 SSH 连接，无需额外守护进程。
- **服务器零部署** — 服务器只需 `sshd` 和你想用的 Agent（`npx`、`claude` 等）。

## 架构

```
┌──────────────────── Android App ────────────────────────┐
│  HomeScreen（服务器列表 + QR 配对）                      │
│  MainShell                                              │
│   AgentTab ──── LiveSession ──── AgentClient ───────┐   │
│   GitTab   ──── exec()      ──── SshTransport ─────►│   │
│   FilesTab ──── exec()      ──────────────────────  │   │
│                                                         │
│  SshTransport（Kotlin/JSch 原生模块）                    │
└─────────────────────────────────────────────────────────┘
                 │ SSH（Ed25519，Android Keystore）
┌────────────────▼──────────── 服务器 ────────────────────┐
│  sshd（唯一要求）                                        │
│  agent: npx @agentclientprotocol/claude-agent-acp       │
│  git, ls, cat（供 Git/Files 标签页使用）                 │
└─────────────────────────────────────────────────────────┘
```

**协议**：[Agent Client Protocol (ACP)](https://agentclientprotocol.com) — JSON-RPC over stdio，通过 SSH spawn。

## 配对服务器

在服务器端运行（需要 Node ≥ 18 和 curl）：

```sh
curl -fsSL https://raw.githubusercontent.com/Rong-Tao/mobile-acp/main/server/install.sh | bash
```

终端会显示二维码。打开 App → **添加服务器 → 扫描二维码**。App 生成 Ed25519 密钥对，将公钥 POST 到一个有效期 5 分钟的临时 HTTP 服务器，并自动测试 SSH 连接——一键完成。

<p align="center">
  <img src="docs/pairing.svg" alt="配对流程" width="560" />
</p>

> **再次配对：** `install.sh` 会把 `setup.mjs` 缓存到 `~/.local/share/mobile-acp-setup/`，之后运行不需要重新下载。

## 当前状态

| 组件 | 状态 |
|---|---|
| SSH 传输（JSch 原生模块） | ✅ |
| Ed25519 密钥生成（Android Keystore） | ✅ |
| QR 配对流程（摄像头 + 服务器 CLI） | ✅ |
| ACP Agent 会话（流式输出、工具调用、授权弹窗） | ✅ |
| Git 标签页（status、diff、commit） | ✅ |
| Files 标签页（目录树、懒加载、文件预览） | ✅ |
| 服务器列表持久化（AsyncStorage） | ✅ |
| GitHub Actions APK 构建 | ✅ |
| SSH 密钥手动导入 | ✅ |
| iOS 原生 SSH 传输 | ❌ 未开始 |
| 会话恢复 / 历史列表 | ❌ 未开始 |

## 构建

### APK（推荐：GitHub Actions）

每次 push 到 `main` 自动触发构建。从 **Actions → Build APK → Artifacts** 下载 APK。

发布版本：
```sh
git tag v0.x.0 && git push origin v0.x.0
```
APK 会出现在 GitHub Release 资产中。

### 本地构建（需要 Android SDK + JDK 17）

```sh
npm install
npx expo run:android
```

## 开发

```sh
npm install
node bridge/server.mjs          # 在 :8790 启动开发用 WebSocket 桥接
npx expo start --web            # 或 Expo Go
```

开发桥接让 Web/Expo Go 客户端无需原生 SSH 即可与本地 Agent 通信。

## 技术栈

- **React Native 0.76** / Expo 52
- **ACP SDK** `@agentclientprotocol/sdk` — JSON-RPC Agent 协议
- **JSch** 通过自定义 Expo Module（Kotlin）实现 SSH
- **expo-camera** 用于扫描二维码
- **expo-secure-store** / Android Keystore 存储私钥

## 仓库结构

```
src/
  core/          Transport, LiveSession, AgentClient, SessionStore, servers
  screens/       HomeScreen（服务器列表 + 配对）, MainShell, ServerDetail
  tabs/          AgentTab, LiveAgentTab, GitTab, FilesTab
  components/    Icon, CodeBlock, Primitives（Press, Btn, Sheet, …）
modules/
  ssh-transport/ Expo Module — Kotlin/JSch SSH 原生实现
bridge/          开发用 WebSocket 桥接（Node.js）
server/          服务器端配对 CLI（install.sh + setup.mjs）
android/         Android 原生工程
docs/            SVG 示意图
```
