import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { installationContractIsActive, blockedInstallationBillboards } from '@/lib/installationContractSelection';
import { parseContractBillboardIds } from '@/lib/compositeTaskContractIdentity';
import { installationTeamCoversBillboard } from '@/utils/teamAssignment';
import { pickInstallationTeam, loadPreviousTeams } from '@/utils/smartTeamAssignment';
import { prepareInstallationOperationTask } from '@/services/installationOperation';
import { syncOperationStatus } from '@/services/operationBoards';

/**
 * عند إنشاء تركيب جديد: تُسحب اللوحات غير المركّبة من أوامر التركيب الأصلية لنفس العقود
 * حتى لا تظهر اللوحة في أمرين. الأمر الأصلي الذي يفرغ يُحذف مع أمر عمله، إلا إن كانت عليه
 * دفعات أو فاتورة فيبقى كما هو للمراجعة.
 */
export async function pullFromOriginalTasks(contractIds: number[], boardIds: number[], keepTaskIds: string[]) {
  const nums = contractIds.join(',');
  const { data: tasks, error } = await supabase.from('installation_tasks').select('id, task_type')
    .or(`contract_id.in.(${nums}),contract_ids.ov.{${nums}}`);
  if (error) throw error;
  const others = (tasks || []).filter((t: any) => t.task_type !== 'reinstallation' && !keepTaskIds.includes(t.id)).map((t: any) => t.id);
  if (!others.length || !boardIds.length) return 0;
  const { data: pulled, error: e2 } = await supabase.from('installation_task_items').delete()
    .in('task_id', others).in('billboard_id', boardIds).neq('status', 'completed').select('task_id');
  if (e2) throw e2;
  for (const id of [...new Set((pulled || []).map((r: any) => r.task_id as string))]) {
    const { count } = await supabase.from('installation_task_items').select('id', { count: 'exact', head: true }).eq('task_id', id);
    if (count) { await syncOperationStatus([id]); continue; }
    const { data: comps } = await supabase.from('composite_tasks').select('id, paid_amount, combined_invoice_id').eq('installation_task_id', id);
    if ((comps || []).some((c: any) => Number(c.paid_amount) > 0 || c.combined_invoice_id)) continue;
    for (const c of comps || []) {
      await supabase.from('composite_tasks').update({ installation_task_id: null, print_task_id: null, cutout_task_id: null } as any).eq('id', c.id);
      await supabase.from('composite_tasks').delete().eq('id', c.id);
    }
    await supabase.from('installation_tasks').delete().eq('id', id);
  }
  return pulled?.length || 0;
}

export interface CreateOperationInput {
  contractIds: number[];
  billboardIds: number[];
  teamAssignments: { teamId: string; billboardIds: number[] }[];
  taskType: 'installation' | 'reinstallation';
  taskName?: string;
  acceptedInactiveContractIds?: number[];
}

/**
 * إنشاء عملية تركيب/إعادة تركيب كاملة (لكل فرقة مهمة) بنفس قواعد النظام:
 * - العقود لزبون واحد، واللوحات تابعة لها، ولا لوحة محجوزة بعقد نشط آخر، ولا لوحات موقوفة.
 * - كل فرقة تغطي مدن ومقاسات لوحاتها.
 * - إعادة التركيب: رقم تشغيلي واحد للعملية كلها.
 * أوامر العمل تُنشأ تلقائياً بمشغل القاعدة عند إنشاء أمر التركيب.
 */
export async function createInstallationOperation(input: CreateOperationInput): Promise<{ taskIds: string[] }> {
  const contractIds = [...new Set(input.contractIds.map(Number).filter(Boolean))];
  let billboardIds = [...new Set(input.billboardIds.map(Number).filter(Boolean))];
  const { taskType } = input;
  if (!contractIds.length) throw new Error('اختر عقداً واحداً على الأقل');
  if (!billboardIds.length) throw new Error('اختر لوحة واحدة على الأقل');
  const mainContract = contractIds[0];
  const today = format(new Date(), 'yyyy-MM-dd');

  // 1) العقود المختارة
  const { data: chosen, error: chosenError } = await supabase.from('Contract')
    .select('Contract_Number, customer_id, "Customer Name", "Contract Date", "End Date", billboard_ids, billboards_released, "Renewal Status"')
    .in('Contract_Number', contractIds);
  if (chosenError) throw chosenError;
  if ((chosen || []).length !== contractIds.length) throw new Error('تغيرت العقود المختارة؛ أعد فتح النافذة');
  if (new Set(chosen!.map(c => c.customer_id || c['Customer Name'])).size !== 1) throw new Error('يجب أن تكون العقود لزبون واحد');
  const inactive = chosen!.filter(c => !installationContractIsActive(c, today));
  if (inactive.some(c => taskType !== 'reinstallation' || !input.acceptedInactiveContractIds?.includes(Number(c.Contract_Number)))) {
    throw new Error('توجد عقود غير نشطة لم تُراجع (مسموح فقط في إعادة التركيب بعد التأكيد)');
  }
  const owned = new Set(chosen!.flatMap(c => parseContractBillboardIds(c.billboard_ids)));
  const foreign = billboardIds.find(id => !owned.has(id));
  if (foreign != null) throw new Error(`اللوحة ${foreign} لا تنتمي للعقود المختارة`);

  // 2) تعارض مع عقود نشطة أخرى
  const active: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('Contract')
      .select('Contract_Number, "Contract Date", "End Date", billboard_ids, billboards_released, "Renewal Status"')
      .gte('End Date', today).order('Contract_Number').range(offset, offset + 499);
    if (error) throw error;
    active.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  const conflicts = blockedInstallationBillboards(active, contractIds, today);
  const conflictId = billboardIds.find(id => conflicts.has(id));
  if (conflictId != null) throw new Error(`اللوحة ${conflictId} مرتبطة بعقد نشط آخر #${conflicts.get(conflictId)}`);

  // 3) استبعاد الموقوفة
  const { data: paused, error: pausedError } = await supabase.from('paused_billboards' as any).select('billboard_id, lifecycle_state').in('contract_number', contractIds);
  if (pausedError) throw new Error('تعذر التحقق من اللوحات الموقوفة');
  const pausedSet = new Set((paused || []).filter((p: any) => p.lifecycle_state !== 'cancelled').map((p: any) => Number(p.billboard_id)));
  billboardIds = billboardIds.filter(id => !pausedSet.has(id));
  if (!billboardIds.length) throw new Error('كل اللوحات المختارة موقوفة');

  // 4) اللوحات والفرق
  const [{ data: boards, error: boardsError }, { data: teams, error: teamsError }] = await Promise.all([
    supabase.from('billboards').select('ID, Billboard_Name, Size, City, Faces_Count, friend_company_id').in('ID', billboardIds),
    supabase.from('installation_teams').select('*'),
  ]);
  if (boardsError) throw boardsError;
  if (teamsError) throw teamsError;
  if ((boards || []).length !== billboardIds.length) throw new Error('تعذر تحميل كل اللوحات المختارة');
  const boardMap = new Map(boards!.map((b: any) => [Number(b.ID), b]));
  const teamMap = new Map((teams || []).map((t: any) => [t.id, t]));

  const byTeam = new Map<string, number[]>();
  const assigned = new Set<number>();
  for (const a of input.teamAssignments) {
    const team = teamMap.get(a.teamId);
    if (!team) throw new Error('فرقة غير موجودة');
    const ids = a.billboardIds.map(Number).filter(id => billboardIds.includes(id) && !assigned.has(id));
    const bad = ids.map(id => boardMap.get(id)).filter((b: any) => !installationTeamCoversBillboard(team, b.Size, b.City, b.friend_company_id));
    if (bad.length) throw new Error(`لوحات خارج نطاق ${team.team_name}: ${bad.map((b: any) => b.Billboard_Name || b.ID).join('، ')}`);
    if (ids.length) { byTeam.set(a.teamId, [...(byTeam.get(a.teamId) || []), ...ids]); ids.forEach(id => assigned.add(id)); }
  }
  const previous = billboardIds.some(id => !assigned.has(id)) ? await loadPreviousTeams(billboardIds.filter(id => !assigned.has(id))) : new Map<number, string>();
  for (const id of billboardIds) {
    if (assigned.has(id)) continue;
    const b: any = boardMap.get(id);
    if (!b?.Size) throw new Error(`مقاس اللوحة ${id} غير محدد`);
    const team = pickInstallationTeam(teams || [], b, previous.get(id));
    if (!team) throw new Error(`لا توجد فرقة مناسبة للوحة ${b.Billboard_Name || id} (${b.City || 'مدينة غير محددة'}، ${b.Size})`);
    byTeam.set(team.id, [...(byTeam.get(team.id) || []), id]);
  }

  // 5) رقم إعادة التركيب للعملية
  let reinstallNumber: number | null = null;
  if (taskType === 'reinstallation') {
    const { data, error } = await supabase.from('installation_tasks').select('reinstallation_number')
      .in('contract_id', contractIds).eq('task_type', 'reinstallation').order('reinstallation_number', { ascending: false }).limit(1);
    if (error) throw error;
    reinstallNumber = (Number(data?.[0]?.reinstallation_number) || 0) + 1;
  }

  // 6) الإنشاء
  const operationId = crypto.randomUUID();
  const multi = contractIds.length > 1;
  const taskIds: string[] = [];
  for (const [teamId, ids] of byTeam) {
    let taskId: string | undefined;
    if (taskType === 'installation' && !multi) {
      const { data: existing } = await supabase.from('installation_tasks').select('id')
        .eq('contract_id', mainContract).eq('team_id', teamId).eq('task_type', 'installation').maybeSingle();
      taskId = existing?.id;
    }
    if (!taskId) {
      const { data: created, error } = await supabase.from('installation_tasks').insert({
        ...(await prepareInstallationOperationTask(operationId)),
        contract_id: mainContract,
        contract_ids: contractIds,
        team_id: teamId,
        status: 'pending',
        task_type: taskType,
        ...(reinstallNumber ? { reinstallation_number: reinstallNumber } : {}),
        task_name: input.taskName || null,
      } as any).select('id').single();
      if (error) throw error;
      taskId = created.id;
    }
    const { data: existingItems, error: exErr } = await supabase.from('installation_task_items').select('billboard_id').eq('task_id', taskId!);
    if (exErr) throw exErr;
    const have = new Set((existingItems || []).map((i: any) => Number(i.billboard_id)));
    const rows = ids.filter(id => !have.has(id)).map(id => ({
      task_id: taskId!, billboard_id: id, status: 'pending', faces_to_install: Number((boardMap.get(id) as any)?.Faces_Count) || 2,
    }));
    if (rows.length) {
      const { error } = await supabase.from('installation_task_items').insert(rows as any);
      if (error) throw error;
    }
    taskIds.push(taskId!);
  }
  if (taskType === 'installation') {
    const allIds = [...byTeam.values()].flat();
    await pullFromOriginalTasks(contractIds, allIds, taskIds);
  }
  return { taskIds };
}
