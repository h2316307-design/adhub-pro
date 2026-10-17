import { supabase } from '@/integrations/supabase/client';

type SchemaError = { code?: string; message: string };
const OPTIONAL_COLUMNS = ['company_installation_price_per_meter', 'selected_faces', 'face_dimensions'];

function missingOptionalColumn(error?: SchemaError | null): string | undefined {
  if (!error || !['42703', 'PGRST204'].includes(error.code || '')) return;
  return OPTIONAL_COLUMNS.find(column => error.message.includes(column));
}

/** Additive fields must not prevent older databases from loading existing operations. */
export async function selectInstallationColumns<T extends { error?: SchemaError | null }>(columns: string, request: (columns: string) => PromiseLike<T>): Promise<T> {
  let selection = columns;
  for (;;) {
    const result = await request(selection);
    const missing = missingOptionalColumn(result.error);
    if (!missing) return result;
    const next = selection.split(',').filter(column => column.trim().replace(/"/g, '') !== missing).join(',');
    if (next === selection) return result;
    selection = next;
  }
}

/** Keep the actual face count and money, even when the optional rate field is unavailable. */
export async function updateInstallationItemCompat(id: string, values: Record<string, any>) {
  const patch = { ...values };
  for (;;) {
    const result = await supabase.from('installation_task_items').update(patch as any).eq('id', id);
    const missing = missingOptionalColumn(result.error);
    if (!missing || !(missing in patch)) return result;
    if (missing === 'selected_faces') {
      const faces: number[] = patch.selected_faces || [];
      const representable = faces.every((face, i) => face === i + 1) || (faces.length === 1 && faces[0] === 2);
      if (!representable) throw new Error('اختيار هذه الأوجه يتطلب تطبيق تحديث الأوجه في قاعدة البيانات');
    }
    delete patch[missing];
  }
}
