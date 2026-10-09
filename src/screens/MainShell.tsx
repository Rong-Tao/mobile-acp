import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME, AccentType } from '../theme';
import type { Server, Project } from '../data/types';
import { Icon } from '../components/Icon';
import { Press, Spinner, Btn } from '../components/Primitives';
import { LiveAgentTab } from '../tabs/LiveAgentTab';
import { FilesTab } from '../tabs/FilesTab';
import { GitTab } from '../tabs/GitTab';
import { ThreadsTab } from '../tabs/ThreadsTab';
import { LiveProvider, SshLiveProvider, useLive, type LiveStatus } from '../core/live-context';
import { useSessionState } from '../core/live';
import { loadCredential } from '../core/credentials';
import type { SshConfig } from '../core/ssh-transport';

const T = THEME;

type TabId = 'agent' | 'threads' | 'files' | 'git';

// 可选 agent（ACP 启动命令都是真实的；没装的选了会在连接时报错并提示）
const AGENT_CHOICES = [
  { id: 'claude', name: 'Claude Code', cmd: 'npx -y @agentclientprotocol/claude-agent-acp', icon: 'spark', tint: '#6aa6ff' },
  { id: 'codex', name: 'Codex', cmd: 'codex acp', icon: 'cmd', tint: '#6cd093' },
  { id: 'gemini', name: 'Gemini CLI', cmd: 'gemini --experimental-acp', icon: 'chip', tint: '#b48ef0' },
];

// ── Top Tab Bar ───────────────────────────────────────────────
function TopTabs({ tab, setTab, accent, onBack }: { tab: TabId; setTab: (t: TabId) => void; accent: AccentType; onBack: () => void }) {
  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'agent', label: 'Agent', icon: 'cmd' },
    { id: 'threads', label: 'Threads', icon: 'thread' },
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
          return (
            <Press key={tb.id} onPress={() => setTab(tb.id)} style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', gap: 6, flexDirection: 'row' }}>
              <Icon name={tb.icon} size={17} color={on ? accent.hue : T.tx2} />
              <Text style={{ fontFamily: on ? T.uiFontSemiBold : T.uiFontMedium, fontSize: 13, color: on ? T.tx0 : T.tx2 }}>{tb.label}</Text>
              {on && <View style={{ position: 'absolute', bottom: 0, width: 40, height: 2.5, borderRadius: 2, backgroundColor: accent.hue }} />}
            </Press>
          );
        })}
      </View>
    </View>
  );
}

// ── Context Header ────────────────────────────────────────────
// 真实状态文字（取代以前会说谎的小绿点）：
// initing = 建连/起 agent;working = turn 进行中;connected = 空闲在线;
// reconnecting = 心跳判死后自动重连中;lost connection = 连接失败(点击立即重试)
function statusLabel(status: LiveStatus, busy: boolean): { text: string; color: string } {
  if (status === 'connecting') return { text: 'initing…', color: T.yellow };
  if (status === 'lost') return { text: 'reconnecting…', color: T.yellow };
  if (status === 'error' || status === 'off') return { text: 'lost connection', color: T.red };
  if (busy) return { text: 'working', color: T.cyan };
  return { text: 'connected', color: T.green };
}

function ContextHeader({ tab, accent, status, busy, onStatusTap, curAgent, onNewThread, serverName, projectName }:
  { tab: TabId; accent: AccentType; status: LiveStatus; busy: boolean; onStatusTap: () => void; curAgent: typeof AGENT_CHOICES[0]; onNewThread: () => void; serverName: string; projectName: string }) {

  const avatar = tab === 'agent'
    ? { icon: curAgent.icon, tint: curAgent.tint }
    : tab === 'threads' ? { icon: 'thread', tint: curAgent.tint }
    : tab === 'files' ? { icon: 'folder', tint: accent.hue } : { icon: 'branch', tint: accent.hue };

  const title = tab === 'agent' ? curAgent.name : tab === 'threads' ? 'Threads' : projectName;
  const sub = tab === 'agent' || tab === 'threads' ? `${projectName} · ${serverName}` : `${serverName} · ${projectName}`;
  const st = statusLabel(status, busy);
  const stuck = status === 'error' || status === 'off' || status === 'lost';

  return (
    <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingRight: 8, backgroundColor: T.bg1, borderBottomWidth: 1, borderColor: T.borderSoft }}>
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: avatar.tint + '22', borderWidth: 1, borderColor: avatar.tint + '44', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={avatar.icon} size={17} color={avatar.tint} />
      </View>
      <Press onPress={stuck ? onStatusTap : undefined} style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, letterSpacing: -0.01 * 15 }} numberOfLines={1}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
          {busy && status === 'on' && <Spinner size={9} color={st.color} />}
          <Text style={{ fontFamily: T.monoFontMedium, fontSize: 11, color: st.color }}>{st.text}</Text>
          <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2, flexShrink: 1 }} numberOfLines={1}>· {sub}</Text>
        </View>
      </Press>
      {tab === 'agent' && (
        <Press onPress={onNewThread} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: accent.dim }}>
          <Icon name="plus" size={19} color={accent.hue} />
        </Press>
      )}
    </View>
  );
}

// ── Main Shell ────────────────────────────────────────────────
type MainShellProps = { server: Server; project: Project; accent: AccentType; onBack: () => void };

export function MainShell(props: MainShellProps) {
  const [ssh, setSsh] = React.useState<SshConfig | null | 'loading'>('loading');
  const [agent, setAgent] = React.useState(AGENT_CHOICES[0]);
  const [gen, setGen] = React.useState(0); // bump 重建 provider = 真实重连/重启 agent

  React.useEffect(() => {
    loadCredential(props.server.id).then((cred) => {
      if (!cred) { setSsh(null); return; }
      setSsh({ host: props.server.host, port: props.server.port, user: props.server.user, auth: cred });
    });
  }, [props.server.id]);

  if (ssh === 'loading') return null;

  const inner = (
    <MainShellInner {...props} curAgent={agent}
      onPickAgent={(a) => { setAgent(a); setGen(g => g + 1); }}
    />
  );

  if (ssh) {
    return (
      <SshLiveProvider key={`${agent.id}-${gen}`} ssh={ssh} cwd={props.project.path} agentCmd={agent.cmd} agentId={agent.id}>
        {inner}
      </SshLiveProvider>
    );
  }

  // 没有存储的 SSH 凭证时，回退到 dev bridge（WS）
  return (
    <LiveProvider key={`${agent.id}-${gen}`} cwd={props.project.path} agentCmd={agent.cmd} agentId={agent.id}>
      {inner}
    </LiveProvider>
  );
}

type InnerProps = MainShellProps & {
  curAgent: typeof AGENT_CHOICES[0];
  onPickAgent: (a: typeof AGENT_CHOICES[0]) => void;
};

function MainShellInner({ server, project, accent, onBack, curAgent, onPickAgent }: InnerProps) {
  const live = useLive();
  const [tab, setTabRaw] = useState<TabId>('agent');
  const sessionState = useSessionState(live.session);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.bg1 }}>
        <TopTabs tab={tab} setTab={setTabRaw} accent={accent} onBack={onBack} />
        <ContextHeader
          tab={tab}
          accent={accent}
          status={live.status}
          busy={sessionState.busy}
          onStatusTap={live.reconnect}
          curAgent={curAgent}
          onNewThread={() => { live.newThread().catch(() => {}); }}
          serverName={server.name}
          projectName={project.name}
        />
      </SafeAreaView>

      <View style={{ flex: 1 }}>
        {tab === 'agent' && (
          live.threadLoading
            ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <Spinner size={22} color={accent.hue} />
                <Text style={{ fontFamily: T.uiFontMedium, fontSize: 13.5, color: T.tx1 }}>Opening thread…</Text>
              </View>
            : live.session
              ? <LiveAgentTab key={live.session.sessionId} session={live.session} accent={accent} />
              : <AgentStatus accent={accent} status={live.status} error={live.error} agentName={curAgent.name} onRetry={live.reconnect} />
        )}
        {tab === 'threads' && (
          <ThreadsTab accent={accent} onOpened={() => setTabRaw('agent')}
            agents={AGENT_CHOICES} curAgentId={curAgent.id}
            onPickAgent={(id) => { const a = AGENT_CHOICES.find(x => x.id === id); if (a) onPickAgent(a); }} />
        )}
        {tab === 'files' && <FilesTab accent={accent} exec={live.exec ?? undefined} cwd={project.path} />}
        {tab === 'git'   && <GitTab   accent={accent} exec={live.exec ?? undefined} cwd={project.path} />}
      </View>
    </View>
  );
}

// Agent 会话不可用时的真实状态面板（取代以前的 mock 对话）
function AgentStatus({ accent, status, error, agentName, onRetry }: {
  accent: AccentType; status: string; error: string | null; agentName: string; onRetry: () => void;
}) {
  if (status === 'connecting') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
        <Spinner size={22} color={accent.hue} />
        <Text style={{ fontFamily: T.uiFontMedium, fontSize: 13.5, color: T.tx1 }}>Starting {agentName}…</Text>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 }}>
      <Icon name="warn" size={26} color={T.red} />
      <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 14.5, color: T.tx0 }}>Couldn't start {agentName}</Text>
      {!!error && (
        <Text style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.tx2, textAlign: 'center' }} numberOfLines={4}>{error}</Text>
      )}
      <Btn accent={accent} icon="refresh" onPress={onRetry} style={{ marginTop: 6 }}>Retry</Btn>
    </View>
  );
}
