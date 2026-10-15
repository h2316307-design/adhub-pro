import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { FileText, Layers, Loader2, Receipt, Scale, Sparkles, Wallet, Wrench, X } from 'lucide-react';
import { buildReceiptAllocations } from '@/lib/distributionPayload';
import { validateDistribution } from '@/lib/distributionValidation';
import { allocateOldestFirst, allocateProportional } from '@/lib/smartAllocation';
import { hasSideDistributions, loadDistributionTargets, loadSideData, type DistTarget, type SideData } from '@/services/distributionTargets';
import { Plus, Trash2, Users } from 'lucide-react';
import { ReceiptImagesField } from '@/components/billing/ReceiptImagesField';

type Props = {
  open: boolean; onOpenChange: (open: boolean) => void; customerId: string; customerName: string; onSuccess: () => void;
  purchaseInvoice?: any; friendRental?: any; editMode?: boolean; editingDistributedPaymentId?: string | null; editingPayments?: any[];
  preSelectedContractIds?: number[]; preFilledAmount?: number | null; sourceAccountPaymentId?: string | null;
};
type EmpRow = { employeeId: string; amount: number; paymentType: 'advance' | 'from_balance' };

const m = (n: number) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
const fmt = (n: number) => `${m(n).toLocaleString('en-US', { maximumFractionDigits: 2 })} د.ل`;
const uuid = () => (crypto as any).randomUUID();
const TYPE_META: Record<DistTarget['type'], { label: string; icon: any }> = {
  contract: { label: 'العقود', icon: FileText },
  composite_task: { label: 'أوامر العمل', icon: Wrench },
  printed_invoice: { label: 'فواتير الطباعة', icon: Receipt },
  sales_invoice: { label: 'فواتير المبيعات', icon: Receipt },
};

/** تنسيق الرقم بفاصلة الآلاف أثناء الكتابة (12,500.5) */
const groupDigits = (raw: string) => {
  const clean = raw.replace(/[^0-9.]/g, '');
  const dot = clean.indexOf('.');
  const int = (dot >= 0 ? clean.slice(0, dot) : clean).replace(/^0+(?=\d)/, '');
  const dec = dot >= 0 ? '.' + clean.slice(dot + 1).replace(/\./g, '').slice(0, 2) : '';
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + dec;
};

function Money({ value, onChange, max, label, className, disabled }: { value: number; onChange: (v: number) => void; max?: number; label: string; className?: string; disabled?: boolean }) {
  const [text, setText] = useState(value ? groupDigits(String(value)) : '');
  useEffect(() => {
    // لا نعيد تنسيق النص إن كان يمثّل نفس القيمة (حتى لا يقفز المؤشر أثناء الكتابة)
    setText(prev => (m(Number(prev.replace(/,/g, '')) || 0) === m(value) ? prev : (value ? groupDigits(String(value)) : '')));
  }, [value]);
  return (
    <Input dir="ltr" inputMode="decimal" aria-label={label} disabled={disabled} value={text} placeholder="0"
      onFocus={e => e.currentTarget.select()}
      onChange={e => {
        const el = e.target;
        const caret = el.selectionStart ?? el.value.length;
        const digitsBefore = el.value.slice(0, caret).replace(/[^0-9.]/g, '').length;
        const t = groupDigits(el.value);
        setText(t);
        // إعادة المؤشر لمكانه بعد إضافة الفواصل
        requestAnimationFrame(() => {
          let pos = 0, seen = 0;
          while (pos < t.length && seen < digitsBefore) { if (/[0-9.]/.test(t[pos])) seen++; pos++; }
          try { el.setSelectionRange(pos, pos); } catch { /* تجاهل */ }
        });
        const v = m(Number(t.replace(/,/g, '')) || 0);
        if (max !== undefined && v > max) setText(groupDigits(String(max)));
        onChange(max !== undefined ? Math.min(v, max) : v);
      }}
      className={cn('h-9 text-center tabular-nums', className)} />
  );
}

/** توزيع دفعة — نسخة مبنية من الصفر: شاشة واحدة، توزيع ذكي، حفظ ذري عبر save_payment_distribution */
export function SmartDistributeDialog(props: Props) {
  const { open, onOpenChange, customerId, customerName, onSuccess, editMode, editingDistributedPaymentId, editingPayments = [],
    preSelectedContractIds, preFilledAmount, sourceAccountPaymentId, purchaseInvoice, friendRental } = props as any;
  const [sideOn, setSideOn] = useState(false);
  const [side, setSide] = useState<SideData | null>(null);
  const [sideLoading, setSideLoading] = useState(false);
  const [empRows, setEmpRows] = useState<EmpRow[]>([]);
  const [custodyRows, setCustodyRows] = useState<{ employeeId: string; amount: number }[]>([]);
  const [expRows, setExpRows] = useState<{ expense_id: string; amount: number }[]>([]);
  const [expEmployee, setExpEmployee] = useState('');
  const [expTotal, setExpTotal] = useState(0);
  const [targets, setTargets] = useState<DistTarget[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('نقدي');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [transferImage, setTransferImage] = useState('');
  const [sourceBank, setSourceBank] = useState('');
  const [destinationBank, setDestinationBank] = useState('');
  const [viaIntermediary, setViaIntermediary] = useState(false);
  const [collector, setCollector] = useState('');
  const [receiver, setReceiver] = useState('');
  const [location, setLocation] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [commission, setCommission] = useState(0);
  const [transferFee, setTransferFee] = useState(0);
  const [saveCredit, setSaveCredit] = useState(true);
  const [filter, setFilter] = useState<'all' | DistTarget['type']>('all');
  const [saving, setSaving] = useState(false);
  const requestId = useRef(uuid());
  const groupId = useRef(uuid());

  const rentals: any[] = friendRental ? (friendRental._groupRentals?.length ? friendRental._groupRentals : [friendRental]) : [];
  const rentalBalance = m(rentals.reduce((s, r) => s + (Number(r.friend_rental_cost) || 0) - (Number(r.used_as_payment) || 0), 0));
  const purchaseCredit = purchaseInvoice ? m((Number(purchaseInvoice.total_amount) || 0) - (Number(purchaseInvoice.used_as_payment) || 0) + (editMode ? editingPayments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0) : 0)) : null;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    requestId.current = uuid();
    groupId.current = uuid();
    setTargets(null); setError(null); setFilter('all');
    setSideOn(false); setSide(null); setEmpRows([]); setCustodyRows([]); setExpRows([]); setExpEmployee(''); setExpTotal(0);
    const first = editingPayments[0] || {};
    setDate(String(first.paid_at || new Date().toISOString()).slice(0, 10));
    setMethod(first.method || 'نقدي');
    setReference(first.reference || '');
    setNotes(first.notes && !String(first.notes).includes('رصيد حساب غير موزع') ? first.notes : '');
    setSourceBank(first.source_bank || ''); setDestinationBank(first.destination_bank || '');
    setTransferImage(editingPayments.find((p: any) => p.transfer_image_url)?.transfer_image_url || '');
    setViaIntermediary(!!first.collected_via_intermediary);
    setCollector(first.collector_name || ''); setReceiver(first.receiver_name || ''); setLocation(first.delivery_location || ''); setCollectionDate(first.collection_date || '');
    setCommission(m(editingPayments.reduce((s: number, p: any) => s + (Number(p.intermediary_commission) || 0), 0)));
    setTransferFee(m(editingPayments.reduce((s: number, p: any) => s + (Number(p.transfer_fee) || 0), 0)));
    const editTotal = m(editingPayments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0));
    (async () => {
      try {
        if (editMode && editingDistributedPaymentId && await hasSideDistributions(editingDistributedPaymentId)) {
          // الدفعة بها سلف/عهد/مصاريف: تُحمَّل كما هي حتى لا تُحذف عند الحفظ
          const sd = await loadSideData(editingDistributedPaymentId);
          if (cancelled) return;
          setSide(sd); setSideOn(true);
          setEmpRows(sd.existing.employees); setCustodyRows(sd.existing.custody); setExpRows(sd.existing.expenses);
          const firstExp = sd.expenses.find(x => sd.existing.expenses.some(r => r.expense_id === x.id));
          setExpEmployee(firstExp?.employeeId || '');
          setExpTotal(m(sd.existing.expenses.reduce((s2, r) => s2 + r.amount, 0)));
        }
        const list = await loadDistributionTargets(customerId, editMode ? editingPayments : []);
        if (cancelled) return;
        const pre = new Set((preSelectedContractIds || []).map(Number));
        const initialAmount = editMode ? editTotal : (preFilledAmount ?? (friendRental ? rentalBalance : purchaseCredit ?? 0));
        let next = list;
        if (!editMode && pre.size) {
          let left = m(initialAmount || 0);
          next = list.map(t => {
            if (t.type !== 'contract' || !pre.has(Number(t.id))) return t;
            const v = initialAmount ? m(Math.min(left, t.remainingAmount)) : t.remainingAmount;
            left = m(left - v);
            return { ...t, selected: true, allocatedAmount: v };
          });
        }
        setTargets(next);
        setAmount(m(initialAmount || (pre.size ? next.filter(t => t.selected).reduce((s, t) => s + t.allocatedAmount, 0) : 0)));
        setSaveCredit(true);
      } catch (e: any) { if (!cancelled) setError(e.message || 'تعذر تحميل المستحقات'); }
    })();
    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const fees = viaIntermediary ? m(commission + transferFee) : 0;
  const sideEmp = sideOn ? empRows.filter(r => r.employeeId && r.amount > 0) : [];
  const sideCus = sideOn ? custodyRows.filter(r => r.employeeId && r.amount > 0) : [];
  const sideExp = sideOn ? expRows.filter(r => r.expense_id && r.amount > 0) : [];
  const sideOut = m([...sideEmp, ...sideCus, ...sideExp].reduce((s, r) => s + r.amount, 0));
  const sideAvailable = m(amount - fees - sideOut);
  const balanceOf = (id: string) => side?.balances.find(b => b.employeeId === id);
  /** الحد الأقصى لصف: ما تبقى من المبلغ المستلم بعد كل التوزيعات الأخرى (ولسحب المستحقات: لا يتجاوز الرصيد) */
  const rowMax = (current: number, balance?: number) => {
    const room = m(Math.max(0, amount - fees - (sideOut - (current || 0))));
    return balance !== undefined ? m(Math.min(room, Math.max(0, balance))) : room;
  };
  const enableSide = async (on: boolean) => {
    setSideOn(on);
    if (on && !side && !sideLoading) {
      setSideLoading(true);
      try { setSide(await loadSideData(editMode ? editingDistributedPaymentId : null)); }
      catch (e: any) { toast.error(e.message || 'تعذر تحميل الموظفين والمصاريف'); setSideOn(false); }
      finally { setSideLoading(false); }
    }
  };
  const allocated = m((targets || []).filter(t => t.selected).reduce((s, t) => s + t.allocatedAmount, 0));
  const remaining = m(amount - allocated);
  const due = m((targets || []).reduce((s, t) => s + t.remainingAmount, 0));
  const visible = (targets || []).filter(t => filter === 'all' || t.type === filter);
  const counts = useMemo(() => (targets || []).reduce((acc, t) => { acc[t.type] = (acc[t.type] || 0) + 1; return acc; }, {} as Record<string, number>), [targets]);

  const errors = targets ? validateDistribution({
    amount, fees, items: targets, saveCredit,
    employees: sideOn ? empRows : [], balances: (side?.balances || []) as any,
    custody: sideOn ? custodyRows : [], custodyAmount: sideOn ? m(custodyRows.reduce((s, r) => s + (r.amount || 0), 0)) : 0,
    expenses: sideOn ? expRows : [],
  }) : [];
  if (sideOn) {
    for (const r of expRows) {
      const e = side?.expenses.find(x => x.id === r.expense_id);
      if (e && r.amount > e.remaining + 0.001) { errors.push(`سداد المصروف «${e.description}» يتجاوز المتبقي عليه (${fmt(e.remaining)})`); break; }
    }
    if (empRows.some(r => r.paymentType === 'from_balance' && !balanceOf(r.employeeId))) errors.push('هذا الموظف ليس له رصيد مستحقات؛ اختر «سلفة»');
  }
  if (purchaseCredit !== null && amount > purchaseCredit + 0.01) errors.unshift(`المبلغ أكبر من رصيد فاتورة المشتريات المتاح (${fmt(purchaseCredit)})`);
  if (friendRental && amount > rentalBalance + 0.01) errors.unshift(`المبلغ أكبر من رصيد إيجار اللوحات (${fmt(rentalBalance)})`);
  if (viaIntermediary && (!collector.trim() || !receiver.trim() || !location.trim() || !collectionDate)) errors.push('أكمل بيانات الوسيط');

  const setAlloc = (key: string, v: number) => setTargets(prev => prev && prev.map(t => t.key !== key ? t : { ...t, allocatedAmount: m(Math.min(v, t.remainingAmount)), selected: v > 0 }));
  const toggle = (key: string, on: boolean) => setTargets(prev => prev && prev.map(t => {
    if (t.key !== key) return t;
    if (!on) return { ...t, selected: false, allocatedAmount: 0 };
    const free = m(amount - allocated);
    return { ...t, selected: true, allocatedAmount: m(Math.max(0, Math.min(t.remainingAmount, free > 0 ? free : t.remainingAmount))) };
  }));
  const apply = (map: Map<string, number>) => setTargets(prev => prev && prev.map(t => {
    const inScope = filter === 'all' || t.type === filter;
    if (!inScope) return t;
    const v = map.get(t.key) || 0;
    return { ...t, selected: v > 0, allocatedAmount: v };
  }));
  const scopeTargets = () => visible.map(t => ({ key: t.key, remaining: t.remainingAmount, date: t.date }));
  const outOfScope = m((targets || []).filter(t => t.selected && !(filter === 'all' || t.type === filter)).reduce((s, t) => s + t.allocatedAmount, 0));

  const save = async () => {
    if (!targets || saving) return;
    if (errors.length) { toast.error(errors[0]); return; }
    setSaving(true);
    try {
      const payments = buildReceiptAllocations({
        items: targets, amount, saveCredit, commission: viaIntermediary ? commission : 0, transferFee: viaIntermediary ? transferFee : 0,
        common: {
          customer_name: customerName, paid_at: date, method,
          reference: method === 'تحويل بنكي' ? reference || null : reference || null,
          notes: notes || null, collected_via_intermediary: viaIntermediary,
          collector_name: viaIntermediary ? collector : null, receiver_name: viaIntermediary ? receiver : null,
          delivery_location: viaIntermediary ? location : null, collection_date: viaIntermediary ? collectionDate : null,
          source_bank: method === 'تحويل بنكي' ? sourceBank || null : null,
          destination_bank: method === 'تحويل بنكي' ? destinationBank || null : null,
          transfer_reference: method === 'تحويل بنكي' ? reference || null : null,
          transfer_image_url: transferImage || null,
        },
      });
      const { error: rpcError } = await (supabase as any).rpc('save_payment_distribution', {
        p_request_id: requestId.current,
        p_payload: {
          group_id: editMode ? editingDistributedPaymentId : groupId.current,
          customer_id: customerId, customer_name: customerName, amount, fees, date, method,
          sender_name: receiver || collector || null,
          expected_payment_ids: editMode ? editingPayments.map((p: any) => p.id) : [],
          source_payment_id: sourceAccountPaymentId || null,
          purchase_invoice_id: purchaseInvoice?.id || null,
          payments, employees: sideEmp, custody: sideCus, expenses: sideExp,
          rentals: rentals.map(r => ({ id: r.id })),
        },
      });
      if (rpcError) throw rpcError;
      toast.success(editMode ? 'تم تحديث التوزيع' : 'تم حفظ الدفعة وتوزيعها');
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'تعذر الحفظ؛ أعد المحاولة');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!saving) onOpenChange(o); }}>
      <DialogContent dir="rtl" className="flex h-[94vh] max-w-[1200px] flex-col gap-0 overflow-hidden p-0 text-right">
        <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 pl-12">
          <span className="rounded-xl bg-primary/15 p-2 text-primary"><Wallet className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-bold">{editMode ? 'تعديل توزيع دفعة' : 'تسجيل وتوزيع دفعة'}</DialogTitle>
            <DialogDescription className="text-sm">{customerName}{purchaseInvoice ? ` · مقايضة بفاتورة مشتريات ${purchaseInvoice.invoice_number}` : ''}{friendRental ? ' · من رصيد إيجار لوحات' : ''}</DialogDescription>
          </div>
        </header>

        {error ? <div className="p-8 text-center text-destructive">{error}</div> : !targets ? (
          <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : (
          <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_1fr]">
            {/* بيانات الدفعة */}
            <aside className="min-h-0 space-y-4 overflow-y-auto border-b border-border bg-muted/20 p-4 lg:border-b-0 lg:border-l">
              <div className="space-y-1">
                <div className="text-sm font-semibold">مبلغ الدفعة</div>
                <Money label="مبلغ الدفعة" value={amount} onChange={setAmount} className="h-14 text-2xl font-bold" />
                <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
                  {due > 0 && <button type="button" className="rounded-md border border-border px-2 py-1 hover:bg-muted" onClick={() => setAmount(due)}>كل المستحق {fmt(due)}</button>}
                  {purchaseCredit !== null && <button type="button" className="rounded-md border border-border px-2 py-1 hover:bg-muted" onClick={() => setAmount(purchaseCredit)}>رصيد المقايضة {fmt(purchaseCredit)}</button>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><div className="text-xs text-muted-foreground">التاريخ</div><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" /></div>
                <div className="space-y-1"><div className="text-xs text-muted-foreground">الطريقة</div>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{['نقدي', 'تحويل بنكي', 'شيك', 'بطاقة ائتمان'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {method === 'تحويل بنكي' && (
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="المصرف المحوِّل" value={sourceBank} onChange={e => setSourceBank(e.target.value)} className="h-9" />
                  <Input placeholder="المصرف المستلم" value={destinationBank} onChange={e => setDestinationBank(e.target.value)} className="h-9" />
                </div>
              )}
              <Input placeholder={method === 'تحويل بنكي' ? 'رقم الحوالة' : method === 'شيك' ? 'رقم الشيك' : 'المرجع (اختياري)'} value={reference} onChange={e => setReference(e.target.value)} className="h-9" />
              <Textarea placeholder="ملاحظات" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
              <ReceiptImagesField value={transferImage} onChange={setTransferImage} customerName={customerName} disabled={saving} />

              <div className="rounded-xl border border-border bg-card p-3">
                <label className="flex items-center justify-between text-sm font-semibold">استلام عبر وسيط<Switch checked={viaIntermediary} onCheckedChange={setViaIntermediary} /></label>
                {viaIntermediary && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Input placeholder="المحصِّل" value={collector} onChange={e => setCollector(e.target.value)} className="h-9" />
                    <Input placeholder="المستلم" value={receiver} onChange={e => setReceiver(e.target.value)} className="h-9" />
                    <Input placeholder="مكان التسليم" value={location} onChange={e => setLocation(e.target.value)} className="h-9" />
                    <Input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)} className="h-9" />
                    <div><div className="text-[11px] text-muted-foreground">عمولة الوسيط</div><Money label="عمولة الوسيط" value={commission} onChange={setCommission} /></div>
                    <div><div className="text-[11px] text-muted-foreground">رسوم التحويل</div><Money label="رسوم التحويل" value={transferFee} onChange={setTransferFee} /></div>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <label className="flex items-center justify-between text-sm font-semibold"><span className="flex items-center gap-2"><Users className="h-4 w-4" />توزيعات إضافية من المبلغ المستلم</span><Switch checked={sideOn} onCheckedChange={enableSide} /></label>
                <p className="mt-1 text-[11px] text-muted-foreground">سلف أو سحب مستحقات لموظف، أو عهدة، أو سداد مصاريف — تُصرف من الأموال المستلمة ولا تغيّر ما يُحسب للزبون.</p>
                {sideOn && (sideLoading || !side ? <Skeleton className="mt-3 h-24 w-full" /> : (
                  <div className="mt-3 space-y-4">
                    <div className={cn('rounded-lg px-3 py-2 text-xs', sideAvailable < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted/50')}>
                      المتاح للصرف: <b className="tabular-nums">{fmt(amount - fees)}</b> · المصروف: <b className="tabular-nums">{fmt(sideOut)}</b> · المتبقي: <b className="tabular-nums">{fmt(sideAvailable)}</b>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold"><span>الموظفون (سلفة / من المستحقات)</span>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => setEmpRows(r => [...r, { employeeId: '', amount: 0, paymentType: 'advance' }])}><Plus className="h-3.5 w-3.5" />إضافة</Button></div>
                      {empRows.map((r, i) => {
                        const bal = balanceOf(r.employeeId);
                        return (
                          <div key={i} className="space-y-1 rounded-lg border border-border p-2">
                            <div className="flex gap-1">
                              <Select value={r.employeeId || undefined} onValueChange={v => setEmpRows(rows => rows.map((x, j) => j === i ? { ...x, employeeId: v, paymentType: balanceOf(v) ? x.paymentType : 'advance' } : x))}>
                                <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="الموظف" /></SelectTrigger>
                                <SelectContent>{side.employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}{e.teamName ? ` · ${e.teamName}` : e.operating ? ' · تشغيل' : ''}</SelectItem>)}</SelectContent>
                              </Select>
                              <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive" aria-label="حذف" onClick={() => setEmpRows(rows => rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                            <div className="flex gap-1">
                              <Select value={r.paymentType} onValueChange={v => setEmpRows(rows => rows.map((x, j) => j === i ? { ...x, paymentType: v as any, amount: v === 'from_balance' ? Math.min(x.amount, rowMax(x.amount, bal?.pendingAmount)) : x.amount } : x))}>
                                <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="advance">سلفة</SelectItem>
                                  <SelectItem value="from_balance" disabled={!bal}>من المستحقات</SelectItem>
                                </SelectContent>
                              </Select>
                              <Money label="مبلغ الموظف" value={r.amount} max={rowMax(r.amount, r.paymentType === 'from_balance' ? bal?.pendingAmount : undefined)} onChange={v => setEmpRows(rows => rows.map((x, j) => j === i ? { ...x, amount: v } : x))} className="flex-1" />
                              <Button size="sm" variant="outline" className="h-9" onClick={() => setEmpRows(rows => rows.map((x, j) => j === i ? { ...x, amount: rowMax(x.amount, x.paymentType === 'from_balance' ? bal?.pendingAmount : undefined) } : x))}>كامل</Button>
                            </div>
                            {bal && <div className="text-[11px] text-muted-foreground">رصيد {bal.teamName}: <b className="tabular-nums">{fmt(bal.pendingAmount)}</b></div>}
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold"><span>عهدة نقدية</span>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => setCustodyRows(r => [...r, { employeeId: '', amount: 0 }])}><Plus className="h-3.5 w-3.5" />إضافة</Button></div>
                      {custodyRows.map((r, i) => (
                        <div key={i} className="flex gap-1">
                          <Select value={r.employeeId || undefined} onValueChange={v => setCustodyRows(rows => rows.map((x, j) => j === i ? { ...x, employeeId: v } : x))}>
                            <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="المستلم" /></SelectTrigger>
                            <SelectContent>{side.employees.map(e => <SelectItem key={e.id} value={e.id} disabled={custodyRows.some((x, j) => j !== i && x.employeeId === e.id)}>{e.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <Money label="مبلغ العهدة" value={r.amount} max={rowMax(r.amount)} onChange={v => setCustodyRows(rows => rows.map((x, j) => j === i ? { ...x, amount: v } : x))} className="w-[110px]" />
                          <Button size="sm" variant="outline" className="h-9" onClick={() => setCustodyRows(rows => rows.map((x, j) => j === i ? { ...x, amount: rowMax(x.amount) } : x))}>كامل</Button>
                          <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive" aria-label="حذف" onClick={() => setCustodyRows(rows => rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-bold">سداد مصاريف موظف</div>
                      {(() => {
                        const empIds = [...new Set(side.expenses.map(x => x.employeeId).filter(Boolean))] as string[];
                        const own = side.expenses.filter(x => (x.employeeId || '') === expEmployee).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
                        const ownDue = m(own.reduce((s2, x) => s2 + x.remaining, 0));
                        const allocMap = new Map(expRows.map(r => [r.expense_id, r.amount]));
                        const distribute = (total: number, empId = expEmployee) => {
                          const list = side.expenses.filter(x => (x.employeeId || '') === empId);
                          const map = allocateOldestFirst(list.map(x => ({ key: x.id, remaining: x.remaining, date: String(x.date || '') })), total);
                          setExpTotal(total);
                          setExpRows([...map.entries()].map(([expense_id, amount]) => ({ expense_id, amount })));
                        };
                        if (!side.expenses.length) return <div className="text-[11px] text-muted-foreground">لا توجد مصاريف غير مسددة</div>;
                        return (
                          <div className="space-y-2 rounded-lg border border-border p-2">
                            <Select value={expEmployee || undefined} onValueChange={v => { setExpEmployee(v); distribute(0, v); }}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                              <SelectContent>
                                {empIds.map(id => {
                                  const due = m(side.expenses.filter(x => x.employeeId === id).reduce((s2, x) => s2 + x.remaining, 0));
                                  return <SelectItem key={id} value={id}>{side.employees.find(e => e.id === id)?.name || side.expenses.find(x => x.employeeId === id)?.employeeName || 'موظف'} — {fmt(due)}</SelectItem>;
                                })}
                              </SelectContent>
                            </Select>
                            {expEmployee && (
                              <>
                                <div className="flex gap-1">
                                  <Money label="المبلغ المدفوع للموظف" value={expTotal} max={rowMax(expTotal, ownDue)} onChange={v => distribute(v)} className="flex-1" />
                                  <Button size="sm" variant="outline" className="h-9" onClick={() => distribute(rowMax(expTotal, ownDue))}>كامل {fmt(rowMax(expTotal, ownDue))}</Button>
                                </div>
                                <div className="text-[11px] text-muted-foreground">يُوزَّع على مصروفاته من الأقدم؛ ما لا يُغطّى يبقى غير مسدد.</div>
                                <div className="max-h-48 space-y-1 overflow-y-auto">
                                  {own.map(x => {
                                    const a = allocMap.get(x.id) || 0;
                                    return (
                                      <div key={x.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1 text-[11px]">
                                        <span className="min-w-0 truncate">{x.description}{x.date ? ` · ${String(x.date).slice(0, 10)}` : ''}</span>
                                        <span className="shrink-0 tabular-nums">{a > 0 ? <b className={a >= x.remaining ? 'text-emerald-600' : 'text-amber-600'}>{fmt(a)}</b> : <span className="text-muted-foreground">غير مسدد</span>} / {fmt(x.remaining)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            {/* المستحقات */}
            <section className="flex min-h-0 flex-col">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <div className="flex flex-wrap gap-1 rounded-lg border border-border p-0.5">
                  {(['all', 'contract', 'composite_task', 'printed_invoice', 'sales_invoice'] as const).filter(k => k === 'all' || counts[k]).map(k => (
                    <button key={k} type="button" onClick={() => setFilter(k)} className={cn('rounded-md px-3 py-1.5 text-sm', filter === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                      {k === 'all' ? 'الكل' : TYPE_META[k].label} <span className="tabular-nums opacity-70">{k === 'all' ? targets.length : counts[k]}</span>
                    </button>
                  ))}
                </div>
                <div className="ms-auto flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => apply(allocateOldestFirst(scopeTargets(), m(amount - outOfScope)))} disabled={amount <= 0}><Sparkles className="h-4 w-4" />توزيع ذكي (الأقدم أولاً)</Button>
                  <Button size="sm" variant="outline" onClick={() => apply(allocateProportional(scopeTargets(), m(amount - outOfScope)))} disabled={amount <= 0}><Scale className="h-4 w-4" />بالتناسب</Button>
                  <Button size="sm" variant="ghost" onClick={() => apply(new Map())}><X className="h-4 w-4" />مسح</Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {!visible.length && <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">لا توجد مستحقات مفتوحة{filter !== 'all' ? ' في هذا القسم' : ''}</div>}
                {visible.map(t => {
                  const Icon = TYPE_META[t.type].icon;
                  const pct = t.totalAmount > 0 ? Math.min(100, Math.round(((t.paidAmount + (t.selected ? t.allocatedAmount : 0)) / t.totalAmount) * 100)) : 0;
                  return (
                    <div key={t.key} className={cn('flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors', t.selected ? 'border-primary/60 bg-primary/5' : 'border-border bg-card')}>
                      <Checkbox checked={t.selected} onCheckedChange={c => toggle(t.key, !!c)} aria-label={`تحديد ${t.displayName}`} className="h-5 w-5" />
                      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-[180px] flex-1">
                        <div className="flex flex-wrap items-center gap-2"><b>{t.displayName}</b>{t.subTasks && t.subTasks.length > 1 && <span className="flex items-center gap-1 rounded bg-muted px-1.5 text-[11px]"><Layers className="h-3 w-3" />{t.subTasks.length} فرق</span>}</div>
                        {t.subtitle && <div className="text-xs text-muted-foreground">{t.subtitle}</div>}
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"><div className={cn('h-full', pct >= 100 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${pct}%` }} /></div>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{pct}%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs tabular-nums">
                        <div><div className="text-muted-foreground">القيمة</div><div>{fmt(t.totalAmount)}</div></div>
                        <div><div className="text-muted-foreground">المدفوع</div><div className="text-emerald-600">{fmt(t.paidAmount)}</div></div>
                        <div><div className="text-muted-foreground">المتبقي</div><div className="font-semibold text-destructive">{fmt(t.remainingAmount)}</div></div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Money label={`مبلغ ${t.displayName}`} value={t.allocatedAmount} max={t.remainingAmount} onChange={v => setAlloc(t.key, v)} className="w-[120px]" />
                        <Button size="sm" variant="outline" className="h-9" title="ما يتسع له المتبقي من مبلغ الدفعة بعد بقية البنود"
                          onClick={() => setAlloc(t.key, amount > 0 ? m(Math.max(0, Math.min(t.remainingAmount, amount - (allocated - t.allocatedAmount)))) : t.remainingAmount)}>كامل</Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border bg-muted/30 px-4 py-3">
                <div className="text-sm"><span className="text-muted-foreground">الدفعة </span><b className="tabular-nums">{fmt(amount)}</b></div>
                <div className="text-sm"><span className="text-muted-foreground">موزّع </span><b className="tabular-nums text-primary">{fmt(allocated)}</b></div>
                <div className="text-sm"><span className="text-muted-foreground">غير موزّع </span><b className={cn('tabular-nums', remaining < 0 ? 'text-destructive' : remaining > 0 ? 'text-amber-600' : 'text-emerald-600')}>{fmt(remaining)}</b></div>
                {fees > 0 && <div className="text-sm"><span className="text-muted-foreground">عمولات </span><b className="tabular-nums">{fmt(fees)}</b></div>}
                <label className="flex items-center gap-2 text-sm"><Switch checked={saveCredit} onCheckedChange={setSaveCredit} />حفظ غير الموزّع رصيداً في الحساب</label>
                <div className="ms-auto flex items-center gap-2">
                  {errors.length > 0 && amount > 0 && <span className="max-w-[320px] truncate text-xs text-destructive" title={errors.join('\n')}>{errors[0]}</span>}
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>إلغاء</Button>
                  <Button onClick={save} disabled={saving || errors.length > 0} className="min-w-[120px]">{saving && <Loader2 className="h-4 w-4 animate-spin" />}حفظ الدفعة</Button>
                </div>
              </footer>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
