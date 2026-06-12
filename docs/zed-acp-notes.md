# Zed 的 ACP 实现调研笔记

> 2026-06 调研，作为 mobile-acp 的实现参照。来源见文末。

## 1. 协议层

**传输**：newline-delimited JSON-RPC 2.0 走子进程 stdio（stderr 留日志）。
约定：路径绝对、行号 1-based、key camelCase、discriminator snake_case，扩展走 `_meta`。

**Agent 侧方法**（client → agent）：
- `initialize`：协商 `protocolVersion` + 双方 capabilities
- `authenticate` / `logout`
- `session/new` `{cwd, mcpServers}` → `{sessionId, configOptions, modes}`
- `session/load`（重放历史）/ `session/resume`（不重放）/ `session/list` / `session/close` / `session/delete`（均按 capability 协商）
- `session/prompt` `{sessionId, prompt: ContentBlock[]}` → `{stopReason}`（turn 结束才返回）
- `session/cancel`（notification）
- `session/set_mode` / `session/set_config_option`

**Client 侧方法**（agent → client）：
- `session/request_permission` `{toolCall, options: [{optionId, name, kind}]}`，
  kind ∈ `allow_once|allow_always|reject_once|reject_always`，**选项由 agent 提供**
- 可选 `fs/read_text_file`、`fs/write_text_file`（读编辑器未保存 buffer）
- 可选 `terminal/create|output|wait_for_exit|kill|release`
- `session/update`（notification）：variant 有 `user_message_chunk`、`agent_message_chunk`、
  `agent_thought_chunk`、`tool_call`、`tool_call_update`、`plan`、`current_mode_update`、
  `available_commands_update`、`usage_update` 等

**ToolCall**：`kind`（read/edit/execute…决定图标）+ `status`（pending/in_progress/completed/failed）
+ `content`（ContentBlock / Diff{path, oldText, newText} / Terminal 引用）+ `locations`（follow 跳转用）。

**取消语义**：client 发 cancel 后要把 pending permission 以 `cancelled` outcome 回复；
agent 以 `cancelled` stopReason 结束原 prompt；cancel 后仍可能补发 update。

## 2. Zed 客户端架构（三层）

`agent_servers`（进程管理）→ `acp_thread`（协议→数据模型）→ `agent_ui`（渲染）。
Zed 内置 agent 也走同一条 ACP 代码路径。

- `AcpConnection::stdio()`：spawn 子进程、按行读写、tap 日志；远程项目时命令经
  `remote_client().build_command()` 改写，**agent 跑在远端**，stdio 经 Zed 的 SSH 隧道回本地。
- 调试：环形缓冲 2000 条消息的 ACP log viewer（`dev: open acp logs`）。
- 安装管理：现行 ACP Registry（自动更新）+ Agent Server 扩展 + settings 手写
  `agent_servers: {"x": {command, args, env}}`。Claude Code 靠适配器
  `@agentclientprotocol/claude-agent-acp`（原 `@zed-industries/claude-code-acp`）。
- `acp_thread`：`Vec<AgentThreadEntry>`（UserMessage 带 git checkpoint / AssistantMessage /
  ToolCall / CompletedPlan）。`handle_session_update()` 做 dispatch：chunk 追加、
  tool_call upsert、plan 复用 entity 防闪烁。Diff content → multi-buffer review；
  Terminal content → 内嵌终端视图；locations → follow mode。

## 3. 权限流

- tool call 置 `WaitingForConfirmation`，oneshot channel 等用户点按钮。
- "Always" 持久化**由 agent 负责**（Claude 适配器写它的 settings.local.json）。
- Zed 本地另有 `agent.tool_permissions`（正则规则，优先级 deny > confirm > allow）。

## 4. 远程（SSH）场景的坑

- agent 凭证在远端读取，本地 keychain 不共享。
- 本地 proxy env 不该注入远端 agent（issue #38392）。
- stdio MCP server 目前本地起、socket 中继（#52254，理想是远端直起）。

## 5. 对 mobile-acp 的启示

1. cwd 等路径必须绝对（`~` 要在远端解析后再发 session/new）。
2. 权限按钮动态渲染 agent 给的 options，客户端不存白名单。
3. mode/模型走 `session/set_mode` / `session/set_config_option`，不本地硬编码。
4. thread 恢复依赖 agent 的 `session/list/load/resume` capability，UI 要可降级。
5. checkpoint（每条 user message 打 git 快照）是 Zed 协议外自己做的，SSH 场景照搬容易。
6. Git/Files 面板与 ACP 无关，纯远端命令。
7. terminal/* 反向调用在手机场景应实现为"远端 exec"。

## 来源

- https://agentclientprotocol.com（protocol/schema/prompt-turn/content）
- https://zed.dev/docs/ai/external-agents 、tool-permissions、agent-panel
- 博客：Bring Your Own Agent to Zed / Claude Code via ACP / ACP Registry
- 源码：zed-industries/zed crates/agent_servers、crates/acp_thread；
  zed-industries/claude-agent-acp
- issues：#52254、#47910、#38392、#44300、PR #49449
