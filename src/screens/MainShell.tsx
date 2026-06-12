import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME, AccentType, accentFor } from '../theme';
import { DATA, Server, Project, Thread } from '../data/mock';
import { Icon } from '../components/Icon';
import { Press, Dot, Spinner, Sheet, EmptyHint } from '../components/Primitives';
import { AgentTab } from '../tabs/AgentTab';
import { LiveAgentTab } from '../tabs/LiveAgentTab';
import { FilesTab } from '../tabs/FilesTab';
import { GitTab } from '../tabs/GitTab';
import { LiveProvider, useLive } from '../core/live-context';

const T = THEME;

type TabId = 'agent' | 'files' | 'git';

// ── Top Tab Bar ───────────────────────────────────────────────
function TopTabs({ tab, setTab, accent, onBack }: { tab: TabId; setTab: (t: TabId) => void; accent: AccentType; onBack: () => void }) {
  const g = DATA.git;
  const gitCount = g.unstaged.length + g.staged.length + g.untracked.length;

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'agent', label: 'Agent', icon: 'cmd' },
    { id: 'files', label: 'Files', icon: 'folder' },
    { id: 'git', label: 'Git', icon: 'branch' },
  ];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg1, borderBottomWidth: 1, borderColor: T.borderSoft, paddingRight: 8 }}>
      <Press onPress={onBack} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="back" size={21} color={T.tx1} />
      </Press>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {TABS.map(tb => {
          const on = tb.id === tab;
          const badge = tb.id === 'git' ? gitCount : 0;
          return (
            <Press key={tb.id} onPress={() => setTab(tb.id)} style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', gap: 6, flexDirection: 'row' }}>
              <Icon name={tb.icon} size={17} color={on ? accent.hue : T.tx2} />
              <Text style={{ fontFamily: on ? T.uiFontSemiBold : T.uiFontMedium, fontSize: 13, color: on ? T.tx0 : T.tx2 }}>{tb.label}</Text>
              {badge > 0 && (
                <View style={{ minWidth: 16, height: 16, borderRadius: 8, backgroundColor: T.yellow, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ fontFamily: T.monoFontMedium, fontSize: 9.5, color: '#0a0b0e' }}>{badge}</Text>
                </View>
              )}
              {on && <View style={{ position: 'absolute', bottom: 0, width: 40, height: 2.5, borderRadius: 2, backgroundColor: accent.hue }} />}
            </Press>
          );
        })}
      </View>
    </View>
  );
}

// ── Context Header ────────────────────────────────────────────
function ContextHeader({ tab, accent, conn, onReconnect, curAgent, curThread, onThreadTap, onAction, serverName, projectName }:
  { tab: TabId; accent: AccentType; conn: string; onReconnect: () => void; curAgent: { icon: string; tint: string; name: string }; curThread?: Thread; onThreadTap: () => void; onAction: () => void; serverName: string; projectName: string }) {
  const g = DATA.git;
  const gitCount = g.unstaged.length + g.staged.length + g.untracked.length;

  const avatar = tab === 'agent'
    ? { icon: curAgent.icon, tint: curAgent.tint }
    : tab === 'files' ? { icon: 'folder', tint: accent.hue } : { icon: 'branch', tint: accent.hue };

  const title = tab === 'agent'
    ? (curThread ? curThread.title : 'New thread')
    : tab === 'files' ? projectName : g.branch;

  const sub = tab === 'agent'
    ? `${projectName} · ${curAgent.name}`
    : tab === 'files' ? `${serverName} · project`
    : `${serverName} · ${gitCount} changes`;

  const tappable = tab === 'agent';

  return (
    <>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingRight: 8, backgroundColor: T.bg1, borderBottomWidth: 1, borderColor: T.borderSoft }}>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: avatar.tint + '22', borderWidth: 1, borderColor: avatar.tint + '44', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={avatar.icon} size={17} color={avatar.tint} />
        </View>
        <Press onPress={tappable ? onThreadTap : undefined} style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, letterSpacing: -0.01 * 15 }} numberOfLines={1}>{title}</Text>
            {tappable && <Icon name="chevD" size={14} color={T.tx2} />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <Dot color={conn === 'online' ? T.green : T.yellow} glow={conn === 'online'} size={6} />
            <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2 }} numberOfLines={1}>{sub}</Text>
          </View>
        </Press>
        {tab === 'agent' && (
          <Press onPress={onAction} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: accent.dim }}>
            <Icon name="plus" size={19} color={accent.hue} />
          </Press>
        )}
        {tab === 'git' && (
          <Press onPress={onReconnect} style={{ height: 34, paddingHorizontal: 11, borderRadius: 10, backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="branch" size={14} color={T.tx1} />
            <Text style={{ fontFamily: T.uiFontMedium, fontSize: 12.5, color: T.tx1 }}>Switch</Text>
          </Press>
        )}
      </View>
      {conn === 'reconnecting' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: 'rgba(217,176,106,0.12)', borderBottomWidth: 1, borderColor: T.yellow + '33' }}>
          <Spinner size={13} color={T.yellow} />
          <Text style={{ fontFamily: T.uiFont, fontSize: 12, color: T.yellow }}>Connection lost — reconnecting over SSH…</Text>
        </View>
      )}
    </>
  );
}

// ── Thread Row ────────────────────────────────────────────────
function ThreadRow({ t, active, accent, onSelect }: { t: Thread; active: boolean; accent: AccentType; onSelect: () => void }) {
  const kind = DATA.agentKinds[t.agent] || DATA.agentKinds.claude;
  return (
    <Press onPress={onSelect} style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 10, paddingVertical: 12,
      borderRadius: 12, marginHorizontal: 8, marginBottom: 2,
      backgroundColor: active ? accent.dim : 'transparent',
      borderWidth: 1, borderColor: active ? accent.hue + '40' : 'transparent',
    }}>
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: kind.tint + '22', borderWidth: 1, borderColor: kind.tint + '44', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={kind.icon} size={16} color={kind.tint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: active ? T.uiFontSemiBold : T.uiFontMedium, fontSize: 14, color: T.tx0 }} numberOfLines={1}>{t.title}</Text>
        <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2, marginTop: 2 }}>{kind.name} · {t.time}</Text>
      </View>
      {active && <Icon name="check" size={18} color={accent.hue} />}
    </Press>
  );
}

// ── Main Shell ────────────────────────────────────────────────
type MainShellProps = { server: Server; project: Project; accent: AccentType; onBack: () => void };

const LIVE_AGENT_CMD = 'npx -y @agentclientprotocol/claude-agent-acp';

export function MainShell(props: MainShellProps) {
  // 进入主界面时尝试连 dev bridge；失败则 UI 回退到 mock 原型行为
  return (
    <LiveProvider cwd={props.project.path} agentCmd={LIVE_AGENT_CMD}>
      <MainShellInner {...props} />
    </LiveProvider>
  );
}

function MainShellInner({ server, project, accent, onBack }: MainShellProps) {
  const live = useLive();
  const [tab, setTabRaw] = useState<TabId>('agent');
  const [activeThread, setActiveThread] = useState('t1');
  const [activeAgent, setActiveAgent] = useState('claude');
  const [conn, setConn] = useState<'online' | 'reconnecting'>('online');
  const [threadSwitcher, setThreadSwitcher] = useState(false);
  const [agentPicker, setAgentPicker] = useState(false);
  const [tq, setTq] = useState('');

  const tweaks = { toolCard: 'card', permission: 'inline', density: 'regular', lineNumbers: false };
  const currentKind = DATA.agentKinds[activeAgent] || DATA.agentKinds.claude;
  const currentThread = DATA.threads.find(t => t.id === activeThread);

  const setTab = (t: TabId) => setTabRaw(t);
  const switchTo = (t: Thread) => { setActiveThread(t.id); setActiveAgent(t.agent); setThreadSwitcher(false); setTq(''); };
  const startThread = (id: string) => { setActiveThread('new'); setActiveAgent(id); setAgentPicker(false); setThreadSwitcher(false); };
  const reconnect = () => { setConn('reconnecting'); setTimeout(() => setConn('online'), 2200); };

  const fThreads = tq
    ? DATA.threads.filter(t => t.title.toLowerCase().includes(tq.toLowerCase()))
    : DATA.threads;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.bg1 }}>
        <TopTabs tab={tab} setTab={setTab} accent={accent} onBack={onBack} />
        <ContextHeader
          tab={tab}
          accent={accent}
          conn={conn}
          onReconnect={reconnect}
          curAgent={currentKind}
          curThread={currentThread}
          onThreadTap={() => setThreadSwitcher(true)}
          onAction={() => setAgentPicker(true)}
          serverName={server.name}
          projectName={project.name}
        />
      </SafeAreaView>

      <View style={{ flex: 1 }}>
        {tab === 'agent' && (
          live.session
            ? <LiveAgentTab session={live.session} accent={accent} />
            : <AgentTab accent={accent} tweaks={tweaks} activeThread={activeThread} agentId={activeAgent} />
        )}
        {tab === 'agent' && live.status === 'connecting' && (
          <View style={{ position: 'absolute', top: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border }}>
            <Spinner size={12} color={accent.hue} />
            <Text style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2 }}>Connecting to agent…</Text>
          </View>
        )}
        {tab === 'files' && <FilesTab accent={accent} />}
        {tab === 'git' && <GitTab accent={accent} />}
      </View>

      {/* thread switcher */}
      <Sheet open={threadSwitcher} onClose={() => { setThreadSwitcher(false); setTq(''); }} height="90%" pad={false}>
        <View style={{ flex: 1, minHeight: 400 }}>
          <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, marginBottom: 12 }}>
              <Text style={{ fontFamily: T.uiFontBold, fontSize: 17, color: T.tx0, letterSpacing: -0.17 }}>Threads</Text>
              <Press onPress={() => { setThreadSwitcher(false); setAgentPicker(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 13, paddingLeft: 10, borderRadius: 10, backgroundColor: accent.hue }}>
                <Icon name="plus" size={17} color={accent.on} />
                <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 13.5, color: accent.on }}>New</Text>
              </Press>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 11 }}>
              <Icon name="search" size={16} color={T.tx2} />
              <TextInput
                value={tq}
                onChangeText={setTq}
                placeholder="Search threads…"
                placeholderTextColor={T.tx2}
                style={{ flex: 1, fontFamily: T.uiFont, fontSize: 14, color: T.tx0, padding: 0 }}
              />
            </View>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
            {fThreads.map(t => (
              <ThreadRow key={t.id} t={t} active={t.id === activeThread} accent={accent} onSelect={() => switchTo(t)} />
            ))}
            {fThreads.length === 0 && (
              <EmptyHint icon="search" title="No threads found" sub={`Nothing matches "${tq}"`} />
            )}
          </ScrollView>
        </View>
      </Sheet>

      {/* agent picker */}
      <Sheet open={agentPicker} onClose={() => setAgentPicker(false)}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 14 }}>
          <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 4 }}>New thread</Text>
          <Text style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2, paddingHorizontal: 6, paddingBottom: 10 }}>Pick an agent to start with</Text>
          {DATA.newAgentOrder.map(id => {
            const a = DATA.agentKinds[id];
            return (
              <Press key={id} onPress={() => startThread(id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: a.tint + '22', borderWidth: 1, borderColor: a.tint + '44', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={a.icon} size={19} color={a.tint} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 14.5, color: T.tx0 }}>{a.name}</Text>
                  <Text style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.tx2 }}>{a.cmd}</Text>
                </View>
                <Icon name="chevR" size={17} color={T.tx2} />
              </Press>
            );
          })}
          <View style={{ height: 1, backgroundColor: T.borderSoft, marginHorizontal: 4, marginVertical: 6 }} />
          <Press onPress={() => setAgentPicker(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 8 }}>
            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={18} color={T.tx2} />
            </View>
            <Text style={{ fontFamily: T.uiFont, fontSize: 14, color: T.tx1 }}>Add an agent…</Text>
          </Press>
        </View>
      </Sheet>
    </View>
  );
}
