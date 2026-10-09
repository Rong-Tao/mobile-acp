// TerminalSession：project 目录里的远端 shell（transport.spawn）。
// 无 PTY 的线性终端：发一行命令、收 stdout/stderr 流。足够跑命令看输出;
// 交互式全屏程序(vim/htop)需要 PTY,留待后续。
// 输入本地回显($ 前缀),输出剥 ANSI 转义;buffer 封顶防爆内存。

import type { Channel, Transport } from './transport';

const MAX_BUF = 200_000;
// 行编辑交给 RN 输入框,shell 关掉 readline;bash 不在就退回 sh
const SHELL_CMD = 'if command -v bash >/dev/null 2>&1; then exec bash --noediting -i; else exec sh -i; fi';

const ANSI_RE = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*(\x07|\x1b\\)|\x1b[()][A-Z0-9]|\x1b[=>]/g;

function clean(chunk: string): string {
  return chunk.replace(ANSI_RE, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export class TerminalSession {
  private buf = '';
  private listeners = new Set<() => void>();
  private ch: Channel | null = null;
  exited = false;

  constructor(private transport: Transport, readonly cwd: string) {}

  async start(): Promise<void> {
    this.exited = false;
    this.ch = await this.transport.spawn({ cmd: SHELL_CMD, cwd: this.cwd });
    this.ch.onData((d) => this.append(clean(d)));
    this.ch.onStderr((d) => this.append(clean(d)));
    this.ch.onExit((code) => {
      this.exited = true;
      this.append(`\n[shell exited${code != null ? ` (${code})` : ''}]\n`);
    });
  }

  /** 发送一行命令（本地回显 + 换行） */
  send(line: string): void {
    if (!this.ch || this.exited) return;
    this.append(`$ ${line}\n`);
    this.ch.write(line + '\n');
  }

  async restart(): Promise<void> {
    this.ch?.kill();
    this.append('\n[restarting shell]\n');
    await this.start();
  }

  kill(): void {
    this.ch?.kill();
    this.ch = null;
  }

  getBuffer = (): string => this.buf;

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  private append(s: string) {
    if (!s) return;
    this.buf += s;
    if (this.buf.length > MAX_BUF) this.buf = this.buf.slice(this.buf.length - MAX_BUF);
    this.listeners.forEach((cb) => cb());
  }
}
