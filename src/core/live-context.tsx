// LiveProvider：进入 MainShell 时建立传输层并起 agent。
// - WS 路径（dev）：bridge URL，browser / Expo Go 联调用
// - SSH 路径（prod）：SshTransport，真机连远端服务器用
//
// exec 在传输层一连上就可用（Files/Git 靠它），agent 起不起得来
// 只影响 session/status——agent 挂了不应该把文件系统和 git 一起拖死。
//
// thread 管理也在这层：session 是"当前 thread"，可新开/切换历史 thread，
// agent 进程保持不动。

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { SessionInfo } from '@agentclientprotocol/sdk';
import { LiveAgent, LiveSession } from './live';
import { WsTransport } from './ws-transport';
import { SshTransport, type SshConfig } from './ssh-transport';
import type { Transport, ExecResult } from './transport';

export type LiveStatus = 'connecting' | 'on' | 'off' | 'error';
export type LiveExec = (cmd: string, cwd?: string) => Promise<ExecResult>;

interface LiveCtxValue {
  /** 当前 thread 的会话 */
  session: LiveSession | null;
  status: LiveStatus;
  error: string | null;
  /** 传输层直连 exec：SSH/bridge 一通就非 null，与 agent 会话无关 */
  exec: LiveExec | null;
  /** 本 project 的历史 thread 列表（agent 支持 session/list 时） */
  threads: SessionInfo[];
  threadsSupported: boolean;
  /** 新开/切换 thread 进行中（替当前 session 渲染 loading） */
  threadLoading: boolean;
  newThread: () => Promise<void>;
  openThread: (sessionId: string) => Promise<void>;
  refreshThreads: () => Promise<void>;
}

const NOOP = async () => {};
const EMPTY_CTX: LiveCtxValue = {
  session: null, status: 'off', error: null, exec: null,
  threads: [], threadsSupported: false, threadLoading: false,
  newThread: NOOP, openThread: NOOP as (id: string) => Promise<void>, refreshThreads: NOOP,
};

const LiveCtx = createContext<LiveCtxValue>(EMPTY_CTX);

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

// 两条路径共用的连接流程：先建 transport（exec 立即可用），再起 agent + 首个 thread
function useLiveValue(
  makeTransport: () => Promise<Transport>,
  cwd: string,
  agentCmd: string,
  agentId: string,
  deps: unknown[],
): LiveCtxValue {
  const [base, setBase] = useState<{ session: LiveSession | null; status: LiveStatus; error: string | null; exec: LiveExec | null }>(
    { session: null, status: 'connecting', error: null, exec: null });
  const [threads, setThreads] = useState<SessionInfo[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const ref = useRef<{ live?: LiveAgent; transport?: Transport; dead?: boolean }>({});

  const refreshThreads = useCallback(async () => {
    const live = ref.current.live;
    if (!live?.supportsThreadList) return;
    try {
      const list = await live.listThreads();
      if (!ref.current.dead) setThreads(list);
    } catch (err) {
      console.warn('[threads] list failed', err);
    }
  }, []);

  const newThread = useCallback(async () => {
    const live = ref.current.live;
    if (!live) return;
    setThreadLoading(true);
    try {
      const sess = await live.newThread();
      if (!ref.current.dead) setBase((b) => ({ ...b, session: sess, status: 'on', error: null }));
    } catch (err) {
      console.warn('[threads] new failed', err);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const openThread = useCallback(async (sessionId: string) => {
    const live = ref.current.live;
    if (!live) return;
    setThreadLoading(true);
    try {
      const sess = await live.openThread(sessionId);
      if (!ref.current.dead) setBase((b) => ({ ...b, session: sess, status: 'on', error: null }));
    } catch (err) {
      console.warn('[threads] open failed', err);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    const state = ref.current;
    state.dead = false;
    setBase({ session: null, status: 'connecting', error: null, exec: null });
    setThreads([]);
    (async () => {
      let exec: LiveExec | null = null;
      try {
        const transport = await makeTransport();
        if (state.dead) { transport.close(); return; }
        state.transport = transport;
        exec = (cmd, c) => transport.exec(cmd, c ? { cwd: c } : undefined);
        // transport 就绪：exec 先行可用，agent 还在启动
        setBase({ session: null, status: 'connecting', error: null, exec });
        const live = await LiveAgent.connect({ transport, cmd: agentCmd, cwd, agentId });
        if (state.dead) { live.dispose(); transport.close(); return; }
        state.live = live;
        const session = await live.resumeOrNewThread();
        if (state.dead) { live.dispose(); transport.close(); return; }
        setBase({ session, status: 'on', error: null, exec });
      } catch (err) {
        // agent 失败不影响已建立的 exec
        if (!state.dead) setBase({ session: null, status: 'error', error: String(err), exec });
      }
    })();
    return () => {
      state.dead = true;
      state.live?.dispose();
      state.transport?.close();
      state.live = undefined;
      state.transport = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    ...base,
    threads,
    threadsSupported: ref.current.live?.supportsThreadList ?? false,
    threadLoading,
    newThread,
    openThread,
    refreshThreads,
  };
}

// ── WS dev bridge provider (browser / Expo Go) ───────────────
export function LiveProvider({ cwd, agentCmd, agentId = 'agent', children }: {
  cwd: string; agentCmd: string; agentId?: string; children: React.ReactNode;
}) {
  const value = useLiveValue(
    async () => {
      const t = new WsTransport(bridgeUrl());
      await t.exec('true'); // 确认 bridge 可达再交付
      return t;
    },
    cwd, agentCmd, agentId, [cwd, agentCmd],
  );
  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}

// ── SSH prod provider ─────────────────────────────────────────
export function SshLiveProvider({ ssh, cwd, agentCmd, agentId = 'agent', children }: {
  ssh: SshConfig; cwd: string; agentCmd: string; agentId?: string; children: React.ReactNode;
}) {
  const value = useLiveValue(
    () => SshTransport.connect(ssh),
    cwd, agentCmd, agentId, [ssh.host, ssh.port, ssh.user, cwd, agentCmd],
  );
  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}

export function useLive(): LiveCtxValue {
  return useContext(LiveCtx);
}
