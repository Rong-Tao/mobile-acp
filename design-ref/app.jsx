// app.jsx — App root: navigation, main shell (header + tab bar), tweaks, mount.
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "blue",
  "toolCard": "card",
  "permission": "inline",
  "density": "regular",
  "lineNumbers": false
}/*EDITMODE-END*/;

const TABS = [
  { id: 'agent', label: 'Agent', icon: 'cmd' },
  { id: 'project', label: 'Files', icon: 'folder' },
  { id: 'git', label: 'Git', icon: 'branch' },
];

function TopTabs({ tab, setTab, accent, onExit }) {
  const T = window.THEME;
  const gitCount = window.DATA.git.unstaged.length + window.DATA.git.staged.length + window.DATA.git.untracked.length;
  return (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', background: T.bg1, borderBottom: `1px solid ${T.borderSoft}`, paddingRight: 8 }}>
      <window.Press onClick={onExit} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.tx1, flexShrink: 0 }}>
        <window.Icon name="back" size={21} />
      </window.Press>
      <div style={{ flex: 1, display: 'flex' }}>
      {TABS.map(tb => {
        const on = tb.id === tab;
        const badge = tb.id === 'git' ? gitCount : 0;
        return (
          <window.Press key={tb.id} onClick={() => setTab(tb.id)} style={{ flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, position: 'relative' }}>
            <window.Icon name={tb.icon} size={17} color={on ? accent.hue : T.tx2} strokeWidth={on ? 1.9 : 1.6} />
            <span style={{ fontFamily: T.uiFont, fontSize: 13, fontWeight: on ? 600 : 500, color: on ? T.tx0 : T.tx2 }}>{tb.label}</span>
            {badge > 0 && (
              <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: T.yellow, color: '#0a0b0e', fontFamily: T.monoFont, fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{badge}</span>
            )}
            {on && <div style={{ position: 'absolute', bottom: 0, width: 40, height: 2.5, borderRadius: 2, background: accent.hue }} />}
          </window.Press>
        );
      })}
      </div>
    </div>
  );
}

function MainShell({ server, project, accent, tweaks, onExit }) {
  const T = window.THEME;
  const AG = window.DATA.agentKinds;
  const [tab, _setTab] = useState('agent');
  const [preview, setPreview] = useState(null);
  const [proj] = useState(project);
  const [conn, setConn] = useState('online');
  const [activeThread, setActiveThread] = useState('t1');
  const [agentId, setAgentId] = useState('claude');
  const [threadList, setThreadList] = useState(false);
  const [agentMenu, setAgentMenu] = useState(false);
  const [tq, setTq] = useState('');

  useEffect(() => { window._acpLines = tweaks.lineNumbers; }, [tweaks.lineNumbers]);

  const setTab = (t) => { setPreview(null); _setTab(t); };
  const openFile = (f) => setPreview(f);
  const reconnect = () => { setConn('reconnecting'); setTimeout(() => setConn('online'), 2200); };

  const threads = window.DATA.threads;
  const curThread = threads.find(t => t.id === activeThread);
  const curAgent = AG[agentId] || AG.claude;
  const switchTo = (t) => { setActiveThread(t.id); setAgentId(t.agent); setThreadList(false); };
  const startThread = (id) => { setActiveThread('new'); setAgentId(id); setAgentMenu(false); setThreadList(false); };
  const fThreads = tq ? threads.filter(t => t.title.toLowerCase().includes(tq.toLowerCase())) : threads;
  const g = window.DATA.git;
  const gitCount = g.unstaged.length + g.staged.length + g.untracked.length;

  // tab-contextual merged header
  const onAgent = tab === 'agent';
  const headAvatar = onAgent
    ? { icon: curAgent.icon, tint: curAgent.tint }
    : tab === 'project' ? { icon: 'folder', tint: accent.hue } : { icon: 'branch', tint: accent.hue };
  const headTitle = onAgent ? (activeThread === 'new' ? 'New thread' : curThread.title) : tab === 'project' ? proj.name : g.branch;
  const headSub = onAgent ? `${proj.name} · ${curAgent.name}` : tab === 'project' ? `${server.name} · project` : `${server.name} · ${gitCount} changes`;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg0 }}>
      {/* tabs on top (stable nav) */}
      <TopTabs tab={tab} setTab={setTab} accent={accent} onExit={onExit} />
      {/* merged, tab-contextual header (below the stable tabs) */}
      <div style={{ flexShrink: 0, background: T.bg1, borderBottom: `1px solid ${T.borderSoft}` }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 9, padding: '0 8px 0 12px' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: headAvatar.tint + '22', border: `1px solid ${headAvatar.tint}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: headAvatar.tint }}>
            <window.Icon name={headAvatar.icon} size={17} />
          </div>
          <window.Press onClick={onAgent ? () => setThreadList(true) : undefined} style={{ flex: 1, minWidth: 0, cursor: onAgent ? 'pointer' : 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: T.uiFont, fontSize: 15, fontWeight: 600, color: T.tx0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>{headTitle}</span>
              {onAgent && <window.Icon name="chevD" size={14} color={T.tx2} style={{ flexShrink: 0 }} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <window.Dot color={conn === 'online' ? T.green : T.yellow} glow={conn === 'online'} size={6} />
              <span style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{headSub}</span>
            </div>
          </window.Press>
          {onAgent && (
            <window.Press onClick={() => setAgentMenu(true)} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent.hue, borderRadius: 10, background: accent.dim, flexShrink: 0 }}>
              <window.Icon name="plus" size={19} />
            </window.Press>
          )}
          {tab === 'git' && (
            <window.Press onClick={reconnect} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 11px', borderRadius: 10, background: T.bg2, border: `1px solid ${T.border}`, color: T.tx1, fontFamily: T.uiFont, fontSize: 12.5, fontWeight: 500, flexShrink: 0 }}>
              <window.Icon name="branch" size={14} /> Switch
            </window.Press>
          )}
        </div>
        {conn === 'reconnecting' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', background: 'rgba(217,176,106,0.12)', borderTop: `1px solid ${T.yellow}33` }}>
            <window.Spinner size={13} color={T.yellow} />
            <span style={{ fontFamily: T.uiFont, fontSize: 12, color: T.yellow }}>Connection lost — reconnecting over SSH…</span>
          </div>
        )}
      </div>

      {/* active tab */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {tab === 'agent' && <window.AgentTab accent={accent} tweaks={tweaks} activeThread={activeThread} agentId={agentId} />}
        {tab === 'project' && <window.ProjectTab accent={accent} onOpenFile={openFile} onMention={() => setTab('agent')} />}
        {tab === 'git' && <window.GitTab accent={accent} onOpenFile={openFile} />}

        {preview && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: T.bg0, overflow: 'hidden' }}>
            <div style={{ height: '100%', animation: 'acp-slidein 0.22s cubic-bezier(.2,.8,.2,1)' }}>
              <window.FilePreview accent={accent} file={preview} onBack={() => setPreview(null)} />
            </div>
          </div>
        )}
      </div>

      {/* thread switcher */}
      <window.Sheet open={threadList} onClose={() => setThreadList(false)} height="90%" pad={false}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '4px 14px 10px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px 12px' }}>
              <span style={{ fontFamily: T.uiFont, fontSize: 17, fontWeight: 700, color: T.tx0, letterSpacing: '-0.01em' }}>Threads</span>
              <window.Press onClick={() => { setThreadList(false); setAgentMenu(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 13px 0 10px', borderRadius: 10, background: accent.hue, color: accent.on, fontFamily: T.uiFont, fontSize: 13.5, fontWeight: 600 }}>
                <window.Icon name="plus" size={17} /> New
              </window.Press>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 11 }}>
              <window.Icon name="search" size={16} color={T.tx2} />
              <input value={tq} onChange={e => setTq(e.target.value)} placeholder="Search threads…"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: T.tx0, fontFamily: T.uiFont, fontSize: 14 }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
            {fThreads.map(t => {
              const on = t.id === activeThread;
              return (
                <window.Press key={t.id} onClick={() => switchTo(t)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', borderRadius: 12,
                  background: on ? accent.dim : 'transparent', border: `1px solid ${on ? accent.hue + '40' : 'transparent'}` }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: AG[t.agent].tint + '22', border: `1px solid ${AG[t.agent].tint}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: AG[t.agent].tint }}>
                    <window.Icon name={AG[t.agent].icon} size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: T.uiFont, fontSize: 14, fontWeight: on ? 600 : 500, color: T.tx0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                    <div style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2, marginTop: 2 }}>{AG[t.agent].name} · {t.time}</div>
                  </div>
                  {on && <window.Icon name="check" size={18} color={accent.hue} />}
                </window.Press>
              );
            })}
            {fThreads.length === 0 && <window.EmptyHint icon="search" title="No threads found" sub={`Nothing matches “${tq}”`} />}
          </div>
        </div>
      </window.Sheet>

      {/* new-thread agent picker */}
      <window.Sheet open={agentMenu} onClose={() => setAgentMenu(false)}>
        <div style={{ padding: '4px 12px 14px' }}>
          <div style={{ fontFamily: T.uiFont, fontSize: 15, fontWeight: 600, color: T.tx0, padding: '6px 6px 4px' }}>New thread</div>
          <div style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2, padding: '0 6px 10px' }}>Pick an agent to start with</div>
          {window.DATA.newAgentOrder.map(id => {
            const a = AG[id];
            return (
              <window.Press key={id} onClick={() => startThread(id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px', borderRadius: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: a.tint + '22', border: `1px solid ${a.tint}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: a.tint }}>
                  <window.Icon name={a.icon} size={19} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.uiFont, fontSize: 14.5, fontWeight: 600, color: T.tx0 }}>{a.name}</div>
                  <div style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.tx2 }}>{a.cmd}</div>
                </div>
                <window.Icon name="chevR" size={17} color={T.tx2} />
              </window.Press>
            );
          })}
          <div style={{ height: 1, background: T.borderSoft, margin: '6px 4px' }} />
          <window.Press onClick={() => setAgentMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px', color: T.tx1, fontFamily: T.uiFont, fontSize: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: T.bg2, border: `1px dashed ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.tx2 }}>
              <window.Icon name="plus" size={18} />
            </div>
            Add an agent…
          </window.Press>
        </div>
      </window.Sheet>
    </div>
  );
}

function App() {
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const accent = window.accentFor(t.accent);
  useEffect(() => { window._acpAccent = accent.hue; }, [accent.hue]);

  const [nav, setNav] = useState({ screen: 'home', server: null, project: null });
  const go = (screen, extra = {}) => setNav(n => ({ ...n, screen, ...extra }));

  let screen;
  if (nav.screen === 'home') screen = <window.ServerList accent={accent} onAdd={() => go('add')} onOpen={(s) => go('detail', { server: s })} />;
  else if (nav.screen === 'add') screen = <window.AddServer accent={accent} onBack={() => go('home')} onPaired={() => go('detail', { server: window.DATA.servers[0] })} />;
  else if (nav.screen === 'detail') screen = <window.ServerDetail server={nav.server} accent={accent} onBack={() => go('home')} onOpenProject={(p) => go('main', { project: p })} />;
  else if (nav.screen === 'main') screen = <MainShell server={nav.server} project={nav.project} accent={accent} tweaks={t} onExit={() => go('detail')} />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1b1e', padding: 0 }}>
      <window.DeviceStage>
        <div style={{ width: '100%', height: '100%', background: window.THEME.bg0 }}>{screen}</div>
      </window.DeviceStage>

      <window.TweaksPanel>
        <window.TweakSection label="Theme" />
        <window.TweakColor label="Accent" value={t.accent === 'blue' ? '#6aa6ff' : t.accent === 'green' ? '#5fcf95' : t.accent === 'orange' ? '#e0a36a' : '#b48ef0'}
          options={['#6aa6ff', '#5fcf95', '#e0a36a', '#b48ef0']}
          onChange={(hex) => setTweak('accent', { '#6aa6ff': 'blue', '#5fcf95': 'green', '#e0a36a': 'orange', '#b48ef0': 'purple' }[hex])} />
        <window.TweakRadio label="Density" value={t.density} options={['comfortable', 'regular', 'dense']} onChange={v => setTweak('density', v)} />
        <window.TweakSection label="Agent chat" />
        <window.TweakRadio label="Tool calls" value={t.toolCard} options={['card', 'compact']} onChange={v => setTweak('toolCard', v)} />
        <window.TweakRadio label="Permission" value={t.permission} options={['inline', 'sheet']} onChange={v => setTweak('permission', v)} />
        <window.TweakToggle label="Code line numbers" value={t.lineNumbers} onChange={v => setTweak('lineNumbers', v)} />
      </window.TweaksPanel>
    </div>
  );
}

// ── Device stage: scales the Android frame to fit viewport ─────
function DeviceStage({ children }) {
  const W = 412, H = 892;
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min((window.innerWidth - 24) / W, (window.innerHeight - 24) / H, 1.1));
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div style={{ width: W * scale, height: H * scale, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <window.AndroidDevice dark width={W} height={H}>{children}</window.AndroidDevice>
      </div>
    </div>
  );
}

window.DeviceStage = DeviceStage;
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
