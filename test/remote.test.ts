// remote.ts 对真实进程/文件系统的测试：bridge → WsTransport → exec。
// 跑法: npx vitest run test/remote.test.ts

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WsTransport } from '../src/core/ws-transport';
import { statProjects, listDirs, detectAgents, scanGitRepos, shq } from '../src/core/remote';

const PORT = 18791;
let bridge: ChildProcess;
let transport: WsTransport;
let root: string;

const exec = (cmd: string, cwd?: string) => transport.exec(cmd, cwd ? { cwd } : undefined);

beforeAll(async () => {
  // 造真实的测试目录：一个干净 repo、一个脏 repo、一个非 git 目录
  root = mkdtempSync(join(tmpdir(), 'macp-remote-'));
  const mk = (name: string) => { const p = join(root, name); mkdirSync(p, { recursive: true }); return p; };
  const git = (dir: string, cmd: string) => execSync(`git ${cmd}`, { cwd: dir, env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });

  const clean = mk('clean-repo');
  git(clean, 'init -b main');
  writeFileSync(join(clean, 'a.txt'), 'hello\n');
  git(clean, 'add .');
  git(clean, 'commit -m init');

  const dirty = mk("dirty repo'with quote"); // 路径带空格和单引号，考验 shq
  git(dirty, 'init -b feat/x');
  writeFileSync(join(dirty, 'a.txt'), '1\n');
  git(dirty, 'add .');
  git(dirty, 'commit -m init');
  writeFileSync(join(dirty, 'a.txt'), '2\n');       // modified
  writeFileSync(join(dirty, 'b.txt'), 'new\n');     // untracked

  mk('plain-dir/sub');

  bridge = spawn('node', [join(__dirname, '../bridge/server.mjs'), '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    bridge.stdout!.on('data', (d: Buffer) => { if (d.toString().includes('listening')) resolve(); });
    bridge.on('exit', () => reject(new Error('bridge died')));
  });
  transport = new WsTransport(`ws://127.0.0.1:${PORT}`);
  await exec('true'); // 等连接就绪
}, 20000);

afterAll(() => {
  transport?.close();
  bridge?.kill();
  rmSync(root, { recursive: true, force: true });
});

describe('statProjects', () => {
  it('reports real branch and dirty count', async () => {
    const res = await statProjects(exec, [
      join(root, 'clean-repo'),
      join(root, "dirty repo'with quote"),
      join(root, 'plain-dir'),
      join(root, 'does-not-exist'),
    ]);
    expect(res[0]).toMatchObject({ isGit: true, exists: true, branch: 'main', dirty: 0 });
    expect(res[1]).toMatchObject({ isGit: true, exists: true, branch: 'feat/x', dirty: 2 });
    expect(res[2]).toMatchObject({ isGit: false, exists: true, branch: '' });
    expect(res[3]).toMatchObject({ exists: false });
    expect(res[1].name).toBe("dirty repo'with quote");
  });
});

describe('listDirs', () => {
  it('lists only directories', async () => {
    const dirs = await listDirs(exec, root);
    expect(dirs).toContain('clean-repo');
    expect(dirs).toContain('plain-dir');
    const sub = await listDirs(exec, join(root, 'plain-dir'));
    expect(sub).toEqual(['sub']);
  });
  it('returns [] for missing path', async () => {
    expect(await listDirs(exec, join(root, 'nope'))).toEqual([]);
  });
});

describe('detectAgents', () => {
  it('detects installed agents on this machine', async () => {
    const agents = await detectAgents(exec);
    expect(agents).toHaveLength(3);
    const claude = agents.find(a => a.id === 'claude')!;
    // 本机装了 claude CLI
    expect(claude.ok).toBe(true);
    expect(claude.version).toMatch(/\d/);
  });
});

describe('scanGitRepos', () => {
  it('finds repos under home', async () => {
    const repos = await scanGitRepos(exec);
    expect(Array.isArray(repos)).toBe(true);
    for (const r of repos) expect(r.startsWith('~/')).toBe(true);
  });
});

describe('shq', () => {
  it('round-trips weird paths through a real shell', async () => {
    const weird = join(root, "dirty repo'with quote");
    const res = await exec(`ls ${shq(weird)}`);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('a.txt');
  });
  it('keeps ~ expandable', async () => {
    const res = await exec(`echo ${shq('~/somewhere')}`);
    expect(res.stdout.trim()).toBe(`${process.env.HOME}/somewhere`);
  });
});
