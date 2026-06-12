import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, ScrollView, Animated } from 'react-native';
import { THEME, AccentType } from '../theme';
import { DATA, TreeNode } from '../data/mock';
import { Icon } from '../components/Icon';
import { Press, Sheet, EmptyHint } from '../components/Primitives';
import { CodeBlock } from '../components/CodeBlock';

const T = THEME;

const GIT_COLOR: Record<string, string> = { M: T.yellow, A: T.green, U: T.cyan, D: T.red };

function fileIconName(n: TreeNode): string {
  if (n.kind === 'image') return 'image2';
  if (n.kind === 'md') return 'doc';
  if (n.kind === 'pdf') return 'pdf';
  if (n.kind === 'bin') return 'terminal';
  return 'file';
}

// Flatten tree honoring open state
function flatten(nodes: TreeNode[], openMap: Record<string, boolean>, out: TreeNode[] = []): TreeNode[] {
  nodes.forEach(n => {
    out.push(n);
    if (n.type === 'dir' && (openMap[n.id] ?? n.open) && n.children) flatten(n.children, openMap, out);
  });
  return out;
}

// ── File Preview ──────────────────────────────────────────────
function FilePreview({ node, accent, onClose }: { node: TreeNode | null; accent: AccentType; onClose: () => void }) {
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

  const kind = node.kind || (node.name.endsWith('.md') ? 'md' : node.name.match(/\.(png|jpg|svg|webp)$/) ? 'image' : node.name.endsWith('.pdf') ? 'pdf' : 'code');
  const content = node.id === 'f-readme' ? DATA.readme : node.id === 'f-pkg' ? DATA.pkgJson : DATA.diffViewCode;

  const crumbs = ['mobile-acp', ...(node.depth > 1 ? ['src', 'git'] : node.depth > 0 ? ['src'] : [])];

  return (
    <Animated.View style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: T.bg0, transform: [{ translateX: slideAnim }],
    }}>
      {/* header with breadcrumb */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 8, backgroundColor: T.bg1, borderBottomWidth: 1, borderColor: T.borderSoft }}>
        <Press onPress={onClose} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}>
          <Icon name="back" size={20} color={T.tx1} />
        </Press>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: node ? 0 : 8 }}>
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              <Text style={{ fontFamily: T.monoFont, fontSize: 12, color: T.tx2 }}>{c}</Text>
              <Icon name="chevR" size={13} color={T.tx2} />
            </React.Fragment>
          ))}
          <Text style={{ fontFamily: T.monoFontMedium, fontSize: 12.5, color: T.tx0 }}>{node.name.split('/').pop()}</Text>
        </ScrollView>
        {kind === 'md' && (
          <Press onPress={() => setRawMd(r => !r)} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 11.5, color: accent.hue }}>{rawMd ? 'Preview' : 'Raw'}</Text>
          </Press>
        )}
        {kind === 'code' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 8 }}>
            <Icon name="lock" size={13} color={T.tx2} />
            <Text style={{ fontFamily: T.uiFont, fontSize: 11, color: T.tx2 }}>Read-only</Text>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
        {(kind === 'code' || (kind === 'md' && rawMd)) && (
          <CodeBlock code={content} showLines={kind === 'code'} fontSize={12.5} pad={14} />
        )}
        {kind === 'md' && !rawMd && (
          <View>
            {content.split('\n').map((ln, i) => {
              if (ln.startsWith('# ')) return <Text key={i} style={{ fontFamily: T.uiFontBold, fontSize: 22, color: T.tx0, letterSpacing: -0.44, marginBottom: 10, marginTop: 4 }}>{ln.slice(2)}</Text>;
              if (ln.startsWith('## ')) return <Text key={i} style={{ fontFamily: T.uiFontSemiBold, fontSize: 15, color: T.tx0, marginTop: 18, marginBottom: 8 }}>{ln.slice(3)}</Text>;
              if (ln.startsWith('- ')) return <View key={i} style={{ flexDirection: 'row', gap: 9 }}><Text style={{ color: accent.hue }}>•</Text><Text style={{ fontFamily: T.uiFont, fontSize: 13.5, color: T.tx1, lineHeight: 24, flex: 1 }}>{ln.slice(2)}</Text></View>;
              if (ln.trim() === '') return <View key={i} style={{ height: 8 }} />;
              return <Text key={i} style={{ fontFamily: T.uiFont, fontSize: 13.5, color: T.tx1, lineHeight: 24 }}>{ln}</Text>;
            })}
          </View>
        )}
        {kind === 'image' && (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <View style={{ width: '100%', height: 200, borderRadius: 12, borderWidth: 1, borderColor: T.border, backgroundColor: T.bg2, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="image2" size={42} color={T.tx2} />
            </View>
            <Text style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2 }}>1024 × 768 · PNG · 84 KB · pinch to zoom</Text>
          </View>
        )}
        {kind === 'pdf' && (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <View style={{ width: '100%', height: 280, borderRadius: 12, borderWidth: 1, borderColor: T.border, backgroundColor: T.bg2, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: T.monoFont, fontSize: 12, color: T.tx2 }}>PROTOCOL.pdf · page 1 / 12</Text>
            </View>
            <Text style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2 }}>System PDF renderer · swipe to page</Text>
          </View>
        )}
        {kind === 'bin' && (
          <EmptyHint icon="file" title="Can't preview this file" sub={`Binary file · ${node.name} · 2.4 MB`} />
        )}
      </ScrollView>
    </Animated.View>
  );
}

// ── Files Tab ─────────────────────────────────────────────────
type FilesTabProps = { accent: AccentType };

export function FilesTab({ accent }: FilesTabProps) {
  const [query, setQuery] = useState('');
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [previewNode, setPreviewNode] = useState<TreeNode | null>(null);
  const [menuNode, setMenuNode] = useState<TreeNode | null>(null);

  const flat = useMemo(() => flatten(DATA.tree, openMap), [openMap]);
  const filtered = useMemo(() => {
    if (!query.trim()) return flat;
    const q = query.toLowerCase();
    return flat.filter(n => n.type === 'file' && n.name.toLowerCase().includes(q));
  }, [flat, query]);

  const toggleDir = (id: string) => setOpenMap(m => {
    const cur = m[id] ?? DATA.tree.flatMap(n => [n, ...(n.children || [])]).find(x => x.id === id)?.open;
    return { ...m, [id]: !cur };
  });

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      {/* search */}
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
            <Press onPress={() => setQuery('')} style={{ color: T.tx2 }}>
              <Icon name="x" size={15} color={T.tx2} />
            </Press>
          )}
        </View>
      </View>

      {/* file tree */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 6, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && query.length > 0 ? (
          <EmptyHint icon="search" title="No files found" sub={`Nothing matches "${query}"`} />
        ) : (
          filtered.map(n => {
            const isOpen = openMap[n.id] ?? n.open;
            return (
              <Press
                key={n.id}
                onPress={() => n.type === 'dir' ? toggleDir(n.id) : setPreviewNode(n)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40, paddingRight: 12, paddingLeft: 12 + (query ? 0 : n.depth * 16) }}
              >
                {n.type === 'dir'
                  ? <Icon name={isOpen ? 'chevD' : 'chevR'} size={15} color={T.tx2} />
                  : <View style={{ width: 15 }} />
                }
                <Icon
                  name={n.type === 'dir' ? 'folder' : fileIconName(n)}
                  size={16}
                  color={n.type === 'dir' ? accent.hue : T.tx2}
                />
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
          })
        )}
      </ScrollView>

      {/* file context menu */}
      <Sheet open={!!menuNode} onClose={() => setMenuNode(null)}>
        {menuNode && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
            <Text style={{ fontFamily: T.monoFont, fontSize: 12.5, color: T.tx1, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 12 }}>{menuNode.name}</Text>
            {([
              ['file', 'Open in Files', () => { setPreviewNode(menuNode); setMenuNode(null); }],
              ['copy', 'Copy path', () => setMenuNode(null)],
              ['at', 'Mention in chat', () => setMenuNode(null)],
              ['git', 'View in Git', () => setMenuNode(null)],
            ] as [string, string, () => void][]).map(([ic, l, fn]) => (
              <Press key={l} onPress={fn} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, height: 50, paddingHorizontal: 8 }}>
                <Icon name={ic} size={20} color={T.tx1} />
                <Text style={{ fontFamily: T.uiFont, fontSize: 15, color: T.tx0 }}>{l}</Text>
              </Press>
            ))}
          </View>
        )}
      </Sheet>

      {/* file preview overlay */}
      {previewNode && (
        <FilePreview node={previewNode} accent={accent} onClose={() => setPreviewNode(null)} />
      )}
    </View>
  );
}
