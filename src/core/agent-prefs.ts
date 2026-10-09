// 每个 (agent, project) 记住用户选过的会话配置（mode/model/effort…），
// 新开 thread 时自动恢复。历史 thread 用它自己存着的配置，不覆盖。

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AgentPrefs {
  /** legacy modes（没有 configOptions 的 agent）选的 modeId */
  modeId?: string;
  /** configOptions 的选择：configId → value */
  config?: Record<string, string | boolean>;
  /** 最近一次打开的 thread——重进项目时自动续上 */
  lastThreadId?: string;
}

const key = (agentId: string, cwd: string) => `mobile-acp:agentprefs:${agentId}:${cwd}`;

export async function loadAgentPrefs(agentId: string, cwd: string): Promise<AgentPrefs> {
  try {
    const raw = await AsyncStorage.getItem(key(agentId, cwd));
    return raw ? (JSON.parse(raw) as AgentPrefs) : {};
  } catch {
    return {};
  }
}

export async function saveAgentPref(
  agentId: string,
  cwd: string,
  patch: { modeId?: string; config?: Record<string, string | boolean>; lastThreadId?: string },
): Promise<void> {
  try {
    const cur = await loadAgentPrefs(agentId, cwd);
    const next: AgentPrefs = {
      ...cur,
      ...(patch.modeId != null ? { modeId: patch.modeId } : {}),
      ...(patch.config ? { config: { ...cur.config, ...patch.config } } : {}),
      ...(patch.lastThreadId != null ? { lastThreadId: patch.lastThreadId } : {}),
    };
    await AsyncStorage.setItem(key(agentId, cwd), JSON.stringify(next));
  } catch {
    // 存不上就算了，不影响会话
  }
}
