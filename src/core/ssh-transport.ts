// SshTransport: prod transport over native SSH (wraps JSch via Expo Module).
// Implements the same Transport interface as WsTransport.

import type { Channel, ExecResult, SpawnOptions, Transport } from './transport';
import { NativeSsh, SshEmitter, sshAvailable } from '../../modules/ssh-transport/src';

export { sshAvailable };

export type SshAuthPassword = { type: 'password'; password: string };
export type SshAuthKey = { type: 'key'; privateKey: string; passphrase?: string };

export interface SshConfig {
  host: string;
  port: number;
  user: string;
  auth: SshAuthPassword | SshAuthKey;
}

let _sid = 0;
let _cid = 0;

export class SshTransport implements Transport {
  private readonly sid: string;

  private constructor(sid: string) {
    this.sid = sid;
  }

  static async connect(cfg: SshConfig): Promise<SshTransport> {
    if (!NativeSsh || !SshEmitter) throw new Error('SSH native module not available');
    const sid = `ssh-${++_sid}`;
    if (cfg.auth.type === 'password') {
      await NativeSsh.connectPassword(sid, cfg.host, cfg.port, cfg.user, cfg.auth.password);
    } else {
      await NativeSsh.connectKey(sid, cfg.host, cfg.port, cfg.user, cfg.auth.privateKey, cfg.auth.passphrase);
    }
    return new SshTransport(sid);
  }

  async spawn(opts: SpawnOptions): Promise<Channel> {
    if (!NativeSsh || !SshEmitter) throw new Error('SSH native module not available');
    const cid = `ch-${++_cid}`;
    await NativeSsh.spawn(this.sid, cid, opts.cmd, opts.cwd);

    const dataCbs = new Set<(chunk: string) => void>();
    const stderrCbs = new Set<(chunk: string) => void>();
    const exitCbs = new Set<(code: number | null) => void>();

    const emitter = SshEmitter;
    const sub1 = emitter.addListener('onData', (e) => {
      if (e.channelId === cid) dataCbs.forEach((cb) => cb(e.data));
    });
    const sub2 = emitter.addListener('onStderr', (e) => {
      if (e.channelId === cid) stderrCbs.forEach((cb) => cb(e.data));
    });
    const sub3 = emitter.addListener('onExit', (e) => {
      if (e.channelId !== cid) return;
      sub1.remove(); sub2.remove(); sub3.remove();
      exitCbs.forEach((cb) => cb(e.code));
    });

    return {
      write: (data) => NativeSsh!.writeStdin(cid, data),
      kill: () => NativeSsh!.killChannel(cid),
      onData: (cb) => { dataCbs.add(cb); return () => dataCbs.delete(cb); },
      onStderr: (cb) => { stderrCbs.add(cb); return () => stderrCbs.delete(cb); },
      onExit: (cb) => { exitCbs.add(cb); return () => exitCbs.delete(cb); },
    };
  }

  async exec(cmd: string, opts?: { cwd?: string }): Promise<ExecResult> {
    if (!NativeSsh) throw new Error('SSH native module not available');
    return NativeSsh.exec(this.sid, cmd, opts?.cwd);
  }

  close(): void {
    NativeSsh?.disconnect(this.sid);
  }
}
