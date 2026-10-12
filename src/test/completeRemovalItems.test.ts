import { beforeEach, describe, expect, it, vi } from 'vitest';
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
import { completeRemovalItems } from '@/services/completeRemovalItems';

describe('quick removal completion', () => {
  beforeEach(() => from.mockReset());
  function fixture(status = 'pending', remaining = 0, fail = false) {
    const calls: any[] = [];
    from.mockImplementation(table => {
      const call: any = { table, filters: [] }; calls.push(call);
      const query: any = {
        update: (value: any) => { call.update = value; return query; },
        select: (_: any, options: any) => { call.count = options?.count; return query; },
        eq: (...args: any[]) => { call.filters.push(args); return query; },
        neq: (...args: any[]) => { call.filters.push(['neq', ...args]); return query; },
        in: (...args: any[]) => { call.filters.push(['in', ...args]); return query; },
        single: async () => ({ data: { status }, error: null }),
        then: (resolve: any) => Promise.resolve(call.count ? { count: remaining, error: null } : { data: [{ id: 'item' }], error: fail ? { message: 'Save failed' } : null }).then(resolve),
      };
      return query;
    });
    return calls;
  }
  it('completes selected pending items across tasks and closes each finished task', async () => {
    const calls = fixture();
    expect(await completeRemovalItems([{ id: 'a', task_id: 'one' }, { id: 'b', task_id: 'two' }], '2026-10-12')).toBe(2);
    expect(calls.filter(call => call.table === 'removal_tasks' && call.update)).toHaveLength(2);
    expect(calls.some(call => call.table === 'billboards')).toBe(false);
    for (const call of calls.filter(call => call.table === 'removal_task_items' && call.update)) expect(call.filters).toContainEqual(['status', 'pending']);
  });
  it('does not close a partially completed task', async () => {
    const calls = fixture('pending', 2);
    await completeRemovalItems([{ id: 'a', task_id: 'one' }], '2026-10-12');
    expect(calls.some(call => call.table === 'removal_tasks' && call.update)).toBe(false);
  });
  it('skips tasks cancelled since the dialog opened', async () => {
    const calls = fixture('cancelled');
    expect(await completeRemovalItems([{ id: 'a', task_id: 'one' }], '2026-10-12')).toBe(0);
    expect(calls.some(call => call.update)).toBe(false);
  });
  it('reports failed updates instead of claiming completion', async () => {
    fixture('pending', 0, true);
    await expect(completeRemovalItems([{ id: 'a', task_id: 'one' }], '2026-10-12')).rejects.toThrow('Save failed');
  });
});
