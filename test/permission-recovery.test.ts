import { describe, it, expect } from 'vitest';
import { parseOrphans } from '../src/core/permission-recovery';

const req = (id: number, sid: string, tid: string) =>
  JSON.stringify({ jsonrpc: '2.0', id, method: 'session/request_permission', params: { sessionId: sid, options: [], toolCall: { toolCallId: tid } } });

describe('parseOrphans', () => {
  it('finds an unanswered request', () => {
    const scan = `5\tREQ\t${req(0, 's1', 't1')}\n9\tUPD\t"toolCallId":"tOther"\n`;
    expect(parseOrphans(scan, 's1').map((o) => o.id)).toEqual([0]);
  });
  it('ignores answered (later update), ended turn, other session', () => {
    expect(parseOrphans(`5\tREQ\t${req(0, 's1', 't1')}\n6\tUPD\t"toolCallId":"t1"\n`, 's1')).toEqual([]);
    expect(parseOrphans(`5\tREQ\t${req(0, 's1', 't1')}\n7\tSTOP\n`, 's1')).toEqual([]);
    expect(parseOrphans(`5\tREQ\t${req(0, 's2', 't1')}\n`, 's1')).toEqual([]);
  });
  it('earlier update of the same tool id does not count', () => {
    expect(parseOrphans(`2\tUPD\t"toolCallId":"t1"\n5\tREQ\t${req(3, 's1', 't1')}\n`, 's1').map((o) => o.id)).toEqual([3]);
  });
  it('survives garbage', () => {
    expect(parseOrphans('x\n5\tREQ\t{bad\n', 's1')).toEqual([]);
  });
});
