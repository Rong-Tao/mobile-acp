// 模拟 Hermes：删掉原生 Web Streams 全局，验证 polyfill 能撑起
// agent-client 的 channel→streams 管道（v0.1.14 真机 "ReadableStream doesn't exist"）。

import { describe, expect, it, beforeAll } from 'vitest';

beforeAll(async () => {
  const g = globalThis as any;
  delete g.ReadableStream;
  delete g.WritableStream;
  delete g.TransformStream;
  expect(typeof g.ReadableStream).toBe('undefined'); // 确认模拟生效
  await import('../src/polyfills');
});

describe('web streams polyfill (Hermes simulation)', () => {
  it('restores stream globals', () => {
    const g = globalThis as any;
    expect(typeof g.ReadableStream).toBe('function');
    expect(typeof g.WritableStream).toBe('function');
    expect(typeof g.TransformStream).toBe('function');
    expect(typeof g.TextEncoder).toBe('function');
    expect(typeof g.TextDecoder).toBe('function');
  });

  it('round-trips data through a channel-shaped stream pipeline', async () => {
    // 复刻 agent-client.channelToWebStreams 的用法
    const encoder = new TextEncoder();
    let emit: (s: string) => void = () => {};
    const readable = new (globalThis as any).ReadableStream({
      start(controller: any) {
        emit = (s: string) => controller.enqueue(encoder.encode(s));
      },
    });
    const written: string[] = [];
    const writable = new (globalThis as any).WritableStream({
      write(chunk: Uint8Array) { written.push(new TextDecoder().decode(chunk)); },
    });

    const writer = writable.getWriter();
    await writer.write(encoder.encode('{"jsonrpc":"2.0"}\n'));
    expect(written.join('')).toBe('{"jsonrpc":"2.0"}\n');

    emit('hello ');
    emit('world');
    const reader = readable.getReader();
    const a = await reader.read();
    const b = await reader.read();
    const dec = new TextDecoder();
    expect(dec.decode(a.value) + dec.decode(b.value)).toBe('hello world');
  });
});
