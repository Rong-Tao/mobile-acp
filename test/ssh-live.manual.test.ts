// 手动验收：remote.ts 过真实 SSH（stray.exe.xyz）只读测试。
// 不进 CI（文件名含 .manual.），不写远端任何东西。
// 跑法: npx vitest run test/ssh-live.manual.test.ts

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
  it('listDirs lists real home directories', async () => {
    const dirs = await listDirs(exec, '~');
    expect(dirs.length).toBeGreaterThan(0);
    expect(dirs).toContain('stray');
    expect(dirs).toContain('web');
  }, 30000);

  it('scanGitRepos finds real repos', async () => {
    const repos = await scanGitRepos(exec);
    expect(repos).toContain('~/stray-mail');
    for (const r of repos) expect(r.startsWith('~/')).toBe(true);
  }, 30000);

  it('statProjects reports real branch/dirty for stray-mail', async () => {
    const [mail, web, missing] = await statProjects(exec, ['~/stray-mail', '~/web', '~/no-such-dir-xyz']);
    expect(mail).toMatchObject({ exists: true, isGit: true, name: 'stray-mail' });
    expect(mail.branch.length).toBeGreaterThan(0);
    expect(mail.dirty).toBeGreaterThanOrEqual(0);
    expect(web.exists).toBe(true);
    expect(missing.exists).toBe(false);
  }, 30000);

  it('detectAgents probes real binaries', async () => {
    const agents = await detectAgents(exec);
    const claude = agents.find(a => a.id === 'claude')!;
    expect(claude.ok).toBe(true); // stray 服务器装了 claude CLI
  }, 30000);

  it('listDirs inside a subdir', async () => {
    const dirs = await listDirs(exec, '~/stray');
    expect(dirs).toContain('log');
    expect(dirs).toContain('tools');
  }, 30000);
});
