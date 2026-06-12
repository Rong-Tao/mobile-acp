// data.jsx — mock data for mobile-acp prototype. Exports to window: DATA
const DATA = {};

// ── Servers ───────────────────────────────────────────────────
DATA.servers = [
  { id: 'srv1', name: 'devbox', host: 'dev.tail9c2f.ts.net', port: 22, user: 'kai',
    online: true, last: '2m ago', auth: 'keystore' },
  { id: 'srv2', name: 'gpu-rig', host: '192.168.1.42', port: 22, user: 'root',
    online: true, last: '1h ago', auth: 'keystore' },
  { id: 'srv3', name: 'prod-edge', host: 'edge.path.xyz', port: 2222, user: 'deploy',
    online: false, last: 'yesterday', auth: 'key-file' },
];

// ── Agents (per server) ───────────────────────────────────────
DATA.installedAgents = [
  { id: 'a1', name: 'Claude Code', cmd: 'claude --acp', ok: true, env: 1 },
  { id: 'a2', name: 'Codex', cmd: 'codex acp', ok: true, env: 1 },
  { id: 'a3', name: 'Gemini CLI', cmd: 'gemini --experimental-acp', ok: false, env: 0 },
];
DATA.availableAgents = [
  { id: 'av1', name: 'Claude Code', pkg: '@anthropic-ai/claude-code', install: 'npm i -g @anthropic-ai/claude-code', cmd: 'claude --acp' },
  { id: 'av2', name: 'Codex', pkg: '@openai/codex', install: 'npm i -g @openai/codex', cmd: 'codex acp' },
  { id: 'av3', name: 'Gemini CLI', pkg: '@google/gemini-cli', install: 'npm i -g @google/gemini-cli', cmd: 'gemini --experimental-acp' },
  { id: 'av4', name: 'Custom agent', pkg: null, install: '', cmd: '' },
];

// ── Projects (working dirs) ───────────────────────────────────
DATA.projects = [
  { id: 'p1', name: 'mobile-acp', path: '~/code/mobile-acp', branch: 'feat/git-panel', dirty: 4 },
  { id: 'p2', name: 'acp-server', path: '~/code/acp-server', branch: 'main', dirty: 0 },
  { id: 'p3', name: 'dotfiles', path: '~/.config', branch: 'main', dirty: 1 },
];

// ── Agents available to start threads with (icon + fixed tint, no brand logos) ──
DATA.agentKinds = {
  claude:   { name: 'Claude Code', cmd: 'claude --acp', icon: 'spark', tint: '#6aa6ff' },
  codex:    { name: 'Codex', cmd: 'codex acp', icon: 'cmd', tint: '#6cd093' },
  gemini:   { name: 'Gemini CLI', cmd: 'gemini --experimental-acp', icon: 'chip', tint: '#b48ef0' },
  terminal: { name: 'Terminal', cmd: 'bash -l', icon: 'terminal', tint: '#a6acb9' },
};
DATA.newAgentOrder = ['claude', 'codex', 'gemini', 'terminal'];

// ── Threads ───────────────────────────────────────────────────
DATA.threads = [
  { id: 't1', title: 'Git panel diff view', time: '2m', agent: 'claude', active: true },
  { id: 't2', title: 'SSH reconnect with backoff', time: '1h', agent: 'claude' },
  { id: 't3', title: 'Thread list virtualization', time: '3h', agent: 'codex' },
  { id: 't4', title: 'run the test suite & fix failures', time: '1d', agent: 'terminal' },
  { id: 't5', title: 'Refactor FilePreview props', time: '2d', agent: 'claude' },
  { id: 't6', title: 'Why does the keyboard push layout?', time: '4d', agent: 'gemini' },
  { id: 't7', title: 'Add @-mention autocomplete', time: '1w', agent: 'codex' },
  { id: 't8', title: 'Dark theme token pass', time: '2w', agent: 'claude' },
];

// short stub conversations for non-active threads
DATA.threadStub = (title) => [
  { id: 's1', role: 'user', text: title + '.' },
  { id: 's2', role: 'assistant', text: 'Sure — let me start by looking at the relevant files. Where would you like me to begin?' },
];

// ── Chat messages (mixed: text, tool calls, permission) ───────
DATA.messages = [
  { id: 'm1', role: 'user', text: 'The Git tab diff isn\u2019t showing line numbers. Can you add a gutter and wire up Stage/Unstage per hunk?' },
  { id: 'm2', role: 'assistant', text: 'Let me look at how the diff view is currently rendered, then add a line-number gutter and per-hunk staging.' },
  { id: 'm3', role: 'tool', tool: 'read', title: 'Read file', target: 'src/git/DiffView.tsx', status: 'done',
    meta: '142 lines',
    output: `export function DiffView({ hunks }: Props) {\n  return (\n    <ScrollX>\n      {hunks.map(h => <Hunk key={h.id} {...h} />)}\n    </ScrollX>\n  );\n}` },
  { id: 'm4', role: 'tool', tool: 'grep', title: 'Search', target: 'gutter', status: 'done',
    meta: '0 matches in src/git', output: 'No matches found.' },
  { id: 'm5', role: 'assistant', text: 'There\u2019s no gutter component yet. I\u2019ll add a `LineGutter` and render it alongside each hunk. First, writing the new component:' },
  { id: 'm6', role: 'tool', tool: 'write', title: 'Write file', target: 'src/git/LineGutter.tsx', status: 'done',
    meta: '+38 lines', diffAdd: 38, diffDel: 0,
    output: `export function LineGutter({ from, to }: GutterProps) {\n  const rows = range(from, to);\n  return (\n    <div className="gutter">\n      {rows.map(n => <span key={n}>{n}</span>)}\n    </div>\n  );\n}` },
  { id: 'm7', role: 'assistant', text: 'Now I need to run the migration that adds the staging RPC. This touches your working tree, so I\u2019ll ask before running it.' },
  { id: 'm8', role: 'permission', tool: 'execute',
    title: 'Run command', cmd: 'npm run db:migrate -- --stage-hunks',
    note: 'Applies 1 pending migration to the local SQLite store.' },
];

// ── Project file tree ─────────────────────────────────────────
DATA.tree = [
  { id: 'd-src', name: 'src', type: 'dir', depth: 0, open: true, children: [
    { id: 'd-git', name: 'git', type: 'dir', depth: 1, open: true, children: [
      { id: 'f-diff', name: 'DiffView.tsx', type: 'file', depth: 2, git: 'M' },
      { id: 'f-gutter', name: 'LineGutter.tsx', type: 'file', depth: 2, git: 'A' },
      { id: 'f-gitpanel', name: 'GitPanel.tsx', type: 'file', depth: 2, git: 'M' },
    ]},
    { id: 'd-ssh', name: 'ssh', type: 'dir', depth: 1, open: false, children: [
      { id: 'f-conn', name: 'connection.ts', type: 'file', depth: 2 },
      { id: 'f-recon', name: 'reconnect.ts', type: 'file', depth: 2, git: 'M' },
    ]},
    { id: 'f-app', name: 'App.tsx', type: 'file', depth: 1 },
    { id: 'f-theme', name: 'theme.ts', type: 'file', depth: 1 },
  ]},
  { id: 'd-assets', name: 'assets', type: 'dir', depth: 0, open: false, children: [
    { id: 'f-logo', name: 'logo.svg', type: 'file', depth: 1, kind: 'image' },
    { id: 'f-shot', name: 'screenshot.png', type: 'file', depth: 1, kind: 'image' },
  ]},
  { id: 'f-readme', name: 'README.md', type: 'file', depth: 0, kind: 'md' },
  { id: 'f-pkg', name: 'package.json', type: 'file', depth: 0, kind: 'code' },
  { id: 'f-spec', name: 'PROTOCOL.pdf', type: 'file', depth: 0, kind: 'pdf' },
  { id: 'f-bin', name: 'acp-daemon', type: 'file', depth: 0, kind: 'bin' },
];

// ── Git status ────────────────────────────────────────────────
DATA.git = {
  branch: 'feat/git-panel',
  ahead: 2, behind: 0,
  staged: [
    { path: 'src/git/LineGutter.tsx', code: 'A', add: 38, del: 0 },
  ],
  unstaged: [
    { path: 'src/git/DiffView.tsx', code: 'M', add: 14, del: 6 },
    { path: 'src/git/GitPanel.tsx', code: 'M', add: 9, del: 2 },
    { path: 'src/ssh/reconnect.ts', code: 'M', add: 21, del: 4 },
  ],
  untracked: [
    { path: 'src/git/LineGutter.test.tsx', code: 'U', add: 0, del: 0 },
  ],
};

// unified diff for DiffView.tsx
DATA.diff = {
  path: 'src/git/DiffView.tsx',
  hunks: [{
    header: '@@ -12,7 +12,9 @@ export function DiffView',
    lines: [
      { n1: 12, n2: 12, t: ' ', s: 'export function DiffView({ hunks }: Props) {' },
      { n1: 13, n2: 13, t: ' ', s: '  return (' },
      { n1: 14, n2: 14, t: ' ', s: '    <ScrollX>' },
      { n1: 15, n2: null, t: '-', s: '      {hunks.map(h => <Hunk key={h.id} {...h} />)}' },
      { n1: null, n2: 15, t: '+', s: '      {hunks.map(h => (' },
      { n1: null, n2: 16, t: '+', s: '        <Hunk key={h.id} gutter={<LineGutter {...h} />} {...h} />' },
      { n1: null, n2: 17, t: '+', s: '      ))}' },
      { n1: 16, n2: 18, t: ' ', s: '    </ScrollX>' },
      { n1: 17, n2: 19, t: ' ', s: '  );' },
      { n1: 18, n2: 20, t: ' ', s: '}' },
    ],
  }],
};

// ── File preview contents ─────────────────────────────────────
DATA.readme = `# mobile-acp

Android native **ACP** client. Connect to any ACP-compatible
coding agent over SSH \u2014 zero server deploy, just \`sshd\`.

## Supported agents
- Claude Code
- Codex
- Gemini CLI

## Quick start
1. Run the setup script on your server
2. Scan the QR code
3. Pick a working directory and go`;

DATA.pkgJson = `{
  "name": "mobile-acp",
  "version": "0.4.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "react": "^18.3.1",
    "ssh2": "^1.15.0"
  }
}`;

Object.assign(window, { DATA });
