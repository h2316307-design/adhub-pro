/**
 * Smart Billboard Service
 * يتعامل مع إضافة/حذف اللوحات من العقود بذكاء
 * يشمل: مهام التركيب، الطباعة، القص المجسمات، الإزالة
 */

import { supabase } from '@/integrations/supabase/client';

export interface LinkedTaskInfo {
  type: 'installation' | 'print' | 'cutout' | 'removal';
  label: string;
  taskId: string;
  itemCount: number;
  status: string;
}

export interface BillboardTaskLinks {
  billboardId: number;
  billboardName: string;
  linkedTasks: LinkedTaskInfo[];
}

/**
 * يفحص اللوحات المراد حذفها ويجلب المهام المرتبطة بها
 */
export async function checkLinkedTasks(
  contractNumber: number,
  billboardIds: number[]
): Promise<BillboardTaskLinks[]> {
  if (billboardIds.length === 0) return [];

  const results: BillboardTaskLinks[] = [];

  // جلب أسماء اللوحات
  const { data: billboards } = await supabase
    .from('billboards')
    .select('ID, Billboard_Name')
    .in('ID', billboardIds);

  const nameMap = new Map<number, string>();
  (billboards || []).forEach(b => nameMap.set(b.ID, b.Billboard_Name || `لوحة ${b.ID}`));

  // 1. مهام التركيب
  const { data: installTasks } = await supabase
    .from('installation_tasks')
    .select('id, status')
    .eq('contract_id', contractNumber);

  const installTaskIds = (installTasks || []).map(t => t.id);
  let installItems: any[] = [];
  if (installTaskIds.length > 0) {
    const { data } = await supabase
      .from('installation_task_items')
      .select('id, billboard_id, task_id, status')
      .in('task_id', installTaskIds)
      .in('billboard_id', billboardIds);
    installItems = data || [];
  }

  // 2. مهام الطباعة
  const { data: printTasks } = await supabase
    .from('print_tasks')
    .select('id, status, contract_id')
    .eq('contract_id', contractNumber);

  const printTaskIds = (printTasks || []).map(t => t.id);
  let printItems: any[] = [];
  if (printTaskIds.length > 0) {
    const { data } = await supabase
      .from('print_task_items')
      .select('id, billboard_id, task_id, status')
      .in('task_id', printTaskIds)
      .in('billboard_id', billboardIds);
    printItems = data || [];
  }

  // 3. مهام القص المجسمات
  const { data: cutoutTasks } = await supabase
    .from('cutout_tasks')
    .select('id, status, contract_id')
    .eq('contract_id', contractNumber);

  const cutoutTaskIds = (cutoutTasks || []).map(t => t.id);
  let cutoutItems: any[] = [];
  if (cutoutTaskIds.length > 0) {
    const { data } = await supabase
      .from('cutout_task_items')
      .select('id, billboard_id, task_id, status')
      .in('task_id', cutoutTaskIds)
      .in('billboard_id', billboardIds);
    cutoutItems = data || [];
  }

  // 4. مهام الإزالة
  const { data: removalTasks } = await supabase
    .from('removal_tasks')
    .select('id, status, contract_id')
    .eq('contract_id', contractNumber);

  const removalTaskIds = (removalTasks || []).map(t => t.id);
  let removalItems: any[] = [];
  if (removalTaskIds.length > 0) {
    const { data } = await supabase
      .from('removal_task_items')
      .select('id, billboard_id, task_id, status')
      .in('task_id', removalTaskIds)
      .in('billboard_id', billboardIds);
    removalItems = data || [];
  }

  // بناء النتائج لكل لوحة
  for (const bbId of billboardIds) {
    const linkedTasks: LinkedTaskInfo[] = [];

    const bbInstallItems = installItems.filter(i => i.billboard_id === bbId);
    if (bbInstallItems.length > 0) {
      const taskStatus = installTasks?.find(t => t.id === bbInstallItems[0].task_id)?.status || 'pending';
      linkedTasks.push({
        type: 'installation',
        label: 'مهمة تركيب',
        taskId: bbInstallItems[0].task_id,
        itemCount: bbInstallItems.length,
        status: taskStatus,
      });
    }

    const bbPrintItems = printItems.filter(i => i.billboard_id === bbId);
    if (bbPrintItems.length > 0) {
      const taskStatus = printTasks?.find(t => t.id === bbPrintItems[0].task_id)?.status || 'pending';
      linkedTasks.push({
        type: 'print',
        label: 'مهمة طباعة',
        taskId: bbPrintItems[0].task_id,
        itemCount: bbPrintItems.length,
        status: taskStatus,
      });
    }

    const bbCutoutItems = cutoutItems.filter(i => i.billboard_id === bbId);
    if (bbCutoutItems.length > 0) {
      const taskStatus = cutoutTasks?.find(t => t.id === bbCutoutItems[0].task_id)?.status || 'pending';
      linkedTasks.push({
        type: 'cutout',
        label: 'مهمة قص مجسم',
        taskId: bbCutoutItems[0].task_id,
        itemCount: bbCutoutItems.length,
        status: taskStatus,
      });
    }

    const bbRemovalItems = removalItems.filter(i => i.billboard_id === bbId);
    if (bbRemovalItems.length > 0) {
      const taskStatus = removalTasks?.find(t => t.id === bbRemovalItems[0].task_id)?.status || 'pending';
      linkedTasks.push({
        type: 'removal',
        label: 'مهمة إزالة',
        taskId: bbRemovalItems[0].task_id,
        itemCount: bbRemovalItems.length,
        status: taskStatus,
      });
    }

    if (linkedTasks.length > 0) {
      results.push({
        billboardId: bbId,
        billboardName: nameMap.get(bbId) || `لوحة ${bbId}`,
        linkedTasks,
      });
    }
  }

  return results;
}

export interface TaskTypeSelection {
  installation: boolean;
  print: boolean;
  cutout: boolean;
  removal: boolean;
}

/**
 * حذف اللوحة من المهام المختارة فقط
 */
export async function removeBillboardFromAllTasks(
  contractNumber: number,
  billboardId: number,
  selectedTypes?: TaskTypeSelection
): Promise<void> {
  const types = selectedTypes || { installation: true, print: true, cutout: true, removal: true };

  if (types.installation) {
    const { data: installTasks } = await supabase
      .from('installation_tasks')
      .select('id')
      .eq('contract_id', contractNumber);
    if (installTasks?.length) {
      await supabase
        .from('installation_task_items')
        .delete()
        .in('task_id', installTasks.map(t => t.id))
        .eq('billboard_id', billboardId);
    }
  }

  if (types.print) {
    const { data: printTasks } = await supabase
      .from('print_tasks')
      .select('id')
      .eq('contract_id', contractNumber);
    if (printTasks?.length) {
      await supabase
        .from('print_task_items')
        .delete()
        .in('task_id', printTasks.map(t => t.id))
        .eq('billboard_id', billboardId);
    }
  }

  if (types.cutout) {
    const { data: cutoutTasks } = await supabase
      .from('cutout_tasks')
      .select('id')
      .eq('contract_id', contractNumber);
    if (cutoutTasks?.length) {
      await supabase
        .from('cutout_task_items')
        .delete()
        .in('task_id', cutoutTasks.map(t => t.id))
        .eq('billboard_id', billboardId);
    }
  }

  if (types.removal) {
    const { data: removalTasks } = await supabase
      .from('removal_tasks')
      .select('id')
      .eq('contract_id', contractNumber);
    if (removalTasks?.length) {
      await supabase
        .from('removal_task_items')
        .delete()
        .in('task_id', removalTasks.map(t => t.id))
        .eq('billboard_id', billboardId);
    }
  }
}

/**
 * إضافة لوحة جديدة للمهام الموجودة مع نسخ الأسعار من نفس المقاس
 */
export async function addBillboardToExistingTasks(
  contractNumber: number,
  billboardId: number
): Promise<{ added: string[] }> {
  const added: string[] = [];

  // جلب معلومات اللوحة
  const { data: billboard } = await supabase
    .from('billboards')
    .select('ID, Size, Faces_Count, has_cutout')
    .eq('ID', billboardId)
    .single();
  
  if (!billboard) return { added };

  const billboardSize = billboard.Size;

  // 1. إضافة لمهام التركيب (trigger auto_create_installation_tasks يتكفل بهذا عادة)
  // لكن نتحقق إن كانت موجودة
  const { data: installTasks } = await supabase
    .from('installation_tasks')
    .select('id, team_id')
    .eq('contract_id', contractNumber);

  if (installTasks?.length) {
    // جلب الفريق المناسب حسب المقاس
    const { data: teams } = await supabase
      .from('installation_teams')
      .select('id, sizes, cities');

    let targetTaskId: string | null = null;
    
    for (const task of installTasks) {
      const team = teams?.find(t => t.id === task.team_id);
      if (team?.sizes?.includes(billboardSize)) {
        targetTaskId = task.id;
        break;
      }
    }

    if (targetTaskId) {
      // تحقق من عدم الوجود مسبقاً
      const { data: existing } = await supabase
        .from('installation_task_items')
        .select('id')
        .eq('task_id', targetTaskId)
        .eq('billboard_id', billboardId);

      if (!existing?.length) {
        await supabase
          .from('installation_task_items')
          .insert({ task_id: targetTaskId, billboard_id: billboardId, status: 'pending' });
        added.push('مهمة التركيب');
      }
    }
  }

  // 2. إضافة لمهام الطباعة
  const { data: printTasks } = await supabase
    .from('print_tasks')
    .select('id')
    .eq('contract_id', contractNumber);

  if (printTasks?.length) {
    const printTaskId = printTasks[0].id;

    // جلب أسعار من لوحة أخت بنفس المقاس
    const { data: siblingItems } = await supabase
      .from('print_task_items')
      .select('unit_cost, customer_unit_cost, width, height, area, quantity, faces_count, customer_unit_price, printer_unit_cost')
      .eq('task_id', printTaskId)
      .limit(100);

    // البحث عن لوحة بنفس المقاس
    let siblingPricing: any = null;
    if (siblingItems?.length) {
      // جلب مقاسات اللوحات الموجودة
      const siblingBbIds = await supabase
        .from('print_task_items')
        .select('billboard_id')
        .eq('task_id', printTaskId);
      
      if (siblingBbIds.data?.length) {
        const { data: siblingBillboards } = await supabase
          .from('billboards')
          .select('ID, Size')
          .in('ID', siblingBbIds.data.map(s => s.billboard_id!).filter(Boolean));

        const sameSizeBbId = siblingBillboards?.find(b => b.Size === billboardSize)?.ID;
        if (sameSizeBbId) {
          const { data: sameSizeItem } = await supabase
            .from('print_task_items')
            .select('*')
            .eq('task_id', printTaskId)
            .eq('billboard_id', sameSizeBbId)
            .limit(1)
            .single();
          if (sameSizeItem) siblingPricing = sameSizeItem;
        }

        // إذا لم نجد نفس المقاس، نأخذ أي أخت
        if (!siblingPricing && siblingItems.length > 0) {
          siblingPricing = siblingItems[0];
        }
      }
    }

    // تحقق من عدم الوجود
    const { data: existingPrint } = await supabase
      .from('print_task_items')
      .select('id')
      .eq('task_id', printTaskId)
      .eq('billboard_id', billboardId);

    if (!existingPrint?.length) {
      const newItem: any = {
        task_id: printTaskId,
        billboard_id: billboardId,
        status: 'pending',
        quantity: 1,
        faces_count: billboard.Faces_Count || 1,
      };

      if (siblingPricing) {
        newItem.unit_cost = siblingPricing.unit_cost;
        newItem.customer_unit_cost = siblingPricing.customer_unit_cost;
        newItem.customer_unit_price = siblingPricing.customer_unit_price;
        newItem.printer_unit_cost = siblingPricing.printer_unit_cost;
        newItem.width = siblingPricing.width;
        newItem.height = siblingPricing.height;
        newItem.area = siblingPricing.area;
        newItem.total_cost = siblingPricing.unit_cost ? (siblingPricing.unit_cost * (siblingPricing.area || 1)) : 0;
        newItem.customer_total_cost = siblingPricing.customer_unit_cost ? (siblingPricing.customer_unit_cost * (siblingPricing.area || 1)) : 0;
        newItem.customer_total_price = siblingPricing.customer_unit_price ? (siblingPricing.customer_unit_price * (siblingPricing.area || 1)) : 0;
      }

      await supabase.from('print_task_items').insert(newItem);
      added.push('مهمة الطباعة');
    }
  }

  // 3. إضافة لمهام القص المجسمات (فقط إذا اللوحة فيها مجسم)
  if (billboard.has_cutout) {
    const { data: cutoutTasks } = await supabase
      .from('cutout_tasks')
      .select('id')
      .eq('contract_id', contractNumber);

    if (cutoutTasks?.length) {
      const cutoutTaskId = cutoutTasks[0].id;

      // جلب أسعار من أخت بنفس المقاس
      const { data: siblingCutout } = await supabase
        .from('cutout_task_items')
        .select('*')
        .eq('task_id', cutoutTaskId)
        .limit(1)
        .single();

      const { data: existingCutout } = await supabase
        .from('cutout_task_items')
        .select('id')
        .eq('task_id', cutoutTaskId)
        .eq('billboard_id', billboardId);

      if (!existingCutout?.length) {
        const newCutoutItem: any = {
          task_id: cutoutTaskId,
          billboard_id: billboardId,
          status: 'pending',
          quantity: 1,
          unit_cost: siblingCutout?.unit_cost || 0,
          total_cost: siblingCutout?.unit_cost || 0,
        };

        await supabase.from('cutout_task_items').insert(newCutoutItem);
        added.push('مهمة القص');
      }
    }
  }

  return { added };
}
