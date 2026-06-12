// code.jsx — tiny regex syntax highlighter + CodeBlock. Exports: highlightLine, CodeBlock
const KW = new Set(('const let var function return if else for while export import from default class extends ' +
  'new await async type interface enum public private readonly void null undefined true false this ' +
  'as of in typeof instanceof => map filter range props').split(' '));

function tokenize(line) {
  const out = [];
  let i = 0;
  const push = (t, v) => out.push({ t, v });
  while (i < line.length) {
    const rest = line.slice(i);
    let m;
    // comment
    if ((m = rest.match(/^\/\/.*$/))) { push('com', m[0]); i += m[0].length; continue; }
    // string
    if ((m = rest.match(/^(['"`])(?:\\.|(?!\1).)*\1?/))) { push('str', m[0]); i += m[0].length; continue; }
    // jsx/html tag name
    if ((m = rest.match(/^<\/?[A-Za-z][\w.]*/))) { push('tag', m[0]); i += m[0].length; continue; }
    // number
    if ((m = rest.match(/^\b\d[\w.]*\b/))) { push('num', m[0]); i += m[0].length; continue; }
    // identifier
    if ((m = rest.match(/^[A-Za-z_$][\w$]*/))) {
      const w = m[0];
      const after = line.slice(i + w.length);
      if (KW.has(w)) push('key', w);
      else if (/^\s*\(/.test(after)) push('fn', w);
      else if (/^[A-Z]/.test(w)) push('type', w);
      else push('txt', w);
      i += w.length; continue;
    }
    // punctuation / whitespace
    push('punc', line[i]); i += 1;
  }
  return out;
}

const COLOR = (T) => ({
  com: T.synCom, str: T.synStr, num: T.synNum, key: T.synKey,
  fn: T.synFn, type: T.synType, tag: T.synFn, punc: T.synPunc, txt: T.tx0,
});

function highlightLine(line, T) {
  const c = COLOR(T);
  return tokenize(line).map((tok, i) => (
    <span key={i} style={{ color: c[tok.t] || T.tx0, fontStyle: tok.t === 'com' ? 'italic' : 'normal' }}>{tok.v}</span>
  ));
}

function CodeBlock({ code, showLines = false, fontSize = 12.5, pad = 12, maxHeight }) {
  const T = window.THEME;
  const lines = code.split('\n');
  return (
    <div style={{
      background: '#0a0b0e', border: `1px solid ${T.borderSoft}`, borderRadius: 10,
      overflow: 'hidden', maxHeight, fontFamily: T.monoFont,
    }}>
      <div style={{ overflowX: 'auto', overflowY: maxHeight ? 'auto' : 'visible', maxHeight }}>
        <pre style={{ margin: 0, padding: `${pad}px ${pad + 2}px`, fontSize, lineHeight: 1.65, minWidth: 'max-content' }}>
          {lines.map((ln, i) => (
            <div key={i} style={{ display: 'flex', whiteSpace: 'pre' }}>
              {showLines && (
                <span style={{ color: T.tx2, width: 30, textAlign: 'right', paddingRight: 14,
                  userSelect: 'none', flexShrink: 0 }}>{i + 1}</span>
              )}
              <code>{highlightLine(ln, T) }</code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

Object.assign(window, { highlightLine, CodeBlock });
