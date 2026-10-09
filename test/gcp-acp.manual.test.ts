// 手动验收：app 的 ACP 栈（AgentClient + LiveSession）经真实 SSH 在 GCP 上
// 启动 claude-agent-acp 并完成握手（initialize + session/new，不发 prompt）。
// 复现真机路径：非交互 shell、spawn + exec 语义与 JSch 一致。
// 跑法: SSH_TEST_HOST=gcp-test npx vitest run test/gcp-acp.manual.test.ts

import '../src/polyfills';
import { afterAll, describe, expect, it } from 'vitest';
import { spawn, execFile } from 'node:child_process';
import type { Channel, ExecResult, SpawnOptions, Transport } from '../src/core/transport';
import { LiveAgent } from '../src/core/live';

const HOST = process.env.SSH_TEST_HOST || 'gcp-test';
const open: { kill: () => void }[] = [];

// ssh 子进程实现 Transport——语义对齐 JSch：非交互 shell，cd cwd && cmd
const transport: Transport = {
  async spawn(opts: SpawnOptions): Promise<Channel> {
    const envPrefix = Object.entries(opts.env ?? {})
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
    const remote = `${opts.cwd ? `cd ${JSON.stringify(opts.cwd)} && ` : ''}${envPrefix ? envPrefix + ' ' : ''}exec ${opts.cmd}`;
    const child = spawn('ssh', [HOST, remote], { stdio: ['pipe', 'pipe', 'pipe'] });
    open.push({ kill: () => child.kill() });
    const dataCbs = new Set<(c: string) => void>();
    const errCbs = new Set<(c: string) => void>();
    const exitCbs = new Set<(c: number | null) => void>();
    child.stdout.on('data', (d: Buffer) => dataCbs.forEach(cb => cb(d.toString())));
    child.stderr.on('data', (d: Buffer) => errCbs.forEach(cb => cb(d.toString())));
    child.on('exit', (code) => exitCbs.forEach(cb => cb(code)));
    return {
      write: (data) => child.stdin.write(data),
      kill: () => child.kill(),
      onData: (cb) => { dataCbs.add(cb); return () => dataCbs.delete(cb); },
      onStderr: (cb) => { errCbs.add(cb); return () => errCbs.delete(cb); },
      onExit: (cb) => { exitCbs.add(cb); return () => exitCbs.delete(cb); },
    };
  },
  exec(cmd: string, opts?: { cwd?: string }): Promise<ExecResult> {
    const full = opts?.cwd ? `cd ${JSON.stringify(opts.cwd)} && { ${cmd}; }` : cmd;
    return new Promise((resolve) => {
      const child = execFile('ssh', [HOST, 'bash -s'], { maxBuffer: 10 * 1024 * 1024 },
        (err: any, stdout, stderr) => resolve({ stdout, stderr, code: err?.code ?? 0 }));
      child.stdin!.end(full);
    });
  },
  close() { open.forEach(p => p.kill()); },
};

afterAll(() => transport.close());

describe(`ACP handshake on ${HOST} (real ssh, non-interactive shell)`, () => {
  it('starts claude-agent-acp and creates a session in ~/dooplex', async () => {
    const agent = await LiveAgent.connect({
      transport,
      cmd: 'npx -y @agentclientprotocol/claude-agent-acp',
      cwd: '~/dooplex',
    });
    const session = await agent.newThread();
    expect(session.sessionId).toBeTruthy();
    console.log('sessionId:', session.sessionId, 'modes:', session.modes?.currentModeId);
    agent.dispose();
  }, 180000);

  it('thread lifecycle in ~/mobile-acp-toy: new → prompt → list → switch → replay', async () => {
    const agent = await LiveAgent.connect({
      transport,
      cmd: 'npx -y @agentclientprotocol/claude-agent-acp',
      cwd: '~/mobile-acp-toy',
      agentId: 'claude',
    });
    try {
      // thread A：真实 prompt（纯问答，不触发工具/权限）
      const a = await agent.newThread();
      const marker = `macp-thread-test-${Date.now()}`;
      await a.send(`Reply with exactly this token and nothing else: ${marker}`);
      const aState = a.store.getState();
      const aReply = aState.entries.filter((e) => e.type === 'assistant_message').map((e: any) => e.text).join('');
      console.log('A:', a.sessionId.slice(0, 8), 'reply:', aReply.trim().slice(0, 60));
      expect(aReply).toContain(marker);

      // session/list 应包含 A（claude 持久化后）
      expect(agent.supportsThreadList).toBe(true);
      const list = await agent.listThreads();
      console.log('threads on GCP:', list.length, list.slice(0, 3).map((t) => `${t.sessionId.slice(0, 8)}·${t.title ?? ''}`));
      expect(list.some((t) => t.sessionId === a.sessionId)).toBe(true);

      // thread B：新开，id 不同，store 独立（空）
      const b = await agent.newThread();
      expect(b.sessionId).not.toBe(a.sessionId);
      expect(b.store.getState().entries.length).toBe(0);
      // A 的 store 不受影响
      expect(a.store.getState().entries.length).toBe(aState.entries.length);

      // 切回 A：内存命中，直接复用同一个 store
      const aAgain = await agent.openThread(a.sessionId);
      expect(aAgain.store).toBe(a.store);

      // 冷加载回放：重开一个 agent 进程（模拟 app 重启），session/load 回放 A
      agent.dispose();
      const agent2 = await LiveAgent.connect({
        transport,
        cmd: 'npx -y @agentclientprotocol/claude-agent-acp',
        cwd: '~/mobile-acp-toy',
        agentId: 'claude',
      });
      try {
        const replayed = await agent2.openThread(a.sessionId);
        const texts = replayed.store.getState().entries
          .map((e: any) => (e.type === 'user_message' ? e.blocks.map((bk: any) => bk.text ?? '').join('') : e.text ?? ''))
          .join('\n');
        console.log('replayed entries:', replayed.store.getState().entries.length);
        expect(texts).toContain(marker); // 用户消息和回复都回放出来
      } finally {
        agent2.dispose();
      }
    } finally {
      agent.dispose();
    }
  }, 600000);
});
