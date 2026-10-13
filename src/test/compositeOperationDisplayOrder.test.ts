import { describe, expect, it } from 'vitest';
import { applyOperationDisplayOrder } from '@/lib/compositeOperationDisplayOrder';

describe('manual operation display order', () => {
  it('keeps the new installation named and below all numbered operations even with manual order', () => {
    const result = applyOperationDisplayOrder([
      { key: 'reinstall', label: 'إعادة تركيب 1', isReinstall: true, sequence: 1 },
      { key: 'initial', label: 'التركيب الأول', isReinstall: false },
    ], ['reinstall', 'initial']);
    expect(result.map(row => [row.key, row.label])).toEqual([['reinstall', 'تركيب 1'], ['initial', 'تركيب جديد']]);
  });
  it('numbers the smallest existing installation sequence as 1 at the bottom when there is no initial installation', () => {
    const result = applyOperationDisplayOrder([{ key: 'sequence4', label: 'إعادة تركيب 4', isReinstall: true, sequence: 4 }, { key: 'sequence8', label: 'إعادة تركيب 8', isReinstall: true, sequence: 8 }]);
    expect(result.map(row => [row.key, row.label])).toEqual([['sequence8', 'تركيب 2'], ['sequence4', 'تركيب 1']]);
  });
  const old = { key: '1293:old', label: 'التركيب الأول', tasks: [{ id: 'a', customer_total: 100, _totalPaid: 50 }] };
  const recent = { key: '1293:new', label: 'إعادة تركيب 1', tasks: [{ id: 'b', customer_total: 200, _totalPaid: 200 }] };
  it('makes the chosen operation installation 1 without moving payments or tasks', () => {
    const ordered = applyOperationDisplayOrder([old, recent], [recent.key, old.key]);
    expect(ordered.map(row => row.label)).toEqual(['تركيب 2', 'تركيب 1']);
    expect(ordered[1].tasks).toBe(recent.tasks);
    expect(ordered[0].tasks).toBe(old.tasks);
    expect(old.label).toBe('التركيب الأول');
  });
  it('preserves default order before a manual choice and appends newly added operations', () => {
    expect(applyOperationDisplayOrder([recent, old]).map(row => [row.key, row.label])).toEqual([[recent.key, 'تركيب 2'], [old.key, 'تركيب 1']]);
    const added = { key: '1293:third', label: 'new', tasks: [] };
    expect(applyOperationDisplayOrder([added, old, recent], [recent.key, 'deleted', old.key]).map(row => row.key)).toEqual([added.key, old.key, recent.key]);
  });
});
