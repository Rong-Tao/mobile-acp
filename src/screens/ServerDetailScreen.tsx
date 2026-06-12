import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME, AccentType } from '../theme';
import { DATA, Server, Project, InstalledAgent, AvailableAgent } from '../data/mock';
import { Icon } from '../components/Icon';
import { Press, Dot, Spinner, Sheet, TopBar, Btn, Field, Seg } from '../components/Primitives';

const T = THEME;

function ProjectRow({ p, accent, onOpen }: { p: Project; accent: AccentType; onOpen: (p: Project) => void }) {
  return (
    <Press onPress={() => onOpen(p)} style={{
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13,
      backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 13,
    }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.bg3, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="folder" size={19} color={accent.hue} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 14.5, color: T.tx0 }}>{p.name}</Text>
        <Text style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.tx2 }} numberOfLines={1}>{p.path}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Icon name="branch" size={13} color={T.tx2} />
        <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx1 }}>{p.branch}</Text>
        {p.dirty > 0 && <Text style={{ fontFamily: T.monoFont, fontSize: 10.5, color: T.yellow, marginLeft: 3 }}>{p.dirty}●</Text>}
      </View>
    </Press>
  );
}

function AgentRow({ a, accent, onMenu }: { a: InstalledAgent; accent: AccentType; onMenu: (a: InstalledAgent) => void }) {
  return (
    <Press onPress={() => onMenu(a)} style={{
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13,
      backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 13,
    }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.bg3, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="terminal" size={18} color={a.ok ? accent.hue : T.tx2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 14.5, color: T.tx0 }}>{a.name}</Text>
        <Text style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.tx2 }}>{a.cmd}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Dot color={a.ok ? T.green : T.red} />
        <Text style={{ fontFamily: T.uiFont, fontSize: 11.5, color: a.ok ? T.green : T.red }}>
          {a.ok ? 'Ready' : 'Not found'}
        </Text>
      </View>
    </Press>
  );
}

function InstallLog({ agent, accent, onDone, onClose }: { agent: AvailableAgent; accent: AccentType; onDone: () => void; onClose: () => void }) {
  const lines = [
    { t: 'cmd', s: '$ ' + agent.install },
    { t: 'out', s: 'npm warn deprecated source-map@0.7.4' },
    { t: 'out', s: 'added 142 packages in 6s' },
    { t: 'out', s: '' },
    { t: 'out', s: 'resolving binaries…' },
    { t: 'ok', s: '✓ ' + agent.cmd.split(' ')[0] + ' linked to /usr/local/bin' },
    { t: 'ok', s: '✓ installation complete' },
  ];
  const [shown, setShown] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (shown >= lines.length) return;
    const d = setTimeout(() => setShown(s => s + 1), shown === 0 ? 250 : 380 + Math.random() * 280);
    return () => clearTimeout(d);
  }, [shown]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [shown]);

  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(blink, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);

  const done = shown >= lines.length;
  const lineColor = (t: string) => t === 'cmd' ? accent.hue : t === 'ok' ? T.green : T.tx1;

  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingTop: 4, paddingBottom: 12 }}>
        <Icon name="download" size={18} color={accent.hue} />
        <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, flex: 1 }}>Installing {agent.name}</Text>
        {!done && <Spinner size={15} color={accent.hue} />}
      </View>
      <View style={{ backgroundColor: '#0a0b0e', borderWidth: 1, borderColor: T.borderSoft, borderRadius: 11, padding: 12, height: 200, overflow: 'hidden' }}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
          {lines.slice(0, shown).map((l, i) => (
            <Text key={i} style={{ fontFamily: T.monoFont, fontSize: 12, lineHeight: 20.4, color: lineColor(l.t) }}>
              {l.s || ' '}
            </Text>
          ))}
          {!done && (
            <Animated.View style={{ width: 8, height: 15, backgroundColor: accent.hue, opacity: blink }} />
          )}
        </ScrollView>
      </View>
      {done ? (
        <View style={{ gap: 10, marginTop: 12 }}>
          <Field label="Launch command" value={agent.cmd} mono onChange={() => {}} />
          <Btn full accent={accent} icon="check" onPress={onDone}>Done · add agent</Btn>
        </View>
      ) : (
        <Btn full kind="ghost" onPress={onClose} style={{ marginTop: 12 }}>Run in background</Btn>
      )}
    </View>
  );
}

type ServerDetailProps = { server: Server; accent: AccentType; onBack: () => void; onOpenProject: (p: Project) => void };

export function ServerDetail({ server, accent, onBack, onOpenProject }: ServerDetailProps) {
  const [tab, setTab] = useState<'projects' | 'agents'>('projects');
  const [installing, setInstalling] = useState<AvailableAgent | null>(null);
  const [picker, setPicker] = useState(false);
  const [agentMenu, setAgentMenu] = useState<InstalledAgent | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.bg1 }}>
        <TopBar
          title={server.name}
          sub={`${server.user}@${server.host}`}
          onBack={onBack}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 10 }}>
              <Dot color={T.green} glow />
              <Text style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.green }}>Online</Text>
            </View>
          }
        />
      </SafeAreaView>

      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
        <Seg accent={accent} value={tab} onChange={v => setTab(v as 'projects' | 'agents')} options={[
          { value: 'projects', label: 'Projects', icon: 'folder' },
          { value: 'agents', label: 'Agents', icon: 'terminal' },
        ]} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 28, gap: 10 }} showsVerticalScrollIndicator={false}>
        {tab === 'projects' && (
          <>
            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 11.5, color: T.tx2, letterSpacing: 0.6, textTransform: 'uppercase' }}>Working directories</Text>
            {DATA.projects.map(p => <ProjectRow key={p.id} p={p} accent={accent} onOpen={onOpenProject} />)}
            <Btn kind="ghost" full icon="plus" onPress={() => setPicker(true)} style={{ marginTop: 4 }}>Add directory</Btn>
          </>
        )}

        {tab === 'agents' && (
          <>
            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 11.5, color: T.tx2, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Installed on {server.name}
            </Text>
            {DATA.installedAgents.map(a => <AgentRow key={a.id} a={a} accent={accent} onMenu={setAgentMenu} />)}
            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 11.5, color: T.tx2, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 10 }}>Install new</Text>
            {DATA.availableAgents.map(a => (
              <Press key={a.id} onPress={() => a.pkg ? setInstalling(a) : undefined} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
                backgroundColor: T.bg2, borderWidth: 1, borderStyle: 'dashed', borderColor: T.border, borderRadius: 13,
              }}>
                <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: T.bg1, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={a.pkg ? 'download' : 'plus'} size={17} color={T.tx1} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: T.uiFontMedium, fontSize: 14, color: T.tx0 }}>{a.name}</Text>
                  <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2 }} numberOfLines={1}>
                    {a.pkg ? a.install : 'Enter your own launch command'}
                  </Text>
                </View>
                <Icon name="chevR" size={17} color={T.tx2} />
              </Press>
            ))}
          </>
        )}
      </ScrollView>

      {/* directory picker sheet */}
      <Sheet open={picker} onClose={() => setPicker(false)}>
        <View style={{ paddingHorizontal: 14, paddingBottom: 16, gap: 10 }}>
          <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, paddingTop: 6, paddingBottom: 6 }}>Browse remote</Text>
          <View style={{ paddingHorizontal: 11, paddingVertical: 8, backgroundColor: T.bg2, borderRadius: 10, borderWidth: 1, borderColor: T.border }}>
            <Text style={{ fontFamily: T.monoFont, fontSize: 12, color: T.tx1 }}>~/code</Text>
          </View>
          {['mobile-acp/', 'acp-server/', 'experiments/', 'node_modules/'].map(d => (
            <Press key={d} onPress={() => setPicker(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, height: 46, paddingHorizontal: 6 }}>
              <Icon name="folder" size={18} color={accent.hue} />
              <Text style={{ fontFamily: T.monoFont, fontSize: 13.5, color: T.tx0, flex: 1 }}>{d}</Text>
              <Icon name="chevR" size={16} color={T.tx2} />
            </Press>
          ))}
          <Btn full accent={accent} onPress={() => setPicker(false)}>Use this directory</Btn>
        </View>
      </Sheet>

      {/* agent config sheet */}
      <Sheet open={!!agentMenu} onClose={() => setAgentMenu(null)}>
        {agentMenu && (
          <View style={{ paddingHorizontal: 14, paddingBottom: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 6, paddingBottom: 2 }}>
              <Icon name="terminal" size={20} color={accent.hue} />
              <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0 }}>{agentMenu.name}</Text>
            </View>
            <Field label="Display name" value={agentMenu.name} mono onChange={() => {}} />
            <Field label="Launch command" value={agentMenu.cmd} mono onChange={() => {}} />
            <Field label="Env vars" value="ANTHROPIC_API_KEY=sk-ant-•••••" mono onChange={() => {}}
              right={<Icon name="lock" size={15} color={T.tx2} />} hint="Encrypted on device" />
            <Field label="Working dir" value="" placeholder="(follows project)" mono onChange={() => {}} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
              <Btn kind="danger" icon="trash" onPress={() => setAgentMenu(null)}>Remove</Btn>
              <Btn full accent={accent} onPress={() => setAgentMenu(null)}>Save</Btn>
            </View>
          </View>
        )}
      </Sheet>

      {/* install log sheet */}
      <Sheet open={!!installing} onClose={() => setInstalling(null)}>
        {installing && (
          <InstallLog agent={installing} accent={accent} onClose={() => setInstalling(null)} onDone={() => setInstalling(null)} />
        )}
      </Sheet>
    </View>
  );
}
