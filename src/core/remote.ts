// 远端服务器探测：项目目录状态、目录浏览、agent 检测。
// 全部是吃 exec 的纯函数，可以在 node 下对 bridge 直接测试（test/remote.test.ts）。

import type { ExecResult } from './transport';

export type Exec = (cmd: string, cwd?: string) => Promise<ExecResult>;

export type RemoteProject = {
  path: string;        // 原样保存（可以带 ~）
  name: string;        // basename
  isGit: boolean;
  exists: boolean;
  branch: string;      // 非 git 时为 ''
  dirty: number;       // git status --porcelain 行数
};

// 单引号 shell 转义；~ 开头的路径保留 ~ 让远端 shell 展开
export function shq(p: string): string {
  if (p === '~') return '~';
  if (p.startsWith('~/')) return '~/' + `'${p.slice(2).replace(/'/g, `'\\''`)}'`;
  return `'${p.replace(/'/g, `'\\''`)}'`;
}

const MARK = '@@MACP@@';

// 一次 exec 批量取回每个目录的 存在性/分支/dirty 数
export async function statProjects(exec: Exec, paths: string[]): Promise<RemoteProject[]> {
  if (paths.length === 0) return [];
  const script = paths.map((p) => {
    const q = shq(p);
    return `printf '%s\\n' '${MARK}'; if [ -d ${q} ]; then printf 'E\\n'; ` +
      `b=$(git -C ${q} rev-parse --abbrev-ref HEAD 2>/dev/null); ` +
      `if [ -n "$b" ]; then printf 'G %s\\n' "$b"; git -C ${q} status --porcelain 2>/dev/null | wc -l; ` +
      `else printf 'N\\n'; fi; else printf 'M\\n'; fi`;
  }).join('; ');
  const res = await exec(script);
  const blocks = res.stdout.split(MARK).slice(1).map((b) => b.trim().split('\n'));
  return paths.map((p, i) => {
    const name = p.replace(/\/+$/, '').split('/').pop() || p;
    const lines = blocks[i] ?? ['M'];
    if (lines[0] !== 'E') return { path: p, name, exists: false, isGit: false, branch: '', dirty: 0 };
    if (lines[1]?.startsWith('G ')) {
      return {
        path: p, name, exists: true, isGit: true,
        branch: lines[1].slice(2).trim(),
        dirty: parseInt(lines[2] ?? '0', 10) || 0,
      };
    }
    return { path: p, name, exists: true, isGit: false, branch: '', dirty: 0 };
  });
}

// 列出某目录下的子目录名（不含隐藏目录；带 / 后缀的已去掉）
export async function listDirs(exec: Exec, path: string): Promise<string[]> {
  const res = await exec(`ls -1p ${shq(path)} 2>/dev/null`);
  return res.stdout.split('\n')
    .filter((l) => l.endsWith('/'))
    .map((l) => l.slice(0, -1))
    .filter((d) => d !== 'node_modules');
}

// 扫描 home 下两层内的 git 仓库，返回 ~ 相对路径
export async function scanGitRepos(exec: Exec): Promise<string[]> {
  const res = await exec(
    `cd ~ && find . -maxdepth 3 -name .git \\( -type d -o -type f \\) -not -path '*/node_modules/*' 2>/dev/null | head -50`
  );
  return res.stdout.split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/\/\.git$/, '').replace(/^\.\//, ''))
    .filter((l) => l !== '.git' && l !== '')
    .map((l) => `~/${l}`)
    .sort();
}

export type DetectedAgent = {
  id: string;
  name: string;
  cmd: string;         // 启动命令（ACP 模式）
  bin: string;         // 探测的可执行文件名
  ok: boolean;
  version: string;     // 探测到的版本（可为空）
};

export const KNOWN_AGENTS: Omit<DetectedAgent, 'ok' | 'version'>[] = [
  { id: 'claude', name: 'Claude Code', bin: 'claude', cmd: 'npx -y @agentclientprotocol/claude-agent-acp' },
  { id: 'codex', name: 'Codex', bin: 'codex', cmd: 'codex acp' },
  { id: 'gemini', name: 'Gemini CLI', bin: 'gemini', cmd: 'gemini --experimental-acp' },
];

// 一次 exec 探测所有已知 agent 是否安装 + 版本
export async function detectAgents(exec: Exec): Promise<DetectedAgent[]> {
  const script = KNOWN_AGENTS.map((a) =>
    `printf '%s\\n' '${MARK}'; if command -v ${a.bin} >/dev/null 2>&1; then printf 'Y\\n'; ${a.bin} --version 2>/dev/null | head -1; else printf 'N\\n'; fi`
  ).join('; ');
  const res = await exec(script);
  const blocks = res.stdout.split(MARK).slice(1).map((b) => b.trim().split('\n'));
  return KNOWN_AGENTS.map((a, i) => {
    const lines = blocks[i] ?? ['N'];
    return { ...a, ok: lines[0] === 'Y', version: lines[0] === 'Y' ? (lines[1] ?? '').trim() : '' };
  });
}
