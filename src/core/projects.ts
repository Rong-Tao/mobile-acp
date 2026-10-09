// 每台服务器保存的 working directory 列表（只存路径，状态每次连上实时取）。

import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (serverId: string) => `mobile-acp:projects_${serverId}`;

export async function loadProjectPaths(serverId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(key(serverId));
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export async function addProjectPath(serverId: string, path: string): Promise<string[]> {
  const list = await loadProjectPaths(serverId);
  const next = list.includes(path) ? list : list.concat(path);
  await AsyncStorage.setItem(key(serverId), JSON.stringify(next));
  return next;
}

export async function removeProjectPath(serverId: string, path: string): Promise<string[]> {
  const next = (await loadProjectPaths(serverId)).filter((p) => p !== path);
  await AsyncStorage.setItem(key(serverId), JSON.stringify(next));
  return next;
}
