// SessionStore：把 session/update 通知流归约成 UI 可渲染的 entry 列表。
// 参照 Zed acp_thread 的模型：chunk 追加、tool_call 按 id upsert、
// plan 整体替换、permission 请求作为待决状态挂在对应 tool call 上。

import type {
  AvailableCommand,
  ContentBlock,
  PlanEntry,
  RequestPermissionRequest,
  SessionNotification,
  ToolCallStatus,
  ToolKind,
  ToolCallContent,
  ToolCallLocation,
} from '@agentclientprotocol/sdk';

export interface UserMessageEntry {
  type: 'user_message';
  blocks: ContentBlock[];
}
export interface AssistantMessageEntry {
  type: 'assistant_message';
  text: string;
}
export interface ThoughtEntry {
  type: 'thought';
  text: string;
}
export interface ToolCallEntry {
  type: 'tool_call';
  toolCallId: string;
  title: string;
  kind: ToolKind;
  status: ToolCallStatus;
  content: ToolCallContent[];
  locations: ToolCallLocation[];
  rawInput?: unknown;
}

export type ThreadEntry = UserMessageEntry | AssistantMessageEntry | ThoughtEntry | ToolCallEntry;

export interface PendingPermission {
  request: RequestPermissionRequest;
  resolve: (optionId: string) => void;
  cancel: () => void;
}

export interface SessionState {
  entries: ThreadEntry[];
  plan: PlanEntry[] | null;
  currentModeId: string | null;
  availableCommands: AvailableCommand[];
  pendingPermission: PendingPermission | null;
  /** 一个 prompt turn 进行中 */
  busy: boolean;
}

type Listener = (state: SessionState) => void;

export class SessionStore {
  private state: SessionState = {
    entries: [],
    plan: null,
    currentModeId: null,
    availableCommands: [],
    pendingPermission: null,
    busy: false,
  };
  private listeners = new Set<Listener>();
  private toolCallIndex = new Map<string, number>();

  getState(): SessionState {
    return this.state;
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit() {
    // 浅拷贝触发 React 重渲染
    this.state = { ...this.state, entries: [...this.state.entries] };
    this.listeners.forEach((cb) => cb(this.state));
  }

  setBusy(busy: boolean) {
    this.state.busy = busy;
    this.emit();
  }

  addUserMessage(blocks: ContentBlock[]) {
    this.state.entries.push({ type: 'user_message', blocks });
    this.emit();
  }

  setPendingPermission(p: PendingPermission | null) {
    this.state.pendingPermission = p;
    this.emit();
  }

  /** turn 被取消时，把进行中的 tool call 标记失败态以外的处理交给后续 update */
  markCancelled() {
    for (const e of this.state.entries) {
      if (e.type === 'tool_call' && (e.status === 'pending' || e.status === 'in_progress')) {
        e.status = 'failed';
      }
    }
    this.emit();
  }

  apply(n: SessionNotification) {
    const u = n.update;
    switch (u.sessionUpdate) {
      case 'user_message_chunk':
        // 客户端发出的内容回显——本地已渲染，忽略
        break;
      case 'agent_message_chunk':
        this.appendText('assistant_message', u.content);
        break;
      case 'agent_thought_chunk':
        this.appendText('thought', u.content);
        break;
      case 'tool_call': {
        const entry: ToolCallEntry = {
          type: 'tool_call',
          toolCallId: u.toolCallId,
          title: u.title,
          kind: u.kind ?? 'other',
          status: u.status ?? 'pending',
          content: u.content ?? [],
          locations: u.locations ?? [],
          rawInput: u.rawInput,
        };
        const idx = this.toolCallIndex.get(u.toolCallId);
        if (idx != null) {
          this.state.entries[idx] = entry;
        } else {
          this.toolCallIndex.set(u.toolCallId, this.state.entries.length);
          this.state.entries.push(entry);
        }
        break;
      }
      case 'tool_call_update': {
        const idx = this.toolCallIndex.get(u.toolCallId);
        if (idx == null) break;
        const entry = this.state.entries[idx] as ToolCallEntry;
        if (u.title != null) entry.title = u.title;
        if (u.kind != null) entry.kind = u.kind;
        if (u.status != null) entry.status = u.status;
        if (u.content != null) entry.content = u.content;
        if (u.locations != null) entry.locations = u.locations;
        if (u.rawInput != null) entry.rawInput = u.rawInput;
        break;
      }
      case 'plan':
        this.state.plan = u.entries;
        break;
      case 'plan_update':
        // plan 变体：整体重发语义，直接替换
        this.state.plan = (u as { entries?: PlanEntry[] }).entries ?? this.state.plan;
        break;
      case 'plan_removed':
        this.state.plan = null;
        break;
      case 'current_mode_update':
        this.state.currentModeId = u.currentModeId;
        break;
      case 'available_commands_update':
        this.state.availableCommands = u.availableCommands;
        break;
      default:
        // config_option_update / session_info_update / usage_update —— Phase 5
        break;
    }
    this.emit();
  }

  private appendText(type: 'assistant_message' | 'thought', content: ContentBlock) {
    if (content.type !== 'text') return; // 非文本 chunk 暂不渲染
    const last = this.state.entries[this.state.entries.length - 1];
    if (last && last.type === type) {
      last.text += content.text;
    } else {
      this.state.entries.push({ type, text: content.text } as ThreadEntry);
    }
  }
}
