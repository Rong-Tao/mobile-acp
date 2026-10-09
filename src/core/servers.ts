import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Server } from '../data/types';

const KEY = 'mobile-acp:servers';

export async function loadServers(): Promise<Server[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Server[]; } catch { return []; }
}

export async function upsertServer(server: Server): Promise<Server[]> {
  const list = await loadServers();
  const next = list.filter((s) => s.id !== server.id).concat(server);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function removeServer(id: string): Promise<Server[]> {
  const list = await loadServers();
  const next = list.filter((s) => s.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
