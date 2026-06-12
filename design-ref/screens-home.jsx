// screens-home.jsx — ServerList (Home) + AddServer. Exports: ServerList, AddServer
const { useState: _h_us } = React;

function ServerCard({ s, accent, onOpen, onMenu }) {
  const T = window.THEME;
  return (
    <window.Press onClick={() => onOpen(s)} style={{
      background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14,
      padding: '14px 14px 13px', display: 'flex', flexDirection: 'column', gap: 11,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.bg3, border: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.online ? accent.hue : T.tx2 }}>
          <window.Icon name="server" size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontFamily: T.uiFont, fontSize: 15.5, fontWeight: 600, color: T.tx0 }}>{s.name}</span>
            <window.Dot color={s.online ? T.green : T.tx2} glow={s.online} />
          </div>
          <div style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.tx2, marginTop: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {s.user}@{s.host}{s.port !== 22 ? ':' + s.port : ''}
          </div>
        </div>
        <window.Press onClick={(e) => { e.stopPropagation(); onMenu(s); }}
          style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.tx2, borderRadius: 9 }}>
          <window.Icon name="more" size={20} />
        </window.Press>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2 }}>
        <span style={{ color: s.online ? T.green : T.tx2 }}>{s.online ? 'Online' : 'Offline'}</span>
        <span style={{ color: T.border }}>·</span>
        <span>{s.last}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: T.tx2 }}>
          <window.Icon name={s.auth === 'keystore' ? 'lock' : 'key'} size={13} />
          {s.auth === 'keystore' ? 'Keystore' : 'Key file'}
        </span>
      </div>
    </window.Press>
  );
}

function ServerList({ accent, onOpen, onAdd }) {
  const T = window.THEME;
  const [menu, setMenu] = _h_us(null);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg0 }}>
      <div style={{ flexShrink: 0, padding: '14px 16px 12px', background: T.bg1, borderBottom: `1px solid ${T.borderSoft}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: T.monoFont, fontSize: 11, color: accent.hue, letterSpacing: '0.12em', fontWeight: 600 }}>MOBILE·ACP</div>
            <div style={{ fontFamily: T.uiFont, fontSize: 23, fontWeight: 700, color: T.tx0, letterSpacing: '-0.02em', marginTop: 2 }}>Servers</div>
          </div>
          <window.Press onClick={onAdd} style={{ height: 40, display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px 0 11px',
            background: accent.hue, color: accent.on, borderRadius: 11, fontFamily: T.uiFont, fontSize: 14, fontWeight: 600 }}>
            <window.Icon name="plus" size={18} /> Add
          </window.Press>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {window.DATA.servers.length} paired
        </div>
        {window.DATA.servers.map(s => (
          <ServerCard key={s.id} s={s} accent={accent} onOpen={onOpen} onMenu={setMenu} />
        ))}
        <div style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2, textAlign: 'center', marginTop: 8, lineHeight: 1.6 }}>
          Zero server deploy — just <span style={{ color: T.tx1 }}>sshd</span>.
        </div>
      </div>

      <window.Sheet open={!!menu} onClose={() => setMenu(null)}>
        <div style={{ padding: '4px 12px 8px' }}>
          <div style={{ fontFamily: T.uiFont, fontSize: 13, color: T.tx2, padding: '8px 8px 12px' }}>{menu?.name}</div>
          {[['edit', 'Edit server'], ['refresh', 'Test connection'], ['copy', 'Duplicate']].map(([ic, l]) => (
            <window.Press key={l} onClick={() => setMenu(null)} style={{ display: 'flex', alignItems: 'center', gap: 13, height: 50, padding: '0 8px', color: T.tx0, fontFamily: T.uiFont, fontSize: 15 }}>
              <window.Icon name={ic} size={20} color={T.tx1} /> {l}
            </window.Press>
          ))}
          <div style={{ height: 1, background: T.borderSoft, margin: '6px 0' }} />
          <window.Press onClick={() => setMenu(null)} style={{ display: 'flex', alignItems: 'center', gap: 13, height: 50, padding: '0 8px', color: T.red, fontFamily: T.uiFont, fontSize: 15 }}>
            <window.Icon name="trash" size={20} /> Delete server
          </window.Press>
        </div>
      </window.Sheet>
    </div>
  );
}

// ── Add Server ────────────────────────────────────────────────
function QrFrame({ accent }) {
  const T = window.THEME;
  // deterministic pseudo-random QR-ish grid (decorative)
  const cells = [];
  let seed = 7;
  for (let i = 0; i < 441; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; cells.push((seed >> 16) % 100 < 48); }
  const finder = (r, c) => (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7);
  return (
    <div style={{ width: 210, height: 210, background: '#0a0b0e', borderRadius: 14, border: `1px solid ${T.border}`,
      padding: 16, display: 'grid', gridTemplateColumns: 'repeat(21,1fr)', gridTemplateRows: 'repeat(21,1fr)', gap: 0 }}>
      {cells.map((on, i) => {
        const r = Math.floor(i / 21), c = i % 21;
        const isFinder = finder(r, c);
        const lit = isFinder ? ((r % 6 !== 0 && c % 6 !== 0) ? (r > 1 && r < 5 && c > 1 && c < 5 || (r === 0 || r === 6 || c === 0 || c === 6)) : true) : on;
        return <div key={i} style={{ background: lit ? (isFinder ? accent.hue : T.tx0) : 'transparent', borderRadius: 0.5 }} />;
      })}
    </div>
  );
}

function AddServer({ accent, onBack, onPaired }) {
  const T = window.THEME;
  const [mode, setMode] = _h_us('qr');
  const [scanned, setScanned] = _h_us(false);
  const [form, setForm] = _h_us({ name: '', host: '', port: '22', user: '', auth: 'keystore' });
  const [testing, setTesting] = _h_us(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const test = () => { setTesting('run'); setTimeout(() => setTesting('ok'), 1400); };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg0 }}>
      <window.TopBar title="Add server" onBack={onBack} />
      <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
        <window.Seg accent={accent} value={mode} onChange={setMode} options={[
          { value: 'qr', label: 'Scan QR', icon: 'qr' },
          { value: 'manual', label: 'Manual', icon: 'edit' },
        ]} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 28px' }}>
        {mode === 'qr' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontFamily: T.uiFont, fontSize: 13, color: T.tx1, textAlign: 'center', lineHeight: 1.6 }}>
              Run this on your server, then point the camera at the code it prints.
            </div>
            <div style={{ width: '100%', background: '#0a0b0e', border: `1px solid ${T.borderSoft}`, borderRadius: 11, padding: '11px 13px',
              fontFamily: T.monoFont, fontSize: 12, color: T.tx1, overflowX: 'auto', whiteSpace: 'nowrap' }}>
              <span style={{ color: accent.hue }}>$</span> curl -fsSL https://mobile-acp.dev/setup.sh | bash
            </div>
            <div style={{ position: 'relative', marginTop: 4 }}>
              <QrFrame accent={accent} />
              {!scanned && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: 14, background: 'rgba(13,14,18,0.78)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <window.Icon name="qr" size={30} color={accent.hue} />
                  <div style={{ fontFamily: T.uiFont, fontSize: 12.5, color: T.tx1 }}>Camera viewfinder</div>
                  <window.Btn size="sm" accent={accent} onClick={() => setScanned(true)}>Simulate scan</window.Btn>
                </div>
              )}
              {scanned && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: 14, border: `2px solid ${T.green}`,
                  boxShadow: `0 0 0 4px ${T.green}22`, pointerEvents: 'none' }} />
              )}
            </div>
            <div style={{ fontFamily: T.monoFont, fontSize: 11, color: scanned ? T.green : T.tx2, display: 'flex', alignItems: 'center', gap: 6 }}>
              {scanned ? <><window.Icon name="check" size={13} /> Key exchange complete</> : 'Code valid for 4:58'}
            </div>
            {scanned && (
              <div style={{ width: '100%', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: 13, marginTop: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <window.Icon name="server" size={18} color={accent.hue} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: T.uiFont, fontSize: 14.5, fontWeight: 600, color: T.tx0 }}>devbox-2</div>
                    <div style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2 }}>kai@10.0.0.7</div>
                  </div>
                </div>
                <window.Btn full accent={accent} onClick={onPaired} style={{ marginTop: 12 }}>Pair &amp; open</window.Btn>
              </div>
            )}
          </div>
        )}

        {mode === 'manual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            <window.Field label="Name" value={form.name} onChange={v => set('name', v)} placeholder="my-server" />
            <window.Field label="Host" value={form.host} onChange={v => set('host', v)} placeholder="example.com or 10.0.0.5" mono />
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}><window.Field label="Port" value={form.port} onChange={v => set('port', v)} mono /></div>
              <div style={{ flex: 2 }}><window.Field label="Username" value={form.user} onChange={v => set('user', v)} placeholder="root" mono /></div>
            </div>
            <div>
              <div style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx1, marginBottom: 8, fontWeight: 500 }}>Authentication</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[['keystore', 'key', 'Generate key', 'Stored in Android Keystore'],
                  ['key-file', 'download', 'Import private key', 'From a .pem / id_ed25519 file'],
                  ['password', 'lock', 'Password', 'Sent over the encrypted channel']].map(([val, ic, l, d]) => {
                  const on = form.auth === val;
                  return (
                    <window.Press key={val} onClick={() => set('auth', val)} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 11,
                      background: on ? accent.dim : T.bg2, border: `1px solid ${on ? accent.hue + '66' : T.border}` }}>
                      <window.Icon name={ic} size={18} color={on ? accent.hue : T.tx2} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: T.uiFont, fontSize: 14, fontWeight: 500, color: T.tx0 }}>{l}
                          {val === 'keystore' && <span style={{ fontSize: 10.5, color: accent.hue, marginLeft: 7, fontWeight: 600 }}>RECOMMENDED</span>}
                        </div>
                        <div style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2, marginTop: 1 }}>{d}</div>
                      </div>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${on ? accent.hue : T.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {on && <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent.hue }} />}
                      </div>
                    </window.Press>
                  );
                })}
              </div>
            </div>
            <window.Btn kind="ghost" full icon={testing === 'ok' ? 'check' : 'refresh'} onClick={test}
              style={testing === 'ok' ? { color: T.green, borderColor: T.green + '55' } : {}}>
              {testing === 'run' ? <window.Spinner /> : testing === 'ok' ? 'Connection OK · 42ms' : 'Test connection'}
            </window.Btn>
            <window.Btn full accent={accent} disabled={testing !== 'ok'} onClick={onPaired}>Save &amp; open</window.Btn>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ServerList, AddServer });
