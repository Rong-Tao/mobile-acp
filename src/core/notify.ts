// 本地通知：app 在后台时提醒 "agent 跑完了 / 要权限"。
// 只在原生平台生效(web 冒烟/测试环境全部 no-op)。
// 限制:进程被系统冻结后 JS 不运行,通知发不出——配合持久化 agent,
// 冻结期间任务照跑,回到 app 时 session/load 能看到完整结果。

import { AppState, Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

async function mod(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  if (cached !== undefined) return cached;
  try {
    cached = await import('expo-notifications');
  } catch {
    cached = null;
  }
  return cached;
}

/** app 启动时调一次：申请权限 + Android channel */
export async function setupNotifications(): Promise<void> {
  const N = await mod();
  if (!N) return;
  try {
    await N.requestPermissionsAsync();
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', {
        name: 'Agent activity',
        importance: N.AndroidImportance.HIGH,
      });
    }
    N.setNotificationHandler({
      // 前台时不弹(界面本身就在展示进度)
      handleNotification: async () => ({
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      }),
    });
  } catch {
    // 权限被拒/模块缺失都不影响主流程
  }
}

/** 仅当 app 不在前台时发本地通知 */
export function notifyIfBackground(title: string, body?: string): void {
  if (AppState.currentState === 'active') return;
  void (async () => {
    const N = await mod();
    if (!N) return;
    try {
      await N.scheduleNotificationAsync({
        content: { title, body: body || undefined },
        trigger: null,
      });
    } catch {}
  })();
}
