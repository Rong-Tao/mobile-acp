#!/usr/bin/env node
// combined.mjs：一个端口同时跑静态文件服务（Expo web build）和 bridge WebSocket。
// 解决 exe.dev 代理只暴露单个端口、不能开多端口 WebSocket 的问题。
//
// 用法: node bridge/combined.mjs [--port 8081] [--dist ./dist] [--token <secret>]

import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { spawn, exec } from 'node:child_process';

const args = process.argv.slice(2);
const argOf = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const PORT   = Number(argOf('--port', process.env.PORT || 8081));
const TOKEN  = argOf('--token', process.env.BRIDGE_TOKEN || '');
const DIST   = resolve(argOf('--dist', join(import.meta.dirname, '..', 'dist')));
const HOME   = process.env.HOME || '/root';

const expandCwd = (p) => {
  if (!p) return HOME;
  if (p === '~') return HOME;
  if (p.startsWith('~/')) return HOME + p.slice(1);
  return p;
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

// ── HTTP: serve dist/ ─────────────────────────────────────────
const httpServer = createServer(async (req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = join(DIST, urlPath);
  // 防路径穿越
  if (!filePath.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  try {
    await stat(filePath);
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    // SPA fallback：路径不存在时发 index.html
    try {
      const data = await readFile(join(DIST, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    } catch {
      res.writeHead(500); res.end('dist/ not found — run: npx expo export -p web --output-dir dist');
    }
  }
});

// ── WebSocket: bridge ─────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  if (TOKEN) {
    const url = new URL(req.url, 'http://x');
    if (url.searchParams.get('token') !== TOKEN) { ws.close(4001, 'bad token'); return; }
  }
  console.log('[bridge] client connected from', req.socket.remoteAddress);
  const procs = new Map();

  const send = (msg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return send({ op: 'error', message: 'bad json' }); }

    if (m.op === 'spawn') {
      try {
        const p = spawn(m.cmd, {
          shell: true, cwd: expandCwd(m.cwd),
          env: { ...process.env, ...(m.env || {}) },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        procs.set(m.ch, p);
        p.stdout.on('data', (d) => send({ op: 'stdout', ch: m.ch, data: d.toString() }));
        p.stderr.on('data', (d) => send({ op: 'stderr', ch: m.ch, data: d.toString() }));
        p.on('exit', (code) => { send({ op: 'exit', ch: m.ch, code }); procs.delete(m.ch); });
        p.on('error', (e) => send({ op: 'error', ch: m.ch, message: String(e) }));
        send({ op: 'spawned', ch: m.ch, pid: p.pid });
        console.log(`[bridge] spawn ch=${m.ch} pid=${p.pid}: ${m.cmd}`);
      } catch (e) { send({ op: 'error', ch: m.ch, message: String(e) }); }
    } else if (m.op === 'stdin') {
      procs.get(m.ch)?.stdin.write(m.data);
    } else if (m.op === 'kill') {
      procs.get(m.ch)?.kill('SIGTERM');
    } else if (m.op === 'exec') {
      exec(m.cmd, { cwd: expandCwd(m.cwd), maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
        send({ op: 'exec-result', id: m.id, stdout, stderr, code: err ? (err.code ?? 1) : 0 });
      });
    }
  });

  ws.on('close', () => {
    console.log('[bridge] client disconnected');
    for (const p of procs.values()) p.kill('SIGTERM');
    procs.clear();
  });
});

httpServer.listen(PORT, () => {
  console.log(`[combined] http+ws on :${PORT}  dist=${DIST}`);
});
