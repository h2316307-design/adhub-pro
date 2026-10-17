import { describe, expect, it } from 'vitest';
import { bucketize, breakdown, weekStart, monthKey } from '@/services/operationsInventory';

describe('operations inventory grouping', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-10-17')).toBe('2026-10-12'); // سبت → اثنين
    expect(weekStart('2026-10-12')).toBe('2026-10-12'); // اثنين نفسه
    expect(weekStart('2026-10-18')).toBe('2026-10-12'); // أحد
  });

  it('groups prints and installs by day, week and month', () => {
    const installs = [
      { date: '2026-10-12', teamId: 't1', teamName: 'A', contractId: null, customerName: "", adType: "" },
      { date: '2026-10-13', teamId: 't1', teamName: 'A', contractId: null, customerName: "", adType: "" },
      { date: '2026-09-30', teamId: 't2', teamName: 'B', contractId: null, customerName: "", adType: "" },
    ];
    const prints = [
      { date: '2026-10-12', printerId: 'p1', printerName: 'P', area: 10, contractId: null, customerName: "", adType: "" },
      { date: '2026-10-13', printerId: 'p1', printerName: 'P', area: 5, contractId: null, customerName: "", adType: "" },
    ];
    const days = bucketize(installs, prints, 'day');
    expect(days.find(b => b.key === '2026-10-13')).toMatchObject({ area: 5, installs: 1 });
    const weeks = bucketize(installs, prints, 'week');
    expect(weeks.find(b => b.key === '2026-10-12')).toMatchObject({ area: 15, installs: 2 });
    const months = bucketize(installs, prints, 'month');
    expect(months.find(b => b.key === monthKey('2026-10-01'))).toMatchObject({ area: 15, installs: 2 });
  });

  it('breaks down by team and printer inside a range', () => {
    const installs = [
      { date: '2026-10-12', teamId: 't1', teamName: 'A', contractId: null, customerName: "", adType: "" },
      { date: '2026-10-12', teamId: 't1', teamName: 'A', contractId: null, customerName: "", adType: "" },
      { date: '2026-11-01', teamId: 't1', teamName: 'A', contractId: null, customerName: "", adType: "" },
    ];
    const prints = [{ date: '2026-10-12', printerId: 'p1', printerName: 'P', area: 7, contractId: null, customerName: "", adType: "" }];
    const d = breakdown(installs, prints, '2026-10-01', '2026-10-31');
    expect(d.teams).toEqual([{ id: 't1', name: 'A', area: 0, installs: 2 }]);
    expect(d.printers).toEqual([{ id: 'p1', name: 'P', area: 7, installs: 0 }]);
  });
});
