// WsTransport：通过 dev bridge（bridge/server.mjs）实现 Transport。
// 依赖全局 WebSocket（浏览器 / RN / Node ≥22 都有）。

import type { Channel, ExecResult, SpawnOptions, Transport } from './transport';

type BridgeMsg = {
  op: string;
  ch?: number;
  id?: number;
  data?: string;
  code?: number | null;
  pid?: number;
  stdout?: string;
  stderr?: string;
  message?: string;
};

class WsChannel implements Channel {
  private dataCbs = new Set<(chunk: string) => void>();
  private stderrCbs = new Set<(chunk: string) => void>();
  private exitCbs = new Set<(code: number | null) => void>();
  exited = false;

  constructor(
    readonly ch: number,
    private send: (msg: object) => void,
  ) {}

  write(data: string): void {
    this.send({ op: 'stdin', ch: this.ch, data });
  }
  kill(): void {
    this.send({ op: 'kill', ch: this.ch });
  }
  onData(cb: (chunk: string) => void) {
    this.dataCbs.add(cb);
    return () => this.dataCbs.delete(cb);
  }
  onStderr(cb: (chunk: string) => void) {
    this.stderrCbs.add(cb);
    return () => this.stderrCbs.delete(cb);
  }
  onExit(cb: (code: number | null) => void) {
    this.exitCbs.add(cb);
    return () => this.exitCbs.delete(cb);
  }

  /** @internal */
  dispatch(m: BridgeMsg) {
    if (m.op === 'stdout') this.dataCbs.forEach((cb) => cb(m.data!));
    else if (m.op === 'stderr') this.stderrCbs.forEach((cb) => cb(m.data!));
    else if (m.op === 'exit') {
      this.exited = true;
      this.exitCbs.forEach((cb) => cb(m.code ?? null));
    }
  }
}

export class WsTransport implements Transport {
  private ws: WebSocket;
  private ready: Promise<void>;
  private nextCh = 1;
  private nextExecId = 1;
  private channels = new Map<number, WsChannel>();
  private pendingSpawns = new Map<number, { resolve: (c: Channel) => void; reject: (e: Error) => void }>();
  private pendingExecs = new Map<number, { resolve: (r: ExecResult) => void; reject: (e: Error) => void }>();

  constructor(url: string, token?: string) {
    const full = token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url;
    this.ws = new WebSocket(full);
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error('bridge connection failed'));
    });
    this.ws.onmessage = (ev: MessageEvent) => this.onMessage(String(ev.data));
    this.ws.onclose = () => {
      const err = new Error('bridge connection closed');
      this.pendingSpawns.forEach((p) => p.reject(err));
      this.pendingExecs.forEach((p) => p.reject(err));
      this.pendingSpawns.clear();
      this.pendingExecs.clear();
      this.channels.forEach((c) => {
        if (!c.exited) c.dispatch({ op: 'exit', ch: c.ch, code: null });
      });
    };
  }

  private send(msg: object) {
    this.ws.send(JSON.stringify(msg));
  }

  private onMessage(raw: string) {
    let m: BridgeMsg;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (m.op === 'spawned') {
      const pending = this.pendingSpawns.get(m.ch!);
      if (pending) {
        this.pendingSpawns.delete(m.ch!);
        pending.resolve(this.channels.get(m.ch!)!);
      }
    } else if (m.op === 'exec-result') {
      const pending = this.pendingExecs.get(m.id!);
      if (pending) {
        this.pendingExecs.delete(m.id!);
        pending.resolve({ stdout: m.stdout ?? '', stderr: m.stderr ?? '', code: m.code ?? 0 });
      }
    } else if (m.op === 'error' && m.ch != null && this.pendingSpawns.has(m.ch)) {
      const pending = this.pendingSpawns.get(m.ch)!;
      this.pendingSpawns.delete(m.ch);
      pending.reject(new Error(m.message || 'spawn failed'));
    } else if (m.ch != null) {
      this.channels.get(m.ch)?.dispatch(m);
    }
  }

  async spawn(opts: SpawnOptions): Promise<Channel> {
    await this.ready;
    const ch = this.nextCh++;
    const channel = new WsChannel(ch, (msg) => this.send(msg));
    this.channels.set(ch, channel);
    return new Promise((resolve, reject) => {
      this.pendingSpawns.set(ch, { resolve, reject });
      this.send({ op: 'spawn', ch, cmd: opts.cmd, cwd: opts.cwd, env: opts.env });
    });
  }

  async exec(cmd: string, opts?: { cwd?: string }): Promise<ExecResult> {
    await this.ready;
    const id = this.nextExecId++;
    return new Promise((resolve, reject) => {
      this.pendingExecs.set(id, { resolve, reject });
      this.send({ op: 'exec', id, cmd, cwd: opts?.cwd });
    });
  }

  close(): void {
    this.ws.close();
  }
}
