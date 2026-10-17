import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ loadEditor: vi.fn(), loadOperations: vi.fn(), saveEditor: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock('@/services/compositeOperations', () => ({ loadEditor: mocks.loadEditor, loadOperations: mocks.loadOperations, saveEditor: mocks.saveEditor }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ update: mocks.update }) } }));
import { saveInstallationFaceSelection, saveInstallationFaceSelections } from '@/services/installationFaceSelection';

describe('face selection from installation cards', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.update.mockReturnValue({ eq: mocks.eq }); mocks.eq.mockResolvedValue({ error: null }); });
  const item = { id: 'item', taskId: 'install', maxFaces: 2 };
  it('saves a single back face and recalculates operation prices through the cost editor', async () => {
    const op = { tasks: [{ installation_task_id: 'install' }] };
    mocks.loadOperations.mockResolvedValue([op]);
    mocks.loadEditor.mockResolvedValue({ lines: [{ id: 'item', faces: 2, maxFaces: 2, selectedFaces: [1, 2], faceArea: 24, faceAreas: [24, 12], sizeInstallPrice: 180, faceInstallPrices: [120, 60], customerPerMeter: 10, customer: 360, company: 180 }], draft: { printEnabled: true }, discountReason: 'discount', notes: 'notes', printerId: 'printer' });
    await saveInstallationFaceSelection(item, [2]);
    const [state, lines, draft, extra] = mocks.saveEditor.mock.calls[0];
    expect(state).toBeDefined();
    expect(lines[0]).toMatchObject({ faces: 1, selectedFaces: [2], company: 60, customer: 120 });
    expect(draft).toMatchObject({ lines, printEnabled: true });
    expect(extra).toEqual({ discountReason: 'discount', notes: 'notes', printerId: 'printer' });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('saves face count and identity for standalone installation tasks', async () => {
    mocks.loadOperations.mockResolvedValue([]);
    await saveInstallationFaceSelection(item, [1]);
    expect(mocks.update).toHaveBeenCalledWith({ faces_to_install: 1, selected_faces: [1], reinstalled_faces: 'face_a' });
    expect(mocks.eq).toHaveBeenCalledWith('id', 'item');
  });
  it('rejects an empty selection without writing', async () => {
    await expect(saveInstallationFaceSelection(item, [])).rejects.toThrow('اختر وجهاً');
    expect(mocks.saveEditor).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('saves a bulk selection once for all boards in the same operation', async () => {
    mocks.loadOperations.mockResolvedValue([{ tasks: [{ installation_task_id: 'install' }] }]);
    const line = { faces: 2, maxFaces: 2, faceArea: 24, sizeInstallPrice: 100, customerPerMeter: null, customer: 100, company: 100 };
    mocks.loadEditor.mockResolvedValue({ lines: [{ ...line, id: 'item' }, { ...line, id: 'other' }], draft: {}, discountReason: '', notes: '', printerId: null });
    await saveInstallationFaceSelections([{ item, selection: [1] }, { item: { ...item, id: 'other' }, selection: [1] }]);
    expect(mocks.loadEditor).toHaveBeenCalledTimes(1);
    expect(mocks.saveEditor).toHaveBeenCalledTimes(1);
    expect(mocks.saveEditor.mock.calls[0][1].map((row: any) => row.faces)).toEqual([1, 1]);
  });
});
