// Hermes（React Native 的 JS 引擎）缺 Web Streams API，而 ACP SDK 和
// agent-client 依赖 ReadableStream/WritableStream/TransformStream。
// 必须在任何业务代码 import 之前执行（index.ts 第一行引入）。

import {
  ReadableStream as RSPolyfill,
  WritableStream as WSPolyfill,
  TransformStream as TSPolyfill,
} from 'web-streams-polyfill';

const g = globalThis as any;

if (typeof g.ReadableStream === 'undefined') g.ReadableStream = RSPolyfill;
if (typeof g.WritableStream === 'undefined') g.WritableStream = WSPolyfill;
if (typeof g.TransformStream === 'undefined') g.TransformStream = TSPolyfill;

// Hermes 新版自带 TextEncoder；TextDecoder 保险起见也补
if (typeof g.TextEncoder === 'undefined' || typeof g.TextDecoder === 'undefined') {
  // fast-text-encoding 以副作用方式往 global 挂 TextEncoder/TextDecoder
  require('fast-text-encoding');
}
