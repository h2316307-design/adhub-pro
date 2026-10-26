import { supabase } from '@/integrations/supabase/client';
import { splitCampaignFaces, hasAmbiguousInstalledFace } from '@/lib/campaignInstallationFaces';
import { parseContractBillboardIds } from '@/lib/compositeTaskContractIdentity';
import { createInstallationOperation, type CreateOperationInput } from './installationOperationCreate';

export async function loadCampaignFacePlan(contractIds: number[], boardIds: number[]) {
  if (!contractIds.length || !boardIds.length) return [];
  const { data: contracts, error } = await supabase.from('Contract').select('Contract_Number,billboard_ids,include_installation_in_price,installation_enabled,include_print_in_billboard_price,print_cost_enabled').in('Contract_Number',contractIds);
  if (error) throw error;
  const nums = contractIds.join(',');
  const tasks: any[] = [];
  for (let offset=0;;offset+=500) {
    const r = await supabase.from('installation_tasks').select('id,contract_id,contract_ids,status').or(`contract_id.in.(${nums}),contract_ids.ov.{${nums}}`).order('id').range(offset,offset+499);
    if(r.error) throw r.error; tasks.push(...(r.data || [])); if((r.data?.length || 0)<500) break;
  }
  const items: any[] = []; const boards: any[] = [];
  for(let start=0;start<boardIds.length;start+=100) {
    const r=await supabase.from('billboards').select('*').in('ID',boardIds.slice(start,start+100));
    if(r.error) throw r.error; boards.push(...(r.data || []));
  }
  for(let start=0;start<tasks.length;start+=100) {
    for(let offset=0;;offset+=500) {
      const r=await supabase.from('installation_task_items').select('*').in('task_id',tasks.slice(start,start+100).map(t=>t.id)).order('id').range(offset,offset+499);
      if(r.error) throw r.error; items.push(...(r.data || [])); if((r.data?.length || 0)<500) break;
    }
  }
  if(boards.length !== new Set(boardIds).size) throw new Error('تعذر تحميل جميع لوحات الحملة');
  return boards.map(board => {
    const owners=(contracts || []).filter(c=>parseContractBillboardIds(c.billboard_ids).includes(Number(board.ID)));
    if(owners.length !== 1) throw new Error(`اللوحة ${board.Billboard_Name || board.ID} تحتاج تحديد عقد واحد للحملة`);
    const contract=owners[0]; const cn=Number(contract.Contract_Number);
    const ownTasks=new Set(tasks.filter(t=>t.status !== 'cancelled' && (Number(t.contract_id)===cn || (t.contract_ids || []).map(Number).includes(cn))).map(t=>t.id));
    const history=items.filter(i=>ownTasks.has(i.task_id) && Number(i.billboard_id)===Number(board.ID));
    if(history.some(i=>hasAmbiguousInstalledFace(i,board))) throw new Error(`سجل اللوحة ${board.Billboard_Name || board.ID} يذكر وجهاً مركّباً دون تحديده؛ حدّد الوجه في مهمة التركيب السابقة أولاً`);
    const split=splitCampaignFaces(board,history);
    const includedInstallation=contract.include_installation_in_price === true || contract.installation_enabled !== false;
    const includedPrint=contract.include_print_in_billboard_price === true || ['true','1'].includes(String(contract.print_cost_enabled));
    return { board, contractNumber: cn, ...split, includedInstallation, includedPrint };
  });
}

export async function createCampaignInstallation(input: CreateOperationInput) {
  // Reload evidence at submission, rather than trusting a stale preview.
  const plan=await loadCampaignFacePlan(input.contractIds,input.billboardIds);
  const groups = new Map<string, { phase: 'first' | 'repeat'; lines: typeof plan }>();
  for (const row of plan) {
    for (const phase of ['first','repeat'] as const) {
      if (!row[phase].length) continue;
      const key = phase === 'repeat' ? phase : `${phase}:${row.includedInstallation}:${row.includedPrint}`;
      if (!groups.has(key)) groups.set(key, { phase, lines: [] });
      groups.get(key)!.lines.push(row);
    }
  }
  const batches: CreateOperationInput[] = [...groups.values()].map(({ phase, lines }) => {
    const noExtra=phase==='first' && lines.every(row=>row.includedInstallation && row.includedPrint);
    const label=noExtra ? 'بدون تكلفة إضافية · مشمول بالعقد' : 'بتكلفة إضافية';
    return { ...input, contractIds:[...new Set(lines.map(row=>row.contractNumber))], billboardIds:lines.map(row=>Number(row.board.ID)),
      faceSelections:Object.fromEntries(lines.map(row=>[Number(row.board.ID),row[phase]])), independent:true,
      taskType:phase==='first' ? 'installation' : 'reinstallation', taskName:`${input.taskName || 'حملة'} · ${label}` };
  });
  // Validate every section before creating the first task (ownership, conflicts, teams, pauses).
  for (const batch of batches) await createInstallationOperation({ ...batch, validateOnly: true });
  const taskIds: string[]=[];
  try {
    for (const batch of batches) {
      const result=await createInstallationOperation(batch);
      taskIds.push(...result.taskIds);
    }
  } catch (error) {
    throw new Error(`${(error as Error).message}${taskIds.length ? ` — تم إنشاء ${taskIds.length} مهمة قبل التعثر؛ راجع الحملة قبل إعادة الإنشاء` : ''}`);
  }
  return { taskIds };
}
