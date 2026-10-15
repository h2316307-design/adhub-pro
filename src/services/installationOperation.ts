import { supabase } from '@/integrations/supabase/client';

const PREFIX = 'installation_operation_task:';

/** Explicit creation identity, independent of contracts, teams and status.
 * Uses the existing settings store so older databases need no schema upgrade.
 */
export async function loadInstallationOperationIds(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('system_settings')
      .select('setting_key, setting_value').like('setting_key', `${PREFIX}%`)
      .order('setting_key').range(offset, offset + 499);
    if (error) throw error;
    for (const row of data || []) {
      if (row.setting_value) result[row.setting_key.slice(PREFIX.length)] = row.setting_value;
    }
    if (!data || data.length < 500) break;
  }
  return result;
}

export async function linkInstallationOperation(operationId: string, taskIds: string[]): Promise<void> {
  const { error } = await supabase.from('system_settings').upsert([...new Set(taskIds)].map(id => ({
    setting_key: PREFIX + id,
    setting_value: operationId,
    updated_at: new Date().toISOString(),
  })), { onConflict: 'setting_key' });
  if (error) throw error;
}

/** Register before inserting. A failed insert leaves only an unused identity,
 * never a visible team task missing its operation membership.
 */
export async function prepareInstallationOperationTask(operationId: string): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await linkInstallationOperation(operationId, [id]);
  return { id };
}
