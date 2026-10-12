// AgentClient：在 Transport 上 spawn 一个 ACP agent 进程，
// 用官方 SDK 的 ClientSideConnection 管 JSON-RPC。
// agent → client 的反向请求（permission / session update）通过回调外抛给 UI。

import {
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type Agent,
  type Client,
  type InitializeResponse,
  type ListSessionsResponse,
  type LoadSessionResponse,
  type NewSessionResponse,
  type PromptResponse,
  type SessionConfigOption,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
  type ContentBlock,
} from '@agentclientprotocol/sdk';
import type { Channel, Transport } from '../transport';

export interface AgentClientHandlers {
  onSessionUpdate(n: SessionNotification): void;
  onPermissionRequest(req: RequestPermissionRequest): Promise<RequestPermissionResponse>;
  onAgentExit?(code: number | null): void;
  onStderr?(line: string): void;
  /**
   * 流里出现任何 prompt 的 stopReason（含上一条连接发起、本连接 SDK 不认识的 id）。
   * 持久 agent 重连后靠它知道"孤儿 turn"结束了。
   */
  onTurnEnd?(): void;
}

export interface AgentClientOptions {
  transport: Transport;
  /** agent 启动命令，如 `npx @agentclientprotocol/claude-agent-acp` */
  cmd: string;
  cwd: string;
  env?: Record<string, string>;
  handlers: AgentClientHandlers;
}

function channelToWebStreams(channel: Channel, onTurnEnd?: () => void) {
  const encoder = new TextEncoder();
  let lineBuf = '';
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      channel.onData((chunk) => {
        if (onTurnEnd) {
          const lines = (lineBuf + chunk).split('\n');
          lineBuf = lines.pop() ?? '';
          if (lines.some((l) => l.includes('"stopReason"'))) onTurnEnd();
        }
        if (!closed) controller.enqueue(encoder.encode(chunk));
      });
      channel.onExit(() => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {}
        }
      });
    },
  });
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      channel.write(new TextDecoder().decode(chunk));
    },
  });
  return { readable, writable };
}

export class AgentClient {
  private constructor(
    private conn: ClientSideConnection,
    private channel: Channel,
    readonly init: InitializeResponse,
  ) {}

  static async start(opts: AgentClientOptions): Promise<AgentClient> {
    const channel = await opts.transport.spawn({ cmd: opts.cmd, cwd: opts.cwd, env: opts.env });
    if (opts.handlers.onStderr) channel.onStderr(opts.handlers.onStderr);
    if (opts.handlers.onAgentExit) channel.onExit(opts.handlers.onAgentExit);

    const { readable, writable } = channelToWebStreams(channel, opts.handlers.onTurnEnd);
    const client: Client = {
      sessionUpdate: async (n) => opts.handlers.onSessionUpdate(n),
      requestPermission: (req) => opts.handlers.onPermissionRequest(req),
    };
    const conn = new ClientSideConnection((_agent: Agent) => client, ndJsonStream(writable, readable));

    const init = await conn.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientInfo: { name: 'mobile-acp', version: '0.1.0' },
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
      },
    });
    return new AgentClient(conn, channel, init);
  }

  newSession(cwd: string): Promise<NewSessionResponse> {
    return this.conn.newSession({ cwd, mcpServers: [] });
  }

  /** 历史会话列表（需要 agent 的 listSessions capability；claude adapter 支持） */
  listSessions(cwd?: string): Promise<ListSessionsResponse> {
    return this.conn.listSessions(cwd ? { cwd } : {});
  }

  /** 加载历史会话：历史内容会以 session/update 通知流回放 */
  loadSession(sessionId: string, cwd: string): Promise<LoadSessionResponse> {
    return this.conn.loadSession({ sessionId, cwd, mcpServers: [] });
  }

  /** session/set_config_option：模式/模型/effort 等会话配置 */
  async setConfigOption(sessionId: string, configId: string, value: string | boolean): Promise<SessionConfigOption[]> {
    const req = typeof value === 'boolean'
      ? { sessionId, configId, type: 'boolean' as const, value }
      : { sessionId, configId, value };
    const resp = await this.conn.setSessionConfigOption(req);
    return resp.configOptions;
  }

  prompt(sessionId: string, blocks: ContentBlock[]): Promise<PromptResponse> {
    return this.conn.prompt({ sessionId, prompt: blocks });
  }

  async cancel(sessionId: string): Promise<void> {
    await this.conn.cancel({ sessionId });
  }

  async setMode(sessionId: string, modeId: string): Promise<void> {
    await this.conn.setSessionMode({ sessionId, modeId });
  }

  async authenticate(methodId: string): Promise<void> {
    await this.conn.authenticate({ methodId });
  }

  /**
   * 直接往 agent stdin 写一条 JSON-RPC response。用于答复"上一条连接时发出、
   * 至今没人回"的 agent→client 请求（持久 agent 重连后，旧请求只存在于 out.log）。
   * agent 靠 id 匹配，与哪条连接无关。
   */
  respondRaw(id: number | string, result: unknown): void {
    this.channel.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
  }

  stop(): void {
    this.channel.kill();
  }
}
