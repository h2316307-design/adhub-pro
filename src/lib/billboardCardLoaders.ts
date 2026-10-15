import { supabase } from '@/integrations/supabase/client';
import { createBatchLoader, createSharedValue } from './batchLoader';

/** بيانات بطاقات اللوحات تُجلب جماعياً لكل الصفحة بدل استعلامات لكل بطاقة */

const chunk = <T,>(arr: T[], n: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const parseIds = (raw: unknown): number[] =>
  String(raw ?? '').split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);

// ── المستويات (جدول صغير ثابت) ──
export const billboardLevelsShared = createSharedValue(async () => {
  const { data } = await supabase.from('billboard_levels').select('level_code').order('level_code');
  return (data || []).map((l: any) => String(l.level_code));
});

// ── سعر الشركات لكل (مقاس، مستوى) ──
const corporatePricing = createSharedValue(async () => {
  const { data } = await supabase
    .from('pricing')
    .select('size, billboard_level, one_month, "2_months", "3_months", "6_months", full_year, one_day')
    .eq('customer_category', 'شركات');
  const map = new Map<string, number | null>();
  (data || []).forEach((d: any) => {
    const price = d.one_month || d['2_months'] || d['3_months'] || d['6_months'] || d.full_year || d.one_day || null;
    map.set(`${d.size}__${d.billboard_level}`, price);
  });
  return map;
});
export async function getCorporatePrice(size: string, level: string): Promise<number | null> {
  const map = await corporatePricing.get();
  return map.get(`${size}__${level}`) ?? null;
}

// ── العقود: الترتيب السنوي والعقد الساري لكل لوحة ──
const contractsIndex = createSharedValue(async () => {
  const today = new Date().toISOString().split('T')[0];
  const [{ data: all }, { data: active }] = await Promise.all([
    supabase.from('Contract').select('Contract_Number, "Contract Date"').order('"Contract Date"', { ascending: true }),
    supabase
      .from('Contract')
      .select('Contract_Number, "Customer Name", "Ad Type", "Contract Date", "End Date", billboard_ids, Total, "Total Rent", Discount, billboard_prices, design_data')
      .gte('End Date', today)
      .order('"End Date"', { ascending: false }),
  ]);
  const byYear = new Map<number, any[]>();
  (all || []).forEach((c: any) => {
    const d = new Date(c['Contract Date']);
    if (isNaN(d.getTime())) return;
    const y = d.getFullYear();
    byYear.set(y, [...(byYear.get(y) || []), c]);
  });
  const activeByBillboard = new Map<number, any>();
  (active || []).forEach((c: any) => {
    parseIds(c.billboard_ids).forEach(id => { if (!activeByBillboard.has(id)) activeByBillboard.set(id, c); });
  });
  return { byYear, activeByBillboard };
}, 60_000);

export async function getYearlyContractCode(contractNumber: unknown, startDate: unknown): Promise<string> {
  if (!contractNumber || !startDate) return '';
  const d = new Date(String(startDate));
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const yearShort = String(year).slice(-2);
  const { byYear } = await contractsIndex.get();
  const list = byYear.get(year) || [];
  const index = list.findIndex((c: any) => String(c.Contract_Number) === String(contractNumber));
  return index !== -1 ? `${index + 1}/${yearShort}` : yearShort;
}

export async function getActiveContract(billboardId: number): Promise<any | null> {
  const { activeByBillboard } = await contractsIndex.get();
  return activeByBillboard.get(Number(billboardId)) ?? null;
}

// ── آخر تمديد لكل لوحة ──
export const latestExtensionLoader = createBatchLoader<number, any>(async ids => {
  const map = new Map<number, any>();
  for (const part of chunk(ids, 150)) {
    const { data } = await supabase
      .from('billboard_extensions')
      .select('billboard_id, extension_days, old_end_date, new_end_date, reason, extension_type, created_at')
      .in('billboard_id', part)
      .order('created_at', { ascending: false });
    (data || []).forEach((r: any) => { if (!map.has(Number(r.billboard_id))) map.set(Number(r.billboard_id), r); });
  }
  return map;
});

// ── آخر بند أمر تركيب لكل لوحة مع تصميمها ومهمتها وفرقتها ──
export const latestTaskLoader = createBatchLoader<number, any>(async ids => {
  const map = new Map<number, any>();
  const items: any[] = [];
  for (const part of chunk(ids, 150)) {
    const { data } = await supabase
      .from('installation_task_items')
      .select('*')
      .in('billboard_id', part)
      .order('created_at', { ascending: false });
    items.push(...(data || []));
  }
  const latest = new Map<number, any>();
  items.forEach(it => { if (!latest.has(Number(it.billboard_id))) latest.set(Number(it.billboard_id), it); });
  const designIds = [...new Set([...latest.values()].map(i => i.selected_design_id).filter(Boolean))];
  const taskIds = [...new Set([...latest.values()].map(i => i.task_id).filter(Boolean))];
  const [designs, tasks] = await Promise.all([
    designIds.length ? supabase.from('task_designs').select('*').in('id', designIds) : Promise.resolve({ data: [] as any[] }),
    taskIds.length ? supabase.from('installation_tasks').select('*, team:installation_teams(*)').in('id', taskIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const designById = new Map((designs.data || []).map((d: any) => [d.id, d]));
  const taskById = new Map((tasks.data || []).map((t: any) => [t.id, t]));
  latest.forEach((it, bb) => {
    map.set(bb, { ...it, selected_design: it.selected_design_id ? designById.get(it.selected_design_id) ?? null : null, task: it.task_id ? taskById.get(it.task_id) ?? null : null });
  });
  return map;
});

// ── تصميم مشترك من أوامر تركيب نفس العقد ──
export const contractSharedDesignLoader = createBatchLoader<number, string>(async contracts => {
  const map = new Map<number, string>();
  const { data: tasks } = await supabase.from('installation_tasks').select('id, contract_id').in('contract_id', contracts);
  const taskContract = new Map((tasks || []).map((t: any) => [t.id, Number(t.contract_id)]));
  const taskIds = [...taskContract.keys()];
  for (const part of chunk(taskIds, 150)) {
    const { data: items } = await supabase
      .from('installation_task_items')
      .select('task_id, design_face_a')
      .in('task_id', part)
      .not('design_face_a', 'is', null)
      .not('design_face_a', 'eq', '');
    (items || []).forEach((it: any) => {
      const c = taskContract.get(it.task_id);
      if (c && !map.has(c)) map.set(c, it.design_face_a);
    });
  }
  return map;
});

/** بعد تعديل لوحة: امسح بياناتها المخزنة لتُجلب من جديد */
export function invalidateBillboardCard(billboardId?: number) {
  latestTaskLoader.clear(billboardId);
  latestExtensionLoader.clear(billboardId);
  contractsIndex.clear();
  corporatePricing.clear();
}
