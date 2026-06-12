# mobile-acp 实施计划

> 愿景：**手机上的 SSH Zed**。一个 Android 客户端，通过 SSH 连远端服务器，
> 跑 ACP 协议的 coding agent（Claude Code / Codex / Gemini CLI），
> agent panel 体验对齐 Zed，配套 Git / Files 面板。服务端零部署，只需 sshd。

设计稿：`design-ref/`（claude.ai design artifact 原件）。
产品需求：`../mobile-acp-prd.md`（home 目录，后续合入 repo）。
Zed 参照：`docs/zed-acp-notes.md`（Zed ACP 实现调研笔记）。

## 架构

```
┌─────────────────────── RN App (Expo) ───────────────────────┐
│  UI 层（已有原型）                                            │
│   HomeScreen / ServerDetail / MainShell                      │
│   AgentTab · GitTab · FilesTab                               │
│           │                                                  │
│  核心层 src/core/（平台无关纯 TS，可在 Node 下测试）            │
│   acp/connection.ts   JSON-RPC + ACP client/agent 双向方法    │
│   acp/session.ts      session/update → ThreadEntry 模型      │
│   transport.ts        Transport 接口（spawn 长进程 / exec 单发）│
│           │                                                  │
│  传输实现                                                     │
│   ws-transport.ts     dev：WebSocket bridge（先行）           │
│   ssh-transport       prod：原生 SSH（后续，同一接口）          │
└──────────────────────────────────────────────────────────────┘
            │ SSH (prod) / WS (dev)
┌─────────── 远端服务器（零部署，只需 sshd）────────────┐
│  agent 进程: npx @agentclientprotocol/claude-agent-acp │
│  git/fs 命令: git status / diff / ls / cat …           │
└────────────────────────────────────────────────────────┘
```

### 关键决策

1. **协议层不手写 schema**：用官方 `@agentclientprotocol/sdk` 的**类型**；
   JSON-RPC 连接自己实现（~200 行），避免 SDK 的 web-streams 依赖在
   RN/Hermes 上的兼容风险。
2. **传输层抽象先行**：`Transport` 接口只有 `spawn()`（长生命周期进程，
   流式 stdio，给 ACP agent 用）和 `exec()`（单发命令，给 git/fs 用）。
   - **dev 路径（先做）**：WebSocket bridge（`bridge/`，一个小 Node 进程
     跑在目标机上），让 Expo web/Expo Go 不需要原生模块就能端到端联调真 agent。
   - **prod 路径（后做）**：原生 SSH。候选：nodejs-mobile + ssh2（最稳，
     包体大）或 Expo Modules 包 sshj（轻，要写原生）。接口不变，可后换。
3. **Claude Code 接入用适配器**：`@agentclientprotocol/claude-agent-acp`
   （PRD 里写的 `claude --acp` 不存在）。
4. **权限选项动态渲染**：按 `session/request_permission` 的 `options[]`
   渲染按钮，不硬编码三态；"always" 的持久化由 agent 侧负责。
5. **模式/模型走协议**：permission mode = `session/set_mode`（来自
   `session/new` 返回的 `modes`）；模型 = `configOptions` +
   `session/set_config_option`。不做本地硬编码。
6. **Git/Files 与 ACP 无关**：纯 SSH 命令（`git status --porcelain=v2`、
   `git diff`、`ls`、`cat`），在 `src/core/remote/` 封装。
7. **terminal/* 方法**：agent 反向调用 `terminal/create` 等时，在**远端**
   exec（手机不是执行环境）。

## 阶段

### Phase 1 — ACP 核心层 + dev bridge（本机可验证）
- [ ] `src/core/acp/connection.ts`：newline-delimited JSON-RPC，
      client→agent 方法封装，agent→client 请求分发（permission/fs/terminal）
- [ ] `src/core/acp/session.ts`：update 流 → entry 列表 reducer
      （chunk 追加、tool_call upsert、plan 整体替换、thought 流）
- [ ] `bridge/server.mjs`：WS ↔ 子进程多路复用（spawn/stdin/stdout/exit/exec）
- [ ] `src/core/ws-transport.ts`
- [ ] Node 端 e2e 测试：bridge + 真 claude-agent-acp，
      initialize → session/new → prompt → 校验 update 流和权限流

### Phase 2 — UI 接线
- [ ] AgentTab：mock 换 session store（流式文本、工具卡片状态机、
      动态权限卡片、plan/thought 卡片）
- [ ] 连接管理：服务器配置 → transport 建立 → agent spawn 生命周期
- [ ] modes / configOptions chips 走协议
- [ ] GitTab / FilesTab 接 `exec()` 真数据

### Phase 3 — SSH 原生传输
- [ ] 选型 spike（nodejs-mobile+ssh2 vs Expo Modules+sshj）
- [ ] 实现 SshTransport，替换 bridge
- [ ] Android Keystore 存私钥

### Phase 4 — 服务端 one-liner + 配对
- [ ] `server/setup.sh`：生成/注册 SSH key，二维码配对（5 分钟时效）
- [ ] app 扫码流程

### Phase 5 — 体验对齐 Zed
- [ ] 每条 user message 打 git checkpoint（SSH 跑 git，支持回滚）
- [ ] diff 卡片 → 逐 hunk 查看
- [ ] tool call locations → 点击跳 Files Tab
- [ ] session/list / load / resume（按 agent capability 降级）
- [ ] slash 命令补全（available_commands_update）
- [ ] usage_update 显示 token 用量

## 当前状态

- ✅ UI 原型（设计稿 1:1 移植，全 mock）
- ✅ Zed ACP 架构调研
- ▶ Phase 1 进行中
