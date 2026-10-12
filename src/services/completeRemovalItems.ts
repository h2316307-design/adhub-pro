import { supabase } from '@/integrations/supabase/client';

export async function completeRemovalItems(items: { id: string; task_id: string }[], removalDate: string) {
  if (!items.length || !/^\d{4}-\d{2}-\d{2}$/.test(removalDate)) throw new Error('حدد اللوحات وتاريخ الإزالة');
  let completed = 0;
  for (const taskId of new Set(items.map(item => item.task_id))) {
    const { data: task, error: taskError } = await supabase.from('removal_tasks').select('status').eq('id', taskId).single();
    if (taskError) throw taskError;
    if (!['pending', 'in_progress'].includes(task.status)) continue;
    const ids = [...new Set(items.filter(item => item.task_id === taskId).map(item => item.id))];
    for (let offset = 0; offset < ids.length; offset += 100) {
      const { data, error } = await supabase.from('removal_task_items').update({
        status: 'completed', completed_at: new Date().toISOString(), removal_date: removalDate,
      }).eq('task_id', taskId).eq('status', 'pending').in('id', ids.slice(offset, offset + 100)).select('id');
      if (error) throw new Error(`تم حفظ ${completed} لوحة ثم توقف الحفظ: ${error.message}`);
      completed += data?.length || 0;
    }
    const { count, error: countError } = await supabase.from('removal_task_items').select('id', { count: 'exact', head: true }).eq('task_id', taskId).neq('status', 'completed');
    if (countError) throw countError;
    if (count === 0) {
      const { error } = await supabase.from('removal_tasks').update({ status: 'completed' }).eq('id', taskId).in('status', ['pending', 'in_progress']);
      if (error) throw error;
    }
  }
  // Completion documents physical removal; it must not clear a newer rental contract.
  return completed;
}
