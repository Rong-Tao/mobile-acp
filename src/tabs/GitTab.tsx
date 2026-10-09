import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { shq } from '../core/remote';
import { THEME, AccentType } from '../theme';
import type { GitFile, DiffHunk } from '../data/types';
import { Icon } from '../components/Icon';
import { Press, Btn, Sheet, EmptyHint } from '../components/Primitives';
import { HighlightedLine } from '../components/CodeBlock';
import type { ExecResult } from '../core/transport';

const T = THEME;
const GIT_COLOR: Record<string, string> = { M: T.yellow, A: T.green, U: T.cyan, D: T.red, R: T.purple };

type ExecFn = (cmd: string, cwd?: string) => Promise<ExecResult>;

// ── git output parsers ────────────────────────────────────────

function parsePorcelain(raw: string) {
  const staged: GitFile[] = [];
  const unstaged: GitFile[] = [];
  const untracked: GitFile[] = [];

  for (const line of raw.split('\n')) {
    if (line.length < 3) continue;
    const x = line[0];  // index (staged) status
    const y = line[1];  // worktree (unstaged) status
    const pathRaw = line.slice(3);
    // handle renames: "new\told"
    const path = pathRaw.includes('\t') ? pathRaw.split('\t')[0] : pathRaw;

    if (x === '?' && y === '?') {
      untracked.push({ path, code: 'U', add: 0, del: 0 });
    } else {
      if (x !== ' ') staged.push({ path, code: x, add: 0, del: 0 });
      if (y !== ' ') unstaged.push({ path, code: y, add: 0, del: 0 });
    }
  }
  return { staged, unstaged, untracked };
}

function parseNumstat(raw: string): Record<string, { add: number; del: number }> {
  const out: Record<string, { add: number; del: number }> = {};
  for (const line of raw.split('\n')) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const [addStr, delStr, path] = parts;
    const add = parseInt(addStr, 10) || 0;
    const del = parseInt(delStr, 10) || 0;
    out[path] = { add, del };
  }
  return out;
}

function parseUnifiedDiff(raw: string): { path: string; hunks: DiffHunk[]; addTotal: number; delTotal: number } {
  let path = '';
  const hunks: DiffHunk[] = [];
  let cur: DiffHunk | null = null;
  let ln1 = 0, ln2 = 0;
  let addTotal = 0, delTotal = 0;

  for (const line of raw.split('\n')) {
    if (line.startsWith('+++ b/')) { path = line.slice(6); continue; }
    if (line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ')) continue;

    const m = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (m) {
      cur = { header: line, lines: [] };
      hunks.push(cur);
      ln1 = parseInt(m[1], 10);
      ln2 = parseInt(m[2], 10);
      continue;
    }
    if (!cur) continue;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      cur.lines.push({ n1: null, n2: ln2++, t: '+', s: line.slice(1) });
      addTotal++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      cur.lines.push({ n1: ln1++, n2: null, t: '-', s: line.slice(1) });
      delTotal++;
    } else if (line.startsWith(' ')) {
      cur.lines.push({ n1: ln1++, n2: ln2++, t: ' ', s: line.slice(1) });
    }
  }
  return { path, hunks, addTotal, delTotal };
}

// ── Diff Sheet ────────────────────────────────────────────────
type DiffState = { path: string; hunks: DiffHunk[]; addTotal: number; delTotal: number } | null;

function DiffContent({ diff, accent, onStage, onDiscard, onClose }: {
  diff: DiffState; accent: AccentType;
  onStage?: () => void; onDiscard?: () => void; onClose: () => void;
}) {
  if (!diff) return null;
  const lineColor = (t: string) => t === '+' ? 'rgba(108,208,147,0.10)' : t === '-' ? 'rgba(229,115,127,0.10)' : 'transparent';
  const gutterBg  = (t: string) => t === ' ' ? '#0a0b0e' : t === '+' ? '#0c130f' : '#130c0e';
  const mark      = (t: string) => t === '+' ? T.green : t === '-' ? T.red : T.tx2;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 2, paddingBottom: 12 }}>
        <Icon name="file" size={16} color={accent.hue} />
        <Text style={{ flex: 1, fontFamily: T.monoFont, fontSize: 12.5, color: T.tx0 }} numberOfLines={1}>{diff.path}</Text>
        <Text style={{ fontFamily: T.monoFont, fontSize: 11 }}>
          <Text style={{ color: T.green }}>+{diff.addTotal} </Text>
          <Text style={{ color: T.red }}>-{diff.delTotal}</Text>
        </Text>
      </View>

      <View style={{ flex: 1, marginHorizontal: 12, backgroundColor: '#0a0b0e', borderWidth: 1, borderColor: T.borderSoft, borderRadius: 11, overflow: 'hidden', maxHeight: 400 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {diff.hunks.map((h, hi) => (
                <View key={hi}>
                  <View style={{ backgroundColor: T.bg2, paddingHorizontal: 12, paddingVertical: 7 }}>
                    <Text style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.purple }}>{h.header}</Text>
                  </View>
                  {h.lines.map((ln, i) => (
                    <View key={i} style={{ flexDirection: 'row', backgroundColor: lineColor(ln.t) }}>
                      <View style={{ width: 30, paddingRight: 8, alignItems: 'flex-end', backgroundColor: gutterBg(ln.t), justifyContent: 'center', paddingVertical: 1 }}>
                        <Text style={{ fontFamily: T.monoFont, fontSize: 12, color: T.tx2, lineHeight: 19.8 }}>{ln.n1 ?? ''}</Text>
                      </View>
                      <View style={{ width: 16, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: T.monoFont, fontSize: 12, color: mark(ln.t), lineHeight: 19.8 }}>{ln.t !== ' ' ? ln.t : ''}</Text>
                      </View>
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

      <View style={{ flexDirection: 'row', gap: 10, padding: 14 }}>
        {onDiscard && <Btn kind="danger" onPress={onDiscard}>Discard</Btn>}
        {onStage && <Btn full accent={accent} icon="plus" onPress={onStage}>Stage file</Btn>}
        {!onStage && <Btn full kind="ghost" onPress={onClose}>Close</Btn>}
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

function Group({ label, files, stagedSet, badge, onToggle, onDiff, accent }: {
  label: string; files: GitFile[]; stagedSet: Set<string>; badge: string;
  onToggle: (path: string) => void; onDiff: (file: GitFile, isStaged: boolean) => void; accent: AccentType;
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
          key={f.path + label}
          file={f}
          staged={stagedSet.has(f.path)}
          onToggle={() => onToggle(f.path)}
          onDiff={() => onDiff(f, label === 'Staged')}
          accent={accent}
        />
      ))}
    </View>
  );
}

// ── Git Tab ───────────────────────────────────────────────────
type GitTabProps = { accent: AccentType; exec?: ExecFn; cwd?: string };

export function GitTab({ accent, exec, cwd }: GitTabProps) {
  const useMock = !exec || !cwd;

  const [staged, setStaged]     = useState<GitFile[]>([]);
  const [unstaged, setUnstaged] = useState<GitFile[]>([]);
  const [untracked, setUntracked] = useState<GitFile[]>([]);
  const [stagedSet, setStagedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading]   = useState(!useMock);
  const [diff, setDiff]         = useState<DiffState>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [commit, setCommit]     = useState('');
  const [committing, setCommitting] = useState(false);

  // Load git status
  const reload = useCallback(async () => {
    if (!exec || !cwd) return;
    setLoading(true);
    try {
      const [statusRes, numstatRes, numstatCachedRes] = await Promise.all([
        exec(`git -C ${shq(cwd)} status --porcelain`),
        exec(`git -C ${shq(cwd)} diff --numstat`),
        exec(`git -C ${shq(cwd)} diff --cached --numstat`),
      ]);
      const parsed   = parsePorcelain(statusRes.stdout);
      const stats    = parseNumstat(numstatRes.stdout);
      const cached   = parseNumstat(numstatCachedRes.stdout);

      const enrich = (files: GitFile[], lookup: Record<string, { add: number; del: number }>) =>
        files.map(f => ({ ...f, ...(lookup[f.path] ?? {}) }));

      setStaged(enrich(parsed.staged, cached));
      setUnstaged(enrich(parsed.unstaged, stats));
      setUntracked(parsed.untracked);
      setStagedSet(new Set(parsed.staged.map(f => f.path)));
    } catch (e) {
      console.warn('[GitTab] reload error', e);
    } finally {
      setLoading(false);
    }
  }, [exec, cwd]);

  useEffect(() => { reload(); }, [reload]);

  const toggle = (path: string) => setStagedSet(s => {
    const n = new Set(s);
    n.has(path) ? n.delete(path) : n.add(path);
    return n;
  });

  const openDiff = async (file: GitFile, isStaged: boolean) => {
    if (!exec || !cwd) return;
    setDiffLoading(true);
    setDiff({ path: file.path, hunks: [], addTotal: 0, delTotal: 0 });
    try {
      const flag = isStaged ? '--cached ' : '';
      const res = await exec(`git -C ${shq(cwd)} diff ${flag}-- ${shq(file.path)}`);
      setDiff(parseUnifiedDiff(res.stdout));
    } catch (e) {
      console.warn('[GitTab] diff error', e);
    } finally {
      setDiffLoading(false);
    }
  };

  const doCommit = async () => {
    if (!exec || !cwd || !commit.trim()) return;
    setCommitting(true);
    try {
      // stage selected files
      const toStage = [...staged, ...unstaged, ...untracked].filter(f => stagedSet.has(f.path)).map(f => f.path);
      if (toStage.length > 0) {
        await exec(`git -C ${shq(cwd)} add -- ${toStage.map(p => shq(p)).join(' ')}`);
      }
      await exec(`git -C ${shq(cwd)} commit -m ${shq(commit)}`);
      setCommit('');
      reload();
    } catch (e) {
      console.warn('[GitTab] commit error', e);
    } finally {
      setCommitting(false);
    }
  };

  const all = [...staged, ...unstaged, ...untracked];
  const stagedFiles   = all.filter(f => stagedSet.has(f.path));
  const unstagedFiles = unstaged.filter(f => !stagedSet.has(f.path));
  const untrackedFiles = untracked.filter(f => !stagedSet.has(f.path));
  const readyToCommit = commit.trim().length > 0 && stagedFiles.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      {loading && (
        <View style={{ position: 'absolute', top: 12, alignSelf: 'center', zIndex: 10 }}>
          <ActivityIndicator size="small" color={accent.hue} />
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 4, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        {!loading && all.length === 0 && (
          <EmptyHint icon="check" title="Working tree clean" sub="No changes to commit" />
        )}
        <Group label="Staged"    files={stagedFiles}    stagedSet={stagedSet} badge={accent.hue} onToggle={toggle} onDiff={openDiff} accent={accent} />
        <Group label="Unstaged"  files={unstagedFiles}  stagedSet={stagedSet} badge={T.yellow}   onToggle={toggle} onDiff={openDiff} accent={accent} />
        <Group label="Untracked" files={untrackedFiles} stagedSet={stagedSet} badge={T.cyan}     onToggle={toggle} onDiff={openDiff} accent={accent} />
      </ScrollView>

      <View style={{ flexShrink: 0, borderTopWidth: 1, borderColor: T.borderSoft, backgroundColor: T.bg1, padding: 10, paddingHorizontal: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 12, paddingLeft: 12, paddingRight: 4, paddingVertical: 4 }}>
          <TextInput
            value={commit}
            onChangeText={setCommit}
            placeholder={`Commit ${stagedFiles.length} file${stagedFiles.length === 1 ? '' : 's'}…`}
            placeholderTextColor={T.tx2}
            style={{ flex: 1, fontFamily: T.uiFont, fontSize: 14, color: T.tx0, padding: 0, paddingVertical: 9 }}
          />
          <Press onPress={() => readyToCommit && doCommit()} style={{
            height: 38, paddingHorizontal: 16, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: readyToCommit ? accent.hue : T.bg3,
          }}>
            {committing
              ? <ActivityIndicator size="small" color={accent.on} />
              : <><Icon name="check" size={16} color={readyToCommit ? accent.on : T.tx2} />
                <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 13.5, color: readyToCommit ? accent.on : T.tx2 }}>Commit</Text></>
            }
          </Press>
        </View>
      </View>

      <Sheet open={diff !== null} onClose={() => setDiff(null)} height="82%">
        {diffLoading
          ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={accent.hue} /></View>
          : <DiffContent
              diff={diff}
              accent={accent}
              onStage={diff ? () => { toggle(diff.path); setDiff(null); } : undefined}
              onDiscard={diff && exec ? async () => {
                await exec(`git -C ${shq(cwd!)} checkout -- ${shq(diff.path)}`);
                reload(); setDiff(null);
              } : undefined}
              onClose={() => setDiff(null)}
            />
        }
      </Sheet>
    </View>
  );
}
