// LiveSession：把 Transport + AgentClient + SessionStore 粘成一个 UI 可消费的会话。

import { useSyncExternalStore } from 'react';
import type { SessionModeState } from '@agentclientprotocol/sdk';
import { AgentClient } from './acp/agent-client';
import { SessionStore, type SessionState } from './acp/session-store';
import type { Transport } from './transport';

export interface LiveSessionOptions {
  transport: Transport;
  /** agent 启动命令 */
  cmd: string;
  /** 工作目录（project 路径） */
  cwd: string;
  env?: Record<string, string>;
}

export class LiveSession {
  readonly store = new SessionStore();
  private agent!: AgentClient;
  sessionId!: string;
  modes: SessionModeState | null = null;

  private constructor(readonly opts: LiveSessionOptions) {}

  static async connect(opts: LiveSessionOptions): Promise<LiveSession> {
    // ACP 规定路径必须绝对：~ 在远端解析
    if (opts.cwd === '~' || opts.cwd.startsWith('~/')) {
      const home = (await opts.transport.exec('echo "$HOME"')).stdout.trim();
      opts = { ...opts, cwd: opts.cwd === '~' ? home : home + opts.cwd.slice(1) };
    }
    const live = new LiveSession(opts);
    live.agent = await AgentClient.start({
      transport: opts.transport,
      cmd: opts.cmd,
      cwd: opts.cwd,
      env: opts.env,
      handlers: {
        onSessionUpdate: (n) => live.store.apply(n),
        onPermissionRequest: (req) =>
          new Promise((resolve) => {
            live.store.setPendingPermission({
              request: req,
              resolve: (optionId) => {
                live.store.setPendingPermission(null);
                resolve({ outcome: { outcome: 'selected', optionId } });
              },
              cancel: () => {
                live.store.setPendingPermission(null);
                resolve({ outcome: { outcome: 'cancelled' } });
              },
            });
          }),
        onStderr: (l) => console.warn('[agent stderr]', l),
        onAgentExit: (code) => console.warn('[agent] exited', code),
      },
    });
    const s = await live.agent.newSession(opts.cwd);
    live.sessionId = s.sessionId;
    live.modes = s.modes ?? null;
    if (s.modes) {
      live.store.apply({
        sessionId: s.sessionId,
        update: { sessionUpdate: 'current_mode_update', currentModeId: s.modes.currentModeId },
      });
    }
    return live;
  }

  async send(text: string): Promise<void> {
    const blocks = [{ type: 'text' as const, text }];
    this.store.addUserMessage(blocks);
    this.store.setBusy(true);
    try {
      const resp = await this.agent.prompt(this.sessionId, blocks);
      if (resp.stopReason === 'cancelled') this.store.markCancelled();
    } finally {
      this.store.setBusy(false);
    }
  }

  async cancel(): Promise<void> {
    // 协议要求：取消时待决的 permission 必须以 cancelled outcome 回复
    this.store.getState().pendingPermission?.cancel();
    await this.agent.cancel(this.sessionId);
  }

  async setMode(modeId: string): Promise<void> {
    await this.agent.setMode(this.sessionId, modeId);
  }

  dispose(): void {
    this.agent.stop();
  }
}

const EMPTY: SessionState = {
  entries: [],
  plan: null,
  currentModeId: null,
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
