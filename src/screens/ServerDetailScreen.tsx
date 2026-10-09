import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME, AccentType } from '../theme';
import type { Server, Project } from '../data/types';
import { Icon } from '../components/Icon';
import { Press, Dot, Spinner, Sheet, TopBar, Btn, Seg } from '../components/Primitives';
import type { Transport } from '../core/transport';
import { SshTransport } from '../core/ssh-transport';
import { WsTransport } from '../core/ws-transport';
import { bridgeUrl } from '../core/live-context';
import { loadCredential } from '../core/credentials';
import {
  statProjects, listDirs, detectAgents, scanGitRepos,
  RemoteProject, DetectedAgent, KNOWN_AGENTS, Exec,
} from '../core/remote';
import { loadProjectPaths, addProjectPath, removeProjectPath } from '../core/projects';
import { upsertServer } from '../core/servers';

const T = THEME;

type ConnState = 'connecting' | 'online' | 'offline';

// ── 连接管理：优先 SSH（有存储凭证），否则 dev bridge ─────────
function useServerTransport(server: Server) {
  const [state, setState] = useState<ConnState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [gen, setGen] = useState(0);
  const ref = useRef<{ transport?: Transport; dead?: boolean }>({});

  useEffect(() => {
    const st = ref.current;
    st.dead = false;
    setState('connecting');
    setError(null);
    (async () => {
      try {
        const cred = await loadCredential(server.id);
        let transport: Transport;
        if (cred) {
          transport = await SshTransport.connect({
            host: server.host, port: server.port, user: server.user, auth: cred,
          });
        } else {
          transport = new WsTransport(bridgeUrl());
          await transport.exec('true'); // 验证 bridge 可达
        }
        if (st.dead) { transport.close(); return; }
        st.transport = transport;
        setState('online');
        // 回写真实连接状态，HomeScreen 的 Online/last 不再是配对时的死数据
        upsertServer({ ...server, online: true, last: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }).catch(() => {});
      } catch (e) {
        if (!st.dead) { setState('offline'); setError(String(e)); }
        upsertServer({ ...server, online: false }).catch(() => {});
      }
    })();
    return () => { st.dead = true; st.transport?.close(); st.transport = undefined; };
  }, [server.id, gen]);

  const exec: Exec | null = state === 'online' && ref.current.transport
    ? (cmd, cwd) => ref.current.transport!.exec(cmd, cwd ? { cwd } : undefined)
    : null;

  return { state, error, exec, retry: () => setGen(g => g + 1) };
}

// ── Project row（真实 branch / dirty；不存在的目录标红）──────
function ProjectRow({ p, accent, onOpen, onLongPress }: {
  p: RemoteProject; accent: AccentType; onOpen: (p: RemoteProject) => void; onLongPress: (p: RemoteProject) => void;
}) {
  return (
    <Press onPress={() => p.exists && onOpen(p)} onLongPress={() => onLongPress(p)} style={{
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13,
      backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 13,
      opacity: p.exists ? 1 : 0.55,
    }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.bg3, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="folder" size={19} color={p.exists ? accent.hue : T.red} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 14.5, color: T.tx0 }}>{p.name}</Text>
        <Text style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.tx2 }} numberOfLines={1}>{p.path}</Text>
      </View>
      {!p.exists ? (
        <Text style={{ fontFamily: T.uiFont, fontSize: 11, color: T.red }}>not found</Text>
      ) : p.isGit ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="branch" size={13} color={T.tx2} />
          <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx1 }} numberOfLines={1}>{p.branch}</Text>
          {p.dirty > 0 && <Text style={{ fontFamily: T.monoFont, fontSize: 10.5, color: T.yellow, marginLeft: 3 }}>{p.dirty}●</Text>}
        </View>
      ) : null}
    </Press>
  );
}

function AgentRow({ a, accent, onMenu }: { a: DetectedAgent; accent: AccentType; onMenu: (a: DetectedAgent) => void }) {
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
        <Text style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.tx2 }} numberOfLines={1}>
          {a.ok && a.version ? a.version : a.cmd}
        </Text>
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

// ── 真实安装：spawn 流式输出 ─────────────────────────────────
const INSTALLS: Record<string, string> = {
  claude: 'npm i -g @anthropic-ai/claude-code',
  codex: 'npm i -g @openai/codex',
  gemini: 'npm i -g @google/gemini-cli',
};

function InstallLog({ agentId, transport, accent, onDone, onClose }: {
  agentId: string; transport: Transport; accent: AccentType; onDone: () => void; onClose: () => void;
}) {
  const info = KNOWN_AGENTS.find(a => a.id === agentId)!;
  const installCmd = INSTALLS[agentId];
  const [lines, setLines] = useState<{ t: string; s: string }[]>([{ t: 'cmd', s: '$ ' + installCmd }]);
  const [status, setStatus] = useState<'running' | 'ok' | 'fail'>('running');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let dead = false;
    let kill: (() => void) | null = null;
    (async () => {
      try {
        const ch = await transport.spawn({ cmd: installCmd });
        kill = () => ch.kill();
        const push = (t: string) => (chunk: string) => {
          if (dead) return;
          const ls = chunk.split('\n').filter(s => s.length > 0).map(s => ({ t, s }));
          if (ls.length) setLines(prev => prev.concat(ls).slice(-200));
        };
        ch.onData(push('out'));
        ch.onStderr(push('err'));
        ch.onExit((code) => {
          if (dead) return;
          const ok = code === 0;
          setLines(prev => prev.concat({ t: ok ? 'ok' : 'err', s: ok ? '✓ installation complete' : `✗ exited with code ${code}` }));
          setStatus(ok ? 'ok' : 'fail');
        });
      } catch (e) {
        if (!dead) { setLines(prev => prev.concat({ t: 'err', s: String(e) })); setStatus('fail'); }
      }
    })();
    return () => { dead = true; kill?.(); };
  }, []);

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [lines]);

  const lineColor = (t: string) => t === 'cmd' ? accent.hue : t === 'ok' ? T.green : t === 'err' ? T.red : T.tx1;

  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingTop: 4, paddingBottom: 12 }}>
        <Icon name="download" size={18} color={accent.hue} />
        <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, flex: 1 }}>Installing {info.name}</Text>
        {status === 'running' && <Spinner size={15} color={accent.hue} />}
      </View>
      <View style={{ backgroundColor: '#0a0b0e', borderWidth: 1, borderColor: T.borderSoft, borderRadius: 11, padding: 12, height: 200, overflow: 'hidden' }}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
          {lines.map((l, i) => (
            <Text key={i} style={{ fontFamily: T.monoFont, fontSize: 12, lineHeight: 20.4, color: lineColor(l.t) }}>
              {l.s || ' '}
            </Text>
          ))}
        </ScrollView>
      </View>
      {status === 'running'
        ? <Btn full kind="ghost" onPress={onClose} style={{ marginTop: 12 }}>Hide (keeps running)</Btn>
        : <Btn full accent={accent} icon={status === 'ok' ? 'check' : 'x'} onPress={onDone} style={{ marginTop: 12 }}>
            {status === 'ok' ? 'Done' : 'Close'}
          </Btn>}
    </View>
  );
}

// ── 远端目录浏览器 ───────────────────────────────────────────
function DirBrowser({ exec, accent, onPick, onClose }: {
  exec: Exec; accent: AccentType; onPick: (path: string) => void; onClose: () => void;
}) {
  const [path, setPath] = useState('~');
  const [dirs, setDirs] = useState<string[] | null>(null);

  useEffect(() => {
    let dead = false;
    setDirs(null);
    listDirs(exec, path).then(d => { if (!dead) setDirs(d); }).catch(() => { if (!dead) setDirs([]); });
    return () => { dead = true; };
  }, [path]);

  const enter = (d: string) => setPath(path === '~' ? `~/${d}` : `${path}/${d}`);
  const up = () => {
    if (path === '~') return;
    const i = path.lastIndexOf('/');
    setPath(i <= 1 ? '~' : path.slice(0, i));
  };

  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 16, gap: 10 }}>
      <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, paddingTop: 6 }}>Browse remote</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Press onPress={up} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', opacity: path === '~' ? 0.4 : 1 }}>
          <Icon name="back" size={17} color={T.tx1} />
        </Press>
        <View style={{ flex: 1, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: T.bg2, borderRadius: 10, borderWidth: 1, borderColor: T.border }}>
          <Text style={{ fontFamily: T.monoFont, fontSize: 12, color: T.tx1 }} numberOfLines={1}>{path}</Text>
        </View>
      </View>
      <View style={{ maxHeight: 300 }}>
        {dirs === null ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}><Spinner size={18} color={accent.hue} /></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {dirs.map(d => (
              <Press key={d} onPress={() => enter(d)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, height: 44, paddingHorizontal: 6 }}>
                <Icon name="folder" size={18} color={accent.hue} />
                <Text style={{ fontFamily: T.monoFont, fontSize: 13.5, color: T.tx0, flex: 1 }} numberOfLines={1}>{d}/</Text>
                <Icon name="chevR" size={16} color={T.tx2} />
              </Press>
            ))}
            {dirs.length === 0 && (
              <Text style={{ fontFamily: T.uiFont, fontSize: 12.5, color: T.tx2, paddingVertical: 14, textAlign: 'center' }}>No subdirectories</Text>
            )}
          </ScrollView>
        )}
      </View>
      <Btn full accent={accent} onPress={() => { onPick(path); onClose(); }}>Use this directory</Btn>
    </View>
  );
}

// ── 主屏 ─────────────────────────────────────────────────────
type ServerDetailProps = { server: Server; accent: AccentType; onBack: () => void; onOpenProject: (p: Project) => void };

export function ServerDetail({ server, accent, onBack, onOpenProject }: ServerDetailProps) {
  const [tab, setTab] = useState<'projects' | 'agents'>('projects');
  const { state, error, exec, retry } = useServerTransport(server);

  // projects
  const [paths, setPaths] = useState<string[]>([]);
  const [projects, setProjects] = useState<RemoteProject[]>([]);
  const [projLoading, setProjLoading] = useState(false);
  const [picker, setPicker] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RemoteProject | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<string[] | null>(null);

  // agents
  const [agents, setAgents] = useState<DetectedAgent[] | null>(null);
  const [agentInfo, setAgentInfo] = useState<DetectedAgent | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => { loadProjectPaths(server.id).then(setPaths); }, [server.id]);

  const refreshProjects = useCallback(async (ps: string[]) => {
    if (!exec) { setProjects(ps.map(p => ({ path: p, name: p.split('/').pop() || p, exists: true, isGit: false, branch: '', dirty: 0 }))); return; }
    setProjLoading(true);
    try { setProjects(await statProjects(exec, ps)); }
    catch { /* 连接中断，保持旧数据 */ }
    finally { setProjLoading(false); }
  }, [exec]);

  useEffect(() => { refreshProjects(paths); }, [paths, exec]);

  useEffect(() => {
    if (!exec) { setAgents(null); return; }
    let dead = false;
    detectAgents(exec).then(a => { if (!dead) setAgents(a); }).catch(() => {});
    return () => { dead = true; };
  }, [exec, installing]);

  const addPath = async (p: string) => setPaths(await addProjectPath(server.id, p));
  const removePath = async (p: string) => { setPaths(await removeProjectPath(server.id, p)); setRemoveTarget(null); };

  const scan = async () => {
    if (!exec) return;
    setScanning(true);
    try { setScanResults((await scanGitRepos(exec)).filter(r => !paths.includes(r))); }
    catch { setScanResults([]); }
    finally { setScanning(false); }
  };

  const statusUi = {
    connecting: { color: T.yellow, label: 'Connecting…' },
    online: { color: T.green, label: 'Online' },
    offline: { color: T.red, label: 'Offline' },
  }[state];

  const transportRef = exec ? true : false;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.bg1 }}>
        <TopBar
          title={server.name}
          sub={`${server.user}@${server.host}`}
          onBack={onBack}
          right={
            <Press onPress={state === 'offline' ? retry : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 10 }}>
              {state === 'connecting' ? <Spinner size={11} color={statusUi.color} /> : <Dot color={statusUi.color} glow={state === 'online'} />}
              <Text style={{ fontFamily: T.uiFont, fontSize: 11.5, color: statusUi.color }}>{statusUi.label}</Text>
            </Press>
          }
        />
      </SafeAreaView>

      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
        <Seg accent={accent} value={tab} onChange={v => setTab(v as 'projects' | 'agents')} options={[
          { value: 'projects', label: 'Projects', icon: 'folder' },
          { value: 'agents', label: 'Agents', icon: 'terminal' },
        ]} />
      </View>

      {state === 'offline' && (
        <Press onPress={retry} style={{ marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 11, backgroundColor: T.red + '14', borderWidth: 1, borderColor: T.red + '44' }}>
          <Text style={{ fontFamily: T.uiFontMedium, fontSize: 12.5, color: T.red }}>Connection failed — tap to retry</Text>
          {!!error && <Text style={{ fontFamily: T.monoFont, fontSize: 10.5, color: T.tx2, marginTop: 4 }} numberOfLines={2}>{error}</Text>}
        </Press>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 28, gap: 10 }} showsVerticalScrollIndicator={false}>
        {tab === 'projects' && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 11.5, color: T.tx2, letterSpacing: 0.6, textTransform: 'uppercase', flex: 1 }}>Working directories</Text>
              {projLoading && <Spinner size={13} color={T.tx2} />}
            </View>
            {projects.map(p => (
              <ProjectRow key={p.path} p={p} accent={accent}
                onOpen={(rp) => onOpenProject({ id: rp.path, name: rp.name, path: rp.path, branch: rp.branch, dirty: rp.dirty })}
                onLongPress={setRemoveTarget} />
            ))}
            {projects.length === 0 && !projLoading && (
              <View style={{ alignItems: 'center', paddingVertical: 18, gap: 4 }}>
                <Text style={{ fontFamily: T.uiFontMedium, fontSize: 13.5, color: T.tx1 }}>No directories yet</Text>
                <Text style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2 }}>Add one, or scan the server for git repos</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Btn kind="ghost" full icon="plus" onPress={() => setPicker(true)} disabled={!transportRef}>Add directory</Btn>
              <Btn kind="ghost" full icon="search" onPress={scan} disabled={!transportRef || scanning}>{scanning ? 'Scanning…' : 'Scan repos'}</Btn>
            </View>
          </>
        )}

        {tab === 'agents' && (
          <>
            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 11.5, color: T.tx2, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Detected on {server.name}
            </Text>
            {agents === null ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                {state === 'connecting' ? <Spinner size={18} color={accent.hue} />
                  : <Text style={{ fontFamily: T.uiFont, fontSize: 12.5, color: T.tx2 }}>Connect to detect installed agents</Text>}
              </View>
            ) : (
              <>
                {agents.map(a => <AgentRow key={a.id} a={a} accent={accent} onMenu={setAgentInfo} />)}
                <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 11.5, color: T.tx2, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 10 }}>Install</Text>
                {agents.filter(a => !a.ok).map(a => (
                  <Press key={a.id} onPress={() => setInstalling(a.id)} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
                    backgroundColor: T.bg2, borderWidth: 1, borderStyle: 'dashed', borderColor: T.border, borderRadius: 13,
                  }}>
                    <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: T.bg1, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="download" size={17} color={T.tx1} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontFamily: T.uiFontMedium, fontSize: 14, color: T.tx0 }}>{a.name}</Text>
                      <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2 }} numberOfLines={1}>{INSTALLS[a.id]}</Text>
                    </View>
                    <Icon name="chevR" size={17} color={T.tx2} />
                  </Press>
                ))}
                {agents.every(a => a.ok) && (
                  <Text style={{ fontFamily: T.uiFont, fontSize: 12.5, color: T.tx2, paddingVertical: 6 }}>All known agents are installed.</Text>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* directory picker */}
      <Sheet open={picker} onClose={() => setPicker(false)}>
        {exec ? <DirBrowser exec={exec} accent={accent} onPick={addPath} onClose={() => setPicker(false)} /> : <View />}
      </Sheet>

      {/* scan results */}
      <Sheet open={scanResults !== null} onClose={() => setScanResults(null)}>
        <View style={{ paddingHorizontal: 14, paddingBottom: 16, gap: 8 }}>
          <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, paddingTop: 6, paddingBottom: 4 }}>Git repos found</Text>
          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {(scanResults ?? []).map(r => (
              <Press key={r} onPress={() => { addPath(r); setScanResults(s => (s ?? []).filter(x => x !== r)); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 11, height: 44, paddingHorizontal: 6 }}>
                <Icon name="folder" size={18} color={accent.hue} />
                <Text style={{ fontFamily: T.monoFont, fontSize: 13, color: T.tx0, flex: 1 }} numberOfLines={1}>{r}</Text>
                <Icon name="plus" size={17} color={T.tx2} />
              </Press>
            ))}
            {(scanResults ?? []).length === 0 && (
              <Text style={{ fontFamily: T.uiFont, fontSize: 12.5, color: T.tx2, paddingVertical: 14, textAlign: 'center' }}>No new repos found</Text>
            )}
          </ScrollView>
          <Btn full kind="ghost" onPress={() => setScanResults(null)}>Close</Btn>
        </View>
      </Sheet>

      {/* remove confirm */}
      <Sheet open={!!removeTarget} onClose={() => setRemoveTarget(null)}>
        {removeTarget && (
          <View style={{ paddingHorizontal: 14, paddingBottom: 16, gap: 12 }}>
            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, paddingTop: 6 }}>{removeTarget.name}</Text>
            <Text style={{ fontFamily: T.monoFont, fontSize: 12, color: T.tx2 }}>{removeTarget.path}</Text>
            <Text style={{ fontFamily: T.uiFont, fontSize: 12.5, color: T.tx1 }}>Remove from this list? The directory on the server is not touched.</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn full kind="ghost" onPress={() => setRemoveTarget(null)}>Cancel</Btn>
              <Btn full kind="danger" icon="trash" onPress={() => removePath(removeTarget.path)}>Remove</Btn>
            </View>
          </View>
        )}
      </Sheet>

      {/* agent info */}
      <Sheet open={!!agentInfo} onClose={() => setAgentInfo(null)}>
        {agentInfo && (
          <View style={{ paddingHorizontal: 14, paddingBottom: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 6, paddingBottom: 2 }}>
              <Icon name="terminal" size={20} color={accent.hue} />
              <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, flex: 1 }}>{agentInfo.name}</Text>
              <Dot color={agentInfo.ok ? T.green : T.red} />
            </View>
            <InfoRow label="Status" value={agentInfo.ok ? `Installed${agentInfo.version ? ' · ' + agentInfo.version : ''}` : 'Not found on server'} />
            <InfoRow label="Binary" value={agentInfo.bin} mono />
            <InfoRow label="ACP launch command" value={agentInfo.cmd} mono />
            <Btn full kind="ghost" onPress={() => setAgentInfo(null)} style={{ marginTop: 4 }}>Close</Btn>
          </View>
        )}
      </Sheet>

      {/* install log（真实 spawn）*/}
      <Sheet open={!!installing} onClose={() => setInstalling(null)}>
        {installing && exec ? (
          <InstallLogHost agentId={installing} server={server} accent={accent} onClose={() => setInstalling(null)} />
        ) : <View />}
      </Sheet>
    </View>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ fontFamily: T.uiFontMedium, fontSize: 11, color: T.tx2, letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontFamily: mono ? T.monoFont : T.uiFont, fontSize: 13, color: T.tx0 }}>{value}</Text>
    </View>
  );
}

// InstallLog 需要原始 transport（spawn），不只是 exec——单独建一条连接，避免和主连接的 exec 抢通道
function InstallLogHost({ agentId, server, accent, onClose }: {
  agentId: string; server: Server; accent: AccentType; onClose: () => void;
}) {
  const [transport, setTransport] = useState<Transport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    let t: Transport | undefined;
    (async () => {
      try {
        const cred = await loadCredential(server.id);
        t = cred
          ? await SshTransport.connect({ host: server.host, port: server.port, user: server.user, auth: cred })
          : new WsTransport(bridgeUrl());
        if (dead) { t.close(); return; }
        setTransport(t);
      } catch (e) { if (!dead) setErr(String(e)); }
    })();
    return () => { dead = true; t?.close(); };
  }, []);

  if (err) return <Text style={{ fontFamily: T.uiFont, fontSize: 12.5, color: T.red, padding: 16 }}>{err}</Text>;
  if (!transport) return <View style={{ alignItems: 'center', padding: 24 }}><Spinner size={18} color={accent.hue} /></View>;
  return <InstallLog agentId={agentId} transport={transport} accent={accent} onDone={onClose} onClose={onClose} />;
}
