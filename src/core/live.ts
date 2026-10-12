// LiveAgent / LiveSession：agent 和 thread 是两层——
// LiveAgent = transport 上的一个 agent 进程（每个 project 一个），
// LiveSession = 其上的一个 thread（ACP session）。可以开新 thread、
// 回看/继续历史 thread（session/list + session/load），互不干扰。

import { useSyncExternalStore } from 'react';
import type { SessionInfo, SessionModeState } from '@agentclientprotocol/sdk';
import { AgentClient } from './acp/agent-client';
import { SessionStore, type SessionState } from './acp/session-store';
import { loadAgentPrefs, saveAgentPref } from './agent-prefs';
import { agentDirExpr, persistentSpawnCmd } from './persist';
import { parseOrphans, scanLogCmd } from './permission-recovery';
import type { Transport } from './transport';

// "换个 agent 并直接开新 thread"：provider 重建前置个一次性标记，
// 重连后的 resumeOrNewThread 消费它（否则会 resume 那个 agent 的上一个 thread）
let freshThreadRequested = false;
export function requestFreshThread(): void { freshThreadRequested = true; }
function consumeFreshThreadRequest(): boolean {
  const v = freshThreadRequested;
  freshThreadRequested = false;
  return v;
}

export interface LiveAgentOptions {
  transport: Transport;
  /** agent 启动命令 */
  cmd: string;
  /** 工作目录（project 路径） */
  cwd: string;
  /** agent 标识（claude/codex/gemini），用于按 project 记住配置 */
  agentId?: string;
  /** 持久化模式：agent 进程 setsid 脱离 SSH，断连后任务照跑，重连复用（见 persist.ts） */
  persist?: boolean;
  /** app 在后台时的提醒回调（turn 完成 / 待权限），由 UI 层注入 */
  notify?: (title: string, body?: string) => void;
  /** 收到任何 agent 流量时回调——连接层拿它当心跳（有流量就不用 ping） */
  onActivity?: () => void;
  env?: Record<string, string>;
}

/** 属于"turn 正在进行"的 session/update 类型（不含 mode/commands/usage 等元信息） */
function isTurnActivity(kind: string): boolean {
  return kind === 'agent_message_chunk' || kind === 'agent_thought_chunk' || kind === 'tool_call' || kind === 'tool_call_update' || kind === 'plan';
}

/** 一个 thread（ACP session）。UI 消费 store，操作走这里。 */
export class LiveSession {
  constructor(
    private owner: LiveAgent,
    readonly sessionId: string,
    readonly store: SessionStore,
    public modes: SessionModeState | null,
  ) {}

  /** 本连接发起的 prompt 在途（区别于重连后接手的"孤儿 turn"） */
  promptActive = false;

  async send(text: string): Promise<void> {
    const blocks = [{ type: 'text' as const, text }];
    this.store.addUserMessage(blocks);
    this.store.setBusy(true);
    this.promptActive = true;
    try {
      const resp = await this.owner.agent.prompt(this.sessionId, blocks);
      if (resp.stopReason === 'cancelled') {
        this.store.markCancelled();
      } else {
        // app 在后台时提醒一下（前台 no-op）
        const entries = this.store.getState().entries;
        const last = [...entries].reverse().find((e) => e.type === 'assistant_message');
        this.owner.opts.notify?.('Agent finished', last && 'text' in last ? last.text.slice(0, 120) : undefined);
      }
    } finally {
      this.promptActive = false;
      this.store.setBusy(false);
    }
  }

  async exec(cmd: string, cwd?: string): Promise<{ stdout: string; stderr: string; code: number }> {
    return this.owner.opts.transport.exec(cmd, cwd ? { cwd } : undefined);
  }

  async cancel(): Promise<void> {
    // 协议要求：取消时待决的 permission 必须以 cancelled outcome 回复
    this.store.getState().pendingPermission?.cancel();
    await this.owner.agent.cancel(this.sessionId);
    // 孤儿 turn 若其实已不在跑（agent 重启过），不会再有 stopReason——别让 busy 永远挂着
    if (!this.promptActive) {
      setTimeout(() => { if (!this.promptActive) this.store.setBusy(false); }, 3000);
    }
  }

  /** legacy mode 切换（没有 configOptions 的 agent）。turn 进行中也允许。 */
  async setMode(modeId: string): Promise<void> {
    await this.owner.agent.setMode(this.sessionId, modeId);
    this.store.apply({
      sessionId: this.sessionId,
      update: { sessionUpdate: 'current_mode_update', currentModeId: modeId },
    });
    this.owner.savePref({ modeId });
  }

  /** 会话配置（mode/model/effort…）。乐观更新 + 持久化，busy 时同样可用。 */
  async setConfig(configId: string, value: string | boolean): Promise<void> {
    this.store.setConfigValueLocal(configId, value);
    this.owner.savePref({ config: { [configId]: value } });
    const opts = await this.owner.agent.setConfigOption(this.sessionId, configId, value);
    this.store.setConfigOptions(opts);
  }

  dispose(): void {
    this.owner.closeThread(this.sessionId);
  }
}

/** 一个 agent 进程 + 它上面的所有 thread。 */
export class LiveAgent {
  agent!: AgentClient;
  cwd!: string;
  private threads = new Map<string, LiveSession>();

  private constructor(readonly opts: LiveAgentOptions) {}

  static async connect(opts: LiveAgentOptions): Promise<LiveAgent> {
    // ACP 规定路径必须绝对：~ 在远端解析
    let cwd = opts.cwd;
    if (cwd === '~' || cwd.startsWith('~/')) {
      const home = (await opts.transport.exec('echo "$HOME"')).stdout.trim();
      cwd = cwd === '~' ? home : home + cwd.slice(1);
    }
    const live = new LiveAgent(opts);
    live.cwd = cwd;
    const spawnCmd = opts.persist
      ? persistentSpawnCmd(opts.cmd, cwd, opts.agentId ?? 'agent')
      : opts.cmd;
    live.agent = await AgentClient.start({
      transport: opts.transport,
      cmd: spawnCmd,
      cwd,
      env: opts.env,
      handlers: {
        // 多 thread：一切通知/请求按 sessionId 路由到对应 store
        onSessionUpdate: (n) => {
          opts.onActivity?.();
          const t = live.threads.get(n.sessionId);
          if (!t) return;
          t.store.apply(n);
          // 重连后接手的"孤儿 turn"：没有本连接的 prompt、却有实时活动流进来 → 在工作
          if (!t.promptActive && !t.store.replaying && !t.store.getState().busy && isTurnActivity(n.update.sessionUpdate)) {
            t.store.setBusy(true);
          }
        },
        onPermissionRequest: (req) =>
          new Promise((resolve) => {
            const store = live.threads.get(req.sessionId)?.store;
            if (!store) {
              resolve({ outcome: { outcome: 'cancelled' } });
              return;
            }
            opts.notify?.('Agent needs permission', req.toolCall?.title ?? undefined);
            store.setPendingPermission({
              request: req,
              resolve: (optionId) => {
                store.setPendingPermission(null);
                resolve({ outcome: { outcome: 'selected', optionId } });
              },
              cancel: () => {
                store.setPendingPermission(null);
                resolve({ outcome: { outcome: 'cancelled' } });
              },
            });
          }),
        onTurnEnd: () => {
          // 接手的孤儿 turn 结束（它的 prompt promise 在旧连接上，这里收不到）
          // 延后一拍：同一批数据里 stopReason 前的最后几条 update 还没被 SDK 派发完
          setTimeout(() => {
            for (const t of live.threads.values()) {
              if (!t.promptActive && t.store.getState().busy) t.store.setBusy(false);
            }
          }, 400);
        },
        onStderr: (l) => console.warn('[agent stderr]', l),
        onAgentExit: (code) => console.warn('[agent] exited', code),
      },
    });
    return live;
  }

  /** agent 是否支持历史会话列表/加载（claude adapter 支持，gemini/codex 未必） */
  get supportsThreadList(): boolean {
    const caps = this.agent.init.agentCapabilities as {
      loadSession?: boolean;
      sessionCapabilities?: { list?: unknown };
    };
    return !!caps?.loadSession && caps?.sessionCapabilities?.list != null;
  }

  /** 新开 thread，并恢复用户在这个 project 记住的配置 */
  async newThread(): Promise<LiveSession> {
    const s = await this.agent.newSession(this.cwd);
    const store = new SessionStore();
    const sess = new LiveSession(this, s.sessionId, store, s.modes ?? null);
    this.threads.set(s.sessionId, sess);
    if (s.configOptions?.length) store.setConfigOptions(s.configOptions);
    if (s.modes) {
      store.apply({
        sessionId: s.sessionId,
        update: { sessionUpdate: 'current_mode_update', currentModeId: s.modes.currentModeId },
      });
    }
    await this.applySavedPrefs(sess);
    this.savePref({ lastThreadId: s.sessionId });
    return sess;
  }

  /** 连接后恢复最近打开的 thread；没有或加载失败则新开 */
  async resumeOrNewThread(): Promise<LiveSession> {
    if (consumeFreshThreadRequest()) return this.newThread();
    if (this.supportsThreadList) {
      try {
        const prefs = await loadAgentPrefs(this.opts.agentId ?? 'agent', this.cwd);
        if (prefs.lastThreadId) return await this.openThread(prefs.lastThreadId);
      } catch (err) {
        console.warn('[threads] resume last failed, starting fresh', err);
      }
    }
    return this.newThread();
  }

  /** 打开历史 thread：已在内存直接复用，否则 session/load 回放 */
  async openThread(sessionId: string): Promise<LiveSession> {
    const existing = this.threads.get(sessionId);
    if (existing) return existing;
    const store = new SessionStore();
    const sess = new LiveSession(this, sessionId, store, null);
    this.threads.set(sessionId, sess); // 先注册：回放通知要能路由进来
    store.replaying = true;
    try {
      const r = await this.agent.loadSession(sessionId, this.cwd);
      sess.modes = r.modes ?? null;
      if (r.configOptions?.length) store.setConfigOptions(r.configOptions);
      if (r.modes) {
        store.apply({
          sessionId,
          update: { sessionUpdate: 'current_mode_update', currentModeId: r.modes.currentModeId },
        });
      }
    } catch (err) {
      this.threads.delete(sessionId);
      throw err;
    } finally {
      store.replaying = false;
    }
    // 回放结束时最后一个 tool call 还在 pending/in_progress → 上一条连接发起的 turn 仍在跑
    const last = [...sess.store.getState().entries].reverse().find((e) => e.type === 'tool_call');
    if (last && last.type === 'tool_call' && (last.status === 'pending' || last.status === 'in_progress')) {
      sess.store.setBusy(true);
    }
    // mode/model/effort 是 (agent, project) 级偏好：历史/重连的 thread 同样套用，
    // 否则 session/load 带回它存档时的 default，用户选过的 bypass 就"丢"了
    await this.applySavedPrefs(sess);
    this.savePref({ lastThreadId: sessionId });
    if (this.opts.persist) await this.recoverPermissions(sess);
    return sess;
  }

  /**
   * 持久 agent 重连：上一条连接发出、没人答复的权限请求只在 out.log 里。
   * 找回来渲染成卡片，答复时直接按原 id 写回 agent stdin。
   */
  private async recoverPermissions(sess: LiveSession): Promise<void> {
    try {
      const dir = agentDirExpr(this.cwd, this.opts.agentId ?? 'agent');
      const r = await this.opts.transport.exec(scanLogCmd(dir));
      const orphans = parseOrphans(r.stdout, sess.sessionId);
      const o = orphans[orphans.length - 1]; // agent 一次只会卡在一个请求上
      if (!o) return;
      const store = sess.store;
      const tid = o.request.toolCall?.toolCallId;
      if (store.getState().pendingPermission?.request.toolCall?.toolCallId === tid) return;
      this.opts.notify?.('Agent needs permission', o.request.toolCall?.title ?? undefined);
      store.setBusy(true);
      store.setPendingPermission({
        request: o.request,
        resolve: (optionId) => {
          store.setPendingPermission(null);
          this.agent.respondRaw(o.id, { outcome: { outcome: 'selected', optionId } });
        },
        cancel: () => {
          store.setPendingPermission(null);
          this.agent.respondRaw(o.id, { outcome: { outcome: 'cancelled' } });
        },
      });
    } catch (err) {
      console.warn('[permission-recovery] failed', err);
    }
  }

  /** 本 project 的历史 thread 列表（新→旧） */
  async listThreads(): Promise<SessionInfo[]> {
    const r = await this.agent.listSessions(this.cwd);
    return [...r.sessions].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }

  closeThread(sessionId: string): void {
    this.threads.delete(sessionId);
  }

  savePref(patch: { modeId?: string; config?: Record<string, string | boolean>; lastThreadId?: string }): void {
    void saveAgentPref(this.opts.agentId ?? 'agent', this.cwd, patch);
  }

  private async applySavedPrefs(sess: LiveSession): Promise<void> {
    try {
      const prefs = await loadAgentPrefs(this.opts.agentId ?? 'agent', this.cwd);
      const state = sess.store.getState();
      if (state.configOptions.length && prefs.config) {
        for (const opt of state.configOptions) {
          const want = prefs.config[opt.id];
          if (want == null || want === opt.currentValue) continue;
          if (opt.type === 'select') {
            const flat = opt.options.flatMap((o) => ('group' in o ? o.options : [o]));
            if (!flat.some((o) => o.value === want)) continue; // 存的值已不存在
          }
          const next = await this.agent.setConfigOption(sess.sessionId, opt.id, want);
          sess.store.setConfigOptions(next);
        }
      } else if (sess.modes && prefs.modeId && prefs.modeId !== sess.modes.currentModeId) {
        if (sess.modes.availableModes.some((m) => m.id === prefs.modeId)) {
          await sess.setMode(prefs.modeId);
        }
      }
    } catch (err) {
      console.warn('[prefs] restore failed', err);
    }
  }

  dispose(): void {
    this.agent.stop();
  }
}

const EMPTY: SessionState = {
  entries: [],
  plan: null,
  currentModeId: null,
  configOptions: [],
  availableCommands: [],
  pendingPermission: null,
  busy: false,
};

export function useSessionState(session: LiveSession | null): SessionState {
  return useSyncExternalStore(
    (cb) => (session ? session.store.subscribe(cb) : () => {}),
    () => (session ? session.store.getState() : EMPTY),
  );
}
