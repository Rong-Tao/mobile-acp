// 共享数据类型（原 mock.ts 拆出；演示用假数据已全部移除）。

export type Server = {
  id: string; name: string; host: string; port: number; user: string;
  online: boolean; last: string; auth: 'keystore' | 'key-file' | 'password';
};

export type Project = { id: string; name: string; path: string; branch: string; dirty: number };

export type Message = {
  id: string; role: 'user' | 'assistant' | 'tool' | 'permission';
  text?: string; tool?: string; title?: string; target?: string; status?: string;
  meta?: string; output?: string; diffAdd?: number; diffDel?: number;
  cmd?: string; note?: string;
};

export type TreeNode = {
  id: string; name: string; type: 'file' | 'dir'; depth: number; open?: boolean;
  children?: TreeNode[]; git?: string; kind?: string;
};

export type GitFile = { path: string; code: string; add: number; del: number };
export type DiffLine = { n1: number | null; n2: number | null; t: string; s: string };
export type DiffHunk = { header: string; lines: DiffLine[] };
