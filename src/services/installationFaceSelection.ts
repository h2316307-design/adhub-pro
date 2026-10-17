import { updateInstallationItemCompat } from './installationSchemaCompatibility';
import { supabase } from '@/integrations/supabase/client';
import { normalizeSelectedFaces } from '@/lib/billboardFaces';
import { changeCostLineFaces } from '@/lib/compositeCosts';
import { loadEditor, loadOperations, saveEditor, type OperationRow } from './compositeOperations';

type FaceSelectionRequest = { item: { id: string; taskId: string; maxFaces: number }; selection: number[] };

/** Save each operation once, including when applying a selection to many cards. */
export async function saveInstallationFaceSelections(requests: FaceSelectionRequest[], operation?: OperationRow) {
  const normalized = requests.map(({ item, selection }) => {
    const selectedFaces = normalizeSelectedFaces(selection, item.maxFaces);
    if (!selectedFaces.length) throw new Error('اختر وجهاً واحداً على الأقل');
    return { item, selectedFaces };
  });
  if (!normalized.length) return;
  const operations = operation ? [operation] : await loadOperations();
  const groups = new Map<OperationRow, typeof normalized>();
  const standalone: typeof normalized = [];
  for (const request of normalized) {
    const op = operations.find(row => row.tasks.some(task => task.installation_task_id === request.item.taskId));
    if (op) groups.set(op, [...(groups.get(op) || []), request]);
    else standalone.push(request);
  }
  for (const [op, selections] of groups) {
    const state = await loadEditor(op);
    const byId = new Map(selections.map(request => [request.item.id, request.selectedFaces]));
    if (selections.some(request => !state.lines.some(line => line.id === request.item.id))) throw new Error('لم تعد اللوحة ضمن العملية؛ حدّث القائمة');
    const lines = state.lines.map(line => byId.has(line.id) ? changeCostLineFaces(line, byId.get(line.id)!) : line);
    await saveEditor(state, lines, { ...state.draft, lines }, { discountReason: state.discountReason, notes: state.notes, printerId: state.printerId });
  }
  for (const { item, selectedFaces } of standalone) {
    const { error } = await updateInstallationItemCompat(item.id, {
      faces_to_install: selectedFaces.length, selected_faces: selectedFaces,
      reinstalled_faces: selectedFaces.length === 1 ? (selectedFaces[0] === 2 ? 'face_b' : 'face_a') : 'both',
    });
    if (error) throw error;
  }
}

export async function saveInstallationFaceSelection(item: FaceSelectionRequest['item'], selection: number[], operation?: OperationRow) {
  return saveInstallationFaceSelections([{ item, selection }], operation);
}
