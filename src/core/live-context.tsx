// LiveProvider：进入 MainShell 时建立传输层并起 agent。
// - WS 路径（dev）：bridge URL，browser / Expo Go 联调用
// - SSH 路径（prod）：SshTransport，真机连远端服务器用
// 连不上则保持 mock 模式（status='off'/'error'），UI 自动回退原型行为。

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { LiveSession } from './live';
import { WsTransport } from './ws-transport';
import { SshTransport, type SshConfig } from './ssh-transport';
import type { Transport } from './transport';

export type LiveStatus = 'connecting' | 'on' | 'off' | 'error';

interface LiveCtxValue {
  session: LiveSession | null;
  status: LiveStatus;
  error: string | null;
}

const LiveCtx = createContext<LiveCtxValue>({ session: null, status: 'off', error: null });

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

// ── WS dev bridge provider (browser / Expo Go) ───────────────
export function LiveProvider({ cwd, agentCmd, children }: {
  cwd: string; agentCmd: string; children: React.ReactNode;
}) {
  const [value, setValue] = useState<LiveCtxValue>({ session: null, status: 'connecting', error: null });
  const ref = useRef<{ session?: LiveSession; transport?: WsTransport; dead?: boolean }>({});

  useEffect(() => {
    const state = ref.current;
    (async () => {
      try {
        const transport = new WsTransport(bridgeUrl());
        state.transport = transport;
        const session = await LiveSession.connect({ transport, cmd: agentCmd, cwd });
        if (state.dead) { session.dispose(); transport.close(); return; }
        state.session = session;
        setValue({ session, status: 'on', error: null });
      } catch (err) {
        if (!state.dead) setValue({ session: null, status: 'error', error: String(err) });
      }
    })();
    return () => {
      state.dead = true;
      state.session?.dispose();
      state.transport?.close();
    };
  }, [cwd, agentCmd]);

  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}

// ── SSH prod provider ─────────────────────────────────────────
export function SshLiveProvider({ ssh, cwd, agentCmd, children }: {
  ssh: SshConfig; cwd: string; agentCmd: string; children: React.ReactNode;
}) {
  const [value, setValue] = useState<LiveCtxValue>({ session: null, status: 'connecting', error: null });
  const ref = useRef<{ session?: LiveSession; transport?: Transport; dead?: boolean }>({});

  useEffect(() => {
    const state = ref.current;
    state.dead = false;
    (async () => {
      try {
        const transport = await SshTransport.connect(ssh);
        state.transport = transport;
        if (state.dead) { transport.close(); return; }
        const session = await LiveSession.connect({ transport, cmd: agentCmd, cwd });
        if (state.dead) { session.dispose(); transport.close(); return; }
        state.session = session;
        setValue({ session, status: 'on', error: null });
      } catch (err) {
        if (!state.dead) setValue({ session: null, status: 'error', error: String(err) });
      }
    })();
    return () => {
      state.dead = true;
      state.session?.dispose();
      state.transport?.close();
    };
  }, [ssh.host, ssh.port, ssh.user, cwd, agentCmd]);

  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}

export function useLive(): LiveCtxValue {
  return useContext(LiveCtx);
}
