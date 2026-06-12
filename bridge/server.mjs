#!/usr/bin/env node
// dev bridge：WebSocket ↔ 子进程多路复用。
// 跑在目标服务器上，让 app（Expo web / Expo Go）不需要原生 SSH 模块
// 就能联调真 agent。生产环境由原生 SSH transport 取代，协议语义相同。
//
// 用法: node bridge/server.mjs [--port 8790] [--token <secret>]
//
// 消息协议（JSON per message）:
//   client → server:
//     {op:'spawn', ch, cmd, cwd?, env?}     启动进程（shell 解析 cmd）
//     {op:'stdin', ch, data}                写进程 stdin
//     {op:'kill', ch}                       杀进程
//     {op:'exec', id, cmd, cwd?}            单发命令，收集输出
//   server → client:
//     {op:'spawned', ch, pid}
//     {op:'stdout'|'stderr', ch, data}
//     {op:'exit', ch, code}
//     {op:'exec-result', id, stdout, stderr, code}
//     {op:'error', ch?, id?, message}

import { WebSocketServer } from 'ws';
import { spawn, exec } from 'node:child_process';

const args = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const PORT = Number(argOf('--port', process.env.BRIDGE_PORT || 8790));
const TOKEN = argOf('--token', process.env.BRIDGE_TOKEN || '');

const wss = new WebSocketServer({ port: PORT });
console.log(`[bridge] listening on :${PORT}${TOKEN ? ' (token required)' : ''}`);

wss.on('connection', (ws, req) => {
  if (TOKEN) {
    const url = new URL(req.url, 'http://x');
    if (url.searchParams.get('token') !== TOKEN) {
      ws.close(4001, 'bad token');
      return;
    }
  }
  console.log('[bridge] client connected');
  const procs = new Map(); // ch -> ChildProcess

  const send = (msg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  ws.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(raw.toString());
    } catch {
      return send({ op: 'error', message: 'bad json' });
    }

    if (m.op === 'spawn') {
      try {
        const p = spawn(m.cmd, {
          shell: true,
          cwd: m.cwd || process.env.HOME,
          env: { ...process.env, ...(m.env || {}) },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        procs.set(m.ch, p);
        p.stdout.on('data', (d) => send({ op: 'stdout', ch: m.ch, data: d.toString() }));
        p.stderr.on('data', (d) => send({ op: 'stderr', ch: m.ch, data: d.toString() }));
        p.on('exit', (code) => {
          send({ op: 'exit', ch: m.ch, code });
          procs.delete(m.ch);
        });
        p.on('error', (err) => send({ op: 'error', ch: m.ch, message: String(err) }));
        send({ op: 'spawned', ch: m.ch, pid: p.pid });
        console.log(`[bridge] spawn ch=${m.ch} pid=${p.pid}: ${m.cmd}`);
      } catch (err) {
        send({ op: 'error', ch: m.ch, message: String(err) });
      }
    } else if (m.op === 'stdin') {
      procs.get(m.ch)?.stdin.write(m.data);
    } else if (m.op === 'kill') {
      procs.get(m.ch)?.kill('SIGTERM');
    } else if (m.op === 'exec') {
      exec(m.cmd, { cwd: m.cwd || process.env.HOME, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
        send({ op: 'exec-result', id: m.id, stdout, stderr, code: err ? (err.code ?? 1) : 0 });
      });
    }
  });

  ws.on('close', () => {
    console.log('[bridge] client disconnected, killing children');
    for (const p of procs.values()) p.kill('SIGTERM');
    procs.clear();
  });
});
