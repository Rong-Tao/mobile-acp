# Development Progress

## v0.1.12 — 2026-10-09

**去 mock 化：所有界面接真实数据**
- ServerDetail Projects：真实 SSH 扫描/浏览远端目录，`git` 真实分支 + dirty 数，按 server 持久化（AsyncStorage）；长按移除；"Scan repos" 扫 home 下 git 仓库
- ServerDetail Agents：`command -v` 真实探测 claude/codex/gemini + 版本；Install 走真实 `npm i -g` spawn 流式输出（原来是假动画）
- ServerDetail 顶部 Online/Offline 为真实连接状态，失败可点重试；连接结果回写 HomeScreen 的 online/last
- MainShell：删掉假 threads 列表/假搜索/假 reconnect；agent picker 切换会真实重启会话；连接状态来自 live.status
- Agent tab 无会话时显示真实状态面板（connecting/error+retry），不再渲染假对话
- Git/Files tab 断线时显示空状态而非 mock 数据；手动添加服务器在无 SSH 模块平台上"测试连接"如实报错（原来假装成功）
- `src/data/mock.ts` 删除 → `src/data/types.ts`（纯类型）；原型 AgentTab 删除，共享视觉组件拆到 `components/AgentBits.tsx`
- 新增 `src/core/remote.ts`（statProjects/listDirs/scanGitRepos/detectAgents，shell 转义安全）+ `test/remote.test.ts`：7 个测试对真实 bridge/git/文件系统全过

**已知残留**
- e2e.test.ts 两例在本 dev VM 上因 OAuth token 与运行中的 Claude Code 冲突而失败（HEAD 基线同样失败，环境问题）
- SSH 断线重连/keepalive 仍未做（手动 Retry 已有）

## v0.1.0 — 2026-06-12

### 已完成

**核心功能**
- SSH 传输层（JSch Kotlin Expo Module）：connect/exec/spawn/disconnect，密码和私钥两种认证
- Ed25519 密钥对生成（JSch `KeyPair.genKeyPair`）
- QR 配对流程：服务器跑 `install.sh` 显示二维码 → App 扫码 → 生成密钥 → POST 公钥 → 测试连接 → 保存
- ACP Agent 会话（JSON-RPC over SSH stdio）：streaming 思考、工具调用、权限弹窗
- Git 标签页：`git status --porcelain` / `git diff --numstat` / 统一 diff 展示 / commit
- Files 标签页：`ls -la` 懒加载目录树、cat 预览文件
- 服务器列表持久化（AsyncStorage）
- 手动添加服务器（keystore / PEM 粘贴 / 密码）
- GitHub Actions CI：每次 push 自动打 APK，打 tag 发 Release

**服务器端工具**
- `server/install.sh`：真正可用的 `curl | bash` one-liner
  - 检查 Node ≥ 18
  - 缓存到 `~/.local/share/mobile-acp-setup/`，重复运行不重下载
  - `</dev/tty` 解决 stdin 问题
- `server/setup.mjs`：本地 HTTP server（5 min）+ 二维码 + token 验证 + 追加 authorized_keys

**已知 Android build 坑（已修）**
- `expo-splash-screen` 版本必须用 `~0.29.24`（SDK 52），`^56.x` 是 SDK 56 的包会引入 `expo-module-gradle-plugin` 导致 build 失败
- 自定义 Expo Module 的 `build.gradle` 用 `ExpoModulesCorePlugin.gradle` 老式写法，不能用新的 `expo-module-gradle-plugin`
- AGP 8.6 中 `components.release` 懒加载，需要 `findByName` null 检查（CI patch）
- Kotlin 版本：classpath 必须显式写 `"...:${kotlinVersion}"` 否则被 RN 0.76.3 的 version catalog 降到 1.9.24，Compose Compiler 1.5.15 要求 1.9.25
- `Module.onDestroy()` 不存在，用 `OnDestroy { }` DSL block

---

## 待做

**近期**
- [ ] 测试 QR 配对全流程（真机）
- [ ] SSH 连接稳定性：重连、keepalive、断线检测
- [ ] AgentTab UI 打磨：permission prompt 对话框、tool call 折叠

**中期**
- [ ] 会话历史 / thread 列表
- [ ] 多服务器切换时保持 session
- [ ] iOS 支持（需要 SwiftSH 或类似库替换 JSch）

**暂不做**
- App Store 上架（需要签名配置，目前 debug keystore）
- EAS Build（需要 Expo 账号）
