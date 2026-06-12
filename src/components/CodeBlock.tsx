import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { THEME } from '../theme';

const T = THEME;

const KW = new Set(('const let var function return if else for while export import from default class extends ' +
  'new await async type interface enum public private readonly void null undefined true false this ' +
  'as of in typeof instanceof => map filter range props').split(' '));

type Token = { t: string; v: string };

function tokenize(line: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const push = (t: string, v: string) => out.push({ t, v });
  while (i < line.length) {
    const rest = line.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^\/\/.*$/))) { push('com', m[0]); i += m[0].length; continue; }
    if ((m = rest.match(/^(['"`])(?:\\.|(?!\1).)*\1?/))) { push('str', m[0]); i += m[0].length; continue; }
    if ((m = rest.match(/^<\/?[A-Za-z][\w.]*/))) { push('tag', m[0]); i += m[0].length; continue; }
    if ((m = rest.match(/^\b\d[\w.]*\b/))) { push('num', m[0]); i += m[0].length; continue; }
    if ((m = rest.match(/^[A-Za-z_$][\w$]*/))) {
      const w = m[0];
      const after = line.slice(i + w.length);
      if (KW.has(w)) push('key', w);
      else if (/^\s*\(/.test(after)) push('fn', w);
      else if (/^[A-Z]/.test(w)) push('type', w);
      else push('txt', w);
      i += w.length; continue;
    }
    push('punc', line[i]); i += 1;
  }
  return out;
}

const COLOR: Record<string, string> = {
  com: T.synCom, str: T.synStr, num: T.synNum, key: T.synKey,
  fn: T.synFn, type: T.synType, tag: T.synFn, punc: T.synPunc, txt: T.tx0,
};

export function HighlightedLine({ line, fontSize }: { line: string; fontSize: number }) {
  const tokens = tokenize(line);
  return (
    <Text style={{ fontFamily: T.monoFont, fontSize }}>
      {tokens.map((tok, i) => (
        <Text key={i} style={{ color: COLOR[tok.t] || T.tx0, fontStyle: tok.t === 'com' ? 'italic' : 'normal' }}>
          {tok.v}
        </Text>
      ))}
    </Text>
  );
}

type CodeBlockProps = {
  code: string;
  showLines?: boolean;
  fontSize?: number;
  pad?: number;
  maxHeight?: number;
};

export function CodeBlock({ code, showLines = false, fontSize = 12.5, pad = 12, maxHeight }: CodeBlockProps) {
  const lines = code.split('\n');
  return (
    <View style={{
      backgroundColor: '#0a0b0e',
      borderWidth: 1, borderColor: T.borderSoft, borderRadius: 10,
      overflow: 'hidden',
      ...(maxHeight ? { maxHeight } : {}),
    }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={maxHeight ? { maxHeight } : undefined}>
        <View style={{ padding: pad }}>
          {lines.map((ln, i) => (
            <View key={i} style={{ flexDirection: 'row' }}>
              {showLines && (
                <Text style={{ fontFamily: T.monoFont, fontSize, color: T.tx2, width: 30, textAlign: 'right', paddingRight: 14, lineHeight: fontSize * 1.65 }}>
                  {i + 1}
                </Text>
              )}
              <View>
                <HighlightedLine line={ln || ' '} fontSize={fontSize} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
