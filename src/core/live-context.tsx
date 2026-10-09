// LiveProvider：进入 MainShell 时建立传输层并起 agent。
// - WS 路径（dev）：bridge URL，browser / Expo Go 联调用
// - SSH 路径（prod）：SshTransport，真机连远端服务器用
//
// exec 在传输层一连上就可用（Files/Git 靠它），agent 起不起得来
// 只影响 session/status——agent 挂了不应该把文件系统和 git 一起拖死。

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { LiveSession } from './live';
import { WsTransport } from './ws-transport';
import { SshTransport, type SshConfig } from './ssh-transport';
import type { Transport, ExecResult } from './transport';

export type LiveStatus = 'connecting' | 'on' | 'off' | 'error';
export type LiveExec = (cmd: string, cwd?: string) => Promise<ExecResult>;

interface LiveCtxValue {
  session: LiveSession | null;
  status: LiveStatus;
  error: string | null;
  /** 传输层直连 exec：SSH/bridge 一通就非 null，与 agent 会话无关 */
  exec: LiveExec | null;
}

const LiveCtx = createContext<LiveCtxValue>({ session: null, status: 'off', error: null, exec: null });

export function bridgeUrl(): string {
  if (typeof location !== 'undefined' && location.hostname) {
    const q = new URLSearchParams(location.search).get('bridge');
    if (q) return q;
    // 同源同端口——combined.mjs 把 bridge WS 和静态文件合在一个端口
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${location.host}`;
  }
  return 'ws://localhost:8081';
}

// 两条路径共用的连接流程：先建 transport（exec 立即可用），再起 agent
function useLiveValue(
  makeTransport: () => Promise<Transport>,
  cwd: string,
  agentCmd: string,
  deps: unknown[],
): LiveCtxValue {
  const [value, setValue] = useState<LiveCtxValue>({ session: null, status: 'connecting', error: null, exec: null });
  const ref = useRef<{ session?: LiveSession; transport?: Transport; dead?: boolean }>({});

  useEffect(() => {
    const state = ref.current;
    state.dead = false;
    setValue({ session: null, status: 'connecting', error: null, exec: null });
    (async () => {
      let exec: LiveExec | null = null;
      try {
        const transport = await makeTransport();
        if (state.dead) { transport.close(); return; }
        state.transport = transport;
        exec = (cmd, c) => transport.exec(cmd, c ? { cwd: c } : undefined);
        // transport 就绪：exec 先行可用，agent 还在启动
        setValue({ session: null, status: 'connecting', error: null, exec });
        const session = await LiveSession.connect({ transport, cmd: agentCmd, cwd });
        if (state.dead) { session.dispose(); transport.close(); return; }
        state.session = session;
        setValue({ session, status: 'on', error: null, exec });
      } catch (err) {
        // agent 失败不影响已建立的 exec
        if (!state.dead) setValue({ session: null, status: 'error', error: String(err), exec });
      }
    })();
    return () => {
      state.dead = true;
      state.session?.dispose();
      state.transport?.close();
      state.session = undefined;
      state.transport = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}

// ── WS dev bridge provider (browser / Expo Go) ───────────────
export function LiveProvider({ cwd, agentCmd, children }: {
  cwd: string; agentCmd: string; children: React.ReactNode;
}) {
  const value = useLiveValue(
    async () => {
      const t = new WsTransport(bridgeUrl());
      await t.exec('true'); // 确认 bridge 可达再交付
      return t;
    },
    cwd, agentCmd, [cwd, agentCmd],
  );
  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}

// ── SSH prod provider ─────────────────────────────────────────
export function SshLiveProvider({ ssh, cwd, agentCmd, children }: {
  ssh: SshConfig; cwd: string; agentCmd: string; children: React.ReactNode;
}) {
  const value = useLiveValue(
    () => SshTransport.connect(ssh),
    cwd, agentCmd, [ssh.host, ssh.port, ssh.user, cwd, agentCmd],
  );
  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}

export function useLive(): LiveCtxValue {
  return useContext(LiveCtx);
}
