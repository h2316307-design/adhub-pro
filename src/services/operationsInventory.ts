import { supabase } from '@/integrations/supabase/client';

/** صف خام: تركيب مكتمل للوحة واحدة */
export interface InstallRecord {
  date: string; teamId: string | null; teamName: string;
  contractId: number | null; customerName: string; adType: string;
}
/** صف خام: أمر طباعة بمساحته ومطبعته */
export interface PrintRecord {
  date: string; printerId: string | null; printerName: string; area: number;
  contractId: number | null; customerName: string; adType: string;
}

/** صف تفصيلي مجمّع: تاريخ + عقد + جهة (فرقة أو مطبعة) */
export interface InstallDetail { date: string; teamName: string; contractId: number | null; customerName: string; adType: string; installs: number }
export interface PrintDetail { date: string; printerName: string; contractId: number | null; customerName: string; adType: string; area: number }

export interface InventoryBucket { key: string; label: string; area: number; installs: number }
export interface InventoryBreakdown { id: string; name: string; area: number; installs: number }

const pageSize = 1000;

/** المطبعة الافتراضية لأوامر الطباعة: مطبعة الفارس الذهبي */
export const DEFAULT_PRINTER_NAME = 'الفارس الذهبي';
export const defaultPrinterId = (printers: { id: string; name: string | null }[]): string | null =>
  printers.find(p => (p.name || '').includes('الفارس'))?.id ?? null;

/** يجلب كل الصفوف بصفحات حتى لا يُقتطع الجرد عند 1000 صف */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

/** تاريخ محلي بصيغة YYYY-MM-DD (يتجنّب انزياح المنطقة الزمنية لتواريخ اليوم) */
export const localDay = (value: string | Date): string => {
  const d = typeof value === 'string' ? new Date(value) : value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** أول يوم (الاثنين) من الأسبوع الذي يقع فيه التاريخ */
export const weekStart = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const shift = (date.getDay() + 6) % 7; // الاثنين = 0
  date.setDate(date.getDate() - shift);
  return localDay(date);
};

export const monthKey = (day: string): string => day.slice(0, 7);

/** بيانات العقود (الزبون ونوع الإعلان) لمجموعة أرقام عقود */
async function loadContractInfo(ids: number[]): Promise<Map<number, { customer: string; adType: string }>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = new Map<number, { customer: string; adType: string }>();
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await supabase.from("Contract")
      .select("\"Contract_Number\", \"Customer Name\", \"Ad Type\"")
      .in("Contract_Number", unique.slice(i, i + 200));
    if (error) throw new Error(error.message);
    (data || []).forEach((c: any) => out.set(Number(c.Contract_Number), { customer: c["Customer Name"] || "", adType: c["Ad Type"] || "" }));
  }
  return out;
}

export async function loadInstallRecords(): Promise<InstallRecord[]> {
  const items = await fetchAll<any>((from, to) => supabase
    .from("installation_task_items")
    .select("task_id, installation_date, completed_at")
    .eq("status", "completed")
    .range(from, to));
  const taskIds = [...new Set(items.map(i => i.task_id).filter(Boolean))];
  const tasks: any[] = [];
  for (let i = 0; i < taskIds.length; i += 200) {
    const { data, error } = await supabase.from("installation_tasks")
      .select("id, team_id, contract_id, contract_ids, installation_teams(team_name)")
      .in("id", taskIds.slice(i, i + 200));
    if (error) throw new Error(error.message);
    tasks.push(...(data || []));
  }
  const taskMap = new Map(tasks.map((t: any) => [t.id, t]));
  const contractOf = (t: any): number | null => Number(t?.contract_id || (t?.contract_ids || [])[0]) || null;
  const info = await loadContractInfo(tasks.map(contractOf).filter((n): n is number => n !== null));
  const out: InstallRecord[] = [];
  for (const it of items) {
    const raw = it.installation_date || it.completed_at;
    if (!raw) continue;
    const day = String(raw).length === 10 ? String(raw) : localDay(String(raw));
    const t: any = taskMap.get(it.task_id);
    const contractId = contractOf(t);
    const c = contractId ? info.get(contractId) : undefined;
    out.push({
      date: day, teamId: t?.team_id ?? null, teamName: t?.installation_teams?.team_name || "بدون فرقة",
      contractId, customerName: c?.customer || "", adType: c?.adType || "",
    });
  }
  return out;
}

export async function loadPrintRecords(): Promise<PrintRecord[]> {
  const tasks = await fetchAll<any>((from, to) => supabase
    .from("print_tasks")
    .select("id, printer_id, total_area, created_at")
    .order("created_at", { ascending: false })
    .range(from, to));
  const { data: printers, error } = await supabase.from("printers").select("id, name");
  if (error) throw new Error(error.message);
  // أمر الطباعة مرتبط بعملية التركيب عبر composite_tasks (العقد والزبون)
  const ids = tasks.map(t => t.id).filter(Boolean);
  const composites: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: cErr } = await supabase.from("composite_tasks")
      .select("print_task_id, contract_id, customer_name")
      .in("print_task_id", ids.slice(i, i + 200));
    if (cErr) throw new Error(cErr.message);
    composites.push(...(data || []));
  }
  const compositeOf = new Map(composites.map((c: any) => [c.print_task_id, c]));
  const info = await loadContractInfo(composites.map(c => Number(c.contract_id)).filter(Boolean));
  const names = new Map((printers || []).map((p: any) => [p.id, p.name as string]));
  // أوامر الطباعة بلا مطبعة محددة تُحسب على مطبعة الفارس الذهبي (المطبعة الافتراضية)
  const faresId = defaultPrinterId(printers || []);
  return tasks
    .filter(t => t.created_at)
    .map(t => {
      const id = t.printer_id ?? faresId;
      const comp: any = compositeOf.get(t.id);
      const contractId = Number(comp?.contract_id) || null;
      const c = contractId ? info.get(contractId) : undefined;
      return {
        date: localDay(String(t.created_at)),
        printerId: id,
        printerName: (id && names.get(id)) || DEFAULT_PRINTER_NAME,
        area: Number(t.total_area) || 0,
        contractId,
        customerName: comp?.customer_name || c?.customer || "",
        adType: c?.adType || "",
      };
    });
}

/** تفصيل التركيبات والطباعة لكل تاريخ وعقد وجهة (فرقة أو مطبعة) */
export function details(installs: InstallRecord[], prints: PrintRecord[], from: string, to: string) {
  const inRange = (d: string) => d >= from && d <= to;
  const instMap = new Map<string, InstallDetail>();
  installs.filter(i => inRange(i.date)).forEach(i => {
    const key = [i.date, i.teamName, i.contractId ?? "", i.customerName].join("|");
    const row = instMap.get(key) || { date: i.date, teamName: i.teamName, contractId: i.contractId, customerName: i.customerName, adType: i.adType, installs: 0 };
    row.installs += 1;
    instMap.set(key, row);
  });
  const printMap = new Map<string, PrintDetail>();
  prints.filter(p => inRange(p.date)).forEach(p => {
    const key = [p.date, p.printerName, p.contractId ?? "", p.customerName].join("|");
    const row = printMap.get(key) || { date: p.date, printerName: p.printerName, contractId: p.contractId, customerName: p.customerName, adType: p.adType, area: 0 };
    row.area += p.area;
    printMap.set(key, row);
  });
  const byDate = <T extends { date: string }>(a: T, b: T) => b.date.localeCompare(a.date);
  return {
    installs: [...instMap.values()].sort(byDate),
    prints: [...printMap.values()].sort(byDate),
  };
}

/** تجميع السجلات حسب الفترة: يومي/أسبوعي/شهري */
export function bucketize(installs: InstallRecord[], prints: PrintRecord[], period: 'day' | 'week' | 'month'): InventoryBucket[] {
  const keyOf = (day: string) => period === 'day' ? day : period === 'week' ? weekStart(day) : monthKey(day);
  const labelOf = (key: string) => period === 'month' ? key : period === 'week' ? `أسبوع ${key}` : key;
  const map = new Map<string, InventoryBucket>();
  const bucket = (day: string) => {
    const key = keyOf(day);
    if (!map.has(key)) map.set(key, { key, label: labelOf(key), area: 0, installs: 0 });
    return map.get(key)!;
  };
  prints.forEach(p => { bucket(p.date).area += p.area; });
  installs.forEach(i => { bucket(i.date).installs += 1; });
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/** تفصيل حسب الفرقة والمطبعة داخل نطاق تاريخي [from, to] (YYYY-MM-DD) */
export function breakdown(installs: InstallRecord[], prints: PrintRecord[], from: string, to: string) {
  const inRange = (d: string) => d >= from && d <= to;
  const teams = new Map<string, InventoryBreakdown>();
  const printers = new Map<string, InventoryBreakdown>();
  installs.filter(i => inRange(i.date)).forEach(i => {
    const id = i.teamId || 'none';
    const row = teams.get(id) || { id, name: i.teamName, area: 0, installs: 0 };
    row.installs += 1;
    teams.set(id, row);
  });
  prints.filter(p => inRange(p.date)).forEach(p => {
    const id = p.printerId || 'none';
    const row = printers.get(id) || { id, name: p.printerName, area: 0, installs: 0 };
    row.area += p.area;
    printers.set(id, row);
  });
  const byInstalls = (a: InventoryBreakdown, b: InventoryBreakdown) => b.installs - a.installs;
  const byArea = (a: InventoryBreakdown, b: InventoryBreakdown) => b.area - a.area;
  return { teams: [...teams.values()].sort(byInstalls), printers: [...printers.values()].sort(byArea) };
}
