import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Animated, ActivityIndicator } from 'react-native';
import { shq } from '../core/remote';
import { THEME, AccentType } from '../theme';
import type { TreeNode } from '../data/types';
import { Icon } from '../components/Icon';
import { Press, Sheet, EmptyHint } from '../components/Primitives';
import { CodeBlock } from '../components/CodeBlock';
import type { ExecResult } from '../core/transport';

const T = THEME;
const GIT_COLOR: Record<string, string> = { M: T.yellow, A: T.green, U: T.cyan, D: T.red };

type ExecFn = (cmd: string, cwd?: string) => Promise<ExecResult>;

// ── remote dir listing ────────────────────────────────────────

function parseLs(raw: string, depth: number, parentId: string): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '.' || trimmed === '..' || trimmed.startsWith('total ')) continue;
    // ls -la output: permissions links user group size date name
    const parts = trimmed.split(/\s+/);
    if (parts.length < 9) continue;
    const perms = parts[0];
    const name  = parts.slice(8).join(' ');
    if (!name || name === '.' || name === '..') continue;
    const isDir = perms.startsWith('d');
    const isLink = perms.startsWith('l');
    nodes.push({
      id: `${parentId}/${name}`,
      name,
      type: isDir || isLink ? 'dir' : 'file',
      depth,
      open: false,
      children: isDir ? [] : undefined,
    });
  }
  return nodes.sort((a, b) => {
    // dirs first, then files, each alphabetical
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function fileIconName(n: TreeNode): string {
  if (n.name.match(/\.(png|jpg|jpeg|svg|webp|gif|ico)$/i)) return 'image2';
  if (n.name.match(/\.(md|mdx)$/i)) return 'doc';
  if (n.name.match(/\.pdf$/i)) return 'pdf';
  return 'file';
}

function flatten(nodes: TreeNode[], openMap: Record<string, boolean>, out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    out.push(n);
    if (n.type === 'dir' && (openMap[n.id] ?? n.open) && n.children) {
      flatten(n.children, openMap, out);
    }
  }
  return out;
}

// ── File Preview ──────────────────────────────────────────────
function FilePreview({ node, content, loading, accent, onClose }: {
  node: TreeNode | null; content: string; loading: boolean; accent: AccentType; onClose: () => void;
}) {
  const slideAnim = React.useRef(new Animated.Value(400)).current;
  const [rawMd, setRawMd] = React.useState(false);

  React.useEffect(() => {
    if (node) {
      setRawMd(false);
      Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 220, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 180, useNativeDriver: true }).start();
    }
  }, [node?.id]);

  if (!node) return null;

  const isMd = node.name.match(/\.(md|mdx)$/i);

  return (
    <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: T.bg0, transform: [{ translateX: slideAnim }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 8, backgroundColor: T.bg1, borderBottomWidth: 1, borderColor: T.borderSoft }}>
        <Press onPress={onClose} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}>
          <Icon name="back" size={20} color={T.tx1} />
        </Press>
        <Text style={{ flex: 1, fontFamily: T.monoFontMedium, fontSize: 12.5, color: T.tx0 }} numberOfLines={1}>{node.name}</Text>
        {isMd && (
          <Press onPress={() => setRawMd(r => !r)} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 11.5, color: accent.hue }}>{rawMd ? 'Preview' : 'Raw'}</Text>
          </Press>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
        {loading ? (
          <ActivityIndicator color={accent.hue} style={{ marginTop: 40 }} />
        ) : isMd && !rawMd ? (
          <View>
            {content.split('\n').map((ln, i) => {
              if (ln.startsWith('# '))  return <Text key={i} style={{ fontFamily: T.uiFontBold, fontSize: 22, color: T.tx0, letterSpacing: -0.44, marginBottom: 10, marginTop: 4 }}>{ln.slice(2)}</Text>;
              if (ln.startsWith('## ')) return <Text key={i} style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, marginTop: 18, marginBottom: 8 }}>{ln.slice(3)}</Text>;
              if (ln.startsWith('- '))  return <View key={i} style={{ flexDirection: 'row', gap: 9 }}><Text style={{ color: accent.hue }}>•</Text><Text style={{ fontFamily: T.uiFont, fontSize: 13.5, color: T.tx1, lineHeight: 24, flex: 1 }}>{ln.slice(2)}</Text></View>;
              if (!ln.trim()) return <View key={i} style={{ height: 8 }} />;
              return <Text key={i} style={{ fontFamily: T.uiFont, fontSize: 13.5, color: T.tx1, lineHeight: 24 }}>{ln}</Text>;
            })}
          </View>
        ) : (
          <CodeBlock code={content} showLines fontSize={12.5} pad={14} />
        )}
      </ScrollView>
    </Animated.View>
  );
}

// ── Files Tab ─────────────────────────────────────────────────
type FilesTabProps = { accent: AccentType; exec?: ExecFn; cwd?: string };

export function FilesTab({ accent, exec, cwd }: FilesTabProps) {
  const useMock = !exec || !cwd;

  const [tree, setTree]         = useState<TreeNode[]>(() => []);
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  const [rootLoading, setRootLoading] = useState(!useMock);
  const [openMap, setOpenMap]   = useState<Record<string, boolean>>({});
  const [query, setQuery]       = useState('');
  const [previewNode, setPreviewNode] = useState<TreeNode | null>(null);
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [menuNode, setMenuNode] = useState<TreeNode | null>(null);

  // Load root directory
  useEffect(() => {
    if (useMock) return;
    setRootLoading(true);
    exec!(`ls -la ${shq(cwd!)}`)
      .then(res => setTree(parseLs(res.stdout, 0, 'root')))
      .catch(e => console.warn('[FilesTab] ls error', e))
      .finally(() => setRootLoading(false));
  }, [exec, cwd]);

  const toggleDir = useCallback(async (node: TreeNode) => {
    const nowOpen = !(openMap[node.id] ?? node.open);
    setOpenMap(m => ({ ...m, [node.id]: nowOpen }));

    if (nowOpen && !useMock && node.children?.length === 0) {
      // Lazily load children
      setLoadingDirs(s => { const n = new Set(s); n.add(node.id); return n; });
      try {
        const dirPath = cwd + node.id.slice('root'.length);
        const res = await exec!(`ls -la ${shq(dirPath)}`);
        const children = parseLs(res.stdout, node.depth + 1, node.id);
        setTree(prev => {
          const update = (nodes: TreeNode[]): TreeNode[] =>
            nodes.map(n => n.id === node.id ? { ...n, children } : { ...n, children: n.children ? update(n.children) : n.children });
          return update(prev);
        });
      } catch (e) {
        console.warn('[FilesTab] ls children error', e);
      } finally {
        setLoadingDirs(s => { const n = new Set(s); n.delete(node.id); return n; });
      }
    }
  }, [openMap, exec, cwd, useMock]);

  const openFile = useCallback(async (node: TreeNode) => {
    setPreviewNode(node);
    setPreviewContent('');
    if (useMock) {
      setPreviewContent('(not connected)');
      return;
    }
    setPreviewLoading(true);
    try {
      const filePath = cwd + node.id.slice('root'.length);
      const res = await exec!(`cat ${shq(filePath)}`);
      setPreviewContent(res.stdout);
    } catch {
      setPreviewContent('(error reading file)');
    } finally {
      setPreviewLoading(false);
    }
  }, [exec, cwd, useMock]);

  const flat = useMemo(() => flatten(tree, openMap), [tree, openMap]);
  const filtered = useMemo(() => {
    if (!query.trim()) return flat;
    const q = query.toLowerCase();
    return flat.filter(n => n.type === 'file' && n.name.toLowerCase().includes(q));
  }, [flat, query]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: T.bg1, borderBottomWidth: 1, borderColor: T.borderSoft }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 11, backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 10 }}>
          <Icon name="search" size={16} color={T.tx2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search files…"
            placeholderTextColor={T.tx2}
            style={{ flex: 1, fontFamily: T.uiFont, fontSize: 13.5, color: T.tx0, padding: 0 }}
          />
          {query.length > 0 && (
            <Press onPress={() => setQuery('')}>
              <Icon name="x" size={15} color={T.tx2} />
            </Press>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 6, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {rootLoading && (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <ActivityIndicator color={accent.hue} />
          </View>
        )}
        {!rootLoading && filtered.length === 0 && query.length > 0 && (
          <EmptyHint icon="search" title="No files found" sub={`Nothing matches "${query}"`} />
        )}
        {filtered.map(n => {
          const isOpen = openMap[n.id] ?? n.open;
          const childLoading = loadingDirs.has(n.id);
          return (
            <Press
              key={n.id}
              onPress={() => n.type === 'dir' ? toggleDir(n) : openFile(n)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40, paddingRight: 12, paddingLeft: 12 + (query ? 0 : n.depth * 16) }}
            >
              {n.type === 'dir'
                ? childLoading
                  ? <ActivityIndicator size="small" color={T.tx2} style={{ width: 15 }} />
                  : <Icon name={isOpen ? 'chevD' : 'chevR'} size={15} color={T.tx2} />
                : <View style={{ width: 15 }} />
              }
              <Icon name={n.type === 'dir' ? 'folder' : fileIconName(n)} size={16} color={n.type === 'dir' ? accent.hue : T.tx2} />
              <Text style={{ flex: 1, fontFamily: n.type === 'dir' ? T.monoFontMedium : T.monoFont, fontSize: 13, color: n.type === 'dir' ? T.tx0 : T.tx1 }} numberOfLines={1}>{n.name}</Text>
              {n.git && (
                <Text style={{ fontFamily: T.monoFontMedium, fontSize: 11, color: GIT_COLOR[n.git] ?? T.tx2, width: 14, textAlign: 'center' }}>{n.git}</Text>
              )}
              {n.type === 'file' && (
                <Press onPress={() => setMenuNode(n)} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="more" size={17} color={T.tx2} />
                </Press>
              )}
            </Press>
          );
        })}
      </ScrollView>

      <Sheet open={!!menuNode} onClose={() => setMenuNode(null)}>
        {menuNode && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
            <Text style={{ fontFamily: T.monoFont, fontSize: 12.5, color: T.tx1, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 12 }}>{menuNode.name}</Text>
            {([
              ['file', 'Open in Files', () => { openFile(menuNode); setMenuNode(null); }],
              ['copy', 'Copy path', () => setMenuNode(null)],
              ['at', 'Mention in chat', () => setMenuNode(null)],
            ] as [string, string, () => void][]).map(([ic, l, fn]) => (
              <Press key={l} onPress={fn} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, height: 50, paddingHorizontal: 8 }}>
                <Icon name={ic} size={20} color={T.tx1} />
                <Text style={{ fontFamily: T.uiFont, fontSize: 15, color: T.tx0 }}>{l}</Text>
              </Press>
            ))}
          </View>
        )}
      </Sheet>

      {previewNode && (
        <FilePreview
          node={previewNode}
          content={previewContent}
          loading={previewLoading}
          accent={accent}
          onClose={() => { setPreviewNode(null); setPreviewContent(''); }}
        />
      )}
    </View>
  );
}
