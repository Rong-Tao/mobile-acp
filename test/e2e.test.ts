// e2e：bridge → WsTransport → AgentClient → SessionStore，对真实 claude-agent-acp。
// 跑法: npx vitest run test/e2e.test.ts
// 前提: 本机 claude 已登录（~/.claude/.credentials.json）。

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WsTransport } from '../src/core/ws-transport';
import { AgentClient } from '../src/core/acp/agent-client';
import { SessionStore } from '../src/core/acp/session-store';

const PORT = 18790;
let bridge: ChildProcess;
let transport: WsTransport;
let agent: AgentClient | null = null;

beforeAll(async () => {
  bridge = spawn('node', [join(__dirname, '../bridge/server.mjs'), '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    bridge.stdout!.on('data', (d: Buffer) => {
      if (d.toString().includes('listening')) resolve();
    });
    bridge.on('exit', () => reject(new Error('bridge died')));
  });
  transport = new WsTransport(`ws://127.0.0.1:${PORT}`);
});

afterAll(() => {
  agent?.stop();
  transport?.close();
  bridge?.kill();
});

describe('transport', () => {
  it('exec runs one-shot commands', async () => {
    const r = await transport.exec('echo hello-bridge');
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe('hello-bridge');
  });

  it('exec reports failures', async () => {
    const r = await transport.exec('false');
    expect(r.code).not.toBe(0);
  });

  it('spawn streams stdio', async () => {
    const ch = await transport.spawn({ cmd: 'cat' });
    const got = new Promise<string>((resolve) => ch.onData(resolve));
    ch.write('ping\n');
    expect((await got).trim()).toBe('ping');
    ch.kill();
  });
});

describe('acp against real claude-agent-acp', () => {
  const store = new SessionStore();
  const cwd = mkdtempSync(join(tmpdir(), 'mobile-acp-e2e-'));

  it('initialize negotiates capabilities', async () => {
    agent = await AgentClient.start({
      transport,
      cmd: 'npx -y @agentclientprotocol/claude-agent-acp',
      cwd,
      handlers: {
        onSessionUpdate: (n) => store.apply(n),
        onPermissionRequest: async (req) => {
          // 自动选第一个 allow 选项
          const allow = req.options.find((o) => o.kind === 'allow_once') ?? req.options[0];
          return { outcome: { outcome: 'selected', optionId: allow.optionId } };
        },
        onStderr: (l) => process.stderr.write(`[agent] ${l}`),
      },
    });
    expect(agent.init.protocolVersion).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it('session/new returns sessionId and modes', async () => {
    const s = await agent!.newSession(cwd);
    expect(s.sessionId).toBeTruthy();
    (globalThis as Record<string, unknown>).__sid = s.sessionId;
    if (s.modes) {
      expect(s.modes.availableModes.length).toBeGreaterThan(0);
      store.apply({
        sessionId: s.sessionId,
        update: { sessionUpdate: 'current_mode_update', currentModeId: s.modes.currentModeId },
      });
    }
  }, 60_000);

  it('prompt streams agent_message_chunk to store', async () => {
    const sid = (globalThis as Record<string, unknown>).__sid as string;
    store.addUserMessage([{ type: 'text', text: 'Reply with exactly the word: pong' }]);
    const resp = await agent!.prompt(sid, [{ type: 'text', text: 'Reply with exactly the word: pong' }]);
    expect(resp.stopReason).toBe('end_turn');
    const text = store
      .getState()
      .entries.filter((e) => e.type === 'assistant_message')
      .map((e) => (e as { text: string }).text)
      .join('');
    expect(text.toLowerCase()).toContain('pong');
  }, 120_000);

  it('tool calls flow through with status transitions', async () => {
    const sid = (globalThis as Record<string, unknown>).__sid as string;
    const resp = await agent!.prompt(sid, [
      { type: 'text', text: `Create a file named marker.txt in ${cwd} containing "hi". Use a tool, then stop.` },
    ]);
    expect(['end_turn', 'max_turn_requests']).toContain(resp.stopReason);
    const calls = store.getState().entries.filter((e) => e.type === 'tool_call');
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.some((c) => (c as { status: string }).status === 'completed')).toBe(true);
  }, 180_000);
});
