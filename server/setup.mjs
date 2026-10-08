#!/usr/bin/env node
/**
 * mobile-acp setup — run on your server to pair it with the mobile app.
 *
 * Prints a QR code with the connection details (host / SSH port / user).
 * The app scans it, generates an Ed25519 key on the phone, and shows the
 * public key — paste that line here and it is appended to
 * ~/.ssh/authorized_keys. No inbound ports, no firewall changes.
 *
 * One-liner:        curl -fsSL https://raw.githubusercontent.com/Rong-Tao/mobile-acp/main/server/install.sh | bash
 * From repo clone:  node server/setup.mjs
 */

import { networkInterfaces, userInfo, homedir } from 'node:os';
import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join }            from 'node:path';
import { createInterface } from 'node:readline';

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

// ── helpers ───────────────────────────────────────────────────
const PRIVATE_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/;

function localIPs() {
  const out = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    }
  }
  return out;
}

// Cloud VMs only see their private IP on local interfaces; the phone needs
// the public one. Ask an external echo service (2s timeout, best effort).
async function publicIP() {
  for (const url of ['https://api.ipify.org', 'https://checkip.amazonaws.com']) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      const ip = (await res.text()).trim();
      if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
    } catch { /* try next */ }
  }
  return null;
}

async function pickHost() {
  // Explicit override wins: MOBILE_ACP_HOST=my.host.example
  if (process.env.MOBILE_ACP_HOST) return process.env.MOBILE_ACP_HOST;
  const pub = await publicIP();
  if (pub) return pub;
  const ips = localIPs();
  return ips[0] ?? '127.0.0.1';
}

function detectSshPort() {
  // Running over SSH? SSH_CONNECTION = "<client-ip> <client-port> <server-ip> <server-port>"
  // — the 4th field is the port sshd actually accepted this session on.
  const sc = (process.env.SSH_CONNECTION ?? '').trim().split(/\s+/);
  if (sc.length === 4 && /^\d+$/.test(sc[3])) return parseInt(sc[3], 10);
  try {
    const conf = readFileSync('/etc/ssh/sshd_config', 'utf8');
    const m = conf.match(/^\s*Port\s+(\d+)/m);
    if (m) return parseInt(m[1], 10);
  } catch { /* unreadable: fall through */ }
  return 22;
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
const host    = await pickHost();
const sshPort = detectSshPort();
const sshUser = userInfo().username;

const payload = JSON.stringify({ h: host, p: sshPort, u: sshUser });

console.clear();
console.log('\x1b[36m\x1b[1mmobile-acp\x1b[0m  SSH key pairing\n');
console.log(`  Server : \x1b[1m${sshUser}@${host}:${sshPort}\x1b[0m`);
if (PRIVATE_RE.test(host)) {
  console.log(`  ⚠ ${host} looks like a private address — if the phone will connect`);
  console.log(`    from elsewhere, rerun with MOBILE_ACP_HOST=<public-ip-or-hostname>.`);
}
console.log('');

console.log(await qrcode.toString(payload, { type: 'terminal', small: true }));
console.log('Open mobile-acp → Add Server → Scan QR.');
console.log('The app will show the phone\'s public key — paste it below');
console.log('(send it to this machine however you like; it\'s public, any channel is fine).\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask() {
  rl.question('\x1b[1mPaste public key:\x1b[0m ', line => {
    const key = line.trim();
    if (key === '') { ask(); return; }
    if (!/^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+)\s+[A-Za-z0-9+/=]+/.test(key)) {
      console.log('\x1b[31m✗ That doesn\'t look like an OpenSSH public key (expected e.g. "ssh-ed25519 AAAA… mobile-acp").\x1b[0m');
      ask();
      return;
    }
    const result = addToAuthorizedKeys(key);
    console.log(`\n\x1b[32m✓ Done!\x1b[0m Key ${result === 'duplicate' ? 'was already present in' : 'added to'} ~/.ssh/authorized_keys`);
    console.log(`  Now tap \x1b[1mTest connection\x1b[0m in the app → ${sshUser}@${host}:${sshPort}\n`);
    rl.close();
  });
}
ask();
