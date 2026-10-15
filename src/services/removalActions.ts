/**
 * عمليات أوامر الإزالة (منقولة من الصفحة القديمة كدوال مستقلة):
 * توثيق الإزالة، التراجع، الحذف، حذف المكررات، تجميع الأوامر، إعادة التوزيع الذكي.
 */
import { supabase } from '@/integrations/supabase/client';
import { findOptimalTeamForRemoval } from '@/utils/teamAssignment';
import type { RemovalTask, RemovalTaskItem } from '@/hooks/useRemovalData';

/** توثيق إزالة لوحات: تُعلَّم مكتملة، تُفرَّغ اللوحات من بيانات العقد، ويُغلق كل أمر اكتملت لوحاته */
export async function completeRemovalItems(itemIds: string[], date: string, notes: string | null, allItems: RemovalTaskItem[]) {
  if (!itemIds.length || !date) throw new Error('حدد تاريخ الإزالة واللوحات المطلوبة');
  const chosen = new Set(itemIds);
  const items = allItems.filter(i => chosen.has(i.id));
  const now = new Date().toISOString();
  const { error } = await supabase.from('removal_task_items').upsert(items.map(i => ({
    id: i.id, task_id: i.task_id, billboard_id: i.billboard_id, status: 'completed' as const,
    completed_at: now, removal_date: date, notes: notes || null,
  })));
  if (error) throw error;

  const taskIds = [...new Set(items.map(i => i.task_id))];
  for (const tId of taskIds) {
    const left = allItems.filter(i => i.task_id === tId && i.status !== 'completed' && !chosen.has(i.id));
    if (!left.length) await supabase.from('removal_tasks').update({ status: 'completed' }).eq('id', tId);
  }

  const boardIds = [...new Set(items.map(i => i.billboard_id).filter(Boolean))];
  if (boardIds.length) {
    await supabase.from('billboards').update({
      Status: 'available', Contract_Number: null, Customer_Name: null, Ad_Type: null, Rent_Start_Date: null, Rent_End_Date: null,
    } as any).in('ID', boardIds);
  }
  return items.length;
}

export async function undoRemovalItem(item: RemovalTaskItem) {
  const { error } = await supabase.from('removal_task_items')
    .update({ status: 'pending', completed_at: null, removal_date: null, notes: null, removed_image_url: null }).eq('id', item.id);
  if (error) throw error;
  await supabase.from('removal_tasks').update({ status: 'pending' }).eq('id', item.task_id);
}

export async function deleteRemovalTasks(taskIds: string[]) {
  for (const id of taskIds) {
    const { error: e1 } = await supabase.from('removal_task_items').delete().eq('task_id', id);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from('removal_tasks').delete().eq('id', id);
    if (e2) throw e2;
  }
}

async function deleteEmptyTasks(taskIds: string[]) {
  for (const tId of taskIds) {
    const { count } = await supabase.from('removal_task_items').select('id', { count: 'exact', head: true }).eq('task_id', tId);
    if (count === 0) await supabase.from('removal_tasks').delete().eq('id', tId);
  }
}

/** حذف تكرار اللوحة الواحدة في أكثر من أمر معلق، مع إبقاء أمر الفرقة ذات الأولوية الأعلى */
export async function cleanupDuplicateRemovals(allItems: RemovalTaskItem[], tasks: RemovalTask[], teams: any[]) {
  const pending = allItems.filter(i => i.status === 'pending');
  if (!pending.length) throw new Error('لا توجد عناصر معلقة');
  const teamOf: Record<string, string> = {}; tasks.forEach(t => { teamOf[t.id] = t.team_id; });
  const prio: Record<string, number> = {}; teams.forEach(t => { prio[t.id] = t.priority || 0; });
  const byBoard: Record<number, RemovalTaskItem[]> = {};
  pending.forEach(i => { (byBoard[i.billboard_id] ||= []).push(i); });
  const del: string[] = [];
  Object.values(byBoard).forEach(list => {
    if (list.length <= 1) return;
    list.sort((a, b) => (prio[teamOf[b.task_id] || ''] || 0) - (prio[teamOf[a.task_id] || ''] || 0));
    list.slice(1).forEach(i => del.push(i.id));
  });
  if (!del.length) throw new Error('لا توجد لوحات مكررة');
  const { error } = await supabase.from('removal_task_items').delete().in('id', del);
  if (error) throw error;
  await deleteEmptyTasks([...new Set(pending.filter(i => del.includes(i.id)).map(i => i.task_id))]);
  return del.length;
}

/** دمج أوامر نفس الفرقة ونفس العقد في أمر واحد */
export async function mergeRemovalTasks(tasks: RemovalTask[]) {
  const groups: Record<string, RemovalTask[]> = {};
  tasks.forEach(t => { (groups[`${t.team_id}_${t.contract_id}`] ||= []).push(t); });
  let merged = 0;
  for (const list of Object.values(groups)) {
    if (list.length <= 1) continue;
    const ids = list.slice(1).map(t => t.id);
    await supabase.from('removal_task_items').update({ task_id: list[0].id }).in('task_id', ids);
    await supabase.from('removal_tasks').delete().in('id', ids);
    merged += ids.length;
  }
  return merged;
}

/** نقل كل لوحة معلقة إلى الفرقة الأنسب (المقاس والمدينة) */
export async function redistributeRemovals(allItems: RemovalTaskItem[], tasks: RemovalTask[], billboardById: Record<string | number, any>) {
  const pending = allItems.filter(i => i.status !== 'completed');
  if (!pending.length) throw new Error('لا توجد عناصر معلقة لإعادة التوزيع');
  const { data: teamsData } = await supabase.from('installation_teams').select('*');
  if (!teamsData?.length) throw new Error('لا توجد فرق معرفة في النظام');
  const local = [...tasks];
  let moved = 0;
  for (const item of pending) {
    const bb = billboardById[item.billboard_id];
    if (!bb) continue;
    const best = findOptimalTeamForRemoval(teamsData, bb.Size, bb.City, bb.friend_company_id);
    const parent = local.find(t => t.id === item.task_id);
    if (!best || !parent?.contract_id || parent.team_id === best.id) continue;
    let target = local.find(t => t.team_id === best.id && t.contract_id === parent.contract_id);
    if (!target) {
      const { data } = await supabase.from('removal_tasks')
        .insert({ contract_id: parent.contract_id, contract_ids: [parent.contract_id], team_id: best.id, status: 'pending' }).select().single();
      if (data) { target = data as any; local.push(target!); }
    }
    if (target) { await supabase.from('removal_task_items').update({ task_id: target.id }).eq('id', item.id); moved++; }
  }
  await deleteEmptyTasks(tasks.map(t => t.id));
  return moved;
}

/** إنشاء أوامر إزالة لعقود محددة: لوحات كل عقد تُوزَّع على الفرقة الأنسب (أمر لكل فرقة) */
export async function createRemovalForContracts(selection: { contractId: number; boardIds: number[] }[], teams: any[]) {
  const { getLatestInstallationSnapshot } = await import('@/hooks/useRemovalData');
  const allIds = [...new Set(selection.flatMap(s => s.boardIds))];
  if (!allIds.length) throw new Error('لم تُحدَّد أي لوحة');
  const { data: boards, error } = await supabase.from('billboards').select('ID, Size, City, friend_company_id').in('ID', allIds);
  if (error) throw error;
  const byId = new Map((boards || []).map((b: any) => [Number(b.ID), b]));
  let created = 0, added = 0, skipped = 0;
  for (const s of selection) {
    const perTeam = new Map<string, number[]>();
    for (const id of s.boardIds) {
      const b = byId.get(id);
      const team = b && findOptimalTeamForRemoval(teams, b.Size, b.City, b.friend_company_id);
      if (!team) { skipped++; continue; }
      perTeam.set(team.id, [...(perTeam.get(team.id) || []), id]);
    }
    for (const [teamId, ids] of perTeam) {
      const { data: task, error: e1 } = await supabase.from('removal_tasks')
        .insert({ contract_id: s.contractId, contract_ids: [s.contractId], team_id: teamId, status: 'pending' }).select().single();
      if (e1 || !task) throw e1 || new Error('تعذر إنشاء أمر الإزالة');
      created++;
      for (const id of ids) {
        const snap = await getLatestInstallationSnapshot([s.contractId], id);
        const { error: e2 } = await supabase.from('removal_task_items').insert({
          task_id: task.id, billboard_id: id, status: 'pending',
          design_face_a: snap?.design_face_a || null, design_face_b: snap?.design_face_b || null, installed_image_url: snap?.installed_image_url || null,
        });
        if (e2) throw e2;
        added++;
      }
    }
  }
  return { created, added, skipped };
}
