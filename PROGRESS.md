# Development Progress

> 本地调试细节(私有服务器、测试链路搭建)见 `NOTES.local.md`(gitignored,不入库)。

## 未发布(working tree)— 2026-10-09 (第三批)

**连接健康 + 状态真实化:**
- **心跳与超时**(live-context):每 15s exec('true') 心跳(10s 超时),所有 exec 带 25s 超时——
  SSH 静默死掉不再表现为"绿点还亮着但 Files 空白永久转圈"
- **自动重连**:判死 → 1.5s 后重建连接(persist agent + lastThreadId 让重连近乎无感);
  连接失败 15s 自动重试,也可点头部状态/Retry 手动触发;重连后 exec 引用更新,Files/Git 自动重取
- **头部状态文字化**(替代会说谎的小绿点):initing(黄)/connected(绿)/working(青,带 spinner)/
  reconnecting(黄)/lost connection(红,可点击立即重连)
- **去掉 agent 小三角**:thread 的 agent 定了不换;agent 选择挪到 Threads 面板(New thread 下方 chips)
- 冒烟 `uitest/resilience.mjs` 8/8:杀 bridge → 状态如实降级 → 重启 bridge → 自动恢复 +
  Files 自动回来 + working 状态;threads2 8/8、原 ui 15/15 无回归

## 2026-10-09 (第二批,已发 v0.1.19;v0.1.20 修键盘遮挡)

**会话持久化 + 后台通知:**
- **持久化 agent 进程**(`src/core/persist.ts`):spawn 包装为 setsid 脱离 + FIFO stdin(0<> 自持写端
  永不 EOF)+ stdout 追加 log;SSH 断了(锁屏/冻结/app 被杀)turn 在服务器上照常跑完;
  重连复用同一进程,tail 从文件末尾接流 + 二次 initialize + session/load 续上。
  服务器只需 POSIX sh/mkfifo/setsid,缺了自动回退普通 spawn。dispose 只断通道不杀 agent
- 已知取舍:adapter 进程常驻服务器按 (agent,project) 累积(谁先用谁复用);adapter 崩溃时
  client 只见静默(stderr 进 err.log);cat>FIFO 必须前台(后台 job stdin 被 sh 重定向 /dev/null)
- **后台本地通知**(`src/core/notify.ts`, expo-notifications):app 不在前台时,turn 完成/
  agent 等权限会弹通知;前台与 web 一律 no-op;app 被系统冻结后 JS 停摆通知发不出——
  靠持久化兜底(回来 session/load 全在)。真机验证待 APK
- 验证:`gcp-acp.manual.test.ts` 新增 persist 用例(真实 SSH:断连 10s→服务器继续 55s 跑完
  →重连回放含 marker)✓;UI 冒烟 8/8(persist 开启下全部复测)✓;tsc/核心测试 ✓

## 2026-10-09 (第一批,已发 v0.1.18)

**Agent/Thread 分层 + 会话配置:**
- 核心重构:`LiveAgent`(一个 agent 进程)与 `LiveSession`(其上的一个 thread/ACP session)分层;
  通知/权限请求按 sessionId 路由到各自 SessionStore,多 thread 互不干扰
- **Threads 独立 tab**(Agent | Threads | Files | Git 四栏):`session/list` 按当前 project cwd 过滤,
  标题+相对时间+当前高亮;点历史 thread 走 `session/load` 全量回放并跳回 Agent;New thread 在面板顶部,
  header 的 "+" 也可快捷新建;agent 进程全程不重启
- **自动续上最近 thread**:lastThreadId 持久化,重进项目/app 冷启动直接恢复上次聊天(失败则静默新开)
- **Mode/Model/Effort chips**(composer 左下):来自 ACP `configOptions`(claude adapter 提供
  mode/model/effort 三个 select),通用选单渲染,`session/set_config_option` 生效;
  busy 时同样可切;没有 configOptions 的 agent(gemini/codex)退回 legacy mode picker
- **配置持久化**:按 (agent, project) 存 AsyncStorage(`src/core/agent-prefs.ts`),
  新 thread/app 重启自动恢复;历史 thread 保留它自己存的配置不被覆盖
- 验证:tsc ✓,remote/polyfill 9 测试 ✓,原 UI 冒烟 15/15 ✓,新冒烟 8/8
  (4 tabs/chips/面板列表/回放跳转/冷启动续上/新 thread 恢复 prefs);截图在 `uitest/shots/`(gitignored);
  e2e 仍是已知的 2 例 OAuth 环境失败
- **真实 SSH 验证**(远端测试服务器):`test/gcp-acp.manual.test.ts` 扩充 thread 全生命周期——
  新建→真实 prompt→session/list 含新 thread→开第二个 thread(store 隔离)→切回(内存复用)→
  杀进程重连后 session/load 冷回放,2/2 过;UI 版冒烟(exec/agent 跑在远端,`uitest/gcp-threads.mjs`)
  4/4 过:真实对话→Threads 面板列出远端历史→切历史 thread 回放→列表刷新 Current 正确

## v0.1.13 – v0.1.17 — 2026-10-09

**真机/真实服务器联调中修掉的 5 个 bug:**

| 版本 | 修复 |
|---|---|
| v0.1.13 | ServerDetail 无限渲染循环导致整屏卡死(exec 每次渲染新引用,effect 依赖它反复触发);Scan repos 按钮被两个 `full` 宽度按钮挤出屏幕 |
| v0.1.14 | `loadCredential` 在无 SecureStore 的平台 throw,连接被误判 Offline、MainShell 卡 loading |
| v0.1.15 | **Hermes 没有 Web Streams API**,ACP 客户端一启动就 `ReferenceError: ReadableStream`——入口注入 polyfill(`src/polyfills.ts`);Files/Git 的 exec 与 agent 会话解耦(agent 挂了文件系统和 git 照常可用);远端路径从 `JSON.stringify` 换成 `shq()`(双引号内 `~` 不展开、`$`/反引号会被 shell 展开) |
| v0.1.16 | Agents 探测补用户级 bin PATH(非交互 SSH 看不到 `~/.local/bin` 的 claude);ssh-live 测试套件主机无关化 |
| v0.1.17 | AgentBits 丢 `useState` import,Agent 页**首条消息渲染必崩** |

**测试体系(全部真实,无 mock):**
- `test/remote.test.ts`:核心远端函数过 bridge(真实 shell/git,含怪路径转义)
- `test/polyfill.test.ts`:删掉 stream 全局模拟 Hermes,验证 polyfill 撑起 ACP 管道
- `test/ssh-live.manual.test.ts`:只读套件过真实 SSH,`SSH_TEST_HOST=<host>` 任意主机
- `test/gcp-acp.manual.test.ts`:app 的 LiveSession/AgentClient 过真实 SSH 完成 ACP 握手
- UI 冒烟:web build(与手机同一份组件)+ headless Chrome 手机视口 + bridge 真实 exec,
  全流程点击验证(扫仓库→加项目→Files→Git diff/commit→Agent 对话→权限弹窗→工具落盘)。
  **两个真机 crash(v0.1.13/v0.1.17)都是这层抓到的,改 UI 后发版前必跑。**

**端到端已验证**(真实远端服务器 + 手机仿真):连接、扫描/添加项目、文件树与预览、
git 状态/diff/真实 commit、agent 对话(流式回答、自主调工具、权限弹窗批准、文件真实写入)。

**下一步:**
- [ ] 会话持久化:spawn 套 tmux + sessionId 持久化 + 重连 `session/load`(adapter 已支持 loadSession)
- [ ] SSH keepalive / 断线自动重连(目前手动 Retry)
- [ ] thread 列表(session/list)

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
