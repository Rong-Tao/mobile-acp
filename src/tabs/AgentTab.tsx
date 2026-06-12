import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { THEME, AccentType } from '../theme';
import { DATA, Message } from '../data/mock';
import { Icon } from '../components/Icon';
import { Press, Spinner, Sheet } from '../components/Primitives';
import { CodeBlock } from '../components/CodeBlock';

const T = THEME;

const CFG = {
  perm: { icon: 'shield', label: 'Permissions', base: 'ask', opts: [
    { v: 'ask', l: 'Ask every time', d: 'Confirm before edits & commands', chip: 'Ask' },
    { v: 'edits', l: 'Accept edits', d: 'Auto-approve writes, ask for commands', chip: 'Accept edits' },
    { v: 'bypass', l: 'Bypass permissions', d: 'Run everything without asking', chip: 'Bypass' },
    { v: 'plan', l: 'Plan mode', d: 'Read-only — propose, don\'t apply', chip: 'Plan' },
  ]},
  model: { icon: 'chip', label: 'Model', base: 'default', opts: [
    { v: 'default', l: 'Default', d: 'Recommended for this agent', chip: 'Default' },
    { v: 'sonnet', l: 'Claude Sonnet 4.5', d: 'Balanced speed & capability', chip: 'Sonnet 4.5' },
    { v: 'opus', l: 'Claude Opus 4.1', d: 'Most capable, slower', chip: 'Opus 4.1' },
    { v: 'haiku', l: 'Claude Haiku 4', d: 'Fastest, lightweight', chip: 'Haiku 4' },
  ]},
  effort: { icon: 'spark', label: 'Thinking effort', base: 'medium', opts: [
    { v: 'off', l: 'Off', d: 'No extended thinking', chip: 'No thinking' },
    { v: 'low', l: 'Low', d: 'Brief reasoning', chip: 'Low' },
    { v: 'medium', l: 'Medium', d: 'Balanced reasoning', chip: 'Medium' },
    { v: 'high', l: 'High', d: 'Deep reasoning, slower', chip: 'High' },
  ]},
};
type CfgKey = keyof typeof CFG;
const cfgChip = (k: CfgKey, v: string) => CFG[k].opts.find(o => o.v === v)?.chip ?? v;

const TOOL_ICON: Record<string, string> = { read: 'file', grep: 'search', write: 'edit', execute: 'terminal' };

// ── Inline Markdown ───────────────────────────────────────────
function InlineMd({ text, fontSize = 14 }: { text: string; fontSize?: number }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <Text style={{ fontFamily: T.uiFont, fontSize, lineHeight: fontSize * 1.6, color: T.tx0 }}>
      {parts.map((p, i) => {
        if (p.startsWith('**')) return <Text key={i} style={{ fontFamily: T.uiFontSemiBold, color: T.tx0 }}>{p.slice(2, -2)}</Text>;
        if (p.startsWith('`')) return <Text key={i} style={{ fontFamily: T.monoFont, fontSize: fontSize * 0.88, backgroundColor: T.bg3, color: T.cyan }}>{' '}{p.slice(1, -1)}{' '}</Text>;
        return <Text key={i}>{p}</Text>;
      })}
    </Text>
  );
}

// ── Tool Card ─────────────────────────────────────────────────
function ToolCard({ m, accent, compact, lineNumbers }: { m: Message; accent: AccentType; compact: boolean; lineNumbers: boolean }) {
  const [open, setOpen] = useState(false);
  const tint = m.tool === 'write' ? T.green : accent.hue;
  return (
    <View style={{ backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 12, overflow: 'hidden' }}>
      <Press onPress={() => setOpen(o => !o)} style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        padding: compact ? 9 : 11, paddingHorizontal: compact ? 11 : 12,
      }}>
        <View style={{
          width: compact ? 26 : 30, height: compact ? 26 : 30, borderRadius: 8,
          backgroundColor: T.bg3, borderWidth: 1, borderColor: T.border,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={TOOL_ICON[m.tool || 'file'] || 'file'} size={compact ? 15 : 17} color={tint} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 12.5, color: T.tx1 }}>{m.title}</Text>
            {m.diffAdd != null && <Text style={{ fontFamily: T.monoFont, fontSize: 10.5, color: T.green }}>+{m.diffAdd}</Text>}
          </View>
          <Text style={{ fontFamily: T.monoFont, fontSize: 12, color: T.tx0 }} numberOfLines={1}>{m.target}</Text>
        </View>
        <Text style={{ fontFamily: T.monoFont, fontSize: 10.5, color: T.tx2 }}>{m.meta}</Text>
        <Icon name={open ? 'chevU' : 'chevD'} size={16} color={T.tx2} />
      </Press>
      {open && m.output && (
        <View style={{ borderTopWidth: 1, borderColor: T.borderSoft, padding: 10 }}>
          <CodeBlock code={m.output} fontSize={11.5} pad={11} maxHeight={220} showLines={lineNumbers} />
        </View>
      )}
    </View>
  );
}

// ── Permission Card ───────────────────────────────────────────
function PermissionCard({ m, accent, onResolve, resolved }: { m: Message; accent: AccentType; onResolve: (r: string) => void; resolved: string | null }) {
  if (resolved) {
    const ok = resolved === 'approve' || resolved === 'always';
    return (
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8,
        backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 10,
      }}>
        <Icon name={ok ? 'check' : 'x'} size={15} color={ok ? T.green : T.red} />
        <Text style={{ fontFamily: T.uiFont, fontSize: 12.5, color: ok ? T.green : T.red }}>
          {resolved === 'always' ? 'Always allowed' : ok ? 'Approved' : 'Denied'}{' · '}
          <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2 }}>{m.cmd}</Text>
        </Text>
      </View>
    );
  }
  return (
    <View style={{
      backgroundColor: T.bg2, borderWidth: 1, borderColor: accent.hue + '66', borderRadius: 13, overflow: 'hidden',
      shadowColor: accent.hue, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, paddingBottom: 10 }}>
        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: accent.dim, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="warn" size={17} color={accent.hue} />
        </View>
        <View>
          <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 13.5, color: T.tx0 }}>Permission required</Text>
          <Text style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2 }}>{m.title}</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 13, paddingBottom: 12 }}>
        <View style={{ backgroundColor: '#0a0b0e', borderWidth: 1, borderColor: T.borderSoft, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={{ fontFamily: T.monoFont, fontSize: 12, color: T.cyan }}>{m.cmd}</Text>
          </ScrollView>
        </View>
        <Text style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2, marginTop: 8, lineHeight: 17.3 }}>{m.note}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 13, paddingBottom: 13 }}>
        <Press onPress={() => onResolve('deny')} style={{
          height: 36, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: T.red + '44',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontFamily: T.uiFontMedium, fontSize: 13, color: T.red }}>Deny</Text>
        </Press>
        <Press onPress={() => onResolve('always')} style={{
          flex: 1, height: 36, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: T.border,
          backgroundColor: T.bg3, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontFamily: T.uiFontMedium, fontSize: 13, color: T.tx0 }}>Always</Text>
        </Press>
        <Press onPress={() => onResolve('approve')} style={{
          flex: 1, height: 36, paddingHorizontal: 16, borderRadius: 12,
          backgroundColor: accent.hue, alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: 6,
        }}>
          <Icon name="check" size={16} color={accent.on} />
          <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 13, color: accent.on }}>Approve</Text>
        </Press>
      </View>
    </View>
  );
}

// ── Bubble ────────────────────────────────────────────────────
function Bubble({ m, accent, fontSize }: { m: Message; accent: AccentType; fontSize: number }) {
  if (m.role === 'user') {
    return (
      <View style={{
        alignSelf: 'flex-end', maxWidth: '86%',
        backgroundColor: accent.dim, borderWidth: 1, borderColor: accent.hue + '44',
        borderRadius: 14, borderBottomRightRadius: 4, padding: 10, paddingHorizontal: 13,
      }}>
        <InlineMd text={m.text || ''} fontSize={fontSize} />
      </View>
    );
  }
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
      <InlineMd text={m.text || ''} fontSize={fontSize} />
    </View>
  );
}

// ── Agent Tab ─────────────────────────────────────────────────
type AgentTabProps = {
  accent: AccentType;
  tweaks: { toolCard: string; permission: string; density: string; lineNumbers: boolean };
  activeThread: string;
  agentId: string;
};

export function AgentTab({ accent, tweaks, activeThread, agentId }: AgentTabProps) {
  const compact = tweaks.toolCard === 'compact';
  const dens = tweaks.density === 'comfortable' ? 1.14 : tweaks.density === 'dense' ? 0.86 : 1;
  const chatFS = 13.6 + (dens - 1) * 8;
  const curAgent = DATA.agentKinds[agentId] || DATA.agentKinds.claude;

  const msgsFor = (id: string): Message[] => {
    if (id === 'new') return [];
    if (id === 't1') return DATA.messages;
    const t = DATA.threads.find(x => x.id === id);
    return DATA.threadStub(t ? t.title : 'this thread');
  };

  const [msgs, setMsgs] = useState<Message[]>(() => msgsFor(activeThread));
  const [perm, setPerm] = useState<string | null>(activeThread === 't1' ? null : 'noop');
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const [cfg, setCfg] = useState({ perm: 'ask', model: 'default', effort: 'medium' });
  const [picker, setPicker] = useState<CfgKey | null>(null);
  const [plusMenu, setPlusMenu] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setMsgs(msgsFor(activeThread));
    setPerm(activeThread === 't1' ? null : 'noop');
    setInput('');
    setThinking(false);
    setShowMention(false);
  }, [activeThread]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [msgs, thinking, perm]);

  const resolve = (r: string) => {
    setPerm(r);
    if (r === 'approve' || r === 'always') {
      setTimeout(() => {
        setMsgs(m => [...m,
          { id: 'mx1', role: 'tool', tool: 'execute', title: 'Run command', target: 'npm run db:migrate', status: 'done', meta: 'exit 0',
            output: '> drizzle-kit migrate\n\nApplying 0007_stage_hunks.sql …\n✓ migration applied (12ms)' },
          { id: 'mx2', role: 'assistant', text: 'Migration applied. The gutter now renders and each hunk has working **Stage** / **Unstage** buttons. Want me to run the test suite?' },
        ]);
      }, 700);
    } else {
      setTimeout(() => setMsgs(m => [...m, { id: 'mx0', role: 'assistant', text: 'Understood — I won\'t run it. You can apply the migration manually when ready.' }]), 500);
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMsgs(m => [...m, { id: 'u' + Date.now(), role: 'user', text }]);
    setInput('');
    setShowMention(false);
    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      setMsgs(m => [...m,
        { id: 'r' + Date.now(), role: 'tool', tool: 'read', title: 'Read file', target: 'src/git/GitPanel.tsx', status: 'done', meta: '88 lines',
          output: 'export function GitPanel() {\n  const { staged, unstaged } = useGitStatus();\n  return <ChangesList … />;\n}' },
        { id: 'a' + Date.now(), role: 'assistant', text: 'Here\'s what I found in `GitPanel.tsx`. I can wire that up next — let me know how you\'d like to proceed.' },
      ]);
    }, 1500);
  };

  const onInput = (v: string) => {
    setInput(v);
    setShowMention(/@\w*$/.test(v));
  };
  const pickMention = (path: string) => {
    setInput(i => i.replace(/@\w*$/, '@' + path + ' '));
    setShowMention(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* message flow */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingTop: 16, paddingBottom: 18, gap: Math.round(13 * dens) }}
        showsVerticalScrollIndicator={false}
      >
        {msgs.length === 0 && !thinking && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 30, paddingHorizontal: 24, minHeight: 300 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: curAgent.tint + '22', borderWidth: 1, borderColor: curAgent.tint + '44', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={curAgent.icon} size={26} color={curAgent.tint} />
            </View>
            <View style={{ alignItems: 'center', gap: 5 }}>
              <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 16, color: T.tx0 }}>New thread · {curAgent.name}</Text>
              <Text style={{ fontFamily: T.uiFont, fontSize: 13, color: T.tx2, textAlign: 'center', lineHeight: 19.5, maxWidth: 250 }}>
                Ask <Text style={{ color: T.tx1 }}>{curAgent.name}</Text> anything about <Text style={{ color: T.tx1 }}>mobile-acp</Text>, or <Text style={{ color: accent.hue }}>@</Text> a file to add context.
              </Text>
            </View>
          </View>
        )}
        {msgs.map(m => {
          if (m.role === 'tool') return <ToolCard key={m.id} m={m} accent={accent} compact={compact} lineNumbers={tweaks.lineNumbers} />;
          if (m.role === 'permission') return <PermissionCard key={m.id} m={m} accent={accent} onResolve={resolve} resolved={perm} />;
          return <Bubble key={m.id} m={m} accent={accent} fontSize={chatFS} />;
        })}
        {thinking && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Spinner size={14} color={accent.hue} />
            <Text style={{ fontFamily: T.uiFont, fontSize: 13, color: T.tx2 }}>Thinking…</Text>
          </View>
        )}
      </ScrollView>

      {/* composer */}
      <View style={{ borderTopWidth: 1, borderColor: T.borderSoft, backgroundColor: T.bg1, padding: 10, paddingHorizontal: 12 }}>
        {showMention && (
          <View style={{
            position: 'absolute', bottom: '100%', left: 12, right: 12, marginBottom: 8,
            backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 12,
            overflow: 'hidden',
            shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
          }}>
            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 11, color: T.tx2, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>Mention a file</Text>
            {['src/git/DiffView.tsx', 'src/git/GitPanel.tsx', 'src/ssh/reconnect.ts'].map(p => (
              <Press key={p} onPress={() => pickMention(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 9 }}>
                <Icon name="file" size={15} color={accent.hue} />
                <Text style={{ fontFamily: T.monoFont, fontSize: 12.5, color: T.tx0 }}>{p}</Text>
              </Press>
            ))}
          </View>
        )}

        <View style={{ backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 16, paddingTop: 4, paddingBottom: 6 }}>
          {/* text row */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 10, paddingTop: 6, paddingRight: 6 }}>
            <TextInput
              value={input}
              onChangeText={onInput}
              multiline
              numberOfLines={expanded ? 5 : 1}
              placeholder="Message agent…  @ for context, / for commands"
              placeholderTextColor={T.tx2}
              onSubmitEditing={send}
              blurOnSubmit={false}
              style={{
                flex: 1, color: T.tx0, fontFamily: T.uiFont, fontSize: 14.5, lineHeight: 21.75,
                maxHeight: expanded ? 200 : 100, paddingVertical: 5, padding: 0,
                textAlignVertical: 'top',
              }}
            />
            <Press onPress={() => setExpanded(e => !e)} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginTop: 1 }}>
              <Icon name={expanded ? 'chevD' : 'expand'} size={16} color={T.tx2} />
            </Press>
          </View>

          {/* control bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4, marginTop: 4 }}>
            <Press onPress={() => setPlusMenu(true)} style={{
              width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
              borderRadius: 10, backgroundColor: T.bg3, borderWidth: 1, borderColor: T.border,
            }}>
              <Icon name="plus" size={19} color={T.tx1} />
            </Press>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingVertical: 1 }}>
              {(['perm', 'model', 'effort'] as CfgKey[]).map(k => {
                const def = CFG[k].base;
                const val = cfg[k];
                const caution = k === 'perm' && val === 'bypass';
                const setv = val !== def;
                const tint = caution ? T.yellow : setv ? accent.hue : T.tx1;
                return (
                  <Press key={k} onPress={() => setPicker(k)} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 9, borderRadius: 9,
                    backgroundColor: caution ? 'rgba(217,176,106,0.12)' : setv ? accent.dim : T.bg3,
                    borderWidth: 1, borderColor: caution ? T.yellow + '55' : setv ? accent.hue + '40' : T.border,
                  }}>
                    <Icon name={CFG[k].icon} size={13} color={tint} />
                    <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 12, color: setv || caution ? tint : T.tx1 }}>
                      {cfgChip(k, val)}
                    </Text>
                    <Icon name="chevD" size={12} color={T.tx2} />
                  </Press>
                );
              })}
            </ScrollView>

            <Press onPress={send} disabled={!input.trim()} style={{
              width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11,
              backgroundColor: input.trim() ? accent.hue : T.bg3,
            }}>
              <Icon name="send" size={18} color={input.trim() ? accent.on : T.tx2} />
            </Press>
          </View>
        </View>
      </View>

      {/* + context menu */}
      <Sheet open={plusMenu} onClose={() => setPlusMenu(false)}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 10 }}>Add to message</Text>
          {([
            ['at', 'Mention a file', 'Reference a file in this project', () => { onInput(input + '@'); }],
            ['image2', 'Attach image', 'Screenshot or photo from device', () => {}],
            ['slash', 'Slash command', 'Run an agent command', () => { onInput(input + '/'); }],
            ['folder', 'Add directory context', 'Include a folder in the prompt', () => {}],
          ] as [string, string, string, () => void][]).map(([ic, l, d, fn]) => (
            <Press key={l} onPress={() => { fn(); setPlusMenu(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 6 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.bg3, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={ic} size={18} color={accent.hue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: T.uiFontMedium, fontSize: 14.5, color: T.tx0 }}>{l}</Text>
                <Text style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2 }}>{d}</Text>
              </View>
            </Press>
          ))}
        </View>
      </Sheet>

      {/* config picker */}
      <Sheet open={!!picker} onClose={() => setPicker(null)}>
        {picker && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 12 }}>
              <Icon name={CFG[picker].icon} size={19} color={accent.hue} />
              <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0 }}>{CFG[picker].label}</Text>
            </View>
            {CFG[picker].opts.map(o => {
              const on = cfg[picker] === o.v;
              const caution = picker === 'perm' && o.v === 'bypass';
              return (
                <Press key={o.v} onPress={() => { setCfg(c => ({ ...c, [picker]: o.v })); setPicker(null); }} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, marginBottom: 2,
                  backgroundColor: on ? accent.dim : 'transparent', borderWidth: 1, borderColor: on ? accent.hue + '44' : 'transparent',
                }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 14.5, color: caution ? T.yellow : T.tx0 }}>{o.l}</Text>
                      {caution && <Icon name="warn" size={14} color={T.yellow} />}
                    </View>
                    <Text style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2, marginTop: 2 }}>{o.d}</Text>
                  </View>
                  {on && <Icon name="check" size={19} color={accent.hue} />}
                </Press>
              );
            })}
          </View>
        )}
      </Sheet>
    </KeyboardAvoidingView>
  );
}
