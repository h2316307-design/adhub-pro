import { supabase } from '@/integrations/supabase/client';
import { sharesInstallationOperation } from '@/lib/installationTransferIdentity';

export async function loadInstallationOperationBillboards(taskId: string, customerContractIds: number[] = []): Promise<number[]> {
  const { data: source, error } = await supabase.from('installation_tasks').select('*').eq('id', taskId).single();
  if (error) throw error;
  const taskIds = new Set<string>([taskId]);
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('installation_tasks').select('*').neq('status', 'cancelled').order('id').range(offset, offset + 499);
    if (error) throw error;
    for (const task of data || []) if (sharesInstallationOperation(source, task, customerContractIds)) taskIds.add(task.id);
    if (!data || data.length < 500) break;
  }
  const boardIds = new Set<number>();
  const ids = [...taskIds];
  for (let start = 0; start < ids.length; start += 50) {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('installation_task_items').select('billboard_id').in('task_id', ids.slice(start, start + 50)).order('id').range(offset, offset + 499);
      if (error) throw error;
      for (const item of data || []) boardIds.add(Number(item.billboard_id));
      if (!data || data.length < 500) break;
    }
  }
  return [...boardIds];
}
