// 持久化 agent 进程：spawn 时用 setsid 脱离 SSH 会话,stdin 走 FIFO(0<> 自持写端
// 永不 EOF),stdout 追加到 log。SSH 断了(手机锁屏/冻结/杀进程)adapter 照常把
// turn 跑完;重连时复用同一进程,tail 从文件末尾接流,二次 initialize + session/load
// 续上。已在真实服务器验证(断连中途杀 ssh → turn 完成 → 重连回放拿到结果)。
//
// 服务器只需 POSIX sh + mkfifo + setsid;缺了就回退为普通一次性 spawn。

import { shq } from './remote';

/** 简单字符串 hash → hex,用作每个 (agent, project) 的目录名 */
function slug(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/**
 * 把 agent 启动命令包装成"持久进程 + 可重连通道"。
 * cwd 必须已是绝对路径(LiveAgent.connect 已解析 ~)。
 */
export function persistentSpawnCmd(agentCmd: string, cwd: string, agentId: string): string {
  const key = slug(`${agentId}:${cwd}`);
  // 注意:
  // - inner sh -c 用 "$0" 传 DIR,避免引号嵌套
  // - cat 必须在前台(后台 job 的 stdin 会被重定向到 /dev/null)
  // - tail -c 0 从末尾接流,不回放旧 JSON-RPC(旧 response 会污染新连接)
  return `
DIR="$HOME/.mobile-acp/agents/${key}"
if command -v setsid >/dev/null 2>&1 && command -v mkfifo >/dev/null 2>&1; then
  mkdir -p "$DIR"
  [ -p "$DIR/in" ] || mkfifo "$DIR/in"
  if [ -f "$DIR/pid" ] && kill -0 "$(cat "$DIR/pid")" 2>/dev/null; then :; else
    rm -f "$DIR/pid"; : > "$DIR/out.log"
    ( cd ${shq(cwd)} && setsid sh -c 'echo $$ > "$0/pid"; exec ${agentCmd} 0<> "$0/in" >> "$0/out.log" 2>> "$0/err.log"' "$DIR" & )
    i=0; while [ ! -s "$DIR/pid" ] && [ "$i" -lt 30 ]; do sleep 0.1; i=$((i+1)); done
  fi
  tail -c 0 -f "$DIR/out.log" &
  exec cat > "$DIR/in"
else
  cd ${shq(cwd)} && exec ${agentCmd}
fi`;
}
