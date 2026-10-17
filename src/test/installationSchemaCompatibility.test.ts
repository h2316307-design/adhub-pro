import { beforeEach, describe, expect, it, vi } from 'vitest';
const query = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ update: query.update }) } }));
import { selectInstallationColumns, updateInstallationItemCompat } from '@/services/installationSchemaCompatibility';

describe('installation faces on older database schemas', () => {
  beforeEach(() => { vi.resetAllMocks(); query.update.mockImplementation(patch => { query.eq.mockName(JSON.stringify(patch)); return { eq: query.eq }; }); });
  it('loads operation items when the optional company rate column is absent', async () => {
    const read = vi.fn().mockResolvedValueOnce({ data: null, error: { code: '42703', message: 'column installation_task_items.company_installation_price_per_meter does not exist' } })
      .mockResolvedValueOnce({ data: [{ id: 'item', faces_to_install: 1 }], error: null });
    const result = await selectInstallationColumns<{ data: unknown; error: any }>('id, faces_to_install, company_installation_price_per_meter', read);
    expect(result.data).toEqual([{ id: 'item', faces_to_install: 1 }]);
    expect(read.mock.calls[1][0]).toBe('id, faces_to_install');
  });
  it('retains face count and calculated costs when saving without the rate column', async () => {
    query.eq.mockResolvedValueOnce({ error: { code: 'PGRST204', message: "Could not find the 'company_installation_price_per_meter' column" } }).mockResolvedValueOnce({ error: null });
    const values = { faces_to_install: 2, selected_faces: [1, 2], company_installation_cost: 300, customer_installation_cost: 600, company_installation_price_per_meter: 5 };
    const result = await updateInstallationItemCompat('item', values);
    expect(result.error).toBeNull();
    expect(query.update.mock.calls[1][0]).toEqual({ faces_to_install: 2, selected_faces: [1, 2], company_installation_cost: 300, customer_installation_cost: 600 });
    expect(values.company_installation_price_per_meter).toBe(5);
  });
  it('can preserve a legacy back-only choice when selected_faces is absent', async () => {
    query.eq.mockResolvedValueOnce({ error: { code: 'PGRST204', message: 'selected_faces column not found' } }).mockResolvedValueOnce({ error: null });
    await updateInstallationItemCompat('item', { faces_to_install: 1, selected_faces: [2], reinstalled_faces: 'face_b' });
    expect(query.update.mock.calls[1][0]).toEqual({ faces_to_install: 1, reinstalled_faces: 'face_b' });
  });
  it('does not silently substitute different physical faces on an older schema', async () => {
    query.eq.mockResolvedValue({ error: { code: '42703', message: 'selected_faces does not exist' } });
    await expect(updateInstallationItemCompat('item', { faces_to_install: 2, selected_faces: [1, 3] })).rejects.toThrow('تحديث الأوجه');
    expect(query.update).toHaveBeenCalledTimes(1);
  });
  it('returns permission errors without dropping fields or retrying', async () => {
    const error = { code: '42501', message: 'permission denied' };
    query.eq.mockResolvedValue({ error });
    expect((await updateInstallationItemCompat('item', { company_installation_price_per_meter: 5 })).error).toEqual(error);
    expect(query.update).toHaveBeenCalledTimes(1);
  });
});
