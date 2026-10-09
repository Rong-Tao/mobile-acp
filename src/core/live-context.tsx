// LiveProvider：进入 MainShell 时建立传输层并起 agent。
// - WS 路径（dev）：bridge URL，browser / Expo Go 联调用
// - SSH 路径（prod）：SshTransport，真机连远端服务器用
//
// exec 在传输层一连上就可用（Files/Git 靠它），agent 起不起得来
// 只影响 session/status——agent 挂了不应该把文件系统和 git 一起拖死。
//
// thread 管理也在这层：session 是"当前 thread"，可新开/切换历史 thread，
// agent 进程保持不动。
//
// 健康检测：SSH 会静默死掉（锁屏/切网/NAT 超时），所以
// - 心跳：每 15s exec('true')，10s 超时 → 判死
// - 所有 exec 带 25s 超时，不再无限挂起
// - 判死后自动重连（持久化 agent + lastThreadId 让重连代价很小），
//   连接失败则 15s 后再试，不需要重启 app

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { SessionInfo } from '@agentclientprotocol/sdk';
import { LiveAgent, LiveSession } from './live';
import { notifyIfBackground } from './notify';
import { WsTransport } from './ws-transport';
import { SshTransport, type SshConfig } from './ssh-transport';
import type { Transport, ExecResult } from './transport';

export type LiveStatus = 'connecting' | 'on' | 'lost' | 'error' | 'off';
export type LiveExec = (cmd: string, cwd?: string) => Promise<ExecResult>;

const HEARTBEAT_MS = 15000;
const HEARTBEAT_TIMEOUT_MS = 10000;
const EXEC_TIMEOUT_MS = 25000;
const RETRY_MS = 15000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

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
  /** 手动重连（自动重连失败后 UI 的 Retry 也走这里） */
  reconnect: () => void;
}

const NOOP = async () => {};
const EMPTY_CTX: LiveCtxValue = {
  session: null, status: 'off', error: null, exec: null,
  threads: [], threadsSupported: false, threadLoading: false,
  newThread: NOOP, openThread: NOOP as (id: string) => Promise<void>, refreshThreads: NOOP,
  reconnect: () => {},
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

// 两条路径共用的连接流程：先建 transport（exec 立即可用），再起 agent + 恢复 thread
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
  const [tick, setTick] = useState(0); // bump = 重建连接
  const ref = useRef<{ live?: LiveAgent; transport?: Transport; dead?: boolean; retry?: ReturnType<typeof setTimeout> }>({});

  const reconnect = useCallback(() => {
    if (ref.current.retry) clearTimeout(ref.current.retry);
    setTick((t) => t + 1);
  }, []);

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

    // 判死 → 标记 lost → 短暂延迟后重建连接
    const markLost = (why: string) => {
      if (state.dead) return;
      console.warn('[conn] lost:', why);
      setBase((b) => ({ ...b, status: 'lost' }));
      if (state.retry) clearTimeout(state.retry);
      state.retry = setTimeout(() => { if (!state.dead) setTick((t) => t + 1); }, 1500);
    };

    let heartbeat: ReturnType<typeof setInterval> | undefined;

    (async () => {
      let exec: LiveExec | null = null;
      try {
        const transport = await withTimeout(makeTransport(), 20000);
        if (state.dead) { transport.close(); return; }
        state.transport = transport;
        // 所有 exec 带超时：传输层死掉时 Files/Git 快速失败而不是永久转圈
        exec = async (cmd, c) => {
          try {
            return await withTimeout(transport.exec(cmd, c ? { cwd: c } : undefined), EXEC_TIMEOUT_MS);
          } catch (err) {
            if (String(err).includes('timed out')) markLost('exec timeout');
            throw err;
          }
        };
        // transport 就绪：exec 先行可用，agent 还在启动
        setBase({ session: null, status: 'connecting', error: null, exec });
        const live = await LiveAgent.connect({
          transport, cmd: agentCmd, cwd, agentId,
          persist: true,            // agent 进程脱离 SSH 存活,断连任务照跑
          notify: notifyIfBackground, // 后台时 turn 完成/待权限弹本地通知
        });
        if (state.dead) { live.dispose(); transport.close(); return; }
        state.live = live;
        const session = await live.resumeOrNewThread();
        if (state.dead) { live.dispose(); transport.close(); return; }
        setBase({ session, status: 'on', error: null, exec });

        // 心跳：轻量 exec 验证 SSH 真的还活着
        heartbeat = setInterval(async () => {
          if (state.dead) return;
          try {
            await withTimeout(transport.exec('true'), HEARTBEAT_TIMEOUT_MS);
          } catch (err) {
            markLost(`heartbeat: ${err}`);
          }
        }, HEARTBEAT_MS);
      } catch (err) {
        // 连接失败：报错 + 15s 后自动再试（手动 Retry 也随时可点）
        if (!state.dead) {
          setBase({ session: null, status: 'error', error: String(err), exec });
          if (state.retry) clearTimeout(state.retry);
          state.retry = setTimeout(() => { if (!state.dead) setTick((t) => t + 1); }, RETRY_MS);
        }
      }
    })();
    return () => {
      state.dead = true;
      if (heartbeat) clearInterval(heartbeat);
      if (state.retry) clearTimeout(state.retry);
      state.live?.dispose();
      state.transport?.close();
      state.live = undefined;
      state.transport = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return {
    ...base,
    threads,
    threadsSupported: ref.current.live?.supportsThreadList ?? false,
    threadLoading,
    newThread,
    openThread,
    refreshThreads,
    reconnect,
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
