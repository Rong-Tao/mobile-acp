// tabs-agent.jsx — Agent chat tab. Exports: AgentTab
const { useState: _a_us, useEffect: _a_ue, useRef: _a_ur } = React;

// minimal inline markdown: **bold**, `code`
function md(text, T) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**')) return <strong key={i} style={{ fontWeight: 650, color: T.tx0 }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`')) return <code key={i} style={{ fontFamily: T.monoFont, fontSize: '0.88em', background: T.bg3, color: T.cyan, padding: '1px 5px', borderRadius: 5 }}>{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

const TOOL_ICON = { read: 'file', grep: 'search', write: 'edit', execute: 'terminal' };

// ACP composer config options
const CFG = {
  perm: { icon: 'shield', label: 'Permissions', base: 'ask', opts: [
    { v: 'ask', l: 'Ask every time', d: 'Confirm before edits & commands', chip: 'Ask' },
    { v: 'edits', l: 'Accept edits', d: 'Auto-approve writes, ask for commands', chip: 'Accept edits' },
    { v: 'bypass', l: 'Bypass permissions', d: 'Run everything without asking', chip: 'Bypass' },
    { v: 'plan', l: 'Plan mode', d: 'Read-only — propose, don\u2019t apply', chip: 'Plan' } ] },
  model: { icon: 'chip', label: 'Model', base: 'default', opts: [
    { v: 'default', l: 'Default', d: 'Recommended for this agent', chip: 'Default' },
    { v: 'sonnet', l: 'Claude Sonnet 4.5', d: 'Balanced speed & capability', chip: 'Sonnet 4.5' },
    { v: 'opus', l: 'Claude Opus 4.1', d: 'Most capable, slower', chip: 'Opus 4.1' },
    { v: 'haiku', l: 'Claude Haiku 4', d: 'Fastest, lightweight', chip: 'Haiku 4' } ] },
  effort: { icon: 'spark', label: 'Thinking effort', base: 'medium', opts: [
    { v: 'off', l: 'Off', d: 'No extended thinking', chip: 'No thinking' },
    { v: 'low', l: 'Low', d: 'Brief reasoning', chip: 'Low' },
    { v: 'medium', l: 'Medium', d: 'Balanced reasoning', chip: 'Medium' },
    { v: 'high', l: 'High', d: 'Deep reasoning, slower', chip: 'High' } ] },
};
const cfgChip = (k, v) => CFG[k].opts.find(o => o.v === v).chip;

function ToolCard({ m, accent, compact }) {
  const T = window.THEME;
  const [open, setOpen] = _a_us(false);
  const tint = m.tool === 'write' ? T.green : accent.hue;
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
      <window.Press onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: compact ? '9px 11px' : '11px 12px' }}>
        <div style={{ width: compact ? 26 : 30, height: compact ? 26 : 30, borderRadius: 8, background: T.bg3,
          border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tint, flexShrink: 0 }}>
          <window.Icon name={TOOL_ICON[m.tool]} size={compact ? 15 : 17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontFamily: T.uiFont, fontSize: 12.5, fontWeight: 600, color: T.tx1 }}>{m.title}</span>
            {m.diffAdd != null && <span style={{ fontFamily: T.monoFont, fontSize: 10.5, color: T.green }}>+{m.diffAdd}</span>}
          </div>
          <div style={{ fontFamily: T.monoFont, fontSize: 12, color: T.tx0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.target}</div>
        </div>
        <span style={{ fontFamily: T.monoFont, fontSize: 10.5, color: T.tx2, flexShrink: 0, whiteSpace: 'nowrap' }}>{m.meta}</span>
        <window.Icon name={open ? 'chevU' : 'chevD'} size={16} color={T.tx2} />
      </window.Press>
      {open && (
        <div style={{ borderTop: `1px solid ${T.borderSoft}`, padding: 10 }}>
          <window.CodeBlock code={m.output} fontSize={11.5} pad={11} maxHeight={220} showLines={window._acpLines} />
        </div>
      )}
    </div>
  );
}

function PermissionCard({ m, accent, onResolve, resolved }) {
  const T = window.THEME;
  if (resolved) {
    const ok = resolved === 'approve' || resolved === 'always';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: T.bg2, flexShrink: 0,
        border: `1px solid ${T.border}`, borderRadius: 10, fontFamily: T.uiFont, fontSize: 12.5, color: ok ? T.green : T.red }}>
        <window.Icon name={ok ? 'check' : 'x'} size={15} />
        {resolved === 'always' ? 'Always allowed' : ok ? 'Approved' : 'Denied'} · <code style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2 }}>{m.cmd}</code>
      </div>
    );
  }
  return (
    <div style={{ background: T.bg2, border: `1px solid ${accent.hue}66`, borderRadius: 13, overflow: 'hidden', flexShrink: 0,
      boxShadow: `0 0 0 3px ${accent.dim}, 0 8px 24px rgba(0,0,0,0.35)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 13px 10px' }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: accent.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent.hue }}>
          <window.Icon name="warn" size={17} />
        </div>
        <div>
          <div style={{ fontFamily: T.uiFont, fontSize: 13.5, fontWeight: 600, color: T.tx0 }}>Permission required</div>
          <div style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2 }}>{m.title}</div>
        </div>
      </div>
      <div style={{ padding: '0 13px 12px' }}>
        <div style={{ fontFamily: T.monoFont, fontSize: 12, color: T.cyan, background: '#0a0b0e', border: `1px solid ${T.borderSoft}`,
          borderRadius: 9, padding: '9px 11px', overflowX: 'auto', whiteSpace: 'nowrap' }}>{m.cmd}</div>
        <div style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2, marginTop: 8, lineHeight: 1.5 }}>{m.note}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 13px 13px' }}>
        <window.Btn kind="danger" size="sm" onClick={() => onResolve('deny')}>Deny</window.Btn>
        <window.Btn kind="fill" size="sm" onClick={() => onResolve('always')} style={{ flex: 1 }}>Always</window.Btn>
        <window.Btn accent={accent} size="sm" icon="check" onClick={() => onResolve('approve')} style={{ flex: 1 }}>Approve</window.Btn>
      </div>
    </div>
  );
}

function Bubble({ m, accent, fs }) {
  const T = window.THEME;
  m = { ...m, fs };
  if (m.role === 'user') {
    return (
      <div style={{ alignSelf: 'flex-end', maxWidth: '86%', flexShrink: 0, background: accent.dim, border: `1px solid ${accent.hue}44`,
        borderRadius: '14px 14px 4px 14px', padding: '10px 13px', fontFamily: T.uiFont, fontSize: m.fs || 14, lineHeight: 1.55, color: T.tx0 }}>
        {md(m.text, T)}
      </div>
    );
  }
  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '100%', flexShrink: 0, fontFamily: T.uiFont, fontSize: m.fs || 14, lineHeight: 1.6, color: T.tx0 }}>
      {md(m.text, T)}
    </div>
  );
}

function AgentTab({ accent, tweaks, activeThread, agentId }) {
  const T = window.THEME;
  const compact = tweaks.toolCard === 'compact';
  const permSheet = tweaks.permission === 'sheet';
  const dens = tweaks.density === 'comfortable' ? 1.14 : tweaks.density === 'dense' ? 0.86 : 1;
  const chatFS = 13.6 + (dens - 1) * 8;
  const AG = window.DATA.agentKinds;
  const curAgent = AG[agentId] || AG.claude;
  const msgsFor = (id) => {
    if (id === 'new') return [];
    if (id === 't1') return window.DATA.messages;
    const t = window.DATA.threads.find(x => x.id === id);
    return window.DATA.threadStub(t ? t.title : 'this thread');
  };
  const [msgs, setMsgs] = _a_us(() => msgsFor(activeThread));
  const [perm, setPerm] = _a_us(activeThread === 't1' ? null : 'noop'); // resolution
  const [input, setInput] = _a_us('');
  const [thinking, setThinking] = _a_us(false);
  const [showMention, setShowMention] = _a_us(false);
  const [cfg, setCfg] = _a_us({ perm: 'ask', model: 'default', effort: 'medium' });
  const [picker, setPicker] = _a_us(null); // 'perm' | 'model' | 'effort'
  const [plusMenu, setPlusMenu] = _a_us(false);
  const [expanded, setExpanded] = _a_us(false);
  const scrollRef = _a_ur(null);

  // load the right conversation when the active thread changes (header lives in the shell)
  _a_ue(() => {
    setMsgs(msgsFor(activeThread));
    setPerm(activeThread === 't1' ? null : 'noop');
    setInput(''); setThinking(false); setShowMention(false);
  }, [activeThread]);

  const toBottom = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; };
  _a_ue(() => { toBottom(); }, [msgs, thinking, perm]);

  const resolve = (r) => {
    setPerm(r);
    if (r === 'approve' || r === 'always') {
      setTimeout(() => {
        setMsgs(m => [...m,
          { id: 'mx1', role: 'tool', tool: 'execute', title: 'Run command', target: 'npm run db:migrate', status: 'done', meta: 'exit 0',
            output: '> drizzle-kit migrate\n\nApplying 0007_stage_hunks.sql …\n✓ migration applied (12ms)' },
          { id: 'mx2', role: 'assistant', text: 'Migration applied. The gutter now renders and each hunk has working **Stage** / **Unstage** buttons. Want me to run the test suite?' },
        ]);
      }, 700);
    } else {
      setTimeout(() => setMsgs(m => [...m, { id: 'mx0', role: 'assistant', text: 'Understood — I won\u2019t run it. You can apply the migration manually when ready.' }]), 500);
    }
  };

  const send = () => {
    const text = input.trim(); if (!text) return;
    setMsgs(m => [...m, { id: 'u' + Date.now(), role: 'user', text }]);
    setInput(''); setShowMention(false); setThinking(true);
    setTimeout(() => {
      setThinking(false);
      setMsgs(m => [...m,
        { id: 'r' + Date.now(), role: 'tool', tool: 'read', title: 'Read file', target: 'src/git/GitPanel.tsx', status: 'done', meta: '88 lines',
          output: 'export function GitPanel() {\n  const { staged, unstaged } = useGitStatus();\n  return <ChangesList … />;\n}' },
        { id: 'a' + Date.now(), role: 'assistant', text: 'Here\u2019s what I found in `GitPanel.tsx`. I can wire that up next — let me know how you\u2019d like to proceed.' },
      ]);
    }, 1500);
  };

  const onInput = (v) => { setInput(v); setShowMention(/@\w*$/.test(v)); };
  const pickMention = (path) => { setInput(i => i.replace(/@\w*$/, '@' + path + ' ')); setShowMention(false); };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg0 }}>
      {/* message flow */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 18px', display: 'flex', flexDirection: 'column', gap: 13 * dens }}>
        {msgs.length === 0 && !thinking && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: '30px 24px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: curAgent.tint + '22', border: `1px solid ${curAgent.tint}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: curAgent.tint }}>
              <window.Icon name={curAgent.icon} size={26} />
            </div>
            <div>
              <div style={{ fontFamily: T.uiFont, fontSize: 16, fontWeight: 600, color: T.tx0 }}>New thread · {curAgent.name}</div>
              <div style={{ fontFamily: T.uiFont, fontSize: 13, color: T.tx2, marginTop: 5, lineHeight: 1.5, maxWidth: 250 }}>
                Ask <span style={{ color: T.tx1 }}>{curAgent.name}</span> anything about <span style={{ color: T.tx1 }}>mobile-acp</span>, or <span style={{ color: accent.hue }}>@</span> a file to add context.
              </div>
            </div>
          </div>
        )}
        {msgs.map(m => {
          if (m.role === 'tool') return <ToolCard key={m.id} m={m} accent={accent} compact={compact} />;
          if (m.role === 'permission') {
            if (permSheet && !perm) return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', flexShrink: 0, background: T.bg2, border: `1px dashed ${accent.hue}66`, borderRadius: 10, fontFamily: T.uiFont, fontSize: 12.5, color: accent.hue }}>
                <window.Spinner size={13} color={accent.hue} /> Waiting for your approval…
              </div>
            );
            return <PermissionCard key={m.id} m={m} accent={accent} onResolve={resolve} resolved={perm} />;
          }
          return <Bubble key={m.id} m={m} accent={accent} fs={chatFS} />;
        })}
        {thinking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.tx2, fontFamily: T.uiFont, fontSize: 13, flexShrink: 0 }}>
            <window.Spinner size={14} color={accent.hue} /> Thinking…
          </div>
        )}
      </div>

      {/* composer */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${T.borderSoft}`, background: T.bg1, padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', position: 'relative' }}>
        {showMention && (
          <div style={{ position: 'absolute', bottom: '100%', left: 12, right: 12, marginBottom: 8, background: T.bg2,
            border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            <div style={{ fontFamily: T.uiFont, fontSize: 11, color: T.tx2, padding: '8px 12px 4px', fontWeight: 600 }}>Mention a file</div>
            {['src/git/DiffView.tsx', 'src/git/GitPanel.tsx', 'src/ssh/reconnect.ts'].map(p => (
              <window.Press key={p} onClick={() => pickMention(p)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', fontFamily: T.monoFont, fontSize: 12.5, color: T.tx0 }}>
                <window.Icon name="file" size={15} color={accent.hue} /> {p}
              </window.Press>
            ))}
          </div>
        )}

        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, padding: '4px 4px 6px' }}>
          {/* text row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 6px 0 10px' }}>
            <textarea value={input} onChange={e => onInput(e.target.value)} rows={expanded ? 5 : 1} placeholder="Message agent…  @ for context, / for commands"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              style={{ flex: 1, resize: 'none', background: 'transparent', border: 'none', outline: 'none', color: T.tx0,
                fontFamily: T.uiFont, fontSize: 14.5, lineHeight: 1.5, maxHeight: expanded ? 200 : 100, padding: '5px 0' }} />
            <window.Press onClick={() => setExpanded(e => !e)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.tx2, borderRadius: 8, flexShrink: 0, marginTop: 1 }}>
              <window.Icon name={expanded ? 'chevD' : 'expand'} size={16} />
            </window.Press>
          </div>

          {/* control bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 4px 0', marginTop: 4 }}>
            <window.Press onClick={() => setPlusMenu(true)} style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.tx1, borderRadius: 10, background: T.bg3, border: `1px solid ${T.border}`, flexShrink: 0 }}>
              <window.Icon name="plus" size={19} />
            </window.Press>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', padding: '1px 0' }}>
              {['perm', 'model', 'effort'].map(k => {
                const def = CFG[k].base, val = cfg[k];
                const caution = k === 'perm' && val === 'bypass';
                const setv = val !== def;
                const tint = caution ? T.yellow : setv ? accent.hue : T.tx1;
                return (
                  <window.Press key={k} onClick={() => setPicker(k)} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30, padding: '0 9px', borderRadius: 9, flexShrink: 0,
                    background: caution ? 'rgba(217,176,106,0.12)' : setv ? accent.dim : T.bg3,
                    border: `1px solid ${caution ? T.yellow + '55' : setv ? accent.hue + '40' : T.border}` }}>
                    <window.Icon name={CFG[k].icon} size={13} color={tint} />
                    <span style={{ fontFamily: T.uiFont, fontSize: 12, fontWeight: 600, color: setv || caution ? tint : T.tx1, whiteSpace: 'nowrap' }}>{cfgChip(k, val)}</span>
                    <window.Icon name="chevD" size={12} color={T.tx2} />
                  </window.Press>
                );
              })}
            </div>

            <window.Press onClick={send} disabled={!input.trim()} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 11, flexShrink: 0,
              background: input.trim() ? accent.hue : T.bg3, color: input.trim() ? accent.on : T.tx2, transition: 'background .15s' }}>
              <window.Icon name="send" size={18} />
            </window.Press>
          </div>
        </div>
      </div>

      {/* + context menu */}
      <window.Sheet open={plusMenu} onClose={() => setPlusMenu(false)}>
        <div style={{ padding: '4px 12px 12px' }}>
          <div style={{ fontFamily: T.uiFont, fontSize: 15, fontWeight: 600, color: T.tx0, padding: '6px 6px 10px' }}>Add to message</div>
          {[['at', 'Mention a file', 'Reference a file in this project', () => { onInput(input + '@'); }],
            ['image2', 'Attach image', 'Screenshot or photo from device', () => {}],
            ['slash', 'Slash command', 'Run an agent command', () => { onInput(input + '/'); }],
            ['folder', 'Add directory context', 'Include a folder in the prompt', () => {}]].map(([ic, l, d, fn]) => (
            <window.Press key={l} onClick={() => { fn(); setPlusMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 6px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: T.bg3, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent.hue, flexShrink: 0 }}>
                <window.Icon name={ic} size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.uiFont, fontSize: 14.5, fontWeight: 500, color: T.tx0 }}>{l}</div>
                <div style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2 }}>{d}</div>
              </div>
            </window.Press>
          ))}
        </div>
      </window.Sheet>

      {/* config picker */}
      <window.Sheet open={!!picker} onClose={() => setPicker(null)}>
        {picker && (
          <div style={{ padding: '4px 12px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 6px 12px' }}>
              <window.Icon name={CFG[picker].icon} size={19} color={accent.hue} />
              <div style={{ fontFamily: T.uiFont, fontSize: 15, fontWeight: 600, color: T.tx0 }}>{CFG[picker].label}</div>
            </div>
            {CFG[picker].opts.map(o => {
              const on = cfg[picker] === o.v;
              const caution = picker === 'perm' && o.v === 'bypass';
              return (
                <window.Press key={o.v} onClick={() => { setCfg(c => ({ ...c, [picker]: o.v })); setPicker(null); }} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px', borderRadius: 12, marginBottom: 2,
                  background: on ? accent.dim : 'transparent', border: `1px solid ${on ? accent.hue + '44' : 'transparent'}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: T.uiFont, fontSize: 14.5, fontWeight: 600, color: caution ? T.yellow : T.tx0 }}>{o.l}</span>
                      {caution && <window.Icon name="warn" size={14} color={T.yellow} />}
                    </div>
                    <div style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2, marginTop: 2 }}>{o.d}</div>
                  </div>
                  {on && <window.Icon name="check" size={19} color={accent.hue} />}
                </window.Press>
              );
            })}
          </div>
        )}
      </window.Sheet>

      <window.Sheet open={permSheet && !!msgs.find(m => m.role === 'permission') && !perm} onClose={() => {}}>
        <div style={{ padding: '0 14px 16px' }}>
          <PermissionCard m={window.DATA.messages.find(m => m.role === 'permission')} accent={accent} onResolve={resolve} resolved={perm} />
        </div>
      </window.Sheet>
    </div>
  );
}

Object.assign(window, { AgentTab });
