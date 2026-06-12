// Stores SSH credentials in the Android Keystore-backed SecureStore.
// Key format: "ssh-cred:<serverId>"

import * as SecureStore from 'expo-secure-store';

export type StoredCred =
  | { type: 'password'; password: string }
  | { type: 'key'; privateKey: string; passphrase?: string };

const key = (serverId: string) => `ssh-cred:${serverId}`;

export async function saveCredential(serverId: string, cred: StoredCred): Promise<void> {
  await SecureStore.setItemAsync(key(serverId), JSON.stringify(cred));
}

export async function loadCredential(serverId: string): Promise<StoredCred | null> {
  const raw = await SecureStore.getItemAsync(key(serverId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredCred;
  } catch {
    return null;
  }
}

export async function deleteCredential(serverId: string): Promise<void> {
  await SecureStore.deleteItemAsync(key(serverId));
}
