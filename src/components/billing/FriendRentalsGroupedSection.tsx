import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft, Building2, Calendar, CheckCircle2, ChevronDown, Edit2, ImageIcon, Loader2, Printer, Search, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { printPurchaseInvoice } from '@/components/billing/PurchaseInvoicePrint';
import { ImageViewer, type ViewerImage } from '@/components/shared/ImageViewer';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

/**
 * إيجارات الشركة الصديقة (مقايضة) — بطاقة لكل عقد:
 * التكلفة على الشركة الصديقة، سعر الزبون، الربح، المستخدم كدفعة والمتبقي،
 * استخدام المتبقي كدفعة، تعديل تاريخ البداية (فردي/جماعي)، طباعة فاتورة مشتريات FR-…،
 * وسجل دفعات المقايضة.
 */

interface FriendRentalItem {
  id: string;
  billboard_id: number;
  contract_number: number;
  friend_rental_cost: number;
  customer_rental_price?: number | null;
  profit?: number | null;
  used_as_payment?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  billboards?: {
    Billboard_Name?: string | null;
    Size?: string | null;
    Municipality?: string | null;
    Faces_Count?: number | null;
    Image_URL?: string | null;
    Nearest_Landmark?: string | null;
    design_face_a?: string | null;
    design_face_b?: string | null;
    Ad_Type?: string | null;
    District?: string | null;
  } | null;
}

interface FriendRentalsGroupedSectionProps {
  friendBillboardRentals: FriendRentalItem[];
  customerName: string;
  onUseAsPayment: (rentals: FriendRentalItem[]) => void;
  contracts?: any[];
  onUpdate?: () => void;
  customerId?: string;
  payments?: any[];
}

type Filter = 'all' | 'available' | 'used' | 'active';

const BARTER = 'مقايضة';
const num = (v: unknown) => Number(v) || 0;
const fmt = (n: number) => (Math.round(num(n) * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });

// تواريخ بلا إزاحة منطقة زمنية
const parseDay = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const showDay = (s?: string | null) => { if (!s) return '—'; const d = parseDay(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
const daysBetween = (a?: string | null, b?: string | null) => (a && b ? Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000) : 0);
const todayStr = () => toDay(new Date());

function generateFriendInvoiceSerial(contractNumber: number): string {
  const ts = Date.now().toString(36).toUpperCase();
  const cn = contractNumber.toString(36).toUpperCase().padStart(3, '0');
  return `FR-${cn}-${ts}`;
}

function getContractDesignImage(contract: any): string | null {
  if (!contract?.design_data) return null;
  try {
    const raw = contract.design_data;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const arr = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    if (Array.isArray(arr)) {
      const m = arr.find((d: any) => d?.designFaceA || d?.design_face_a_url || d?.designFaceB || d?.design_face_b_url);
      if (m) return m.designFaceA || m.design_face_a_url || m.designFaceB || m.design_face_b_url;
    }
  } catch { /* تجاهل بيانات تصميم تالفة */ }
  return null;
}

/** تاريخ النهاية الجديد مع الحفاظ على مدة العقد (أشهر/أيام) أو الفرق الفعلي للإيجار */
function calcEndDate(newStart: string, rental: FriendRentalItem, contract: any): string {
  if (!newStart) return '';
  const d = parseDay(newStart);
  const keepDiff = () => {
    if (rental.start_date && rental.end_date) d.setTime(d.getTime() + (parseDay(rental.end_date).getTime() - parseDay(rental.start_date).getTime()));
  };
  if (contract) {
    const mode = contract.pricing_mode || 'months';
    const months = contract.duration_months != null ? Number(contract.duration_months) : null;
    const days = contract.duration_days != null ? Number(contract.duration_days) : null;
    if (mode === 'months' && months !== null) {
      if (contract.use_30_day_month !== false) d.setDate(d.getDate() + months * 30);
      else d.setMonth(d.getMonth() + months);
    } else if (mode === 'days' && days !== null) d.setDate(d.getDate() + days);
    else keepDiff();
  } else keepDiff();
  return toDay(d);
}

function durationLabel(contract: any): string {
  if (contract?.pricing_mode === 'months' && contract.duration_months != null) {
    const m = Number(contract.duration_months);
    return m === 1 ? 'شهر' : m === 2 ? 'شهرين' : `${m} أشهر`;
  }
  if (contract?.pricing_mode === 'days' && contract.duration_days != null) return `${contract.duration_days} يوم`;
  return 'غير محددة — يُحافَظ على عدد الأيام الحالي';
}

/* ───────── عناصر عرض صغيرة ───────── */

function Kpi({ label, value, tone, hint }: { label: string; value: number; tone: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 font-manrope text-lg font-bold tabular-nums', tone)}>{fmt(value)} <span className="text-xs font-medium text-muted-foreground">د.ل</span></div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Money({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn('font-manrope text-sm font-bold tabular-nums', tone)}>{fmt(value)}</div>
    </div>
  );
}

function Thumb({ src, onOpen, className }: { src?: string | null; onOpen?: () => void; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <div className={cn('flex shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground', className)}><ImageIcon className="h-5 w-5 opacity-50" /></div>;
  }
  return (
    <button type="button" onClick={onOpen} className={cn('shrink-0 overflow-hidden rounded-lg border bg-muted cursor-zoom-in', className)} title="تكبير">
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
    </button>
  );
}

/* ───────── المكوّن ───────── */

export function FriendRentalsGroupedSection({
  friendBillboardRentals,
  customerName,
  onUseAsPayment,
  contracts,
  onUpdate,
  customerId,
  payments = [],
}: FriendRentalsGroupedSectionProps) {
  const rentals = friendBillboardRentals || [];
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [viewer, setViewer] = useState<{ images: ViewerImage[]; index: number; title?: string } | null>(null);

  const [fetchedContracts, setFetchedContracts] = useState<Record<number, any>>({});
  const [taskDesigns, setTaskDesigns] = useState<Record<number, string>>({});
  const [barterPayments, setBarterPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // تعديل التاريخ: rentals = اللوحات المعنية (واحدة أو أكثر)
  const [dateEdit, setDateEdit] = useState<{ rentals: FriendRentalItem[]; start: string } | null>(null);
  const [savingDate, setSavingDate] = useState(false);

  const contractNums = useMemo(
    () => Array.from(new Set(rentals.map(r => Number(r.contract_number)).filter(Boolean))),
    [rentals],
  );
  const contractKey = contractNums.join(',');

  // العقود (لمدة العقد ونوع الإعلان والتصميم)
  useEffect(() => {
    if (!contractNums.length) return;
    let alive = true;
    supabase.from('Contract').select('*').in('Contract_Number', contractNums).then(({ data, error }) => {
      if (!alive || error || !data) return;
      const map: Record<number, any> = {};
      data.forEach((c: any) => { map[Number(c.Contract_Number)] = c; });
      setFetchedContracts(map);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractKey]);

  // تصميم التركيب الفعلي لكل عقد
  useEffect(() => {
    if (!contractNums.length) return;
    let alive = true;
    (async () => {
      const { data: tasks } = await supabase.from('installation_tasks').select('id, contract_id').in('contract_id', contractNums);
      if (!tasks?.length) return;
      const byTask = new Map<string, number>(tasks.filter(t => t.contract_id).map(t => [String(t.id), Number(t.contract_id)]));
      const { data: items } = await supabase.from('installation_task_items').select('task_id, design_face_a')
        .in('task_id', tasks.map(t => t.id)).not('design_face_a', 'is', null).neq('design_face_a', '');
      if (!alive || !items) return;
      const map: Record<number, string> = {};
      items.forEach((it: any) => { const cn = byTask.get(String(it.task_id)); if (cn && it.design_face_a && !map[cn]) map[cn] = it.design_face_a; });
      setTaskDesigns(map);
    })().catch(err => console.error('friend rentals: designs', err));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractKey]);

  // سجل دفعات المقايضة
  useEffect(() => {
    if (!customerId) return;
    let alive = true;
    setLoadingPayments(true);
    supabase.from('customer_payments')
      .select('*, composite_tasks(task_number), sales_invoices(invoice_number), printed_invoices(invoice_number)')
      .eq('customer_id', customerId).eq('method', BARTER).order('paid_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (!error && data) setBarterPayments(data);
        setLoadingPayments(false);
      });
    return () => { alive = false; };
  }, [customerId, rentals]);

  const contractOf = (cn: number) => fetchedContracts[cn] || contracts?.find((c: any) => Number(c.Contract_Number) === cn);

  const groups = useMemo(() => {
    const map = new Map<number, FriendRentalItem[]>();
    rentals.forEach(r => { const cn = Number(r.contract_number) || 0; if (!map.has(cn)) map.set(cn, []); map.get(cn)!.push(r); });
    const today = todayStr();
    const barterList = (payments || []).filter(p => p?.method === BARTER);

    return Array.from(map.entries()).map(([contractNumber, list]) => {
      const cost = list.reduce((s, r) => s + num(r.friend_rental_cost), 0);
      const customerPrice = list.reduce((s, r) => s + num(r.customer_rental_price), 0);
      const profit = list.reduce((s, r) => s + num(r.profit), 0);
      const dbUsed = list.reduce((s, r) => s + num(r.used_as_payment), 0);

      // دفعات مقايضة مسجّلة على العقد أو تذكر لوحاته (للسجلات القديمة التي لم تُحدّث used_as_payment)
      const ids = list.map(r => String(r.billboard_id)).filter(Boolean);
      const names = list.map(r => r.billboards?.Billboard_Name).filter(Boolean) as string[];
      const paymentsUsed = barterList.reduce((s, p) => {
        const note = String(p.notes || '');
        const byContract = contractNumber > 0 && (Number(p.contract_number) === contractNumber || note.includes(`عقد ${contractNumber}`) || note.includes(`#${contractNumber}`));
        const byBoard = ids.some(id => note.includes(id)) || names.some(n => note.includes(n));
        return byContract || byBoard ? s + num(p.amount) : s;
      }, 0);

      const used = Math.min(cost, Math.max(dbUsed, paymentsUsed));
      const remaining = Math.max(0, cost - used);
      const contract = contractOf(contractNumber);
      const design = taskDesigns[contractNumber] || getContractDesignImage(contract)
        || list.find(r => r.billboards?.design_face_a)?.billboards?.design_face_a
        || list.find(r => r.billboards?.design_face_b)?.billboards?.design_face_b
        || null;
      const starts = list.map(r => r.start_date).filter(Boolean) as string[];
      const ends = list.map(r => r.end_date).filter(Boolean) as string[];
      return {
        contractNumber, rentals: list, cost, customerPrice, profit, used, remaining,
        fullyUsed: used > 0 && remaining <= 0.01,
        design,
        adType: contract?.['Ad Type'] || contract?.ad_type || '',
        contractCustomer: contract?.['Customer Name'] || contract?.customer_name || '',
        firstStart: starts.sort()[0] || null,
        lastEnd: ends.sort().slice(-1)[0] || null,
        active: list.some(r => !r.end_date || r.end_date.slice(0, 10) >= today),
        contract,
      };
    }).sort((a, b) => b.contractNumber - a.contractNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentals, contracts, fetchedContracts, taskDesigns, payments]);

  const totals = useMemo(() => groups.reduce((t, g) => ({
    cost: t.cost + g.cost, customer: t.customer + g.customerPrice, profit: t.profit + g.profit,
    used: t.used + g.used, remaining: t.remaining + g.remaining,
  }), { cost: 0, customer: 0, profit: 0, used: 0, remaining: 0 }), [groups]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter(g => {
      if (filter === 'available' && g.remaining <= 0.01) return false;
      if (filter === 'used' && !g.fullyUsed) return false;
      if (filter === 'active' && !g.active) return false;
      if (!q) return true;
      return String(g.contractNumber).includes(q) || String(g.adType).toLowerCase().includes(q)
        || g.rentals.some(r => [r.billboards?.Billboard_Name, r.billboards?.Municipality, r.billboards?.Nearest_Landmark, r.billboards?.Size]
          .some(v => String(v || '').toLowerCase().includes(q)));
    });
  }, [groups, filter, query]);

  const counts = useMemo(() => ({
    all: groups.length,
    available: groups.filter(g => g.remaining > 0.01).length,
    used: groups.filter(g => g.fullyUsed).length,
    active: groups.filter(g => g.active).length,
  }), [groups]);

  const toggleOpen = (cn: number) => setOpen(prev => { const n = new Set(prev); n.has(cn) ? n.delete(cn) : n.add(cn); return n; });
  const toggleSel = (id: string, on?: boolean) => setSelected(prev => { const n = new Set(prev); (on ?? !n.has(id)) ? n.add(id) : n.delete(id); return n; });
  const toggleGroupSel = (list: FriendRentalItem[]) => setSelected(prev => {
    const n = new Set(prev); const all = list.every(r => n.has(r.id));
    list.forEach(r => (all ? n.delete(r.id) : n.add(r.id))); return n;
  });

  const openImages = (list: FriendRentalItem[], design: string | null, startAt: { kind: 'design' } | { kind: 'rental'; id: string }, title: string) => {
    const imgs: (ViewerImage & { key: string })[] = [];
    if (design) imgs.push({ key: 'design', src: design, label: 'التصميم' });
    list.forEach(r => { if (r.billboards?.Image_URL) imgs.push({ key: r.id, src: r.billboards.Image_URL, label: r.billboards?.Billboard_Name || 'لوحة' }); });
    const idx = Math.max(0, imgs.findIndex(i => (startAt.kind === 'design' ? i.key === 'design' : i.key === startAt.id)));
    setViewer({ images: imgs.map(({ src, label }) => ({ src, label })), index: idx, title });
  };

  const selectedRentals = useMemo(() => rentals.filter(r => selected.has(r.id)), [rentals, selected]);

  const saveDates = async () => {
    if (!dateEdit?.start || !dateEdit.rentals.length) return;
    setSavingDate(true);
    try {
      const results = await Promise.all(dateEdit.rentals.map(r =>
        supabase.from('friend_billboard_rentals')
          .update({ start_date: dateEdit.start, end_date: calcEndDate(dateEdit.start, r, contractOf(Number(r.contract_number))) })
          .eq('id', r.id)));
      const failed = results.find(r => r.error);
      if (failed?.error) throw failed.error;
      toast.success(dateEdit.rentals.length > 1 ? `حُدّث تاريخ البداية لـ ${dateEdit.rentals.length} لوحة` : 'حُدّث تاريخ الإيجار');
      if (dateEdit.rentals.length > 1) setSelected(new Set());
      setDateEdit(null);
      onUpdate?.();
    } catch (err: any) {
      toast.error('تعذّر حفظ التاريخ: ' + (err?.message || err));
    } finally {
      setSavingDate(false);
    }
  };

  const printInvoice = (g: (typeof groups)[number]) => {
    const list = g.rentals;
    const headerItem = {
      description: `عقد رقم ${g.contractNumber}`,
      quantity: 1, unit: 'عقد', unitPrice: g.cost, total: g.cost,
      durationMonths: undefined, image_url: undefined, size: undefined,
      faces: list.reduce((s, r) => s + (r.billboards?.Faces_Count || 1), 0),
      billboardName: undefined,
      locationDetails: `عقد بقيمة إجمالية (نوع الإعلان: ${g.adType || 'غير محدد'})`,
      startDate: g.firstStart || undefined,
      isContractHeader: true,
    };
    const subItems = list.map(r => {
      const bb = r.billboards;
      return {
        description: `لوحة ${bb?.Billboard_Name || 'لوحة'}`,
        quantity: 1, unit: 'لوحة', unitPrice: 0, total: 0,
        durationMonths: Math.round(daysBetween(r.start_date, r.end_date) / 30) || 1,
        image_url: bb?.Image_URL || undefined,
        size: bb?.Size || undefined,
        faces: bb?.Faces_Count || 1,
        billboardName: bb?.Billboard_Name || '—',
        locationDetails: [
          `البلدية: ${bb?.Municipality || '—'}`, `المنطقة: ${bb?.District || '—'}`,
          `أقرب نقطة: ${bb?.Nearest_Landmark || '—'}`, `نوع الإعلان: ${bb?.Ad_Type || '—'}`,
        ].join(' • '),
        startDate: r.start_date || undefined,
        isContractSubRow: true,
      };
    });
    printPurchaseInvoice({
      invoiceNumber: generateFriendInvoiceSerial(g.contractNumber),
      invoiceDate: new Date().toISOString(),
      invoiceName: 'فاتورة مشتريات - إيجار لوحات صديقة',
      supplierName: customerName,
      supplierCompany: customerName,
      billboardImage: g.design || undefined,
      isFriendRental: true,
      items: [headerItem, ...subItems],
      totalAmount: g.cost,
      notes: `عقد رقم ${g.contractNumber} - ${list.length} لوحات - من ${showDay(g.firstStart)} إلى ${showDay(g.lastEnd)}`,
    } as any);
  };

  if (rentals.length === 0) return null;

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'available', label: 'متاح كدفعة' },
    { key: 'used', label: 'مستخدم بالكامل' },
    { key: 'active', label: 'نشط' },
  ];

  const previewRental = dateEdit?.rentals.length === 1 ? dateEdit.rentals[0] : null;
  const previewContract = previewRental ? contractOf(Number(previewRental.contract_number)) : null;

  return (
    <section className="space-y-4" dir="rtl">
      {/* الرأس والإجماليات */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500"><Building2 className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold">إيجارات الشركة الصديقة (مقايضة)</h3>
            <p className="text-xs text-muted-foreground">{groups.length} عقد · {rentals.length} لوحة مؤجّرة من {customerName}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi label="التكلفة على الشركة الصديقة" value={totals.cost} tone="text-amber-600 dark:text-amber-400" />
          <Kpi label="سعر الزبون" value={totals.customer} tone="text-sky-600 dark:text-sky-400" />
          <Kpi label="الربح" value={totals.profit} tone="text-emerald-600 dark:text-emerald-400" />
          <Kpi label="المستخدم كدفعة" value={totals.used} tone="text-violet-600 dark:text-violet-400" />
          <Kpi label="المتبقي المتاح كدفعة" value={totals.remaining} tone={totals.remaining > 0.01 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'} />
        </div>
      </div>

      {/* أدوات التصفية */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl border bg-card p-1">
          {filters.map(f => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
              {f.label} <span className="font-manrope opacity-70">({counts[f.key]})</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="بحث برقم العقد أو اسم اللوحة أو البلدية…" className="h-9 pr-9" />
        </div>
      </div>

      {/* بطاقات العقود */}
      {visible.length === 0 && (
        <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">لا توجد عقود مطابقة</div>
      )}

      {visible.map(g => {
        const isOpen = open.has(g.contractNumber);
        const pct = g.cost > 0 ? Math.min(100, (g.used / g.cost) * 100) : 0;
        const allSel = g.rentals.every(r => selected.has(r.id));
        const someSel = !allSel && g.rentals.some(r => selected.has(r.id));
        return (
          <article key={g.contractNumber}
            className={cn('overflow-hidden rounded-2xl border bg-card transition-colors',
              g.fullyUsed ? 'border-violet-500/40' : g.remaining > 0.01 && g.used > 0 ? 'border-orange-500/40' : '')}>
            <div className="flex flex-col gap-4 p-4 lg:flex-row">
              <Thumb src={g.design} className="h-24 w-full lg:w-36"
                onOpen={() => openImages(g.rentals, g.design, { kind: 'design' }, `عقد ${g.contractNumber}`)} />

              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-manrope text-lg font-bold">عقد #{g.contractNumber}</span>
                  <Badge variant="outline" className={g.active ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>{g.active ? 'نشط' : 'منتهي'}</Badge>
                  <Badge variant="outline">{g.rentals.length} لوحة</Badge>
                  {g.adType && <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">{g.adType}</Badge>}
                  {g.fullyUsed
                    ? <Badge className="gap-1 bg-violet-600 hover:bg-violet-600"><CheckCircle2 className="h-3 w-3" /> مستخدم بالكامل كدفعة</Badge>
                    : g.used > 0
                      ? <Badge className="gap-1 bg-orange-500 hover:bg-orange-500"><ArrowRightLeft className="h-3 w-3" /> مستخدم جزئياً</Badge>
                      : <Badge variant="outline" className="border-orange-500/40 text-orange-600 dark:text-orange-400">متاح كدفعة</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="font-manrope">{showDay(g.firstStart)}</span><span>←</span><span className="font-manrope">{showDay(g.lastEnd)}</span>
                  {g.contractCustomer && <span>· زبون العقد: {g.contractCustomer}</span>}
                </div>

                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  <Money label="التكلفة" value={g.cost} tone="text-amber-600 dark:text-amber-400" />
                  <Money label="سعر الزبون" value={g.customerPrice} tone="text-sky-600 dark:text-sky-400" />
                  <Money label="الربح" value={g.profit} tone="text-emerald-600 dark:text-emerald-400" />
                  <Money label="المستخدم" value={g.used} tone="text-violet-600 dark:text-violet-400" />
                  <Money label="المتبقي" value={g.remaining} tone={g.remaining > 0.01 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'} />
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-muted" title={`مستخدم ${fmt(g.used)} من ${fmt(g.cost)}`}>
                  <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="flex shrink-0 flex-row flex-wrap items-start gap-2 lg:w-48 lg:flex-col lg:items-stretch">
                {g.remaining > 0.01 && (
                  <Button size="sm" className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700" onClick={() => onUseAsPayment(g.rentals)}>
                    <ArrowRightLeft className="h-4 w-4" />
                    {g.used > 0 ? 'استخدام المتبقي كدفعة' : 'استخدام كدفعة'}
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => printInvoice(g)}>
                  <Printer className="h-4 w-4" /> فاتورة مشتريات
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => toggleOpen(g.contractNumber)}>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                  {isOpen ? 'إخفاء اللوحات' : 'عرض اللوحات'}
                </Button>
              </div>
            </div>

            {isOpen && (
              <div className="border-t bg-muted/20">
                <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs">
                  <label className="flex cursor-pointer items-center gap-2 font-semibold">
                    <Checkbox checked={allSel ? true : someSel ? 'indeterminate' : false} onCheckedChange={() => toggleGroupSel(g.rentals)} />
                    تحديد كل لوحات العقد
                  </label>
                  <span className="text-muted-foreground">· حدّد لوحات لتعديل تاريخ بدايتها معاً</span>
                </div>
                <div className="divide-y">
                  {g.rentals.map(r => {
                    const bb = r.billboards;
                    const cost = num(r.friend_rental_cost);
                    const used = num(r.used_as_payment) || (g.fullyUsed ? cost : 0);
                    const sel = selected.has(r.id);
                    const ended = !!r.end_date && r.end_date.slice(0, 10) < todayStr();
                    return (
                      <div key={r.id} className={cn('flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center', sel && 'bg-primary/5')}>
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <Checkbox checked={sel} onCheckedChange={v => toggleSel(r.id, !!v)} aria-label="تحديد" />
                          <Thumb src={bb?.Image_URL} className="h-14 w-20"
                            onOpen={() => openImages(g.rentals, g.design, { kind: 'rental', id: r.id }, `عقد ${g.contractNumber}`)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate font-bold">{bb?.Billboard_Name || `لوحة ${r.billboard_id}`}</span>
                              {bb?.Size && <span className="rounded bg-muted px-1.5 py-0.5 font-manrope text-[11px] font-semibold">{bb.Size}</span>}
                              {ended && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">منتهي</span>}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {[bb?.Municipality, bb?.District, bb?.Nearest_Landmark].filter(Boolean).join(' · ') || '—'}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="font-manrope">{showDay(r.start_date)}</span><span className="text-muted-foreground">←</span>
                              <span className="font-manrope">{showDay(r.end_date)}</span>
                              <span className="text-muted-foreground">({daysBetween(r.start_date, r.end_date)} يوم)</span>
                              <button type="button" className="mr-1 inline-flex items-center gap-0.5 rounded px-1 text-primary hover:bg-primary/10"
                                onClick={() => setDateEdit({ rentals: [r], start: (r.start_date || '').slice(0, 10) })}>
                                <Edit2 className="h-3 w-3" /> تعديل
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-3 md:w-[360px]">
                          <Money label="التكلفة" value={cost} tone="text-amber-600 dark:text-amber-400" />
                          <Money label="سعر الزبون" value={num(r.customer_rental_price)} tone="text-sky-600 dark:text-sky-400" />
                          <Money label="الربح" value={num(r.profit)} tone="text-emerald-600 dark:text-emerald-400" />
                          <Money label="المستخدم" value={used} tone={used > 0 ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </article>
        );
      })}

      {/* سجل دفعات المقايضة */}
      <div className="rounded-2xl border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <ArrowRightLeft className="h-4 w-4 text-violet-500" />
          <h4 className="font-bold">سجل دفعات المقايضة</h4>
          <span className="text-xs text-muted-foreground">({barterPayments.length})</span>
          {barterPayments.length > 0 && (
            <span className="mr-auto font-manrope text-sm font-bold text-violet-600 dark:text-violet-400">
              {fmt(barterPayments.reduce((s, p) => s + num(p.amount), 0))} د.ل
            </span>
          )}
        </div>
        {loadingPayments ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : barterPayments.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">لا توجد دفعات مقايضة مسجّلة لهذا الزبون</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-right font-semibold">التاريخ</th>
                  <th className="px-4 py-2 text-right font-semibold">المبلغ</th>
                  <th className="px-4 py-2 text-right font-semibold">مسدَّد على</th>
                  <th className="px-4 py-2 text-right font-semibold">البيان</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {barterPayments.map(p => {
                  const link = p.contract_number ? `عقد #${p.contract_number}`
                    : p.composite_task_id ? `أمر عمل #${p.composite_tasks?.task_number || '—'}`
                    : p.sales_invoice_id ? `فاتورة مبيعات #${p.sales_invoices?.invoice_number || '—'}`
                    : p.printed_invoice_id ? `فاتورة طباعة #${p.printed_invoices?.invoice_number || '—'}`
                    : 'رصيد في حساب الزبون';
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-2 font-manrope">{showDay(p.paid_at)}</td>
                      <td className="whitespace-nowrap px-4 py-2 font-manrope font-bold">{fmt(num(p.amount))} د.ل</td>
                      <td className="whitespace-nowrap px-4 py-2"><Badge variant="outline">{link}</Badge></td>
                      <td className="px-4 py-2 text-muted-foreground">{p.notes || 'مقايضة إيجار لوحة'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* شريط التحديد */}
      {selected.size > 0 && (
        <div className="fixed bottom-24 left-1/2 z-[60] flex lg:bottom-6 w-[92%] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border bg-background/95 px-4 py-3 shadow-2xl backdrop-blur">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 font-manrope text-sm font-bold text-primary-foreground">{selected.size}</span>
          <span className="flex-1 text-sm font-semibold">لوحة محددة</span>
          <Button size="sm" className="gap-1.5" onClick={() => setDateEdit({ rentals: selectedRentals, start: '' })}>
            <Edit2 className="h-3.5 w-3.5" /> تعديل تاريخ البداية
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelected(new Set())} aria-label="إلغاء التحديد"><X className="h-4 w-4" /></Button>
        </div>
      )}

      {/* نافذة تعديل تاريخ البداية (فردي/جماعي) */}
      <Dialog open={!!dateEdit} onOpenChange={o => { if (!o && !savingDate) setDateEdit(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {dateEdit && dateEdit.rentals.length > 1 ? `تعديل تاريخ البداية — ${dateEdit.rentals.length} لوحة` : 'تعديل تاريخ بداية الإيجار'}
            </DialogTitle>
          </DialogHeader>
          {dateEdit && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {dateEdit.rentals.length > 1
                  ? 'يُعاد احتساب تاريخ النهاية لكل لوحة حسب مدة عقدها.'
                  : (previewRental?.billboards?.Billboard_Name || '') + ' — تُحفظ مدة العقد الأصلية.'}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="friend-start">تاريخ البداية الجديد</Label>
                <Input id="friend-start" type="date" value={dateEdit.start} onChange={e => setDateEdit({ ...dateEdit, start: e.target.value })} />
              </div>
              {dateEdit.start && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border bg-muted/30 p-3 text-sm">
                  {previewRental ? (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">النهاية الجديدة</span><b className="font-manrope">{showDay(calcEndDate(dateEdit.start, previewRental, previewContract))}</b></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">مدة العقد</span><span>{durationLabel(previewContract)}</span></div>
                    </>
                  ) : dateEdit.rentals.map(r => (
                    <div key={r.id} className="flex justify-between gap-2">
                      <span className="truncate">{r.billboards?.Billboard_Name || r.billboard_id} <span className="text-xs text-muted-foreground">(عقد {r.contract_number})</span></span>
                      <b className="font-manrope">{showDay(calcEndDate(dateEdit.start, r, contractOf(Number(r.contract_number))))}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDateEdit(null)} disabled={savingDate}>إلغاء</Button>
            <Button onClick={saveDates} disabled={savingDate || !dateEdit?.start} className="gap-1.5">
              {savingDate && <Loader2 className="h-4 w-4 animate-spin" />} حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewer && <ImageViewer images={viewer.images} index={viewer.index} title={viewer.title} onClose={() => setViewer(null)} />}
    </section>
  );
}

export default FriendRentalsGroupedSection;
