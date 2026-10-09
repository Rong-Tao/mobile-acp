// AgentTab 原型拆出的共享视觉组件：InlineMd / ToolCard / Bubble。
// LiveAgentTab（真实 ACP 会话）使用这些组件渲染消息。

import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { THEME, AccentType } from '../theme';
import type { Message } from '../data/types';
import { Icon } from '../components/Icon';
import { Press } from '../components/Primitives';
import { CodeBlock } from '../components/CodeBlock';

const T = THEME;

const TOOL_ICON: Record<string, string> = { read: 'file', grep: 'search', write: 'edit', execute: 'terminal' };

// ── Inline Markdown ───────────────────────────────────────────
export function InlineMd({ text, fontSize = 14 }: { text: string; fontSize?: number }) {
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
export function ToolCard({ m, accent, compact, lineNumbers }: { m: Message; accent: AccentType; compact: boolean; lineNumbers: boolean }) {
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
export function Bubble({ m, accent, fontSize }: { m: Message; accent: AccentType; fontSize: number }) {
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

