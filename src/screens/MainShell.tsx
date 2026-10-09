import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME, AccentType } from '../theme';
import type { Server, Project } from '../data/types';
import { Icon } from '../components/Icon';
import { Press, Dot, Spinner, Sheet, Btn } from '../components/Primitives';
import { LiveAgentTab } from '../tabs/LiveAgentTab';
import { FilesTab } from '../tabs/FilesTab';
import { GitTab } from '../tabs/GitTab';
import { LiveProvider, SshLiveProvider, useLive } from '../core/live-context';
import { loadCredential } from '../core/credentials';
import type { SshConfig } from '../core/ssh-transport';

const T = THEME;

type TabId = 'agent' | 'files' | 'git';

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
type Conn = 'online' | 'connecting' | 'offline';

function ContextHeader({ tab, accent, conn, curAgent, onAgentTap, serverName, projectName }:
  { tab: TabId; accent: AccentType; conn: Conn; curAgent: typeof AGENT_CHOICES[0]; onAgentTap: () => void; serverName: string; projectName: string }) {

  const avatar = tab === 'agent'
    ? { icon: curAgent.icon, tint: curAgent.tint }
    : tab === 'files' ? { icon: 'folder', tint: accent.hue } : { icon: 'branch', tint: accent.hue };

  const title = tab === 'agent' ? curAgent.name : projectName;
  const sub = tab === 'agent' ? `${projectName} · ${serverName}` : `${serverName} · ${projectName}`;
  const connColor = conn === 'online' ? T.green : conn === 'connecting' ? T.yellow : T.red;

  return (
    <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingRight: 8, backgroundColor: T.bg1, borderBottomWidth: 1, borderColor: T.borderSoft }}>
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: avatar.tint + '22', borderWidth: 1, borderColor: avatar.tint + '44', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={avatar.icon} size={17} color={avatar.tint} />
      </View>
      <Press onPress={tab === 'agent' ? onAgentTap : undefined} style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, letterSpacing: -0.01 * 15 }} numberOfLines={1}>{title}</Text>
          {tab === 'agent' && <Icon name="chevD" size={14} color={T.tx2} />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
          <Dot color={connColor} glow={conn === 'online'} size={6} />
          <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2 }} numberOfLines={1}>{sub}</Text>
        </View>
      </Press>
      {tab === 'agent' && (
        <Press onPress={onAgentTap} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: accent.dim }}>
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
      onReconnect={() => setGen(g => g + 1)} />
  );

  if (ssh) {
    return (
      <SshLiveProvider key={`${agent.id}-${gen}`} ssh={ssh} cwd={props.project.path} agentCmd={agent.cmd}>
        {inner}
      </SshLiveProvider>
    );
  }

  // 没有存储的 SSH 凭证时，回退到 dev bridge（WS）
  return (
    <LiveProvider key={`${agent.id}-${gen}`} cwd={props.project.path} agentCmd={agent.cmd}>
      {inner}
    </LiveProvider>
  );
}

type InnerProps = MainShellProps & {
  curAgent: typeof AGENT_CHOICES[0];
  onPickAgent: (a: typeof AGENT_CHOICES[0]) => void;
  onReconnect: () => void;
};

function MainShellInner({ server, project, accent, onBack, curAgent, onPickAgent, onReconnect }: InnerProps) {
  const live = useLive();
  const [tab, setTabRaw] = useState<TabId>('agent');
  const [agentPicker, setAgentPicker] = useState(false);

  const conn: Conn = live.status === 'on' ? 'online' : live.status === 'connecting' ? 'connecting' : 'offline';

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.bg1 }}>
        <TopTabs tab={tab} setTab={setTabRaw} accent={accent} onBack={onBack} />
        <ContextHeader
          tab={tab}
          accent={accent}
          conn={conn}
          curAgent={curAgent}
          onAgentTap={() => setAgentPicker(true)}
          serverName={server.name}
          projectName={project.name}
        />
      </SafeAreaView>

      <View style={{ flex: 1 }}>
        {tab === 'agent' && (
          live.session
            ? <LiveAgentTab session={live.session} accent={accent} />
            : <AgentStatus accent={accent} status={live.status} error={live.error} agentName={curAgent.name} onRetry={onReconnect} />
        )}
        {tab === 'files' && <FilesTab accent={accent} exec={live.session ? (cmd, cwd) => live.session!.exec(cmd, cwd) : undefined} cwd={project.path} />}
        {tab === 'git'   && <GitTab   accent={accent} exec={live.session ? (cmd, cwd) => live.session!.exec(cmd, cwd) : undefined} cwd={project.path} />}
      </View>

      {/* agent picker（切换会真实重启会话）*/}
      <Sheet open={agentPicker} onClose={() => setAgentPicker(false)}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 14 }}>
          <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 4 }}>Agent</Text>
          <Text style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2, paddingHorizontal: 6, paddingBottom: 10 }}>
            Switching restarts the session with the selected agent
          </Text>
          {AGENT_CHOICES.map(a => {
            const active = a.id === curAgent.id;
            return (
              <Press key={a.id} onPress={() => { setAgentPicker(false); if (!active) onPickAgent(a); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 12, backgroundColor: active ? accent.dim : 'transparent' }}>
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: a.tint + '22', borderWidth: 1, borderColor: a.tint + '44', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={a.icon} size={19} color={a.tint} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 14.5, color: T.tx0 }}>{a.name}</Text>
                  <Text style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.tx2 }} numberOfLines={1}>{a.cmd}</Text>
                </View>
                {active && <Icon name="check" size={18} color={accent.hue} />}
              </Press>
            );
          })}
        </View>
      </Sheet>
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
