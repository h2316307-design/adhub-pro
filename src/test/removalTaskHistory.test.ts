import { describe, expect, it } from 'vitest';
import { excludePreviouslyCompletedRemovals } from '../services/removalTaskHistory';

describe('removal completion history', () => {
  const tasks = [
    { id: 'old', contract_id: 10, status: 'completed' },
    { id: 'duplicate', contract_id: 10, status: 'pending' },
    { id: 'new', contract_id: 11, status: 'pending' },
  ];
  it('keeps completion history and new contracts, but excludes duplicate pending work', () => {
    const items = [
      { task_id: 'old', billboard_id: 160, status: 'completed' },
      { task_id: 'duplicate', billboard_id: 160, status: 'pending' },
      { task_id: 'new', billboard_id: 160, status: 'pending' },
    ];
    expect(excludePreviouslyCompletedRemovals(items, tasks)).toEqual([items[0], items[2]]);
  });
  it('respects completed parent tasks even with stale pending items', () => {
    const items = [{ task_id: 'old', billboard_id: 160, status: 'pending' }, { task_id: 'duplicate', billboard_id: 160, status: 'pending' }];
    expect(excludePreviouslyCompletedRemovals(items, tasks)).toEqual([]);
  });
  it('keeps unfinished billboards from a partially completed contract', () => {
    const items = [{ task_id: 'duplicate', billboard_id: 160, status: 'completed' }, { task_id: 'duplicate', billboard_id: 161, status: 'pending' }];
    expect(excludePreviouslyCompletedRemovals(items, tasks)).toEqual(items);
  });
});

it('keeps new amendment removal work separate from completed original work', () => {
  const tasks = [{ id: 'original', contract_id: 10, status: 'completed' }, { id: 'amendment', contract_id: 10, amendment_number: 2, status: 'pending' }];
  const items = [{ task_id: 'original', billboard_id: 1, status: 'completed' }, { task_id: 'amendment', billboard_id: 1, status: 'pending' }];
  expect(excludePreviouslyCompletedRemovals(items, tasks)).toEqual(items);
});
