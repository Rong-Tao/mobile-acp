// LiveAgent / LiveSession：agent 和 thread 是两层——
// LiveAgent = transport 上的一个 agent 进程（每个 project 一个），
// LiveSession = 其上的一个 thread（ACP session）。可以开新 thread、
// 回看/继续历史 thread（session/list + session/load），互不干扰。

import { useSyncExternalStore } from 'react';
import type { SessionInfo, SessionModeState } from '@agentclientprotocol/sdk';
import { AgentClient } from './acp/agent-client';
import { SessionStore, type SessionState } from './acp/session-store';
import { loadAgentPrefs, saveAgentPref } from './agent-prefs';
import { persistentSpawnCmd } from './persist';
import type { Transport } from './transport';

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
  env?: Record<string, string>;
}

/** 一个 thread（ACP session）。UI 消费 store，操作走这里。 */
export class LiveSession {
  constructor(
    private owner: LiveAgent,
    readonly sessionId: string,
    readonly store: SessionStore,
    public modes: SessionModeState | null,
  ) {}

  async send(text: string): Promise<void> {
    const blocks = [{ type: 'text' as const, text }];
    this.store.addUserMessage(blocks);
    this.store.setBusy(true);
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
        onSessionUpdate: (n) => live.threads.get(n.sessionId)?.store.apply(n),
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
    this.savePref({ lastThreadId: sessionId });
    return sess;
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
