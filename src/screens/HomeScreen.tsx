import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TextInput, ActivityIndicator, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { THEME, AccentType } from '../theme';
import { Server } from '../data/mock';
import { Icon } from '../components/Icon';
import { Press, Dot, Sheet, TopBar, Btn, Field, Seg } from '../components/Primitives';
import { NativeSsh, sshAvailable } from '../../modules/ssh-transport/src';
import { saveCredential } from '../core/credentials';
import { loadServers, upsertServer, removeServer } from '../core/servers';
import { SshTransport } from '../core/ssh-transport';

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
            {s.auth === 'keystore' ? 'Keystore' : s.auth === 'key-file' ? 'Key file' : 'Password'}
          </Text>
        </View>
      </View>
    </Press>
  );
}

// ── Server List ───────────────────────────────────────────────
type ServerListProps = { accent: AccentType; onOpen: (s: Server) => void; onAdd: () => void };

export function ServerList({ accent, onOpen, onAdd }: ServerListProps) {
  const [servers, setServers] = useState<Server[]>([]);
  const [menu, setMenu] = useState<Server | null>(null);

  useEffect(() => { loadServers().then(setServers); }, []);

  const handleDelete = async (s: Server) => {
    const next = await removeServer(s.id);
    setServers(next);
    setMenu(null);
  };

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
        {servers.length > 0 && (
          <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 11.5, color: T.tx2, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {servers.length} paired
          </Text>
        )}
        {servers.map(s => (
          <ServerCard key={s.id} s={s} accent={accent} onOpen={onOpen} onMenu={setMenu} />
        ))}
        {servers.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
            <Icon name="server" size={40} color={T.tx2} />
            <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 16, color: T.tx1 }}>No servers yet</Text>
            <Text style={{ fontFamily: T.uiFont, fontSize: 13, color: T.tx2, textAlign: 'center', lineHeight: 20 }}>
              Tap Add to pair your first server.{'\n'}Just sshd — no extra setup required.
            </Text>
            <Btn accent={accent} icon="plus" onPress={onAdd}>Add server</Btn>
          </View>
        )}
        <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2, textAlign: 'center', marginTop: 8, lineHeight: 17.6 }}>
          Zero server deploy — just <Text style={{ color: T.tx1 }}>sshd</Text>.
        </Text>
      </ScrollView>

      <Sheet open={!!menu} onClose={() => setMenu(null)}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          <Text style={{ fontFamily: T.uiFont, fontSize: 13, color: T.tx2, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 12 }}>{menu?.name}</Text>
          <View style={{ height: 1, backgroundColor: T.borderSoft, marginVertical: 6 }} />
          <Press onPress={() => menu && handleDelete(menu)} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, height: 50, paddingHorizontal: 8 }}>
            <Icon name="trash" size={20} color={T.red} />
            <Text style={{ fontFamily: T.uiFont, fontSize: 15, color: T.red }}>Delete server</Text>
          </Press>
        </View>
      </Sheet>
    </View>
  );
}

// ── QR camera ─────────────────────────────────────────────────
type QrPayload = { h: string; p: number; u: string };

function QrCamera({ onScan, accent }: { onScan: (data: string) => void; accent: AccentType }) {
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  if (!permission) {
    return (
      <View style={{ width: 240, height: 240, borderRadius: 14, backgroundColor: T.bg2, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={accent.hue} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ alignItems: 'center', gap: 14, paddingVertical: 20 }}>
        <Icon name="qr" size={36} color={T.tx2} />
        <Text style={{ fontFamily: T.uiFont, fontSize: 13.5, color: T.tx1, textAlign: 'center', lineHeight: 22 }}>
          Camera access needed{'\n'}to scan the QR code
        </Text>
        <Btn accent={accent} onPress={requestPermission}>Allow camera</Btn>
      </View>
    );
  }

  return (
    <CameraView
      style={{ width: 240, height: 240, borderRadius: 14, overflow: 'hidden' }}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={(result: { data: string }) => {
        if (scannedRef.current) return;
        scannedRef.current = true;
        onScan(result.data);
      }}
    />
  );
}

// ── Add Server ────────────────────────────────────────────────
type AddServerProps = { accent: AccentType; onBack: () => void; onPaired: (server: Server) => void };

export function AddServer({ accent, onBack, onPaired }: AddServerProps) {
  const [mode, setMode] = useState<'qr' | 'manual'>('qr');

  // QR flow
  const [qrPayload, setQrPayload] = useState<QrPayload | null>(null);
  const [qrError, setQrError] = useState('');
  const [pairing, setPairing] = useState<'idle' | 'keygen' | 'share' | 'testing' | 'ok' | 'err'>('idle');
  const [pairError, setPairError] = useState('');
  const [keys, setKeys] = useState<{ privateKey: string; publicKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Manual flow
  const [form, setForm] = useState({ name: '', host: '', port: '22', user: '', auth: 'keystore' });
  const [cred, setCred] = useState({ password: '', privateKey: '' });
  const [testing, setTesting] = useState<null | 'run' | 'ok' | 'err'>(null);
  const [testErr, setTestErr] = useState('');
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const resetQr = () => { setQrPayload(null); setQrError(''); setPairing('idle'); setPairError(''); setKeys(null); setCopied(false); };

  // ── QR pairing ───────────────────────────────────────────────
  const handleQrScan = (raw: string) => {
    try {
      const p = JSON.parse(raw) as QrPayload;
      if (!p.h || !p.u) throw new Error('missing fields');
      setQrError('');
      setQrPayload({ h: p.h, p: Number(p.p) || 22, u: p.u });
    } catch {
      setQrError('Not a mobile-acp QR code. Make sure you\'re scanning the right code.');
    }
  };

  const handleKeygen = async () => {
    setPairing('keygen');
    setPairError('');
    try {
      if (!sshAvailable || !NativeSsh) throw new Error('Native SSH module not available. Please build a native development client.');
      const kp = await NativeSsh.generateKeyPair();
      setKeys(kp);
      setPairing('share');
    } catch (e: any) {
      setPairing('err');
      setPairError(String(e?.message ?? e));
    }
  };

  const handleTest = async () => {
    if (!qrPayload || !keys) return;
    setPairing('testing');
    setPairError('');
    try {
      const transport = await SshTransport.connect({
        host: qrPayload.h, port: qrPayload.p, user: qrPayload.u,
        auth: { type: 'key', privateKey: keys.privateKey },
      });
      await transport.exec('echo ok');
      transport.close();

      const server: Server = {
        id: `srv-${Date.now()}`,
        name: qrPayload.h,
        host: qrPayload.h,
        port: qrPayload.p,
        user: qrPayload.u,
        online: true,
        last: 'just now',
        auth: 'keystore',
      };
      await saveCredential(server.id, { type: 'key', privateKey: keys.privateKey });
      await upsertServer(server);
      setPairing('ok');
      setTimeout(() => onPaired(server), 700);
    } catch (e: any) {
      setPairing('share');
      setPairError(String(e?.message ?? e));
    }
  };

  const copyPubkey = async () => {
    if (!keys) return;
    await Clipboard.setStringAsync(keys.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const sharePubkey = () => {
    if (!keys) return;
    Share.share({ message: keys.publicKey }).catch(() => {});
  };

  // ── Manual flow ──────────────────────────────────────────────
  const testManual = async () => {
    setTesting('run'); setTestErr('');
    if (!sshAvailable) { setTimeout(() => setTesting('ok'), 1200); return; }
    try {
      const auth = form.auth === 'password'
        ? { type: 'password' as const, password: cred.password }
        : { type: 'key' as const, privateKey: cred.privateKey };
      const t = await SshTransport.connect({ host: form.host, port: Number(form.port) || 22, user: form.user, auth });
      const r = await t.exec('echo ok');
      t.close();
      if (r.stdout.trim() !== 'ok') throw new Error('unexpected: ' + r.stdout);
      setTesting('ok');
    } catch (e: any) {
      setTesting('err');
      setTestErr(String(e?.message ?? e));
    }
  };

  const saveManual = async () => {
    let privKey = cred.privateKey;
    if (form.auth === 'keystore' && sshAvailable && NativeSsh) {
      const kp = await NativeSsh.generateKeyPair();
      privKey = kp.privateKey;
    }
    const server: Server = {
      id: `srv-${Date.now()}`,
      name: form.name || form.host,
      host: form.host,
      port: Number(form.port) || 22,
      user: form.user,
      online: true,
      last: 'just now',
      auth: form.auth as 'keystore' | 'key-file' | 'password',
    };
    const storedCred = form.auth === 'password'
      ? { type: 'password' as const, password: cred.password }
      : { type: 'key' as const, privateKey: privKey };
    await saveCredential(server.id, storedCred);
    await upsertServer(server);
    onPaired(server);
  };

  const busy = pairing === 'keygen' || pairing === 'testing' || pairing === 'ok';

  return (
    <View style={{ flex: 1, backgroundColor: T.bg0 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: T.bg1 }}>
        <TopBar title="Add server" onBack={onBack} />
      </SafeAreaView>
      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
        <Seg accent={accent} value={mode} onChange={v => { setMode(v as 'qr' | 'manual'); resetQr(); }} options={[
          { value: 'qr',     label: 'Scan QR', icon: 'qr'   },
          { value: 'manual', label: 'Manual',  icon: 'edit'  },
        ]} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 18, paddingBottom: 32, gap: 12 }} showsVerticalScrollIndicator={false}>

        {/* ── QR: waiting to scan ── */}
        {mode === 'qr' && !qrPayload && (
          <>
            <Text style={{ fontFamily: T.uiFont, fontSize: 13, color: T.tx1, textAlign: 'center', lineHeight: 20.8 }}>
              Run this on your server, then point the camera at the QR code it prints.
            </Text>
            <View style={{ backgroundColor: '#0a0b0e', borderWidth: 1, borderColor: T.borderSoft, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11 }}>
              <Text style={{ fontFamily: T.monoFont, fontSize: 12, color: T.tx1 }}>
                <Text style={{ color: accent.hue }}>$ </Text>npx -y mobile-acp-setup
              </Text>
            </View>
            <View style={{ alignItems: 'center', gap: 12, marginTop: 4 }}>
              <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: T.border }}>
                <QrCamera onScan={handleQrScan} accent={accent} />
              </View>
              {qrError
                ? <Text style={{ fontFamily: T.uiFont, fontSize: 12.5, color: T.red, textAlign: 'center', maxWidth: 280 }}>{qrError}</Text>
                : <Text style={{ fontFamily: T.monoFont, fontSize: 11, color: T.tx2 }}>Code valid for 5 minutes</Text>
              }
            </View>
          </>
        )}

        {/* ── QR: scanned, confirm & pair ── */}
        {mode === 'qr' && qrPayload && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, backgroundColor: T.bg2, borderRadius: 13, borderWidth: 1, borderColor: T.border }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: accent.dim, borderWidth: 1, borderColor: accent.hue + '44', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={20} color={accent.hue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 14.5, color: T.tx0 }}>{qrPayload.u}@{qrPayload.h}</Text>
                <Text style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.tx2 }}>SSH port {qrPayload.p}</Text>
              </View>
              {!busy && (
                <Press onPress={resetQr} style={{ padding: 6 }}>
                  <Icon name="x" size={16} color={T.tx2} />
                </Press>
              )}
            </View>

            {pairError !== '' && (
              <View style={{ backgroundColor: T.bg2, borderRadius: 11, borderWidth: 1, borderColor: T.red + '44', padding: 12 }}>
                <Text style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.red }}>{pairError}</Text>
              </View>
            )}

            {/* step 1: generate key */}
            {(pairing === 'idle' || pairing === 'keygen' || pairing === 'err') && (
              <>
                <Press
                  onPress={pairing !== 'keygen' ? handleKeygen : undefined}
                  style={{
                    height: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10,
                    backgroundColor: pairing === 'keygen' ? accent.hue + 'aa' : accent.hue,
                  }}
                >
                  {pairing === 'keygen' && <ActivityIndicator size="small" color={accent.on} />}
                  <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15.5, color: accent.on }}>
                    {pairing === 'keygen' ? 'Generating key…' : pairing === 'err' ? 'Try again' : 'Generate key'}
                  </Text>
                </Press>
                <Text style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2, textAlign: 'center', lineHeight: 19 }}>
                  A new Ed25519 key is generated on this device. Next you'll paste its public half into the script waiting on your server.
                </Text>
              </>
            )}

            {/* step 2: share pubkey + test */}
            {(pairing === 'share' || pairing === 'testing' || pairing === 'ok') && keys && (
              <>
                <View style={{ backgroundColor: '#0a0b0e', borderWidth: 1, borderColor: T.borderSoft, borderRadius: 11, padding: 12, gap: 10 }}>
                  <Text style={{ fontFamily: T.uiFontMedium, fontSize: 12, color: T.tx1 }}>Public key — paste into the script on your server</Text>
                  <Text style={{ fontFamily: T.monoFont, fontSize: 10.5, color: T.tx1, lineHeight: 15 }} numberOfLines={3} ellipsizeMode="middle">
                    {keys.publicKey}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Press onPress={copyPubkey} style={{ flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, backgroundColor: T.bg3, borderWidth: 1, borderColor: copied ? T.green + '66' : T.border }}>
                      <Icon name={copied ? 'check' : 'copy'} size={15} color={copied ? T.green : T.tx1} />
                      <Text style={{ fontFamily: T.uiFontMedium, fontSize: 13, color: copied ? T.green : T.tx1 }}>{copied ? 'Copied' : 'Copy'}</Text>
                    </Press>
                    <Press onPress={sharePubkey} style={{ flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, backgroundColor: T.bg3, borderWidth: 1, borderColor: T.border }}>
                      <Icon name="share" size={15} color={T.tx1} />
                      <Text style={{ fontFamily: T.uiFontMedium, fontSize: 13, color: T.tx1 }}>Share…</Text>
                    </Press>
                  </View>
                </View>

                <Press
                  onPress={pairing === 'share' ? handleTest : undefined}
                  style={{
                    height: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10,
                    backgroundColor: pairing === 'ok' ? T.green : pairing === 'testing' ? accent.hue + 'aa' : accent.hue,
                  }}
                >
                  {pairing === 'testing' && <ActivityIndicator size="small" color={accent.on} />}
                  {pairing === 'ok' && <Icon name="check" size={18} color="#fff" />}
                  <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 15.5, color: accent.on }}>
                    {pairing === 'ok' ? 'Connected!' : pairing === 'testing' ? 'Testing SSH…' : 'Test connection'}
                  </Text>
                </Press>

                <Text style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2, textAlign: 'center', lineHeight: 19 }}>
                  Send the key to your computer any way you like (it's public), paste it into the waiting script, then test.
                </Text>
              </>
            )}
          </>
        )}

        {/* ── Manual mode ── */}
        {mode === 'manual' && (
          <>
            <Field label="Name" value={form.name} onChange={v => setF('name', v)} placeholder="my-server" accent={accent} />
            <Field label="Host" value={form.host} onChange={v => setF('host', v)} placeholder="example.com or 10.0.0.5" mono accent={accent} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Field label="Port" value={form.port} onChange={v => setF('port', v)} mono accent={accent} /></View>
              <View style={{ flex: 2 }}><Field label="Username" value={form.user} onChange={v => setF('user', v)} placeholder="root" mono accent={accent} /></View>
            </View>

            <View>
              <Text style={{ fontFamily: T.uiFontMedium, fontSize: 12, color: T.tx1, marginBottom: 8 }}>Authentication</Text>
              <View style={{ gap: 8 }}>
                {([
                  ['keystore', 'lock', 'Generate key', 'New Ed25519 key in Android Keystore'],
                  ['key-file', 'download', 'Paste private key', 'Import a .pem / id_ed25519 file'],
                  ['password', 'key', 'Password', 'Sent over the encrypted channel'],
                ] as [string, string, string, string][]).map(([val, ic, l, d]) => {
                  const on = form.auth === val;
                  return (
                    <Press key={val} onPress={() => setF('auth', val)} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 11,
                      backgroundColor: on ? accent.dim : T.bg2, borderWidth: 1, borderColor: on ? accent.hue + '66' : T.border,
                    }}>
                      <Icon name={ic} size={18} color={on ? accent.hue : T.tx2} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          <Text style={{ fontFamily: T.uiFontMedium, fontSize: 14, color: T.tx0 }}>{l}</Text>
                          {val === 'keystore' && <Text style={{ fontFamily: T.uiFontSemiBold, fontSize: 10.5, color: accent.hue }}>RECOMMENDED</Text>}
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

            {form.auth === 'password' && (
              <Field label="Password" value={cred.password} onChange={v => setCred(c => ({ ...c, password: v }))}
                placeholder="SSH password" secure accent={accent} />
            )}
            {form.auth === 'key-file' && (
              <View>
                <Text style={{ fontFamily: T.uiFontMedium, fontSize: 12, color: T.tx1, marginBottom: 8 }}>Private key (PEM)</Text>
                <TextInput
                  value={cred.privateKey}
                  onChangeText={v => setCred(c => ({ ...c, privateKey: v }))}
                  placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n…'}
                  placeholderTextColor={T.tx2}
                  multiline
                  numberOfLines={6}
                  style={{
                    backgroundColor: T.bg2, borderWidth: 1, borderColor: T.border, borderRadius: 11,
                    fontFamily: T.monoFont, fontSize: 11.5, color: T.tx0, padding: 12,
                    textAlignVertical: 'top', minHeight: 100,
                  }}
                />
              </View>
            )}
            {form.auth === 'keystore' && (
              <View style={{ backgroundColor: T.bg2, borderRadius: 11, borderWidth: 1, borderColor: T.borderSoft, padding: 12 }}>
                <Text style={{ fontFamily: T.uiFont, fontSize: 12, color: T.tx2, lineHeight: 19 }}>
                  A new Ed25519 key pair will be generated. Add the public key to{' '}
                  <Text style={{ fontFamily: T.monoFont, color: T.tx1 }}>~/.ssh/authorized_keys</Text> on the server,{' '}
                  or use the QR scan flow for automatic setup.
                </Text>
              </View>
            )}

            {testErr !== '' && (
              <Text style={{ fontFamily: T.monoFont, fontSize: 11.5, color: T.red }}>{testErr}</Text>
            )}

            {form.auth !== 'keystore' && (
              <Btn
                kind="ghost" full
                icon={testing === 'run' ? undefined : testing === 'ok' ? 'check' : 'refresh'}
                onPress={testing === 'run' ? undefined : testManual}
                style={testing === 'ok' ? { borderColor: T.green + '55' } : testing === 'err' ? { borderColor: T.red + '55' } : {}}
              >
                {testing === 'run' ? 'Testing…' : testing === 'ok' ? 'Connection OK' : testing === 'err' ? 'Connection failed' : 'Test connection'}
              </Btn>
            )}

            <Btn
              full accent={accent}
              disabled={!form.host.trim() || !form.user.trim() || (form.auth !== 'keystore' && testing !== 'ok')}
              onPress={saveManual}
            >
              Save & open
            </Btn>
          </>
        )}
      </ScrollView>
    </View>
  );
}
