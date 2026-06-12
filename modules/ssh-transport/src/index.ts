import { EventEmitter, requireNativeModule } from 'expo-modules-core';

export type ExecResult = { stdout: string; stderr: string; code: number };

type NativeMod = {
  connectPassword(sessionId: string, host: string, port: number, user: string, password: string): Promise<void>;
  connectKey(sessionId: string, host: string, port: number, user: string, privateKey: string, passphrase?: string): Promise<void>;
  exec(sessionId: string, cmd: string, cwd?: string): Promise<ExecResult>;
  spawn(sessionId: string, channelId: string, cmd: string, cwd?: string): Promise<void>;
  writeStdin(channelId: string, data: string): void;
  killChannel(channelId: string): void;
  disconnect(sessionId: string): void;
  isConnected(sessionId: string): boolean;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};

export type SshEvents = {
  onData: (params: { channelId: string; data: string }) => void;
  onStderr: (params: { channelId: string; data: string }) => void;
  onExit: (params: { channelId: string; code: number }) => void;
};

export type SshEmitterLike = {
  addListener<K extends keyof SshEvents>(event: K, listener: SshEvents[K]): { remove(): void };
};

let _native: NativeMod | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _emitter: SshEmitterLike | null = null;

try {
  _native = requireNativeModule<NativeMod>('SshTransport');
  _emitter = new EventEmitter<SshEvents>(_native as any) as unknown as SshEmitterLike;
} catch {
  // Not available in web / Expo Go
}

export const NativeSsh = _native;
export const SshEmitter = _emitter;
export const sshAvailable = _native !== null;
