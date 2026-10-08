// Reusable SSH identities (profiles): a username + Ed25519 keypair that
// persists across pairings. Metadata lives in AsyncStorage; the private key
// goes to the Android Keystore-backed SecureStore, like credentials.ts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type Identity = {
  id: string;
  user: string;        // SSH username this profile logs in as
  publicKey: string;   // OpenSSH authorized_keys line
  createdAt: number;
};

const KEY = 'mobile-acp:identities';
// SecureStore keys may only contain [A-Za-z0-9._-] — no colons
const credKey = (id: string) => `ssh-identity_${id}`;

export async function loadIdentities(): Promise<Identity[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Identity[]; } catch { return []; }
}

export async function createIdentity(
  user: string,
  keys: { privateKey: string; publicKey: string },
): Promise<Identity> {
  const identity: Identity = {
    id: `id-${Date.now()}`,
    user,
    publicKey: keys.publicKey,
    createdAt: Date.now(),
  };
  await SecureStore.setItemAsync(credKey(identity.id), keys.privateKey);
  const list = await loadIdentities();
  await AsyncStorage.setItem(KEY, JSON.stringify(list.concat(identity)));
  return identity;
}

export async function loadIdentityKey(id: string): Promise<string | null> {
  return SecureStore.getItemAsync(credKey(id));
}

export async function removeIdentity(id: string): Promise<Identity[]> {
  const next = (await loadIdentities()).filter(i => i.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  await SecureStore.deleteItemAsync(credKey(id));
  return next;
}
