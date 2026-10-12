import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { readRemovalPages, removalRentalConflict } from '../services/removalCleanupService';

describe('removalRentalConflict', () => {
  it('retains an active billboard included in the upcoming export', () => {
    const billboard = { ID: '160', Billboard_Name: 'TR-SJ0160', Status: 'محجوز' };
    const contracts = [
      {
        Contract_Number: '1274',
        'Customer Name': 'محمد البحباح',
        'Contract Date': '2026-10-03',
        'End Date': '2027-01-01',
        'Renewal Status': 'نشط',
        billboard_ids: '160',
      },
    ];

    const result = removalRentalConflict(billboard, contracts, '2026-10-11');
    expect(result.rented).toBe(false);
    expect(result.visibleInExport).toBe(true);
    expect(result.contracts.length).toBeGreaterThan(0);
    expect(result.contracts[0].contractNumber).toBe('1274');
  });

  it('correctly identifies a billboard as NOT rented when all contracts are expired', () => {
    const billboard = { ID: '160', Billboard_Name: 'TR-SJ0160', Status: 'شاغر' };
    const contracts = [
      {
        Contract_Number: '1262',
        'Customer Name': 'طاهر جهد',
        'Contract Date': '2026-06-01',
        'End Date': '2026-09-13',
        billboard_ids: '160',
      },
    ];

    const result = removalRentalConflict(billboard, contracts, '2026-10-11');
    expect(result.rented).toBe(false);
  });
});


describe('removal export and pagination', () => {
  it('excludes a long rental outside the upcoming export', () => {
    const result = removalRentalConflict({ ID: 160 }, [{ Contract_Number: 1, billboard_ids: '160', 'Contract Date': '2026-01-01', 'End Date': '2027-12-01' }], '2026-10-12');
    expect(result.visibleInExport).toBe(false);
    expect(result.rented).toBe(true);
  });
  it('reads beyond the first database page', async () => {
    const fetchPage = vi.fn(async (from: number) => ({ data: Array.from({ length: from === 0 ? 500 : 2 }, (_, i) => from + i), error: null }));
    const rows = await readRemovalPages(fetchPage);
    expect(rows).toHaveLength(502);
    expect(fetchPage).toHaveBeenLastCalledWith(500, 999);
  });
  it('fails instead of treating a failed page as an empty result', async () => {
    await expect(readRemovalPages(async () => ({ data: null, error: new Error('read failed') }))).rejects.toThrow('read failed');
  });
});
