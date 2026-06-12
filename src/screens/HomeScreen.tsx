import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME, AccentType, accentFor } from '../theme';
import { DATA, Server, AvailableAgent } from '../data/mock';
import { Icon } from '../components/Icon';
import { Press, Dot, Spinner, Sheet, TopBar, Btn, Field, Seg } from '../components/Primitives';

const T = THEME;

// ── Server Card ───────────────────────────────────────────────
function ServerCard({ s, accent, onOpen, onMenu }: { s: Server; accent: AccentType; onOpen: (s: Server) => void; onMenu: (s: Server) => void }) {
  return (
    <Press onPress={() => onOpen(s)} style={{
      backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 14,
      padding: 14, gap: 11,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: T.bg3, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="server" size={20} color={s.online ? accent.hue : T.tx2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15.5, color: T.tx0 }}>{s.name}</Text>
            <Dot color={s.online ? T.green : T.tx2} glow={s.online} />
          </View>
          <Text style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.tx2, marginTop: 2 }} numberOfLines={1}>
            {s.user}@{s.host}{s.port !== 22 ? ':' + s.port : ''}
          </Text>
        </View>
        <Press onPress={() => onMenu(s)} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9 }}>
          <Icon name="more" size={20} color={T.tx2} />
        </Press>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: T.uiFont, fontSize: 11.5, color: s.online ? T.green : T.tx2 }}>
          {s.online ? 'Online' : 'Offline'}
        </Text>
        <Text style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.border }}>·</Text>
        <Text style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2 }}>{s.last}</Text>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name={s.auth === 'keystore' ? 'lock' : 'key'} size={13} color={T.tx2} />
          <Text style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2 }}>
            {s.auth === 'keystore' ? 'Keystore' : 'Key file'}
          </Text>
        </View>
      </View>
    </Press>
  );
}

// ── Server List ───────────────────────────────────────────────
type ServerListProps = { accent: AccentType; onOpen: (s: Server) => void; onAdd: () => void };

export function ServerList({ accent, onOpen, onAdd }: ServerListProps) {
  const [menu, setMenu] = useState<Server | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.bg1 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderColor: T.borderSoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontFamily: T.monoFontMedium, fontSize: 11, color: accent.hue, letterSpacing: 1.2 }}>MOBILE·ACP</Text>
              <Text style={{ fontFamily: T.uiFontBold, fontSize: 23, color: T.tx0, letterSpacing: -0.46, marginTop: 2 }}>Servers</Text>
            </View>
            <Press onPress={onAdd} style={{
              height: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14,
              backgroundColor: accent.hue, borderRadius: 11,
            }}>
              <Icon name="plus" size={18} color={accent.on} />
              <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 14, color: accent.on }}>Add</Text>
            </Press>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 11 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 11.5, color: T.tx2, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {DATA.servers.length} paired
        </Text>
        {DATA.servers.map(s => (
          <ServerCard key={s.id} s={s} accent={accent} onOpen={onOpen} onMenu={setMenu} />
        ))}
        <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2, textAlign: 'center', marginTop: 8, lineHeight: 17.6 }}>
          Zero server deploy — just <Text style={{ color: T.tx1 }}>sshd</Text>.
        </Text>
      </ScrollView>

      <Sheet open={!!menu} onClose={() => setMenu(null)}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          <Text style={{ fontFamily: T.uiFont, fontSize: 13, color: T.tx2, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 12 }}>{menu?.name}</Text>
          {([['edit', 'Edit server'], ['refresh', 'Test connection'], ['copy', 'Duplicate']] as [string, string][]).map(([ic, l]) => (
            <Press key={l} onPress={() => setMenu(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, height: 50, paddingHorizontal: 8 }}>
              <Icon name={ic} size={20} color={T.tx1} />
              <Text style={{ fontFamily: T.uiFont, fontSize: 15, color: T.tx0 }}>{l}</Text>
            </Press>
          ))}
          <View style={{ height: 1, backgroundColor: T.borderSoft, marginVertical: 6 }} />
          <Press onPress={() => setMenu(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, height: 50, paddingHorizontal: 8 }}>
            <Icon name="trash" size={20} color={T.red} />
            <Text style={{ fontFamily: T.uiFont, fontSize: 15, color: T.red }}>Delete server</Text>
          </Press>
        </View>
      </Sheet>
    </View>
  );
}

// ── QR Frame (decorative) ─────────────────────────────────────
function QrFrame({ accent }: { accent: AccentType }) {
  const cells: boolean[] = [];
  let seed = 7;
  for (let i = 0; i < 441; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    cells.push((seed >> 16) % 100 < 48);
  }
  const finder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7);
  const rows = Array.from({ length: 21 }, (_, r) =>
    Array.from({ length: 21 }, (_, c) => {
      const isFinder = finder(r, c);
      const on = cells[r * 21 + c];
      const lit = isFinder
        ? ((r % 6 !== 0 && c % 6 !== 0)
          ? (r > 1 && r < 5 && c > 1 && c < 5) || (r === 0 || r === 6 || c === 0 || c === 6)
          : true)
        : on;
      return { lit, isFinder };
    })
  );
  return (
    <View style={{ width: 210, height: 210, backgroundColor: '#0a0b0e', borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 16 }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flex: 1, flexDirection: 'row' }}>
          {row.map((cell, c) => (
            <View key={c} style={{ flex: 1, backgroundColor: cell.lit ? (cell.isFinder ? accent.hue : T.tx0) : 'transparent', borderRadius: 0.5 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Add Server ────────────────────────────────────────────────
type AddServerProps = { accent: AccentType; onBack: () => void; onPaired: () => void };

export function AddServer({ accent, onBack, onPaired }: AddServerProps) {
  const [mode, setMode] = useState<'qr' | 'manual'>('qr');
  const [scanned, setScanned] = useState(false);
  const [form, setForm] = useState({ name: '', host: '', port: '22', user: '', auth: 'keystore' });
  const [testing, setTesting] = useState<null | 'run' | 'ok'>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const test = () => {
    setTesting('run');
    setTimeout(() => setTesting('ok'), 1400);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.bg1 }}>
        <TopBar title="Add server" onBack={onBack} />
      </SafeAreaView>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 0 }}>
        <Seg accent={accent} value={mode} onChange={v => setMode(v as 'qr' | 'manual')} options={[
          { value: 'qr', label: 'Scan QR', icon: 'qr' },
          { value: 'manual', label: 'Manual', icon: 'edit' },
        ]} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 18, paddingBottom: 28, gap: 12 }} showsVerticalScrollIndicator={false}>
        {mode === 'qr' && (
          <>
            <Text style={{ fontFamily: T.uiFont, fontSize: 13, color: T.tx1, textAlign: 'center', lineHeight: 20.8 }}>
              Run this on your server, then point the camera at the code it prints.
            </Text>
            <View style={{ backgroundColor: '#0a0b0e', borderWidth: 1, borderColor: T.borderSoft, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11 }}>
              <Text style={{ fontFamily: T.monoFont, fontSize: 12, color: T.tx1 }}>
                <Text style={{ color: accent.hue }}>$ </Text>
                curl -fsSL https://mobile-acp.dev/setup.sh | bash
              </Text>
            </View>
            <View style={{ alignItems: 'center', marginTop: 4 }}>
              <View>
                <QrFrame accent={accent} />
                {!scanned && (
                  <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14,
                    backgroundColor: 'rgba(13,14,18,0.78)', alignItems: 'center', justifyContent: 'center', gap: 10,
                  }}>
                    <Icon name="qr" size={30} color={accent.hue} />
                    <Text style={{ fontFamily: T.uiFont, fontSize: 12.5, color: T.tx1 }}>Camera viewfinder</Text>
                    <Btn size="sm" accent={accent} onPress={() => setScanned(true)}>Simulate scan</Btn>
                  </View>
                )}
                {scanned && (
                  <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14,
                    borderWidth: 2, borderColor: T.green,
                    shadowColor: T.green, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 8,
                    pointerEvents: 'none',
                  } as any} />
                )}
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {scanned && <Icon name="check" size={13} color={T.green} />}
              <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: scanned ? T.green : T.tx2 }}>
                {scanned ? 'Key exchange complete' : 'Code valid for 4:58'}
              </Text>
            </View>
            {scanned && (
              <View style={{ backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 13, marginTop: 2, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Icon name="server" size={18} color={accent.hue} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 14.5, color: T.tx0 }}>devbox-2</Text>
                    <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2 }}>kai@10.0.0.7</Text>
                  </View>
                </View>
                <Btn full accent={accent} onPress={onPaired}>Pair & open</Btn>
              </View>
            )}
          </>
        )}

        {mode === 'manual' && (
          <>
            <Field label="Name" value={form.name} onChange={v => set('name', v)} placeholder="my-server" accent={accent} />
            <Field label="Host" value={form.host} onChange={v => set('host', v)} placeholder="example.com or 10.0.0.5" mono accent={accent} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Field label="Port" value={form.port} onChange={v => set('port', v)} mono accent={accent} /></View>
              <View style={{ flex: 2 }}><Field label="Username" value={form.user} onChange={v => set('user', v)} placeholder="root" mono accent={accent} /></View>
            </View>
            <View>
              <Text style={{ fontFamily: T.uiFontMedium, fontSize: 12, color: T.tx1, marginBottom: 8 }}>Authentication</Text>
              <View style={{ gap: 8 }}>
                {([
                  ['keystore', 'key', 'Generate key', 'Stored in Android Keystore'],
                  ['key-file', 'download', 'Import private key', 'From a .pem / id_ed25519 file'],
                  ['password', 'lock', 'Password', 'Sent over the encrypted channel'],
                ] as [string, string, string, string][]).map(([val, ic, l, d]) => {
                  const on = form.auth === val;
                  return (
                    <Press key={val} onPress={() => set('auth', val)} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 11,
                      backgroundColor: on ? accent.dim : T.bg2, borderWidth: 1, borderColor: on ? accent.hue + '66' : T.border,
                    }}>
                      <Icon name={ic} size={18} color={on ? accent.hue : T.tx2} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          <Text style={{ fontFamily: T.uiFontMedium, fontSize: 14, color: T.tx0 }}>{l}</Text>
                          {val === 'keystore' && (
                            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 10.5, color: accent.hue }}>RECOMMENDED</Text>
                          )}
                        </View>
                        <Text style={{ fontFamily: T.uiFont, fontSize: 11.5, color: T.tx2, marginTop: 1 }}>{d}</Text>
                      </View>
                      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: on ? accent.hue : T.border, alignItems: 'center', justifyContent: 'center' }}>
                        {on && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent.hue }} />}
                      </View>
                    </Press>
                  );
                })}
              </View>
            </View>
            <Btn kind="ghost" full icon={testing === 'ok' ? 'check' : 'refresh'} onPress={test}
              style={testing === 'ok' ? { borderColor: T.green + '55' } : {}}>
              {testing === 'run'
                ? <Spinner size={14} color={T.tx1} />
                : <Text style={{ fontFamily: T.uiFontMedium, fontSize: 14.5, color: testing === 'ok' ? T.green : T.tx1 }}>
                    {testing === 'ok' ? 'Connection OK · 42ms' : 'Test connection'}
                  </Text>
              }
            </Btn>
            <Btn full accent={accent} disabled={testing !== 'ok'} onPress={onPaired}>Save & open</Btn>
          </>
        )}
      </ScrollView>
    </View>
  );
}
