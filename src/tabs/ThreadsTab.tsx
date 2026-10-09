// ThreadsTab：当前 project 的 thread 面板。
// 新建 thread + 历史列表（session/list），点历史项回放加载并跳回 Agent tab。

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { THEME, AccentType } from '../theme';
import { Icon } from '../components/Icon';
import { Press, Spinner, EmptyHint } from '../components/Primitives';
import { useLive } from '../core/live-context';

const T = THEME;

// "3m" / "2h" / "5d" 式相对时间
function relTime(iso?: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff) || diff < 0) return '';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function ThreadsTab({ accent, onOpened }: { accent: AccentType; onOpened: () => void }) {
  const live = useLive();
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try { await live.refreshThreads(); } finally { setRefreshing(false); setLoaded(true); }
  };

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!live.threadsSupported && !live.session) {
    return <EmptyHint icon="thread" title="No agent session" sub="Connect an agent to manage threads" />;
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 12, paddingTop: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={accent.hue} />}
    >
      {/* 新建 */}
      <Press
        onPress={() => { live.newThread().then(onOpened).catch(() => {}); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 13, backgroundColor: accent.dim, borderWidth: 1, borderColor: accent.hue + '33', marginBottom: 14 }}
      >
        <Icon name="plus" size={18} color={accent.hue} />
        <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 14, color: accent.hue }}>New thread</Text>
      </Press>

      {!live.threadsSupported ? (
        <Text style={{ fontFamily: T.uiFont, fontSize: 12.5, color: T.tx2, paddingHorizontal: 4 }}>
          This agent doesn't support listing past threads
        </Text>
      ) : (
        <>
          <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 11, color: T.tx2, letterSpacing: 1.2, paddingHorizontal: 4, paddingBottom: 8 }}>
            RECENT
          </Text>
          {!loaded && live.threads.length === 0 && (
            <View style={{ alignItems: 'center', padding: 24 }}>
              <Spinner size={18} color={accent.hue} />
            </View>
          )}
          {loaded && live.threads.length === 0 && (
            <Text style={{ fontFamily: T.uiFont, fontSize: 12.5, color: T.tx2, paddingHorizontal: 4 }}>
              No past threads in this project yet
            </Text>
          )}
          {live.threads.map((t) => {
            const active = t.sessionId === live.session?.sessionId;
            return (
              <Press
                key={t.sessionId}
                onPress={() => {
                  if (active) { onOpened(); return; }
                  live.openThread(t.sessionId).then(onOpened).catch(() => {});
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, paddingHorizontal: 11, borderRadius: 13, marginBottom: 3,
                  backgroundColor: active ? accent.dim : 'transparent', borderWidth: 1, borderColor: active ? accent.hue + '44' : 'transparent' }}
              >
                <Icon name={active ? 'spark' : 'thread'} size={16} color={active ? accent.hue : T.tx2} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: active ? T.uiFontSemiBold : T.uiFontMedium, fontSize: 13.5, color: T.tx0 }} numberOfLines={1}>
                    {t.title || t.sessionId.slice(0, 8)}
                  </Text>
                  {active && (
                    <Text style={{ fontFamily: T.uiFont, fontSize: 11, color: accent.hue, marginTop: 1 }}>Current</Text>
                  )}
                </View>
                <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2 }}>{relTime(t.updatedAt)}</Text>
              </Press>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}
