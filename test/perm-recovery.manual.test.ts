// 手动验收：权限请求在 SSH 断连期间发出 → 重连后卡片被找回 → 批准后 agent 继续、busy 清除。
// 跑法: SSH_TEST_HOST=gcp-test npx vitest run test/perm-recovery.manual.test.ts

import '../src/polyfills';
import { afterAll, describe, expect, it, vi } from 'vitest';

// node 里没有原生 AsyncStorage：用内存实现，prefs 才能真正存取
vi.mock('@react-native-async-storage/async-storage', () => {
  const m = new Map<string, string>();
  return { default: { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v) } };
});
import { spawn, execFile } from 'node:child_process';
import type { Channel, ExecResult, SpawnOptions, Transport } from '../src/core/transport';
import { LiveAgent } from '../src/core/live';
import { agentDirExpr } from '../src/core/persist';

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


describe(`permission recovery on ${HOST}`, () => {
  it('orphan permission is recovered after reconnect and can be approved', async () => {
    const AGENT_ID = 'perm-test';
    const CMD = 'npx -y @agentclientprotocol/claude-agent-acp';
    const CWD = '~/mobile-acp-toy';
    const marker = `PERM-${Date.now()}`;
    const connect = () => LiveAgent.connect({ transport, cmd: CMD, cwd: CWD, agentId: AGENT_ID, persist: true });
    const waitFor = async (cond: () => boolean, ms: number, what: string) => {
      const t0 = Date.now();
      while (!cond()) {
        if (Date.now() - t0 > ms) throw new Error('timeout: ' + what);
        await new Promise((r) => setTimeout(r, 500));
      }
    };

    // 连接 1：default 模式，让它跑一个需要批准的命令；请求一出现就"断线"（不答复）
    const a1 = await connect();
    const t1 = await a1.newThread();
    if (t1.modes?.availableModes.some((m) => m.id === 'default')) await t1.setMode('default');
    const sessionId = t1.sessionId;
    t1.send(`Use the Bash tool to run exactly: echo ${marker} > /tmp/${marker}.txt — then reply done.`).catch(() => {});
    await waitFor(() => !!t1.store.getState().pendingPermission, 120000, 'permission request on conn 1');
    a1.dispose(); // 请求属于这条连接，永远没人回
    await new Promise((r) => setTimeout(r, 3000));

    // 连接 2：重连，卡片必须被找回
    const a2 = await connect();
    try {
      const t2 = await a2.openThread(sessionId);
      const st = t2.store.getState();
      expect(st.pendingPermission).toBeTruthy();
      expect(st.busy).toBe(true);
      const allow = st.pendingPermission!.request.options.find((o) => o.kind === 'allow_once')!;
      st.pendingPermission!.resolve(allow.optionId);
      // 批准后：turn 完成 → onTurnEnd 清掉 busy，且命令真的执行了
      await waitFor(() => !t2.store.getState().busy, 120000, 'busy cleared after turn end');
      const r = await transport.exec(`cat /tmp/${marker}.txt`);
      expect(r.stdout.trim()).toBe(marker);
    } finally {
      a2.dispose();
      await transport.exec(`D=${agentDirExpr(CWD.replace('~', '/home/rong'), AGENT_ID)}; kill "$(cat "$D/pid" 2>/dev/null)" 2>/dev/null; rm -rf "$D" /tmp/${marker}.txt; true`);
    }
  }, 400000);

  it('saved mode (agent+project level) is applied when reopening an existing thread', async () => {
    const AGENT_ID = 'perm-test-prefs';
    const CMD = 'npx -y @agentclientprotocol/claude-agent-acp';
    const CWD = '~/mobile-acp-toy';
    const a1 = await LiveAgent.connect({ transport, cmd: CMD, cwd: CWD, agentId: AGENT_ID, persist: true });
    const t1 = await a1.newThread();
    await t1.setMode('default');
    const sessionId = t1.sessionId;
    a1.dispose();
    const a2 = await LiveAgent.connect({ transport, cmd: CMD, cwd: CWD, agentId: AGENT_ID, persist: true });
    try {
      // 用户在别处把偏好改成 bypass，然后重开这个旧 thread
      const t0 = await a2.newThread();
      await t0.setMode('bypassPermissions');
      const t2 = await a2.openThread(sessionId);
      expect(t2.store.getState().currentModeId).toBe('bypassPermissions');
    } finally {
      a2.dispose();
      await transport.exec(`D=${agentDirExpr('/home/rong/mobile-acp-toy', AGENT_ID)}; kill "$(cat "$D/pid" 2>/dev/null)" 2>/dev/null; rm -rf "$D"; true`);
    }
  }, 200000);

  it('turn started on a dropped connection shows busy after reconnect, clears when it ends', async () => {
    const AGENT_ID = 'perm-test-busy';
    const CMD = 'npx -y @agentclientprotocol/claude-agent-acp';
    const CWD = '~/mobile-acp-toy';
    const marker = `BUSY-${Date.now()}`;
    const a1 = await LiveAgent.connect({ transport, cmd: CMD, cwd: CWD, agentId: AGENT_ID, persist: true });
    const t1 = await a1.newThread();
    await t1.setMode('bypassPermissions');
    const sessionId = t1.sessionId;
    t1.send(`Use Bash to run exactly: for i in $(seq 1 30); do sleep 1; done; echo ${marker} — then reply with the marker.`).catch(() => {});
    await new Promise((r) => setTimeout(r, 12000)); // 让 tool call 先出现
    a1.dispose();
    const a2 = await LiveAgent.connect({ transport, cmd: CMD, cwd: CWD, agentId: AGENT_ID, persist: true });
    try {
      const t2 = await a2.openThread(sessionId);
      expect(t2.store.getState().busy).toBe(true); // 回放末尾 tool call 仍在跑
      const t0 = Date.now();
      while (t2.store.getState().busy) {
        if (Date.now() - t0 > 90000) throw new Error('busy never cleared');
        await new Promise((r) => setTimeout(r, 500));
      }
      const texts = t2.store.getState().entries
        .map((e) => ('text' in e ? e.text : e.type === 'tool_call' ? JSON.stringify(e.content) : '')).join('\n');
      expect(texts).toContain(marker); // 结束前的实时输出已入列
    } finally {
      a2.dispose();
      await transport.exec(`D=${agentDirExpr('/home/rong/mobile-acp-toy', AGENT_ID)}; kill "$(cat "$D/pid" 2>/dev/null)" 2>/dev/null; rm -rf "$D"; true`);
    }
  }, 300000);
});
