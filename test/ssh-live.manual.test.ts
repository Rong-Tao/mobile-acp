// 手动验收：remote.ts 过真实 SSH 的只读测试，主机无关。
// 不进 CI（文件名含 .manual.），不写远端任何东西。
// 跑法: SSH_TEST_HOST=<host> npx vitest run test/ssh-live.manual.test.ts
//       （host 是 ~/.ssh/config 里的别名，如 stray.exe.xyz / gcp-test）

import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { statProjects, listDirs, scanGitRepos, detectAgents, shq, type Exec } from '../src/core/remote';

const HOST = process.env.SSH_TEST_HOST || 'stray.exe.xyz';

// 与 app 内 JSch exec 同语义：整段命令交给远端 shell 执行
const exec: Exec = (cmd, cwd) => new Promise((resolve) => {
  const full = cwd ? `cd ${shq(cwd)} && { ${cmd}; }` : cmd;
  const child = execFile('ssh', ['-o', 'BatchMode=yes', HOST, 'bash -s'],
    { maxBuffer: 10 * 1024 * 1024 },
    (err: any, stdout, stderr) => resolve({ stdout, stderr, code: err?.code ?? 0 }));
  child.stdin!.end(full);
});

describe(`remote.ts over real ssh to ${HOST} (read-only)`, () => {
  it('listDirs lists home directories and can enter one', async () => {
    const dirs = await listDirs(exec, '~');
    expect(dirs.length).toBeGreaterThan(0);
    const sub = await listDirs(exec, `~/${dirs[0]}`);
    expect(Array.isArray(sub)).toBe(true);
  }, 30000);

  it('scanGitRepos finds repos with ~ paths', async () => {
    const repos = await scanGitRepos(exec);
    expect(repos.length).toBeGreaterThan(0);
    for (const r of repos) expect(r.startsWith('~/')).toBe(true);
  }, 60000);

  it('statProjects reports real branch for a scanned repo, flags missing dirs', async () => {
    const repos = await scanGitRepos(exec);
    const [repo, missing] = await statProjects(exec, [repos[0], '~/no-such-dir-xyz']);
    expect(repo).toMatchObject({ exists: true, isGit: true });
    expect(repo.branch.length).toBeGreaterThan(0);
    expect(repo.dirty).toBeGreaterThanOrEqual(0);
    expect(missing.exists).toBe(false);
  }, 60000);

  it('detectAgents probes all known agents without error', async () => {
    const agents = await detectAgents(exec);
    expect(agents).toHaveLength(3);
    for (const a of agents) expect(typeof a.ok).toBe('boolean');
    console.log(`${HOST} agents:`, agents.map(a => `${a.bin}=${a.ok ? (a.version || 'yes') : 'no'}`).join(' '));
  }, 30000);

  it('shq round-trips paths through the real remote shell', async () => {
    const res = await exec(`echo ${shq('~/somewhere')}`);
    expect(res.stdout.trim()).toMatch(/^\/.+\/somewhere$/);
  }, 30000);
});
