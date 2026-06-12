// screens-server.jsx — ServerDetail: Projects + Agent management. Exports: ServerDetail
const { useState: _s_us, useEffect: _s_ue, useRef: _s_ur } = React;

function ProjectRow({ p, accent, onOpen }) {
  const T = window.THEME;
  return (
    <window.Press onClick={() => onOpen(p)} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
      background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 13 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: T.bg3, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent.hue }}>
        <window.Icon name="folder" size={19} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.uiFont, fontSize: 14.5, fontWeight: 600, color: T.tx0 }}>{p.name}</div>
        <div style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.tx2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.path}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <window.Icon name="branch" size={13} color={T.tx2} />
        <span style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx1 }}>{p.branch}</span>
        {p.dirty > 0 && <span style={{ fontFamily: T.monoFont, fontSize: 10.5, color: T.yellow, marginLeft: 3 }}>{p.dirty}&#9679;</span>}
      </div>
    </window.Press>
  );
}

function AgentRow({ a, accent, onMenu }) {
  const T = window.THEME;
  return (
    <window.Press onClick={() => onMenu(a)} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
      background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 13 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: T.bg3, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: a.ok ? accent.hue : T.tx2 }}>
        <window.Icon name="terminal" size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.uiFont, fontSize: 14.5, fontWeight: 600, color: T.tx0 }}>{a.name}</div>
        <div style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.tx2 }}>{a.cmd}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <window.Dot color={a.ok ? T.green : T.red} />
        <span style={{ fontFamily: T.uiFont, fontSize: 11.5, color: a.ok ? T.green : T.red }}>{a.ok ? 'Ready' : 'Not found'}</span>
      </div>
    </window.Press>
  );
}

function InstallLog({ agent, accent, onDone, onClose }) {
  const T = window.THEME;
  const lines = [
    { t: 'cmd', s: '$ ' + agent.install },
    { t: 'out', s: 'npm warn deprecated source-map@0.7.4' },
    { t: 'out', s: 'added 142 packages in 6s' },
    { t: 'out', s: '' },
    { t: 'out', s: 'resolving binaries…' },
    { t: 'ok', s: '\u2713 ' + agent.cmd.split(' ')[0] + ' linked to /usr/local/bin' },
    { t: 'ok', s: '\u2713 installation complete' },
  ];
  const [shown, setShown] = _s_us(0);
  const ref = _s_ur(null);
  _s_ue(() => {
    if (shown >= lines.length) return;
    const d = setTimeout(() => setShown(s => s + 1), shown === 0 ? 250 : 380 + Math.random() * 280);
    return () => clearTimeout(d);
  }, [shown]);
  _s_ue(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [shown]);
  const done = shown >= lines.length;
  return (
    <div style={{ padding: '4px 14px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 2px 12px' }}>
        <window.Icon name="download" size={18} color={accent.hue} />
        <div style={{ fontFamily: T.uiFont, fontSize: 15, fontWeight: 600, color: T.tx0 }}>Installing {agent.name}</div>
        {!done && <window.Spinner size={15} color={accent.hue} />}
      </div>
      <div ref={ref} style={{ background: '#0a0b0e', border: `1px solid ${T.borderSoft}`, borderRadius: 11,
        padding: 12, height: 200, overflowY: 'auto', fontFamily: T.monoFont, fontSize: 12, lineHeight: 1.7 }}>
        {lines.slice(0, shown).map((l, i) => (
          <div key={i} style={{ color: l.t === 'cmd' ? accent.hue : l.t === 'ok' ? T.green : T.tx1, whiteSpace: 'pre-wrap' }}>{l.s || '\u00a0'}</div>
        ))}
        {!done && <span style={{ display: 'inline-block', width: 8, height: 15, background: accent.hue, verticalAlign: 'text-bottom', animation: 'acp-blink 1s steps(1) infinite' }} />}
      </div>
      {done ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <window.Field label="Launch command" value={agent.cmd} mono onChange={() => {}} />
          <window.Btn full accent={accent} icon="check" onClick={onDone}>Done · add agent</window.Btn>
        </div>
      ) : (
        <window.Btn full kind="ghost" onClick={onClose} style={{ marginTop: 12 }}>Run in background</window.Btn>
      )}
    </div>
  );
}

function ServerDetail({ server, accent, onBack, onOpenProject }) {
  const T = window.THEME;
  const [tab, setTab] = _s_us('projects');
  const [installing, setInstalling] = _s_us(null);
  const [picker, setPicker] = _s_us(false);
  const [agentMenu, setAgentMenu] = _s_us(null);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg0 }}>
      <window.TopBar title={server.name} sub={`${server.user}@${server.host}`} onBack={onBack}
        right={<div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingRight: 10, fontFamily: T.uiFont, fontSize: 11.5, color: T.green }}><window.Dot color={T.green} glow /> Online</div>} />
      <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
        <window.Seg accent={accent} value={tab} onChange={setTab} options={[
          { value: 'projects', label: 'Projects', icon: 'folder' },
          { value: 'agents', label: 'Agents', icon: 'terminal' },
        ]} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'projects' && (<>
          <div style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Working directories</div>
          {window.DATA.projects.map(p => <ProjectRow key={p.id} p={p} accent={accent} onOpen={onOpenProject} />)}
          <window.Btn kind="ghost" full icon="plus" onClick={() => setPicker(true)} style={{ marginTop: 4 }}>Add directory</window.Btn>
        </>)}

        {tab === 'agents' && (<>
          <div style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Installed on {server.name}</div>
          {window.DATA.installedAgents.map(a => <AgentRow key={a.id} a={a} accent={accent} onMenu={setAgentMenu} />)}
          <div style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 10 }}>Install new</div>
          {window.DATA.availableAgents.map(a => (
            <window.Press key={a.id} onClick={() => a.pkg && setInstalling(a)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: T.bg2, border: `1px dashed ${T.border}`, borderRadius: 13 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: T.bg1, border: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.tx1 }}>
                <window.Icon name={a.pkg ? 'download' : 'plus'} size={17} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.uiFont, fontSize: 14, fontWeight: 500, color: T.tx0 }}>{a.name}</div>
                <div style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.pkg ? a.install : 'Enter your own launch command'}</div>
              </div>
              <window.Icon name="chevR" size={17} color={T.tx2} />
            </window.Press>
          ))}
        </>)}
      </div>

      {/* directory picker sheet */}
      <window.Sheet open={picker} onClose={() => setPicker(false)}>
        <div style={{ padding: '4px 14px 16px' }}>
          <div style={{ fontFamily: T.uiFont, fontSize: 15, fontWeight: 600, color: T.tx0, padding: '6px 2px 12px' }}>Browse remote</div>
          <div style={{ fontFamily: T.monoFont, fontSize: 12, color: T.tx1, padding: '8px 11px', background: T.bg2, borderRadius: 10, border: `1px solid ${T.border}`, marginBottom: 10 }}>~/code</div>
          {['mobile-acp/', 'acp-server/', 'experiments/', 'node_modules/'].map((d, i) => (
            <window.Press key={d} onClick={() => setPicker(false)} style={{ display: 'flex', alignItems: 'center', gap: 11, height: 46, padding: '0 6px', color: T.tx0, fontFamily: T.monoFont, fontSize: 13.5 }}>
              <window.Icon name="folder" size={18} color={accent.hue} /> {d}
              <window.Icon name="chevR" size={16} color={T.tx2} style={{ marginLeft: 'auto' }} />
            </window.Press>
          ))}
          <window.Btn full accent={accent} onClick={() => setPicker(false)} style={{ marginTop: 10 }}>Use this directory</window.Btn>
        </div>
      </window.Sheet>

      {/* agent config / delete menu */}
      <window.Sheet open={!!agentMenu} onClose={() => setAgentMenu(null)}>
        {agentMenu && (
          <div style={{ padding: '4px 14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px 14px' }}>
              <window.Icon name="terminal" size={20} color={accent.hue} />
              <div style={{ fontFamily: T.uiFont, fontSize: 15, fontWeight: 600, color: T.tx0 }}>{agentMenu.name}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <window.Field label="Display name" value={agentMenu.name} mono onChange={() => {}} />
              <window.Field label="Launch command" value={agentMenu.cmd} mono onChange={() => {}} />
              <window.Field label="Env vars" value="ANTHROPIC_API_KEY=sk-ant-•••••" mono onChange={() => {}}
                right={<window.Icon name="lock" size={15} color={T.tx2} />} hint="Encrypted on device" />
              <window.Field label="Working dir" value="" placeholder="(follows project)" mono onChange={() => {}} />
              <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                <window.Btn kind="danger" icon="trash" onClick={() => setAgentMenu(null)}>Remove</window.Btn>
                <window.Btn full accent={accent} onClick={() => setAgentMenu(null)}>Save</window.Btn>
              </div>
            </div>
          </div>
        )}
      </window.Sheet>

      {/* install log sheet */}
      <window.Sheet open={!!installing} onClose={() => setInstalling(null)}>
        {installing && <InstallLog agent={installing} accent={accent} onClose={() => setInstalling(null)} onDone={() => setInstalling(null)} />}
      </window.Sheet>
    </div>
  );
}

Object.assign(window, { ServerDetail });
