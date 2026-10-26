import { expect, it } from 'vitest';
import { buildRemovalOperations } from '@/services/removalOperations';
it('separates original removal work and each amendment, grouping teams within the same amendment', () => {
  const tasks = [
    { id: 'original', contract_id: 1, team_id: 'a', status: 'pending', created_at: '2026-10-26' },
    { id: 'first', contract_id: 1, team_id: 'a', amendment_number: 1, status: 'pending', created_at: '2026-10-26' },
    { id: 'first-b', contract_id: 1, team_id: 'b', amendment_number: 1, status: 'pending', created_at: '2026-10-26' },
    { id: 'second', contract_id: 1, team_id: 'a', amendment_number: 2, status: 'pending', created_at: '2026-10-26' },
  ] as any;
  const items = Object.fromEntries(tasks.map((t: any, i: number) => [t.id, [{ id: String(i), task_id: t.id, billboard_id: i + 1, status: 'pending' }]]));
  const result = buildRemovalOperations(tasks, items, {}, {}, {});
  expect(result).toHaveLength(3);
  expect(new Set(result.map(r => r.key)).size).toBe(3);
  expect(result.find(r => r.amendmentNumber === 1)?.boards).toBe(2);
  expect(result.find(r => !r.amendmentNumber)?.key).toBe('c:1');
});
