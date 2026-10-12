import { describe, expect, it } from 'vitest';
import { applyOperationDisplayOrder } from '@/lib/compositeOperationDisplayOrder';

describe('manual operation display order', () => {
  const old = { key: '1293:old', label: 'التركيب الأول', tasks: [{ id: 'a', customer_total: 100, _totalPaid: 50 }] };
  const recent = { key: '1293:new', label: 'إعادة تركيب 1', tasks: [{ id: 'b', customer_total: 200, _totalPaid: 200 }] };
  it('makes the chosen operation installation 1 without moving payments or tasks', () => {
    const ordered = applyOperationDisplayOrder([old, recent], [recent.key, old.key]);
    expect(ordered.map(row => row.label)).toEqual(['تركيب 1', 'تركيب 2']);
    expect(ordered[0].tasks).toBe(recent.tasks);
    expect(ordered[1].tasks).toBe(old.tasks);
    expect(old.label).toBe('التركيب الأول');
  });
  it('preserves default order before a manual choice and appends newly added operations', () => {
    expect(applyOperationDisplayOrder([old, recent])).toEqual([old, recent]);
    const added = { key: '1293:third', label: 'new', tasks: [] };
    expect(applyOperationDisplayOrder([added, old, recent], [recent.key, 'deleted', old.key]).map(row => row.key)).toEqual([recent.key, old.key, added.key]);
  });
});
