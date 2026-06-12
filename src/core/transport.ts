// Transport 抽象：app 与远端服务器之间的两种通道。
// - spawn(): 长生命周期进程，流式 stdio —— 给 ACP agent 用
// - exec():  单发命令 —— 给 Git/Files 面板用
// 实现：WsTransport（dev bridge，先行）/ SshTransport（prod，后续）。

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface SpawnOptions {
  cmd: string;
  cwd?: string;
  env?: Record<string, string>;
}

export interface Channel {
  write(data: string): void;
  onData(cb: (chunk: string) => void): () => void;
  onStderr(cb: (chunk: string) => void): () => void;
  onExit(cb: (code: number | null) => void): () => void;
  kill(): void;
}

export interface Transport {
  spawn(opts: SpawnOptions): Promise<Channel>;
  exec(cmd: string, opts?: { cwd?: string }): Promise<ExecResult>;
  close(): void;
}
