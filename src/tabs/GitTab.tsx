import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { THEME, AccentType } from '../theme';
import { DATA, GitFile } from '../data/mock';
import { Icon } from '../components/Icon';
import { Press, Btn, Sheet } from '../components/Primitives';
import { HighlightedLine } from '../components/CodeBlock';

const T = THEME;

const GIT_COLOR: Record<string, string> = { M: T.yellow, A: T.green, U: T.cyan, D: T.red };

// ── Diff Sheet (inside a bottom sheet) ───────────────────────
function DiffContent({ accent, onClose }: { accent: AccentType; onClose: () => void }) {
  const d = DATA.diff;
  const lineColor = (t: string) => t === '+' ? 'rgba(108,208,147,0.10)' : t === '-' ? 'rgba(229,115,127,0.10)' : 'transparent';
  const gutterBg = (t: string) => t === ' ' ? '#0a0b0e' : t === '+' ? '#0c130f' : '#130c0e';
  const mark = (t: string) => t === '+' ? T.green : t === '-' ? T.red : T.tx2;

  return (
    <View style={{ flex: 1, flexDirection: 'column' }}>
      {/* file path */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 2, paddingBottom: 12 }}>
        <Icon name="file" size={16} color={accent.hue} />
        <Text style={{ flex: 1, fontFamily: T.monoFont, fontSize: 12.5, color: T.tx0 }} numberOfLines={1}>{d.path}</Text>
        <Text style={{ fontFamily: T.monoFont, fontSize: 11 }}>
          <Text style={{ color: T.green }}>+14 </Text>
          <Text style={{ color: T.red }}>-6</Text>
        </Text>
      </View>

      {/* diff content */}
      <View style={{ flex: 1, marginHorizontal: 12, backgroundColor: '#0a0b0e', borderWidth: 1, borderColor: T.borderSoft, borderRadius: 11, overflow: 'hidden', maxHeight: 400 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {d.hunks.map((h, hi) => (
                <View key={hi}>
                  {/* hunk header — sticky-like (just styled) */}
                  <View style={{ backgroundColor: T.bg2, paddingHorizontal: 12, paddingVertical: 7 }}>
                    <Text style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.purple }}>{h.header}</Text>
                  </View>
                  {h.lines.map((ln, i) => (
                    <View key={i} style={{ flexDirection: 'row', backgroundColor: lineColor(ln.t) }}>
                      {/* line numbers */}
                      <View style={{ width: 30, paddingRight: 8, alignItems: 'flex-end', backgroundColor: gutterBg(ln.t), justifyContent: 'center', paddingVertical: 1 }}>
                        <Text style={{ fontFamily: T.monoFont, fontSize: 12, color: T.tx2, lineHeight: 19.8 }}>{ln.n1 ?? ''}</Text>
                      </View>
                      {/* diff marker */}
                      <View style={{ width: 16, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: T.monoFont, fontSize: 12, color: mark(ln.t), lineHeight: 19.8 }}>{ln.t !== ' ' ? ln.t : ''}</Text>
                      </View>
                      {/* code — syntax highlighted */}
                      <View style={{ paddingRight: 18 }}>
                        <HighlightedLine line={ln.s || ' '} fontSize={12} />
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      </View>

      {/* actions */}
      <View style={{ flexDirection: 'row', gap: 10, padding: 14 }}>
        <Btn kind="danger" onPress={onClose}>Discard</Btn>
        <Btn full accent={accent} icon="plus" onPress={onClose}>Stage file</Btn>
      </View>
    </View>
  );
}

// ── Change Row ────────────────────────────────────────────────
function ChangeRow({ file, staged, onToggle, onDiff, accent }: {
  file: GitFile; staged: boolean; onToggle: () => void; onDiff: () => void; accent: AccentType;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44, paddingLeft: 12, paddingRight: 4 }}>
      <Press onPress={onToggle} style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        borderWidth: 1.5, borderColor: staged ? accent.hue : T.border,
        backgroundColor: staged ? accent.hue : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {staged && <Icon name="check" size={14} color={accent.on} />}
      </Press>
      <Press onPress={onDiff} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: T.monoFontMedium, fontSize: 12, color: GIT_COLOR[file.code] ?? T.tx2, width: 12, flexShrink: 0 }}>{file.code}</Text>
        <Text style={{ flex: 1, fontFamily: T.monoFont, fontSize: 12.5, color: T.tx0, writingDirection: 'rtl', textAlign: 'left' }} numberOfLines={1}>{file.path}</Text>
        {(file.add > 0 || file.del > 0) && (
          <View style={{ flexDirection: 'row', gap: 4, flexShrink: 0 }}>
            {file.add > 0 && <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.green }}>+{file.add}</Text>}
            {file.del > 0 && <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.red }}>-{file.del}</Text>}
          </View>
        )}
      </Press>
    </View>
  );
}

// ── Section Group ─────────────────────────────────────────────
function Group({ label, files, stagedSet, badge, onToggle, onDiff, accent }: {
  label: string; files: GitFile[]; stagedSet: Set<string>; badge: string;
  onToggle: (path: string) => void; onDiff: () => void; accent: AccentType;
}) {
  if (files.length === 0) return null;
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 }}>
        <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 11.5, color: T.tx2, letterSpacing: 0.04 * 11.5, textTransform: 'uppercase' }}>{label}</Text>
        <View style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: 20, backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border }}>
          <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: badge }}>{files.length}</Text>
        </View>
      </View>
      {files.map(f => (
        <ChangeRow
          key={f.path}
          file={f}
          staged={stagedSet.has(f.path)}
          onToggle={() => onToggle(f.path)}
          onDiff={onDiff}
          accent={accent}
        />
      ))}
    </View>
  );
}

// ── Git Tab ───────────────────────────────────────────────────
type GitTabProps = { accent: AccentType };

export function GitTab({ accent }: GitTabProps) {
  const g = DATA.git;
  const all = [...g.staged, ...g.unstaged, ...g.untracked];
  const [staged, setStaged] = useState<Set<string>>(() => new Set(g.staged.map(f => f.path)));
  const [diff, setDiff] = useState(false);
  const [commit, setCommit] = useState('');

  const toggle = (path: string) => setStaged(s => {
    const n = new Set(s);
    n.has(path) ? n.delete(path) : n.add(path);
    return n;
  });

  const stagedFiles = all.filter(f => staged.has(f.path));
  const unstagedFiles = g.unstaged.filter(f => !staged.has(f.path));
  const untrackedFiles = g.untracked.filter(f => !staged.has(f.path));

  const readyToCommit = commit.trim().length > 0 && stagedFiles.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 4, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        <Group label="Staged" files={stagedFiles} stagedSet={staged} badge={accent.hue} onToggle={toggle} onDiff={() => setDiff(true)} accent={accent} />
        <Group label="Unstaged" files={unstagedFiles} stagedSet={staged} badge={T.yellow} onToggle={toggle} onDiff={() => setDiff(true)} accent={accent} />
        <Group label="Untracked" files={untrackedFiles} stagedSet={staged} badge={T.cyan} onToggle={toggle} onDiff={() => setDiff(true)} accent={accent} />
      </ScrollView>

      {/* commit bar */}
      <View style={{ flexShrink: 0, borderTopWidth: 1, borderColor: T.borderSoft, backgroundColor: T.bg1, padding: 10, paddingHorizontal: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingLeft: 12, paddingRight: 4, paddingVertical: 4 }}>
          <TextInput
            value={commit}
            onChangeText={setCommit}
            placeholder={`Commit ${stagedFiles.length} file${stagedFiles.length === 1 ? '' : 's'}…`}
            placeholderTextColor={T.tx2}
            style={{ flex: 1, fontFamily: T.uiFont, fontSize: 14, color: T.tx0, padding: 0, paddingVertical: 9 }}
          />
          <Press onPress={() => readyToCommit && setCommit('')} style={{
            height: 38, paddingHorizontal: 16, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: readyToCommit ? accent.hue : T.bg3,
          }}>
            <Icon name="check" size={16} color={readyToCommit ? accent.on : T.tx2} />
            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 13.5, color: readyToCommit ? accent.on : T.tx2 }}>Commit</Text>
          </Press>
        </View>
      </View>

      {/* diff sheet */}
      <Sheet open={diff} onClose={() => setDiff(false)} height="82%">
        <DiffContent accent={accent} onClose={() => setDiff(false)} />
      </Sheet>
    </View>
  );
}
