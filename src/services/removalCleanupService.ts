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
    readRemovalPages((from, to) => supabase.from('removal_tasks').select('id, status, amendment_number').in('status', ['pending', 'in_progress']).order('id').range(from, to)),
    readRemovalPages((from, to) => supabase.from('Contract').select('*').order('Contract_Number').range(from, to)),
    readRemovalPages((from, to) => supabase.from('billboards').select('*').order('ID').range(from, to)),
  ]);

  const active = new Set(tasks.filter(t => !t.amendment_number).map(t => t.id));
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

// ─────────────────────────────────────────────────────────────────────────────
// الفحص الذكي: معاينة قبل أي تعديل
//  1) لوحات معلقة في أوامر الإزالة لكنها لم تعد للإزالة (مؤجرة/محجوزة) ← تُقترح للاستبعاد
//  2) لوحات ظاهرة في المتاح (عقد منتهٍ، أو عقد وُضع في المتاح) ولا يوجد لها أمر إزالة ← تُقترح كأوامر جديدة
// ─────────────────────────────────────────────────────────────────────────────

export interface CleanupExcludeCandidate { id: string; task_id: string; billboard_id: number; name: string; reason: string; contracts: string }
export interface CleanupAddBoard { id: number; name: string; size: string; city: string; why: string }
export interface CleanupAddGroup { contractId: number; customerName: string; adType: string; endDate: string; shownInAvailable: boolean; boards: CleanupAddBoard[] }
export interface SmartCleanupAnalysis { checked: number; exclude: CleanupExcludeCandidate[]; add: CleanupAddGroup[] }

/** أقدم تاريخ انتهاء يُعتبر فيه العقد المنتهي حديثاً (العقود الأقدم أُزيلت غالباً قبل اعتماد النظام) */
export const REMOVAL_LOOKBACK_START = '2025-10-01';

export async function analyzeRemovalCleanup(): Promise<SmartCleanupAnalysis> {
  const [items, tasks, contracts, billboards] = await Promise.all([
    readRemovalPages((from, to) => supabase.from('removal_task_items').select('id, task_id, billboard_id, status').order('id').range(from, to)),
    readRemovalPages((from, to) => supabase.from('removal_tasks').select('id, status, contract_id, contract_ids, amendment_number').order('id').range(from, to)),
    readRemovalPages((from, to) => supabase.from('Contract').select('*').order('Contract_Number').range(from, to)),
    readRemovalPages((from, to) => supabase.from('billboards').select('*').order('ID').range(from, to)),
  ]) as any[][];

  const activeTasks = new Set(tasks.filter(t => !t.amendment_number && ['pending', 'in_progress'].includes(t.status)).map(t => t.id));
  const contractsOfTask = new Map<string, number[]>(tasks.map(t => [t.id, [t.contract_id, ...(t.contract_ids || [])].map(Number).filter(Boolean)]));
  const byId = new Map(billboards.map(b => [Number(b.ID), b]));

  // 1) الاستبعاد
  const pendingActive = items.filter(i => i.status === 'pending' && activeTasks.has(i.task_id));
  const exclude: CleanupExcludeCandidate[] = pendingActive.flatMap(item => {
    const b = byId.get(Number(item.billboard_id));
    if (!b) return [];
    const c = removalRentalConflict(b, contracts);
    return c.rented ? [{
      id: item.id, task_id: item.task_id, billboard_id: Number(item.billboard_id),
      name: b.Billboard_Name || String(item.billboard_id), reason: c.reason,
      contracts: c.contracts.map(x => `${x.contractNumber} (${x.customerName || 'عميل'})`).join('، '),
    }] : [];
  });

  // 2) الإضافة: أزواج (عقد، لوحة) لها أمر إزالة سابق بأي حالة لا تُقترح مجدداً
  const hasRemoval = new Set<string>();
  const pendingBoards = new Set<number>();
  items.forEach(i => {
    (contractsOfTask.get(i.task_id) || []).forEach(cn => hasRemoval.add(`${cn}:${Number(i.billboard_id)}`));
    if (i.status === 'pending' && tasks.some(t => t.id === i.task_id && ['pending', 'in_progress'].includes(t.status))) pendingBoards.add(Number(i.billboard_id));
  });

  const groups = new Map<number, CleanupAddGroup>();
  billboards.forEach(b => {
    const id = Number(b.ID);
    if (pendingBoards.has(id)) return;
    const st = resolveBillboardAvailability(b, contracts, { upcomingMonthsWindow: 4 });
    let target: { contractNumber: string | number; customerName: string; adType: string; endDate: string } | undefined;
    let shown = false;
    if (st.classification === 'EXPLICIT_CONTRACT_SHOW') { target = st.activeContracts[0]; shown = true; }
    else if (st.classification === 'AVAILABLE_WITHOUT_CONTRACT') {
      target = [...st.expiredContracts].filter(c => c.endDate >= REMOVAL_LOOKBACK_START).sort((a, b2) => b2.endDate.localeCompare(a.endDate))[0];
    }
    if (!target) return;
    const cn = Number(target.contractNumber);
    if (!cn || hasRemoval.has(`${cn}:${id}`)) return;
    const raw = contracts.find(c => Number(c.Contract_Number) === cn);
    if (raw?.ignore_removal_alert) return;
    if (!groups.has(cn)) groups.set(cn, { contractId: cn, customerName: target.customerName || raw?.['Customer Name'] || '—', adType: target.adType || raw?.['Ad Type'] || '', endDate: target.endDate, shownInAvailable: shown, boards: [] });
    groups.get(cn)!.boards.push({
      id, name: b.Billboard_Name || `لوحة ${id}`, size: b.Size || '', city: b.City || b.Municipality || '',
      why: shown ? 'العقد معروض في المتاح' : `انتهى العقد ${target.endDate}`,
    });
  });

  const add = [...groups.values()].sort((a, b) => Number(b.shownInAvailable) - Number(a.shownInAvailable) || b.endDate.localeCompare(a.endDate));
  return { checked: pendingActive.length, exclude, add };
}

/** حذف عناصر معلقة محددة من أوامر الإزالة النشطة، ثم حذف الأوامر التي فرغت */
export async function excludeRemovalItems(candidates: CleanupExcludeCandidate[]) {
  const removed: CleanupExcludeCandidate[] = [];
  const taskIds = [...new Set(candidates.map(c => c.task_id))];
  for (const taskId of taskIds) {
    const batch = candidates.filter(c => c.task_id === taskId);
    for (let o = 0; o < batch.length; o += 100) {
      const part = batch.slice(o, o + 100);
      const { data, error } = await supabase.from('removal_task_items').delete()
        .eq('task_id', taskId).eq('status', 'pending').in('id', part.map(c => c.id)).select('id');
      if (error) throw new Error(`توقف الاستبعاد بعد ${removed.length} عنصر: ${error.message}`);
      const del = new Set((data || []).map((r: any) => r.id));
      removed.push(...part.filter(c => del.has(c.id)));
    }
  }
  let emptyTasksRemoved = 0;
  for (const taskId of taskIds) {
    const { count, error } = await supabase.from('removal_task_items').select('id', { count: 'exact', head: true }).eq('task_id', taskId);
    if (error) throw error;
    if (count === 0) {
      const { data } = await supabase.from('removal_tasks').delete().eq('id', taskId).in('status', ['pending', 'in_progress']).select('id');
      emptyTasksRemoved += data?.length || 0;
    }
  }
  return { removed, emptyTasksRemoved };
}
