// tabs-other.jsx — ProjectTab, GitTab, FilesTab. Exports all three.
const { useState: _o_us } = React;

const GIT_COLOR = (T) => ({ M: T.yellow, A: T.green, U: T.cyan, D: T.red });

// ── flatten tree honoring open state ──────────────────────────
function flatten(nodes, openMap, out = []) {
  nodes.forEach(n => {
    out.push(n);
    if (n.type === 'dir' && (openMap[n.id] ?? n.open) && n.children) flatten(n.children, openMap, out);
  });
  return out;
}

function ProjectTab({ accent, onOpenFile, onMention }) {
  const T = window.THEME;
  const [openMap, setOpenMap] = _o_us({});
  const [q, setQ] = _o_us('');
  const [menu, setMenu] = _o_us(null);
  const rows = flatten(window.DATA.tree, openMap);
  const filtered = q ? rows.filter(r => r.type === 'file' && r.name.toLowerCase().includes(q.toLowerCase())) : rows;
  const gc = GIT_COLOR(T);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg0 }}>
      <div style={{ flexShrink: 0, padding: '10px 12px', background: T.bg1, borderBottom: `1px solid ${T.borderSoft}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 11px', background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10 }}>
          <window.Icon name="search" size={16} color={T.tx2} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search files…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: T.tx0, fontFamily: T.uiFont, fontSize: 13.5 }} />
          {q && <window.Press onClick={() => setQ('')} style={{ color: T.tx2 }}><window.Icon name="x" size={15} /></window.Press>}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0 20px' }}>
        {filtered.map(n => {
          const isOpen = openMap[n.id] ?? n.open;
          return (
            <window.Press key={n.id}
              onClick={() => n.type === 'dir' ? setOpenMap(m => ({ ...m, [n.id]: !isOpen })) : onOpenFile(n)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: 40, padding: '0 12px 0', paddingLeft: 12 + (q ? 0 : n.depth * 16) }}>
              {n.type === 'dir' ? (
                <window.Icon name={isOpen ? 'chevD' : 'chevR'} size={15} color={T.tx2} />
              ) : <span style={{ width: 15 }} />}
              <window.Icon name={n.type === 'dir' ? 'folder' : (n.kind === 'image' ? 'image' : n.kind === 'md' ? 'doc' : n.kind === 'pdf' ? 'pdf' : 'file')}
                size={16} color={n.type === 'dir' ? accent.hue : T.tx2} />
              <span style={{ flex: 1, fontFamily: T.monoFont, fontSize: 13, color: n.type === 'dir' ? T.tx0 : T.tx1, fontWeight: n.type === 'dir' ? 500 : 400,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q ? n.name : n.name}</span>
              {n.git && <span style={{ fontFamily: T.monoFont, fontSize: 11, color: gc[n.git], fontWeight: 600, width: 14, textAlign: 'center' }}>{n.git}</span>}
              {n.type === 'file' && (
                <window.Press onClick={(e) => { e.stopPropagation(); setMenu(n); }} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.tx2 }}>
                  <window.Icon name="more" size={17} />
                </window.Press>
              )}
            </window.Press>
          );
        })}
      </div>

      <window.Sheet open={!!menu} onClose={() => setMenu(null)}>
        {menu && (
          <div style={{ padding: '4px 12px 12px' }}>
            <div style={{ fontFamily: T.monoFont, fontSize: 12.5, color: T.tx1, padding: '8px 8px 12px' }}>{menu.name}</div>
            {[['file', 'Open in Files', () => { onOpenFile(menu); setMenu(null); }],
              ['copy', 'Copy path', () => setMenu(null)],
              ['at', 'Mention in chat', () => { onMention && onMention(menu); setMenu(null); }],
              ['git', 'View in Git', () => setMenu(null)]].map(([ic, l, fn]) => (
              <window.Press key={l} onClick={fn} style={{ display: 'flex', alignItems: 'center', gap: 13, height: 50, padding: '0 8px', color: T.tx0, fontFamily: T.uiFont, fontSize: 15 }}>
                <window.Icon name={ic} size={20} color={T.tx1} /> {l}
              </window.Press>
            ))}
          </div>
        )}
      </window.Sheet>
    </div>
  );
}

// ── Git tab ───────────────────────────────────────────────────
function ChangeRow({ f, accent, staged, onToggle, onDiff }) {
  const T = window.THEME; const gc = GIT_COLOR(T);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minHeight: 44, padding: '0 4px 0 12px' }}>
      <window.Press onClick={() => onToggle(f)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        border: `1.5px solid ${staged ? accent.hue : T.border}`, background: staged ? accent.hue : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {staged && <window.Icon name="check" size={14} color={accent.on} strokeWidth={2.4} />}
      </window.Press>
      <window.Press onClick={() => onDiff(f)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: T.monoFont, fontSize: 12, color: gc[f.code], fontWeight: 600, width: 12, flexShrink: 0 }}>{f.code}</span>
        <span style={{ flex: 1, fontFamily: T.monoFont, fontSize: 12.5, color: T.tx0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl', textAlign: 'left' }}>{f.path}</span>
        {(f.add > 0 || f.del > 0) && (
          <span style={{ fontFamily: T.monoFont, fontSize: 11, flexShrink: 0, whiteSpace: 'nowrap' }}>
            <span style={{ color: T.green }}>+{f.add}</span> <span style={{ color: T.red }}>-{f.del}</span>
          </span>
        )}
      </window.Press>
    </div>
  );
}

function DiffSheet({ accent, onClose }) {
  const T = window.THEME; const d = window.DATA.diff;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 6px 12px 14px', flexShrink: 0 }}>
        <window.Icon name="file" size={16} color={accent.hue} />
        <span style={{ flex: 1, fontFamily: T.monoFont, fontSize: 12.5, color: T.tx0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.path}</span>
        <span style={{ fontFamily: T.monoFont, fontSize: 11 }}><span style={{ color: T.green }}>+14</span> <span style={{ color: T.red }}>-6</span></span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', margin: '0 12px', background: '#0a0b0e', border: `1px solid ${T.borderSoft}`, borderRadius: 11, WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: 'max-content' }}>
          {d.hunks.map((h, hi) => (
            <div key={hi}>
              <div style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.purple, background: T.bg2, padding: '7px 12px', position: 'sticky', top: 0, whiteSpace: 'pre' }}>{h.header}</div>
              {h.lines.map((ln, i) => {
                const bg = ln.t === '+' ? 'rgba(108,208,147,0.10)' : ln.t === '-' ? 'rgba(229,115,127,0.10)' : 'transparent';
                const mark = ln.t === '+' ? T.green : ln.t === '-' ? T.red : T.tx2;
                return (
                  <div key={i} style={{ display: 'flex', background: bg, whiteSpace: 'pre', fontFamily: T.monoFont, fontSize: 12, lineHeight: 1.65 }}>
                    <span style={{ width: 30, textAlign: 'right', paddingRight: 8, color: T.tx2, userSelect: 'none', flexShrink: 0, position: 'sticky', left: 0, background: ln.t === ' ' ? '#0a0b0e' : (ln.t === '+' ? '#0c130f' : '#130c0e') }}>{ln.n1 ?? ''}</span>
                    <span style={{ width: 16, textAlign: 'center', color: mark, flexShrink: 0 }}>{ln.t === ' ' ? '' : ln.t}</span>
                    <code style={{ color: ln.t === ' ' ? T.tx1 : T.tx0, paddingRight: 18 }}>{window.highlightLine(ln.s, T)}</code>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, padding: 14, flexShrink: 0 }}>
        <window.Btn kind="danger" onClick={onClose}>Discard</window.Btn>
        <window.Btn full accent={accent} icon="plus" onClick={onClose}>Stage file</window.Btn>
      </div>
    </div>
  );
}

function GitTab({ accent }) {
  const T = window.THEME;
  const g = window.DATA.git;
  const [staged, setStaged] = _o_us(() => new Set(g.staged.map(f => f.path)));
  const [diff, setDiff] = _o_us(false);
  const [commit, setCommit] = _o_us('');

  const all = [...g.staged, ...g.unstaged, ...g.untracked];
  const stagedFiles = all.filter(f => staged.has(f.path));
  const unstagedFiles = g.unstaged.filter(f => !staged.has(f.path));
  const untrackedFiles = g.untracked.filter(f => !staged.has(f.path));
  const toggle = (f) => setStaged(s => { const n = new Set(s); n.has(f.path) ? n.delete(f.path) : n.add(f.path); return n; });

  const Group = ({ label, files, count, badge }) => files.length === 0 ? null : (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 12px 6px' }}>
        <span style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontFamily: T.monoFont, fontSize: 11, color: badge, background: T.bg2, padding: '1px 7px', borderRadius: 20, border: `1px solid ${T.border}` }}>{files.length}</span>
      </div>
      {files.map(f => <ChangeRow key={f.path} f={f} accent={accent} staged={staged.has(f.path)} onToggle={toggle} onDiff={() => setDiff(true)} />)}
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg0 }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4, paddingBottom: 8 }}>
        <Group label="Staged" files={stagedFiles} badge={accent.hue} />
        <Group label="Unstaged" files={unstagedFiles} badge={T.yellow} />
        <Group label="Untracked" files={untrackedFiles} badge={T.cyan} />
      </div>

      <div style={{ flexShrink: 0, borderTop: `1px solid ${T.borderSoft}`, background: T.bg1, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '4px 4px 4px 12px' }}>
          <input value={commit} onChange={e => setCommit(e.target.value)} placeholder={`Commit ${stagedFiles.length} file${stagedFiles.length === 1 ? '' : 's'}…`}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: T.tx0, fontFamily: T.uiFont, fontSize: 14, padding: '9px 0' }} />
          <window.Press onClick={() => setCommit('')} disabled={!commit.trim() || stagedFiles.length === 0}
            style={{ height: 38, padding: '0 16px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 6,
              background: commit.trim() && stagedFiles.length ? accent.hue : T.bg3, color: commit.trim() && stagedFiles.length ? accent.on : T.tx2,
              fontFamily: T.uiFont, fontSize: 13.5, fontWeight: 600 }}>
            <window.Icon name="check" size={16} /> Commit
          </window.Press>
        </div>
      </div>

      <window.Sheet open={diff} onClose={() => setDiff(false)} height="82%" pad={false}>
        <DiffSheet accent={accent} onClose={() => setDiff(false)} />
      </window.Sheet>
    </div>
  );
}

// ── Files tab ─────────────────────────────────────────────────
function StripePlaceholder({ label, h = 220 }) {
  const T = window.THEME;
  return (
    <div style={{ height: h, borderRadius: 12, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `repeating-linear-gradient(135deg, ${T.bg2}, ${T.bg2} 11px, ${T.bg1} 11px, ${T.bg1} 22px)` }}>
      <span style={{ fontFamily: T.monoFont, fontSize: 12, color: T.tx2, background: T.bg0, padding: '4px 10px', borderRadius: 6, border: `1px solid ${T.border}` }}>{label}</span>
    </div>
  );
}

function FilePreview({ accent, file, onBack }) {
  const T = window.THEME;
  const [rawMd, setRawMd] = _o_us(false);
  if (!file) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg0 }}>
        <div style={{ flexShrink: 0, height: 46, display: 'flex', alignItems: 'center', padding: '0 14px', background: T.bg1, borderBottom: `1px solid ${T.borderSoft}` }}>
          <span style={{ fontFamily: T.uiFont, fontSize: 15, fontWeight: 600, color: T.tx0 }}>Files</span>
        </div>
        <window.EmptyHint icon="doc" title="No file open" sub="Browse the Project tree or @-mention a file in chat to preview it here." />
      </div>
    );
  }
  const f = file;
  const kind = f.kind || (f.name.endsWith('.md') ? 'md' : f.name.match(/\.(png|jpg|gif|svg|webp)$/) ? 'image' : f.name.endsWith('.pdf') ? 'pdf' : 'code');
  const crumbs = ['mobile-acp', ...(f.name === 'README.md' ? [] : f.name.includes('/') ? f.name.split('/').slice(0, -1) : (f.depth ? ['src', 'git'] : []))];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg0 }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '8px 10px 8px 6px', background: T.bg1, borderBottom: `1px solid ${T.borderSoft}` }}>
        {onBack && (
          <window.Press onClick={onBack} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.tx1, borderRadius: 10, flexShrink: 0 }}>
            <window.Icon name="back" size={20} />
          </window.Press>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', paddingLeft: onBack ? 0 : 8 }}>
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              <span style={{ fontFamily: T.monoFont, fontSize: 12, color: T.tx2, whiteSpace: 'nowrap' }}>{c}</span>
              <window.Icon name="chevR" size={13} color={T.tx2} />
            </React.Fragment>
          ))}
          <span style={{ fontFamily: T.monoFont, fontSize: 12.5, color: T.tx0, fontWeight: 600, whiteSpace: 'nowrap' }}>{f.name.split('/').pop()}</span>
        </div>
        {kind === 'md' && (
          <window.Press onClick={() => setRawMd(r => !r)} style={{ flexShrink: 0, fontFamily: T.uiFont, fontSize: 11.5, color: accent.hue, fontWeight: 600, padding: '6px 8px' }}>
            {rawMd ? 'Preview' : 'Raw'}
          </window.Press>
        )}
        {kind === 'code' && (
          <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, fontFamily: T.uiFont, fontSize: 11, color: T.tx2, paddingRight: 8 }}>
            <window.Icon name="lock" size={13} /> Read-only
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        {kind === 'code' && <window.CodeBlock code={f.name === 'package.json' ? window.DATA.pkgJson : window.DATA.messages[2].output} showLines fontSize={12.5} />}
        {kind === 'md' && (rawMd
          ? <window.CodeBlock code={window.DATA.readme} fontSize={12.5} />
          : <MarkdownView text={window.DATA.readme} accent={accent} />)}
        {kind === 'image' && (<>
          <StripePlaceholder label={`${f.name.split('/').pop()} · drop image`} h={240} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 14, fontFamily: T.uiFont, fontSize: 12, color: T.tx2 }}>
            <span>1024 × 768</span><span style={{ color: T.border }}>·</span><span>PNG · 84 KB</span><span style={{ color: T.border }}>·</span><span>pinch to zoom</span>
          </div>
        </>)}
        {kind === 'pdf' && (<>
          <StripePlaceholder label="PROTOCOL.pdf · page 1 / 12" h={300} />
          <div style={{ textAlign: 'center', marginTop: 12, fontFamily: T.uiFont, fontSize: 12, color: T.tx2 }}>System PDF renderer · swipe to page</div>
        </>)}
        {kind === 'bin' && (
          <window.EmptyHint icon="file" title="Can't preview this file" sub={`Binary file · ${f.name.split('/').pop()} · 2.4 MB`} />
        )}
      </div>
    </div>
  );
}

function MarkdownView({ text, accent }) {
  const T = window.THEME;
  const blocks = text.split('\n');
  const out = []; let i = 0;
  while (i < blocks.length) {
    const ln = blocks[i];
    if (ln.startsWith('# ')) out.push(<div key={i} style={{ fontFamily: T.uiFont, fontSize: 22, fontWeight: 700, color: T.tx0, margin: '4px 0 10px', letterSpacing: '-0.02em' }}>{inlineMd(ln.slice(2), T)}</div>);
    else if (ln.startsWith('## ')) out.push(<div key={i} style={{ fontFamily: T.uiFont, fontSize: 15, fontWeight: 600, color: T.tx0, margin: '18px 0 8px' }}>{inlineMd(ln.slice(3), T)}</div>);
    else if (ln.startsWith('- ')) out.push(<div key={i} style={{ display: 'flex', gap: 9, fontFamily: T.uiFont, fontSize: 13.5, color: T.tx1, lineHeight: 1.7, paddingLeft: 4 }}><span style={{ color: accent.hue }}>•</span>{inlineMd(ln.slice(2), T)}</div>);
    else if (/^\d\. /.test(ln)) out.push(<div key={i} style={{ display: 'flex', gap: 9, fontFamily: T.uiFont, fontSize: 13.5, color: T.tx1, lineHeight: 1.7, paddingLeft: 4 }}><span style={{ color: accent.hue, fontFamily: T.monoFont }}>{ln.slice(0, 2)}</span>{inlineMd(ln.slice(3), T)}</div>);
    else if (ln.trim() === '') out.push(<div key={i} style={{ height: 8 }} />);
    else out.push(<div key={i} style={{ fontFamily: T.uiFont, fontSize: 13.5, color: T.tx1, lineHeight: 1.7 }}>{inlineMd(ln, T)}</div>);
    i++;
  }
  return <div>{out}</div>;
}
function inlineMd(s, T) {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith('**')) return <strong key={i} style={{ color: T.tx0, fontWeight: 650 }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`')) return <code key={i} style={{ fontFamily: T.monoFont, fontSize: '0.86em', background: T.bg3, color: T.cyan, padding: '1px 5px', borderRadius: 5 }}>{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

Object.assign(window, { ProjectTab, GitTab, FilePreview });
