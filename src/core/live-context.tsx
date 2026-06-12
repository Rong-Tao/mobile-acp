// LiveProvider：进入 MainShell 时尝试连 dev bridge 并起 agent。
// 连不上则保持 mock 模式（status='off'/'error'），UI 自动回退到原型行为。

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { LiveSession } from './live';
import { WsTransport } from './ws-transport';

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
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${location.hostname}:8790`;
  }
  return 'ws://localhost:8790';
}

export function LiveProvider({ cwd, agentCmd, children }: { cwd: string; agentCmd: string; children: React.ReactNode }) {
  const [value, setValue] = useState<LiveCtxValue>({ session: null, status: 'connecting', error: null });
  const ref = useRef<{ session?: LiveSession; transport?: WsTransport; dead?: boolean }>({});

  useEffect(() => {
    const state = ref.current;
    (async () => {
      try {
        const transport = new WsTransport(bridgeUrl());
        state.transport = transport;
        const session = await LiveSession.connect({ transport, cmd: agentCmd, cwd });
        if (state.dead) {
          session.dispose();
          transport.close();
          return;
        }
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

export function useLive(): LiveCtxValue {
  return useContext(LiveCtx);
}
