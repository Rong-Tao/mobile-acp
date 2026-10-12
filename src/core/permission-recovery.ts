// 持久 agent 重连后找回"孤儿权限请求"。
// 权限请求（agent→client, session/request_permission）只发给当时那条连接；
// SSH 断开重连后新连接收不到，agent 却还在等 → turn 永远 working。
// 但请求全文都在 out.log 里：扫日志找出"发出后既没有 tool_call_update、
// 也没有 turn 结束(stopReason)"的请求，重新渲染成权限卡片；用户点选后
// 直接往 agent stdin 写同 id 的 response 即可（agent 按 id 匹配）。

import type { RequestPermissionRequest } from '@agentclientprotocol/sdk';

export interface OrphanPermission {
  /** JSON-RPC 请求 id（agent 进程内自增） */
  id: number | string;
  request: RequestPermissionRequest;
}

/** 在服务器上把 out.log 压缩成 `行号\tKIND[\t数据]`，避免把几 MB 日志拉回手机 */
export function scanLogCmd(dirExpr: string): string {
  return `awk '
/session\\/request_permission/ { print NR "\\tREQ\\t" $0; next }
/"stopReason"/ { print NR "\\tSTOP"; next }
/"sessionUpdate":"tool_call_update"/ { match($0, /"toolCallId":"[^"]*"/); print NR "\\tUPD\\t" substr($0, RSTART, RLENGTH) }
' ${dirExpr}/out.log 2>/dev/null`;
}

/** 解析 scanLogCmd 的输出；只返回属于 sessionId 且仍未决的请求 */
export function parseOrphans(scan: string, sessionId: string): OrphanPermission[] {
  const reqs: { line: number; id: number | string; request: RequestPermissionRequest }[] = [];
  const updates: { line: number; toolCallId: string }[] = [];
  let lastStop = 0;
  for (const raw of scan.split('\n')) {
    const [n, kind, ...rest] = raw.split('\t');
    const line = Number(n);
    if (!line) continue;
    if (kind === 'STOP') lastStop = line;
    else if (kind === 'UPD') {
      const m = /"toolCallId":"([^"]*)"/.exec(rest.join('\t'));
      if (m) updates.push({ line, toolCallId: m[1] });
    } else if (kind === 'REQ') {
      try {
        const msg = JSON.parse(rest.join('\t'));
        if (msg.method === 'session/request_permission' && msg.params?.sessionId === sessionId) {
          reqs.push({ line, id: msg.id, request: msg.params });
        }
      } catch {
        // 截断/损坏的行：当作没有
      }
    }
  }
  return reqs
    .filter((r) => r.line > lastStop)
    .filter((r) => {
      const tid = r.request.toolCall?.toolCallId;
      return !updates.some((u) => u.line > r.line && u.toolCallId === tid);
    })
    .map(({ id, request }) => ({ id, request }));
}
