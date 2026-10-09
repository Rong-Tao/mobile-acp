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
// 连接健康：参数与状态机对齐 Zed 的 remote_client.rs——
// - 心跳 5s 间隔 / 5s 超时；连续 5 次 miss 才判死（偶发抖动只闪黄不重连）
// - 任何 agent 流量都算心跳（流量活跃时不发 ping，省电；Zed #19219）
// - 状态: connecting → on → degraded(HeartbeatMissed) → lost(Reconnecting) → error(Disconnected)
// - 自动重连最多 3 次（3s 间隔），用尽转 error 等手动/回前台
// 手机特有（桌面 Zed 没有的）：app 回到前台立即探活，死了马上重连——
// 冻结回来 TCP 几乎必死，不等心跳慢慢发现。

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { SessionInfo } from '@agentclientprotocol/sdk';
import { LiveAgent, LiveSession } from './live';
import { notifyIfBackground } from './notify';
import { WsTransport } from './ws-transport';
import { SshTransport, type SshConfig } from './ssh-transport';
import type { Transport, ExecResult } from './transport';

export type LiveStatus = 'connecting' | 'on' | 'degraded' | 'lost' | 'error' | 'off';
export type LiveExec = (cmd: string, cwd?: string) => Promise<ExecResult>;

// —— Zed 对齐参数 ——
const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 5000;
const MAX_MISSED_HEARTBEATS = 5;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_SPACING_MS = 3000;
const EXEC_TIMEOUT_MS = 25000;

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
  /** 手动重连（重置尝试计数；UI 的 Retry / 点状态文字走这里） */
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
  const [tick, setTick] = useState(0); // bump = 重建连接（一次重连尝试）
  const ref = useRef<{
    live?: LiveAgent; transport?: Transport; dead?: boolean;
    retry?: ReturnType<typeof setTimeout>;
    attempts: number;          // 连续失败的重连次数（跨 effect 重建存活）
    lastActivity: number;      // 最近一次收到流量/心跳成功的时刻
  }>({ attempts: 0, lastActivity: 0 });
  const statusRef = useRef<LiveStatus>('connecting');

  const setStatus = useCallback((updater: (b: typeof base) => typeof base) => {
    setBase((b) => { const n = updater(b); statusRef.current = n.status; return n; });
  }, []);

  const reconnect = useCallback(() => {
    ref.current.attempts = 0; // 手动触发重置计数
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
      if (!ref.current.dead) setStatus((b) => ({ ...b, session: sess, status: 'on', error: null }));
    } catch (err) {
      console.warn('[threads] new failed', err);
    } finally {
      setThreadLoading(false);
    }
  }, [setStatus]);

  const openThread = useCallback(async (sessionId: string) => {
    const live = ref.current.live;
    if (!live) return;
    setThreadLoading(true);
    try {
      const sess = await live.openThread(sessionId);
      if (!ref.current.dead) setStatus((b) => ({ ...b, session: sess, status: 'on', error: null }));
    } catch (err) {
      console.warn('[threads] open failed', err);
    } finally {
      setThreadLoading(false);
    }
  }, [setStatus]);

  useEffect(() => {
    const state = ref.current;
    state.dead = false;
    setStatus(() => ({ session: null, status: 'connecting', error: null, exec: null }));
    setThreads([]);

    const touch = () => { state.lastActivity = Date.now(); };

    // 连续 5 次 miss → 标记 lost → 立即发起重连（effect 重建）
    const markLost = (why: string) => {
      if (state.dead) return;
      console.warn('[conn] lost:', why);
      setStatus((b) => ({ ...b, status: 'lost' }));
      if (state.retry) clearTimeout(state.retry);
      state.retry = setTimeout(() => { if (!state.dead) setTick((t) => t + 1); }, 500);
    };

    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let missed = 0;
    let pinging = false;

    (async () => {
      let exec: LiveExec | null = null;
      try {
        const transport = await withTimeout(makeTransport(), 20000);
        if (state.dead) { transport.close(); return; }
        state.transport = transport;
        touch();
        // 所有 exec 带超时：传输层死掉时 Files/Git 快速失败而不是永久转圈
        // （死没死由心跳判定——慢命令 ≠ 连接死了）
        exec = async (cmd, c) => {
          const r = await withTimeout(transport.exec(cmd, c ? { cwd: c } : undefined), EXEC_TIMEOUT_MS);
          touch();
          return r;
        };
        // transport 就绪：exec 先行可用，agent 还在启动
        setStatus(() => ({ session: null, status: 'connecting', error: null, exec }));
        const live = await LiveAgent.connect({
          transport, cmd: agentCmd, cwd, agentId,
          persist: true,              // agent 进程脱离 SSH 存活,断连任务照跑
          notify: notifyIfBackground, // 后台时 turn 完成/待权限弹本地通知
          onActivity: touch,          // agent 流量即心跳
        });
        if (state.dead) { live.dispose(); transport.close(); return; }
        state.live = live;
        const session = await live.resumeOrNewThread();
        if (state.dead) { live.dispose(); transport.close(); return; }
        state.attempts = 0; // 连上了，清空失败计数
        touch();
        setStatus(() => ({ session, status: 'on', error: null, exec }));

        // 心跳：近 5s 内有真实流量就不 ping（流量本身证明连接活着）
        heartbeat = setInterval(async () => {
          if (state.dead || pinging) return;
          if (Date.now() - state.lastActivity < HEARTBEAT_INTERVAL_MS) {
            missed = 0;
            return;
          }
          pinging = true;
          try {
            await withTimeout(transport.exec('true'), HEARTBEAT_TIMEOUT_MS);
            touch();
            missed = 0;
            if (statusRef.current === 'degraded' && !state.dead) {
              setStatus((b) => ({ ...b, status: 'on' }));
            }
          } catch (err) {
            missed++;
            if (missed >= MAX_MISSED_HEARTBEATS) {
              markLost(`${missed} missed heartbeats: ${err}`);
            } else if (statusRef.current === 'on' && !state.dead) {
              setStatus((b) => ({ ...b, status: 'degraded' }));
            }
          } finally {
            pinging = false;
          }
        }, HEARTBEAT_INTERVAL_MS);
      } catch (err) {
        // 连接失败：计数 +1；3 次以内 3s 后自动再试，用尽转 error 等手动/回前台
        if (!state.dead) {
          state.attempts += 1;
          if (state.attempts < MAX_RECONNECT_ATTEMPTS) {
            console.warn(`[conn] attempt ${state.attempts} failed, retrying…`, err);
            setStatus((b) => ({ ...b, session: null, status: 'lost', error: String(err), exec }));
            if (state.retry) clearTimeout(state.retry);
            state.retry = setTimeout(() => { if (!state.dead) setTick((t) => t + 1); }, RECONNECT_SPACING_MS);
          } else {
            setStatus(() => ({ session: null, status: 'error', error: String(err), exec }));
          }
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

  // 手机特有：回到前台立即探活。冻结期间 TCP 多半已死，不等心跳慢慢数。
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || ref.current.dead) return;
      const st = statusRef.current;
      if (st === 'lost' || st === 'error' || st === 'degraded') {
        reconnect();
      } else if (st === 'on') {
        const transport = ref.current.transport;
        if (!transport) return;
        withTimeout(transport.exec('true'), HEARTBEAT_TIMEOUT_MS).then(
          () => { ref.current.lastActivity = Date.now(); },
          () => { if (!ref.current.dead) reconnect(); },
        );
      }
    });
    return () => sub.remove();
  }, [reconnect]);

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
