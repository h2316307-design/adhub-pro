import { supabase } from '@/integrations/supabase/client';
import { checkIsAvailableOrUpcomingForExport, resolveBillboardAvailability } from './billboardAvailabilityService';

export async function readRemovalPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await fetchPage(from, from + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}

export function removalRentalConflict(billboard: any, contracts: any[], referenceDate?: string) {
  const state = resolveBillboardAvailability(billboard, contracts, { referenceDate, upcomingMonthsWindow: 4 });
  const visibleInExport = checkIsAvailableOrUpcomingForExport(billboard, contracts, 4, referenceDate);
  return {
    rented: !visibleInExport,
    contracts: state.activeContracts,
    reason: state.reason,
    visibleInExport,
  };
}

export async function cleanupRentedRemovalItems() {
  const [items, tasks, contracts, billboards] = await Promise.all([
    readRemovalPages((from, to) => supabase.from('removal_task_items').select('id, task_id, billboard_id').eq('status', 'pending').order('id').range(from, to)),
    readRemovalPages((from, to) => supabase.from('removal_tasks').select('id, status').in('status', ['pending', 'in_progress']).order('id').range(from, to)),
    readRemovalPages((from, to) => supabase.from('Contract').select('*').order('Contract_Number').range(from, to)),
    readRemovalPages((from, to) => supabase.from('billboards').select('*').order('ID').range(from, to)),
  ]);

  const active = new Set(tasks.map(t => t.id));
  const byId = new Map(billboards.map(b => [Number(b.ID), b]));

  const candidates = items.filter(item => active.has(item.task_id)).flatMap(item => {
    const billboard = byId.get(Number(item.billboard_id));
    if (!billboard) return [];
    const conflict = removalRentalConflict(billboard, contracts);
    return conflict.rented ? [{
      ...item,
      reason: conflict.reason,
      name: billboard.Billboard_Name || String(item.billboard_id),
      contracts: conflict.contracts.map(c => `${c.contractNumber} (${c.customerName || 'عميل'})`).join('، ')
    }] : [];
  });

  const removed: typeof candidates = [];
  const affectedTaskIds = new Set(candidates.map(c => c.task_id));

  // Scope every write to pending items in a still-active task. Completed evidence is retained.
  for (const taskId of affectedTaskIds) {
    const { data: task, error: taskError } = await supabase.from('removal_tasks').select('status').eq('id', taskId).maybeSingle();
    if (taskError) throw taskError;
    if (!task || !['pending', 'in_progress'].includes(task.status)) continue;

    const taskItems = candidates.filter(c => c.task_id === taskId);
    for (let offset = 0; offset < taskItems.length; offset += 100) {
      const batch = taskItems.slice(offset, offset + 100);
      const { data, error } = await supabase.from('removal_task_items').delete()
        .eq('task_id', taskId).eq('status', 'pending').in('id', batch.map(c => c.id)).select('id');
      if (error) throw new Error(`توقف التنظيف بعد استبعاد ${removed.length} عنصر: ${error.message}`);
      const deleted = new Set((data || []).map(row => row.id));
      removed.push(...batch.filter(c => deleted.has(c.id)));
    }
  }

  // Also clean up any active tasks that now have 0 items left
  let emptyTasksRemoved = 0;
  for (const taskId of affectedTaskIds) {
    const { count, error } = await supabase
      .from('removal_task_items')
      .select('id', { count: 'exact', head: true })
      .eq('task_id', taskId);

    if (error) throw error;
    if (count === 0) {
      const { data: deletedTasks, error: deleteError } = await supabase.from('removal_tasks').delete().eq('id', taskId).in('status', ['pending', 'in_progress']).select('id');
      if (deleteError) throw deleteError;
      emptyTasksRemoved += deletedTasks?.length || 0;
    }
  }

  return { checked: items.filter(item => active.has(item.task_id)).length, removed, emptyTasksRemoved };
}
