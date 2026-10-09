// LiveAgentTab：真 ACP 会话渲染（Phase 2）。
// 复用 AgentTab 的视觉组件，数据来自 SessionStore 的 ThreadEntry 流。

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { THEME, AccentType } from '../theme';
import { Icon } from '../components/Icon';
import { Press, Spinner, Sheet } from '../components/Primitives';
import { InlineMd, ToolCard, Bubble } from '../components/AgentBits';
import type { Message } from '../data/types';
import { LiveSession, useSessionState } from '../core/live';
import type { PendingPermission, ThreadEntry, ToolCallEntry } from '../core/acp/session-store';
import type { PlanEntry, SessionConfigOption, SessionConfigSelectOption } from '@agentclientprotocol/sdk';

const T = THEME;

const KIND_ICON: Record<string, string> = {
  read: 'read', search: 'grep', fetch: 'read',
  edit: 'write', delete: 'write', move: 'write',
  execute: 'execute', think: 'read', switch_mode: 'execute', other: 'execute',
};

function toolEntryToMessage(e: ToolCallEntry): Message {
  const texts: string[] = [];
  let diffAdd: number | undefined;
  for (const c of e.content) {
    if (c.type === 'content' && c.content.type === 'text') texts.push(c.content.text);
    else if (c.type === 'diff') {
      diffAdd = c.newText.split('\n').length;
      texts.push(c.newText);
    } else if (c.type === 'terminal') texts.push(`[terminal ${c.terminalId}]`);
  }
  const input = e.rawInput as Record<string, unknown> | undefined;
  const target =
    e.locations[0]?.path ??
    (typeof input?.command === 'string' ? input.command : '') ??
    '';
  return {
    id: e.toolCallId,
    role: 'tool',
    tool: KIND_ICON[e.kind] ?? 'execute',
    title: e.title,
    target: String(target),
    status: e.status,
    meta: e.status === 'in_progress' ? 'running…' : e.status,
    output: texts.join('\n') || undefined,
    diffAdd,
  };
}

// ── 动态权限卡片：按 agent 给出的 options 渲染 ─────────────────
function LivePermissionCard({ p, accent }: { p: PendingPermission; accent: AccentType }) {
  const tc = p.request.toolCall;
  const input = tc?.rawInput as Record<string, unknown> | undefined;
  const cmd =
    (typeof input?.command === 'string' && input.command) ||
    tc?.locations?.[0]?.path ||
    tc?.title ||
    '';
  return (
    <View style={{
      backgroundColor: T.bg2, borderWidth: 1, borderColor: accent.hue + '66', borderRadius: 13, overflow: 'hidden',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, paddingBottom: 10 }}>
        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: accent.dim, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="warn" size={17} color={accent.hue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 13.5, color: T.tx0 }}>Permission required</Text>
          <Text style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2 }} numberOfLines={1}>{tc?.title ?? 'Tool call'}</Text>
        </View>
      </View>
      {!!cmd && (
        <View style={{ paddingHorizontal: 13, paddingBottom: 12 }}>
          <View style={{ backgroundColor: '#0a0b0e', borderWidth: 1, borderColor: T.borderSoft, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text style={{ fontFamily: T.monoFont, fontSize: 12, color: T.cyan }}>{String(cmd)}</Text>
            </ScrollView>
          </View>
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 13, paddingBottom: 13 }}>
        {p.request.options.map((o) => {
          const reject = o.kind === 'reject_once' || o.kind === 'reject_always';
          const primary = o.kind === 'allow_once';
          return (
            <Press key={o.optionId} onPress={() => p.resolve(o.optionId)} style={{
              height: 36, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: primary ? accent.hue : reject ? 'transparent' : T.bg3,
              borderWidth: primary ? 0 : 1, borderColor: reject ? T.red + '44' : T.border,
            }}>
              {primary && <Icon name="check" size={15} color={accent.on} />}
              <Text style={{ fontFamily: T.uiFontMedium, fontSize: 13, color: primary ? accent.on : reject ? T.red : T.tx0 }}>
                {o.name}
              </Text>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

// ── Plan 卡片 ─────────────────────────────────────────────────
function PlanCard({ plan, accent }: { plan: PlanEntry[]; accent: AccentType }) {
  return (
    <View style={{ backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, gap: 7 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Icon name="check" size={14} color={accent.hue} />
        <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 12.5, color: T.tx1 }}>Plan</Text>
      </View>
      {plan.map((e, i) => {
        const done = e.status === 'completed';
        const active = e.status === 'in_progress';
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{
              width: 14, height: 14, borderRadius: 7, marginTop: 2,
              borderWidth: 1.5, borderColor: done ? T.green : active ? accent.hue : T.border,
              backgroundColor: done ? T.green + '33' : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {done && <Icon name="check" size={9} color={T.green} />}
              {active && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent.hue }} />}
            </View>
            <Text style={{
              flex: 1, fontFamily: T.uiFont, fontSize: 12.5, lineHeight: 18,
              color: done ? T.tx2 : T.tx0,
              textDecorationLine: done ? 'line-through' : 'none',
            }}>{e.content}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ThoughtBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Press onPress={() => setOpen(o => !o)} style={{ paddingVertical: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="spark" size={12} color={T.tx2} />
        <Text style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2 }}>
          Thinking {open ? '' : `· ${Math.min(text.length, 999)} chars`}
        </Text>
        <Icon name={open ? 'chevU' : 'chevD'} size={12} color={T.tx2} />
      </View>
      {open && (
        <Text style={{ fontFamily: T.uiFont, fontSize: 12.5, lineHeight: 19, color: T.tx2, fontStyle: 'italic', marginTop: 4 }}>
          {text}
        </Text>
      )}
    </Press>
  );
}

// ── 会话配置 chips（mode/model/effort…）─────────────────────────
const CATEGORY_ICON: Record<string, string> = {
  mode: 'shield', model: 'chip', thought_level: 'spark',
};

function flatOptions(opt: SessionConfigOption): SessionConfigSelectOption[] {
  if (opt.type !== 'select') return [];
  return opt.options.flatMap((o) => ('group' in o ? o.options : [o]));
}

function optionLabel(opt: SessionConfigOption): string {
  if (opt.type === 'boolean') return opt.name;
  const cur = flatOptions(opt).find((o) => o.value === opt.currentValue);
  return cur?.name ?? String(opt.currentValue);
}

// ── Live Agent Tab ────────────────────────────────────────────
export function LiveAgentTab({ session, accent }: { session: LiveSession; accent: AccentType }) {
  const state = useSessionState(session);
  const [input, setInput] = useState('');
  // 打开中的配置选单：configOption 的 id，或 'legacy-mode'（没有 configOptions 的 agent）
  const [picker, setPicker] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [state.entries.length, state.busy, state.pendingPermission]);

  const send = () => {
    const text = input.trim();
    if (!text || state.busy) return;
    setInput('');
    session.send(text).catch((err) => console.warn('[prompt]', err));
  };

  // configOptions 优先（claude adapter：mode/model/effort）；没有时退回 legacy modes
  const selectOpts = state.configOptions.filter((o) => o.type === 'select');
  const modes = session.modes;
  const currentMode = modes?.availableModes.find((m) => m.id === (state.currentModeId ?? modes.currentModeId));
  const pickerOpt = picker != null ? selectOpts.find((o) => o.id === picker) ?? null : null;

  const renderEntry = (e: ThreadEntry, i: number) => {
    if (e.type === 'user_message') {
      const text = e.blocks.map((b) => (b.type === 'text' ? b.text : `[${b.type}]`)).join('');
      return <Bubble key={i} m={{ id: String(i), role: 'user', text }} accent={accent} fontSize={13.6} />;
    }
    if (e.type === 'assistant_message') {
      return <Bubble key={i} m={{ id: String(i), role: 'assistant', text: e.text }} accent={accent} fontSize={13.6} />;
    }
    if (e.type === 'thought') return <ThoughtBlock key={i} text={e.text} />;
    if (e.type === 'tool_call') {
      return <ToolCard key={e.toolCallId} m={toolEntryToMessage(e)} accent={accent} compact={false} lineNumbers={false} />;
    }
    return null;
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingTop: 16, paddingBottom: 18, gap: 13 }}
        showsVerticalScrollIndicator={false}
      >
        {state.entries.length === 0 && !state.busy && (
          <View style={{ alignItems: 'center', justifyContent: 'center', gap: 10, padding: 30, minHeight: 260 }}>
            <Icon name="spark" size={26} color={accent.hue} />
            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0 }}>Live session ready</Text>
            <Text style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.tx2 }}>{session.sessionId.slice(0, 24)}…</Text>
          </View>
        )}
        {state.entries.map(renderEntry)}
        {state.plan && state.plan.length > 0 && <PlanCard plan={state.plan} accent={accent} />}
        {state.pendingPermission && <LivePermissionCard p={state.pendingPermission} accent={accent} />}
        {state.busy && !state.pendingPermission && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Spinner size={14} color={accent.hue} />
            <Text style={{ fontFamily: T.uiFont, fontSize: 13, color: T.tx2 }}>Working…</Text>
          </View>
        )}
      </ScrollView>

      {/* composer */}
      <View style={{ borderTopWidth: 1, borderColor: T.borderSoft, backgroundColor: T.bg1, padding: 10, paddingHorizontal: 12 }}>
        <View style={{ backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 16, paddingTop: 4, paddingBottom: 6 }}>
          <View style={{ paddingHorizontal: 10, paddingTop: 6 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              multiline
              placeholder="Message agent…"
              placeholderTextColor={T.tx2}
              onSubmitEditing={send}
              blurOnSubmit={false}
              style={{ color: T.tx0, fontFamily: T.uiFont, fontSize: 14.5, lineHeight: 21.75, maxHeight: 120, paddingVertical: 5, padding: 0, textAlignVertical: 'top' }}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 6, marginTop: 4 }}>
            {/* 配置 chips：busy 时也可以切（mode/model/effort 对下一步立即生效） */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 7 }}>
              {selectOpts.length > 0 ? selectOpts.map((o) => (
                <Press key={o.id} onPress={() => setPicker(o.id)} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 9, borderRadius: 9,
                  backgroundColor: T.bg3, borderWidth: 1, borderColor: T.border,
                }}>
                  <Icon name={CATEGORY_ICON[o.category ?? ''] ?? 'settings'} size={13} color={T.tx1} />
                  <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 12, color: T.tx1 }}>{optionLabel(o)}</Text>
                  <Icon name="chevD" size={12} color={T.tx2} />
                </Press>
              )) : modes && (
                <Press onPress={() => setPicker('legacy-mode')} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 9, borderRadius: 9,
                  backgroundColor: T.bg3, borderWidth: 1, borderColor: T.border,
                }}>
                  <Icon name="shield" size={13} color={T.tx1} />
                  <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 12, color: T.tx1 }}>{currentMode?.name ?? '…'}</Text>
                  <Icon name="chevD" size={12} color={T.tx2} />
                </Press>
              )}
            </ScrollView>
            <View style={{ flex: 1 }} />
            {state.busy ? (
              <Press onPress={() => session.cancel()} style={{
                width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11,
                backgroundColor: T.bg3, borderWidth: 1, borderColor: T.red + '55',
              }}>
                <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: T.red }} />
              </Press>
            ) : (
              <Press onPress={send} disabled={!input.trim()} style={{
                width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11,
                backgroundColor: input.trim() ? accent.hue : T.bg3,
              }}>
                <Icon name="send" size={18} color={input.trim() ? accent.on : T.tx2} />
              </Press>
            )}
          </View>
        </View>
      </View>

      {/* 配置选单（session/set_config_option；legacy agent 走 session/set_mode） */}
      <Sheet open={picker != null} onClose={() => setPicker(null)}>
        {pickerOpt ? (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 12 }}>
              <Icon name={CATEGORY_ICON[pickerOpt.category ?? ''] ?? 'settings'} size={19} color={accent.hue} />
              <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0 }}>{pickerOpt.name}</Text>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {flatOptions(pickerOpt).map((m) => {
                const on = m.value === pickerOpt.currentValue;
                return (
                  <Press key={m.value} onPress={() => { session.setConfig(pickerOpt.id, m.value).catch((e) => console.warn('[setConfig]', e)); setPicker(null); }} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, marginBottom: 2,
                    backgroundColor: on ? accent.dim : 'transparent', borderWidth: 1, borderColor: on ? accent.hue + '44' : 'transparent',
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 14.5, color: T.tx0 }}>{m.name}</Text>
                      {!!m.description && <Text style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2, marginTop: 2 }}>{m.description}</Text>}
                    </View>
                    {on && <Icon name="check" size={19} color={accent.hue} />}
                  </Press>
                );
              })}
            </ScrollView>
          </View>
        ) : picker === 'legacy-mode' && modes ? (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 12 }}>
              <Icon name="shield" size={19} color={accent.hue} />
              <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0 }}>Mode</Text>
            </View>
            {modes.availableModes.map((m) => {
              const on = m.id === (state.currentModeId ?? modes.currentModeId);
              return (
                <Press key={m.id} onPress={() => { session.setMode(m.id).catch((e) => console.warn('[setMode]', e)); setPicker(null); }} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, marginBottom: 2,
                  backgroundColor: on ? accent.dim : 'transparent', borderWidth: 1, borderColor: on ? accent.hue + '44' : 'transparent',
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 14.5, color: T.tx0 }}>{m.name}</Text>
                    {!!m.description && <Text style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2, marginTop: 2 }}>{m.description}</Text>}
                  </View>
                  {on && <Icon name="check" size={19} color={accent.hue} />}
                </Press>
              );
            })}
          </View>
        ) : null}
      </Sheet>
    </KeyboardAvoidingView>
  );
}
