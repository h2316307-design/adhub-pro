import { supabase } from '@/integrations/supabase/client';

const MAX_INSTALL_DAYS = 15;

export interface BillboardDelayInfo {
  billboardId: number;
  billboardName: string;
  size: string;
  designDate: string;          // تاريخ إدخال التصميم
  expectedDate: string;        // التاريخ المتوقع للتركيب (تصميم + 15 يوم)
  actualInstallDate: string;   // تاريخ التركيب الفعلي
  delayDays: number;           // أيام التأخير
  billboardCost: number;       // تكلفة اللوحة (الإيجار)
  weight: number;              // وزن اللوحة من إجمالي العقد
  equivalentExtensionDays: number; // أيام التعويض المرجحة
  dailyValue: number;          // القيمة اليومية للوحة
  financialValue: number;      // القيمة المالية للتأخير
}

export interface BillboardContractStartDelay {
  billboardId: number;
  billboardName: string;
  size: string;
  contractStartDate: string;
  actualInstallDate: string;
  daysFromStart: number;          // أيام من بداية العقد حتى التركيب
  billboardCost: number;
  dailyValue: number;
  financialValue: number;         // القيمة المالية (أيام من البداية × القيمة اليومية)
}

export interface ContractDelayResult {
  contractNumber: number;
  totalBillboards: number;
  delayedBillboards: number;
  onTimeBillboards: number;
  totalEquivalentExtensionDays: number;
  totalFinancialValue: number;
  suggestedNewEndDate: string | null;
  originalEndDate: string | null;
  contractStartDate: string | null;
  contractDurationDays: number;
  totalContractValue: number;
  details: BillboardDelayInfo[];
  // حساب التأخير من بداية العقد
  fromContractStart: {
    totalDaysLost: number;              // إجمالي الأيام المفقودة من بداية العقد
    totalFinancialValue: number;        // القيمة المالية الإجمالية
    weightedAvgDays: number;            // المتوسط المرجح للأيام
    details: BillboardContractStartDelay[];
  };
}

export async function calculateContractDelay(contractNumber: number): Promise<ContractDelayResult | null> {
  try {
    // 1. جلب بيانات العقد
    const { data: contract } = await supabase
      .from('Contract')
      .select('Contract_Number, "Contract Date", "End Date", "Total Rent", Total, billboard_ids, billboards_data')
      .eq('Contract_Number', contractNumber)
      .single();

    if (!contract) return null;

    const startDate = contract['Contract Date'];
    const endDate = contract['End Date'];
    if (!startDate || !endDate) return null;

    const contractStart = new Date(startDate);
    const contractEnd = new Date(endDate);
    const contractDurationDays = Math.max(1, Math.ceil((contractEnd.getTime() - contractStart.getTime()) / (1000 * 60 * 60 * 24)));
    const totalContractValue = Number(contract['Total Rent'] || contract.Total || 0);

    // 2. جلب مهام التركيب المرتبطة بالعقد (فقط التركيب الجديد، بدون إعادة التركيب)
    const { data: tasks } = await supabase
      .from('installation_tasks')
      .select('id')
      .eq('contract_id', contractNumber)
      .or('task_type.is.null,task_type.neq.reinstallation');

    if (!tasks || tasks.length === 0) {
      return {
        contractNumber,
        totalBillboards: 0,
        delayedBillboards: 0,
        onTimeBillboards: 0,
        totalEquivalentExtensionDays: 0,
        totalFinancialValue: 0,
        suggestedNewEndDate: null,
        originalEndDate: endDate,
        contractStartDate: startDate,
        contractDurationDays,
        totalContractValue,
        details: [],
        fromContractStart: { totalDaysLost: 0, totalFinancialValue: 0, weightedAvgDays: 0, details: [] },
      };
    }

    const taskIds = tasks.map(t => t.id);

    // 3. جلب عناصر المهام مع تفاصيل اللوحة والتصميم
    const { data: items } = await supabase
      .from('installation_task_items')
      .select(`
        id, billboard_id, status, installation_date, selected_design_id,
        billboard:billboards!installation_task_items_billboard_id_fkey(Billboard_Name, Size, Price, Contract_Number)
      `)
      .in('task_id', taskIds);

    if (!items || items.length === 0) {
      return {
        contractNumber,
        totalBillboards: 0,
        delayedBillboards: 0,
        onTimeBillboards: 0,
        totalEquivalentExtensionDays: 0,
        totalFinancialValue: 0,
        suggestedNewEndDate: null,
        originalEndDate: endDate,
        contractStartDate: startDate,
        contractDurationDays,
        totalContractValue,
        details: [],
        fromContractStart: { totalDaysLost: 0, totalFinancialValue: 0, weightedAvgDays: 0, details: [] },
      };
    }

    // فلترة اللوحات التي تخص هذا العقد فقط
    const relevantItems = items.filter(item => {
      const bb = item.billboard as any;
      return bb?.Contract_Number === contractNumber;
    });

    // تصفية التكرارات
    const uniqueMap = new Map<number, typeof relevantItems[0]>();
    relevantItems.forEach(item => {
      if (item.billboard_id && !uniqueMap.has(item.billboard_id)) {
        uniqueMap.set(item.billboard_id, item);
      }
    });
    const uniqueItems = Array.from(uniqueMap.values());

    // 4. جلب تواريخ التصاميم
    const designIds = uniqueItems
      .map(i => i.selected_design_id)
      .filter(Boolean) as string[];

    let designDates: Record<string, string> = {};
    if (designIds.length > 0) {
      const { data: designs } = await supabase
        .from('task_designs')
        .select('id, created_at')
        .in('id', designIds);
      if (designs) {
        designs.forEach(d => { designDates[d.id] = d.created_at; });
      }
    }

    // 5. حساب تكلفة كل لوحة من billboards_data
    let billboardCosts: Record<number, number> = {};
    if (contract.billboards_data) {
      try {
        const bbs = typeof contract.billboards_data === 'string'
          ? JSON.parse(contract.billboards_data)
          : contract.billboards_data;
        if (Array.isArray(bbs)) {
          bbs.forEach((b: any) => {
            const id = Number(b.id);
            const cost = Number(b.price || b.Price || b.rent || 0);
            if (id) billboardCosts[id] = cost;
          });
        }
      } catch {}
    }

    // Fallback: توزيع متساوٍ إذا لم نجد أسعار فردية
    if (Object.keys(billboardCosts).length === 0 && uniqueItems.length > 0) {
      const perBillboard = totalContractValue / uniqueItems.length;
      uniqueItems.forEach(item => {
        if (item.billboard_id) billboardCosts[item.billboard_id] = perBillboard;
      });
    }

    // 6. حساب التأخير لكل لوحة
    const details: BillboardDelayInfo[] = [];

    for (const item of uniqueItems) {
      if (!item.selected_design_id || !item.installation_date) continue;

      const designDateStr = designDates[item.selected_design_id];
      if (!designDateStr) continue;

      const designDate = new Date(designDateStr);
      const expectedDate = new Date(designDate);
      expectedDate.setDate(expectedDate.getDate() + MAX_INSTALL_DAYS);

      const actualDate = new Date(item.installation_date);
      const delayMs = actualDate.getTime() - expectedDate.getTime();
      const delayDays = Math.max(0, Math.ceil(delayMs / (1000 * 60 * 60 * 24)));

      const bb = item.billboard as any;
      const billboardCost = billboardCosts[item.billboard_id] || Number(bb?.Price || 0);
      const weight = totalContractValue > 0 ? billboardCost / totalContractValue : 0;
      const equivalentExtensionDays = weight * delayDays;
      const dailyValue = contractDurationDays > 0 ? billboardCost / contractDurationDays : 0;
      const financialValue = dailyValue * delayDays;

      details.push({
        billboardId: item.billboard_id,
        billboardName: bb?.Billboard_Name || `لوحة ${item.billboard_id}`,
        size: bb?.Size || '',
        designDate: designDateStr,
        expectedDate: expectedDate.toISOString().slice(0, 10),
        actualInstallDate: item.installation_date,
        delayDays,
        billboardCost,
        weight,
        equivalentExtensionDays,
        dailyValue,
        financialValue,
      });
    }

    const delayedDetails = details.filter(d => d.delayDays > 0);
    const totalExtension = delayedDetails.reduce((s, d) => s + d.equivalentExtensionDays, 0);
    const totalFinancial = delayedDetails.reduce((s, d) => s + d.financialValue, 0);

    let suggestedNewEndDate: string | null = null;
    if (totalExtension > 0 && endDate) {
      const newEnd = new Date(endDate);
      newEnd.setDate(newEnd.getDate() + Math.ceil(totalExtension));
      suggestedNewEndDate = newEnd.toISOString().slice(0, 10);
    }

    // 7. حساب التأخير من بداية العقد (كم يوم من بداية العقد حتى التركيب الفعلي)
    const fromStartDetails: BillboardContractStartDelay[] = [];
    for (const item of uniqueItems) {
      if (!item.installation_date) continue;
      const actualDate = new Date(item.installation_date);
      const daysFromStart = Math.max(0, Math.ceil((actualDate.getTime() - contractStart.getTime()) / (1000 * 60 * 60 * 24)));
      const bb = item.billboard as any;
      const billboardCost = billboardCosts[item.billboard_id] || Number(bb?.Price || 0);
      const dailyValue = contractDurationDays > 0 ? billboardCost / contractDurationDays : 0;
      const financialValue = dailyValue * daysFromStart;

      fromStartDetails.push({
        billboardId: item.billboard_id,
        billboardName: bb?.Billboard_Name || `لوحة ${item.billboard_id}`,
        size: bb?.Size || '',
        contractStartDate: startDate,
        actualInstallDate: item.installation_date,
        daysFromStart,
        billboardCost,
        dailyValue,
        financialValue,
      });
    }

    const totalDaysLost = fromStartDetails.reduce((s, d) => s + d.daysFromStart, 0);
    const totalFromStartFinancial = fromStartDetails.reduce((s, d) => s + d.financialValue, 0);
    const totalCostOfFromStart = fromStartDetails.reduce((s, d) => s + d.billboardCost, 0);
    const weightedAvgDays = totalCostOfFromStart > 0
      ? fromStartDetails.reduce((s, d) => s + d.daysFromStart * (d.billboardCost / totalCostOfFromStart), 0)
      : 0;

    return {
      contractNumber,
      totalBillboards: details.length,
      delayedBillboards: delayedDetails.length,
      onTimeBillboards: details.length - delayedDetails.length,
      totalEquivalentExtensionDays: Math.round(totalExtension * 10) / 10,
      totalFinancialValue: Math.round(totalFinancial * 100) / 100,
      suggestedNewEndDate,
      originalEndDate: endDate,
      contractStartDate: startDate,
      contractDurationDays,
      totalContractValue,
      details: delayedDetails,
      fromContractStart: {
        totalDaysLost,
        totalFinancialValue: Math.round(totalFromStartFinancial * 100) / 100,
        weightedAvgDays: Math.round(weightedAvgDays * 10) / 10,
        details: fromStartDetails.filter(d => d.daysFromStart > 0),
      },
    };
  } catch (error) {
    console.error('Error calculating contract delay:', error);
    return null;
  }
}
