// ui.jsx — shared chrome primitives. Exports: TopBar, Btn, Field, Seg, EmptyHint, Press
const { useState: _us } = React;

function Press({ children, onClick, style, active, disabled }) {
  const [d, setD] = _us(false);
  return (
    <div
      onPointerDown={() => !disabled && setD(true)}
      onPointerUp={() => setD(false)}
      onPointerLeave={() => setD(false)}
      onClick={disabled ? undefined : onClick}
      style={{
        cursor: disabled ? 'default' : 'pointer', transition: 'transform .08s, background .12s, opacity .12s',
        transform: d ? 'scale(0.985)' : 'none', opacity: disabled ? 0.45 : 1,
        WebkitTapHighlightColor: 'transparent', ...style,
      }}>
      {children}
    </div>
  );
}

function TopBar({ title, sub, onBack, right, accent }) {
  const T = window.THEME;
  return (
    <div style={{
      flexShrink: 0, height: 52, display: 'flex', alignItems: 'center', gap: 4,
      padding: '0 6px 0 4px', background: T.bg1, borderBottom: `1px solid ${T.borderSoft}`,
    }}>
      {onBack && (
        <Press onClick={onBack} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, color: T.tx1 }}>
          <window.Icon name="back" size={22} />
        </Press>
      )}
      <div style={{ flex: 1, minWidth: 0, paddingLeft: onBack ? 0 : 10 }}>
        <div style={{ fontFamily: T.uiFont, fontSize: 16, fontWeight: 600, color: T.tx0, letterSpacing: '-0.01em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {sub && <div style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2, marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function Btn({ children, onClick, kind = 'primary', size = 'md', icon, accent, full, disabled, style }) {
  const T = window.THEME;
  const a = accent || window.accentFor('blue');
  const h = size === 'sm' ? 36 : size === 'lg' ? 50 : 44;
  const styles = {
    primary: { background: a.hue, color: a.on, border: '1px solid transparent', fontWeight: 600 },
    soft: { background: a.dim, color: a.hue, border: `1px solid ${a.hue}33`, fontWeight: 600 },
    ghost: { background: 'transparent', color: T.tx1, border: `1px solid ${T.border}`, fontWeight: 500 },
    danger: { background: 'transparent', color: T.red, border: `1px solid ${T.red}44`, fontWeight: 500 },
    fill: { background: T.bg3, color: T.tx0, border: `1px solid ${T.border}`, fontWeight: 500 },
  }[kind];
  return (
    <Press onClick={onClick} disabled={disabled} style={{
      height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      padding: '0 16px', borderRadius: 12, fontFamily: T.uiFont, fontSize: size === 'sm' ? 13 : 14.5,
      width: full ? '100%' : 'auto', ...styles, ...style,
    }}>
      {icon && <window.Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </Press>
  );
}

function Field({ label, value, onChange, placeholder, mono, hint, type, right, readOnly, onFocus }) {
  const T = window.THEME;
  const [f, setF] = _us(false);
  return (
    <label style={{ display: 'block' }}>
      {label && <div style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx1, marginBottom: 7, fontWeight: 500 }}>{label}</div>}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 46, padding: '0 12px',
        background: T.bg2, border: `1px solid ${f ? (window._acpAccent || '#6aa6ff') : T.border}`,
        borderRadius: 11, transition: 'border-color .15s',
      }}>
        <input value={value} placeholder={placeholder} type={type || 'text'} readOnly={readOnly}
          onChange={e => onChange && onChange(e.target.value)}
          onFocus={() => { setF(true); onFocus && onFocus(); }} onBlur={() => setF(false)}
          style={{
            flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
            color: T.tx0, fontSize: 14.5, fontFamily: mono ? T.monoFont : T.uiFont,
          }} />
        {right}
      </div>
      {hint && <div style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
    </label>
  );
}

function Seg({ options, value, onChange, accent }) {
  const T = window.THEME;
  const a = accent || window.accentFor('blue');
  return (
    <div style={{
      display: 'flex', gap: 3, padding: 3, background: T.bg2,
      border: `1px solid ${T.borderSoft}`, borderRadius: 12,
    }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <Press key={o.value} onClick={() => onChange(o.value)} style={{
            flex: 1, height: 38, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: on ? T.bg4 : 'transparent', color: on ? T.tx0 : T.tx2,
            fontFamily: T.uiFont, fontSize: 13.5, fontWeight: on ? 600 : 500,
            boxShadow: on ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
          }}>
            {o.icon && <window.Icon name={o.icon} size={16} />}
            {o.label}
          </Press>
        );
      })}
    </div>
  );
}

function EmptyHint({ icon, title, sub }) {
  const T = window.THEME;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: '48px 30px', textAlign: 'center', color: T.tx2 }}>
      {icon && <div style={{ width: 52, height: 52, borderRadius: 14, background: T.bg2, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}><window.Icon name={icon} size={24} /></div>}
      <div style={{ fontFamily: T.uiFont, fontSize: 14.5, color: T.tx1, fontWeight: 500 }}>{title}</div>
      {sub && <div style={{ fontFamily: T.uiFont, fontSize: 12.5, color: T.tx2, lineHeight: 1.5, maxWidth: 240 }}>{sub}</div>}
    </div>
  );
}

Object.assign(window, { TopBar, Btn, Field, Seg, EmptyHint, Press });
