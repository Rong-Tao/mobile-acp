// 手动验收：app 的 ACP 栈（AgentClient + LiveSession）经真实 SSH 在 GCP 上
// 启动 claude-agent-acp 并完成握手（initialize + session/new，不发 prompt）。
// 复现真机路径：非交互 shell、spawn + exec 语义与 JSch 一致。
// 跑法: SSH_TEST_HOST=gcp-test npx vitest run test/gcp-acp.manual.test.ts

import '../src/polyfills';
import { afterAll, describe, expect, it } from 'vitest';
import { spawn, execFile } from 'node:child_process';
import type { Channel, ExecResult, SpawnOptions, Transport } from '../src/core/transport';
import { LiveSession } from '../src/core/live';

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
    const session = await LiveSession.connect({
      transport,
      cmd: 'npx -y @agentclientprotocol/claude-agent-acp',
      cwd: '~/dooplex',
    });
    expect(session.sessionId).toBeTruthy();
    console.log('sessionId:', session.sessionId, 'modes:', session.modes?.currentModeId);
    session.dispose();
  }, 180000);
});
