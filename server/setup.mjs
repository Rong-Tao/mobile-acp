#!/usr/bin/env node
/**
 * mobile-acp setup — run on your server to pair it with the mobile app.
 *
 * Starts a short-lived HTTP server (5 min), prints a QR code the app scans,
 * receives the phone's public key, and appends it to ~/.ssh/authorized_keys.
 * No existing SSH key needed.
 *
 * One-liner:        curl -fsSL https://raw.githubusercontent.com/Rong-Tao/mobile-acp/main/server/install.sh | bash
 * From repo clone:  node server/setup.mjs
 */

import { createServer }            from 'node:http';
import { networkInterfaces, userInfo, homedir } from 'node:os';
import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join }                    from 'node:path';
import { randomBytes }             from 'node:crypto';
import { createInterface }         from 'node:readline';

// ── auto-install qrcode if missing ────────────────────────────
let qrcode;
try {
  qrcode = (await import('qrcode')).default;
} catch {
  const { execSync } = await import('node:child_process');
  const dir = join(homedir(), '.mobile-acp-deps');
  mkdirSync(dir, { recursive: true });
  console.log('Installing qrcode (one-time)…');
  execSync(`npm install --prefix ${JSON.stringify(dir)} --no-fund --no-audit qrcode`, { stdio: 'inherit' });
  qrcode = (await import(join(dir, 'node_modules', 'qrcode', 'lib', 'index.js'))).default;
}

const EXPIRY_SEC  = 300;   // 5 minutes
const SETUP_PORT  = 2222;  // preferred pairing server port (falls back to random)

// ── helpers ───────────────────────────────────────────────────
function localIPs() {
  const out = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    }
  }
  return out;
}

async function pickIP(ips) {
  if (ips.length === 0) return '127.0.0.1';
  if (ips.length === 1) return ips[0];
  console.log('\nMultiple interfaces detected:');
  ips.forEach((ip, i) => console.log(`  [${i + 1}] ${ip}`));

  // When run via `curl | bash`, stdin is the pipe (not a TTY) — auto-pick the first IP.
  if (!process.stdin.isTTY) {
    console.log(`\nAuto-selected ${ips[0]} (run directly for interactive selection)`);
    return ips[0];
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question('\nSelect [1]: ', answer => {
      rl.close();
      const idx = Math.max(0, Math.min(parseInt(answer || '1', 10) - 1, ips.length - 1));
      resolve(ips[idx]);
    });
  });
}

async function freePort(preferred) {
  return new Promise(resolve => {
    const s = createServer();
    s.listen(preferred, () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', () => {
      const s2 = createServer();
      s2.listen(0, () => { const p = s2.address().port; s2.close(() => resolve(p)); });
    });
  });
}

function addToAuthorizedKeys(pubkey) {
  const sshDir  = join(homedir(), '.ssh');
  const akPath  = join(sshDir, 'authorized_keys');
  mkdirSync(sshDir, { recursive: true, mode: 0o700 });

  const keyBody = pubkey.trim().split(' ').slice(0, 2).join(' ');
  if (existsSync(akPath) && readFileSync(akPath, 'utf8').includes(keyBody)) {
    return 'duplicate';
  }
  appendFileSync(akPath, '\n' + pubkey.trim() + '\n', { mode: 0o600 });
  return 'added';
}

// ── main ──────────────────────────────────────────────────────
const ips      = localIPs();
const host     = await pickIP(ips);
const port     = await freePort(SETUP_PORT);
const token    = randomBytes(16).toString('hex');
const expiry   = Math.floor(Date.now() / 1000) + EXPIRY_SEC;
const sshUser  = userInfo().username;
const sshPort  = 22;

const payload  = JSON.stringify({ h: host, p: sshPort, u: sshUser, sp: port, t: token, e: expiry });

let done = false;

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method !== 'POST' || req.url !== '/pair') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  const supplied = (req.headers['authorization'] ?? '').replace(/^Bearer /, '').trim();
  if (supplied !== token) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid token' }));
    return;
  }
  if (Math.floor(Date.now() / 1000) > expiry) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'token expired' }));
    return;
  }

  let body = '';
  req.on('data', d => { body += d; });
  req.on('end', () => {
    try {
      const { pubkey, name } = JSON.parse(body);
      if (!pubkey || typeof pubkey !== 'string' || !pubkey.startsWith('ssh-')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid pubkey' }));
        return;
      }
      const result = addToAuthorizedKeys(pubkey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, user: sshUser, result }));

      process.stdout.write('\r\x1b[K');   // clear spinner line
      console.log(`\n\x1b[32m✓ Paired!\x1b[0m`);
      if (name) console.log(`  Device : ${name}`);
      console.log(`  Key    : ${result === 'duplicate' ? 'already present' : 'added to ~/.ssh/authorized_keys'}`);
      console.log(`  Connect: ${sshUser}@${host} (port ${sshPort})\n`);

      done = true;
      setTimeout(() => { server.close(); process.exit(0); }, 800);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid json' }));
    }
  });
});

server.listen(port, '0.0.0.0', async () => {
  console.clear();
  console.log('\x1b[36m\x1b[1mmobile-acp\x1b[0m  SSH key pairing\n');
  console.log(`  Server  : \x1b[1m${sshUser}@${host}:${sshPort}\x1b[0m`);
  console.log(`  Pairing : port ${port}  ·  expires in ${EXPIRY_SEC / 60} min\n`);

  const qrStr = await qrcode.toString(payload, { type: 'terminal', small: true });
  console.log(qrStr);
  console.log('Open mobile-acp → Add Server → Scan QR\n');

  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let fi = 0;
  const ticker = setInterval(() => {
    if (done) return;
    const rem = expiry - Math.floor(Date.now() / 1000);
    if (rem <= 0) { clearInterval(ticker); return; }
    const m = Math.floor(rem / 60), s = rem % 60;
    process.stdout.write(`\r${frames[fi++ % frames.length]} Waiting… (${m}:${String(s).padStart(2,'0')} remaining)`);
  }, 120);

  setTimeout(() => {
    clearInterval(ticker);
    if (!done) {
      process.stdout.write('\r\x1b[K');
      console.log('\x1b[31mExpired. Run the command again.\x1b[0m\n');
      server.close();
      process.exit(1);
    }
  }, EXPIRY_SEC * 1000);
});
