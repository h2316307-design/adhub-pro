/**
 * تفاصيل الدفعة الموزعة — مبنية من الصفر.
 * ملخص واضح: المستلم ← رسوم التحصيل ← الموزع على مستحقات الزبون ← التوزيعات الجانبية ← الرصيد الزائد،
 * مع المتبقي الحالي لكل عقد/فاتورة، وبيانات الوسيط قابلة للتعديل، وكل أوامر الطباعة السابقة.
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { compositeTaskLabel } from '@/lib/compositeTaskLabel';
import {
  ArrowDownToLine, Banknote, Briefcase, CalendarDays, Edit, FileText, HandCoins, Loader2, Printer, Receipt, Save,
  Trash2, UserCheck, Users, Wallet, X,
} from 'lucide-react';
import type { PaymentRow } from './BillingTypes';
import IntermediaryReceiptPrintDialog from './IntermediaryReceiptPrintDialog';
import { ConvertToCustodyDialog } from './ConvertToCustodyDialog';
import { useUnifiedReceiptPrint } from './UnifiedReceiptPrint';
import { printDistributedUnifiedReceipt } from './distributedReceiptPrint';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupedPayments: PaymentRow[];
  totalAmount: number;
  onPrintCombined: () => void;
  onPrintIndividual: (payment: PaymentRow) => void;
  onDelete: () => void;
  onEdit?: () => void;
  customerName: string;
}

interface TargetInfo { label: string; sub?: string; due: number; paid: number }
interface SideRow { kind: 'advance' | 'balance' | 'custody' | 'withdrawal' | 'expense'; title: string; sub?: string; amount: number }

const money = (n: number) => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US')} د.ل`;
const dmy = (s?: string | null) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—');
const num = (v: unknown) => Number(v) || 0;
const sb = supabase as any;

function targetKey(p: PaymentRow) {
  if (p.contract_number) return `c:${p.contract_number}`;
  if (p.printed_invoice_id) return `pi:${p.printed_invoice_id}`;
  if (p.sales_invoice_id) return `si:${p.sales_invoice_id}`;
  if (p.composite_task_id) return `ct:${p.composite_task_id}`;
  return 'surplus';
}

async function loadTargets(rows: PaymentRow[]): Promise<Record<string, TargetInfo>> {
  const ids = (k: keyof PaymentRow) => [...new Set(rows.map(r => r[k]).filter(Boolean))] as any[];
  const [contracts, printed, sales, tasks] = await Promise.all([
    ids('contract_number').length ? sb.from('Contract').select('Contract_Number, "Ad Type", Total, "Total Paid"').in('Contract_Number', ids('contract_number').map(Number)) : { data: [] },
    ids('printed_invoice_id').length ? sb.from('printed_invoices').select('id, invoice_number, total_amount, paid_amount').in('id', ids('printed_invoice_id')) : { data: [] },
    ids('sales_invoice_id').length ? sb.from('sales_invoices').select('id, invoice_number, invoice_name, total_amount, paid_amount').in('id', ids('sales_invoice_id')) : { data: [] },
    ids('composite_task_id').length ? sb.from('composite_tasks').select('*').in('id', ids('composite_task_id')) : { data: [] },
  ]);
  const out: Record<string, TargetInfo> = {};
  (contracts.data || []).forEach((c: any) => { out[`c:${c.Contract_Number}`] = { label: `عقد #${c.Contract_Number}`, sub: c['Ad Type'] || undefined, due: num(c.Total), paid: num(c['Total Paid']) }; });
  (printed.data || []).forEach((i: any) => { out[`pi:${i.id}`] = { label: `فاتورة طباعة #${i.invoice_number || ''}`, due: num(i.total_amount), paid: num(i.paid_amount) }; });
  (sales.data || []).forEach((i: any) => { out[`si:${i.id}`] = { label: `فاتورة مبيعات #${i.invoice_number || ''}`, sub: i.invoice_name || undefined, due: num(i.total_amount), paid: num(i.paid_amount) }; });
  (tasks.data || []).forEach((t: any) => {
    let label = 'أمر تركيب';
    try { label = compositeTaskLabel(t); } catch { /* label fallback */ }
    out[`ct:${t.id}`] = { label, sub: t.contract_id ? `عقد #${t.contract_id}` : undefined, due: num(t.customer_total), paid: num(t.paid_amount) };
  });
  return out;
}

async function loadSide(groupId: string): Promise<SideRow[]> {
  const [adv, team, cust, wd, exp] = await Promise.all([
    sb.from('employee_advances').select('amount, reason, employee:employees(name)').eq('distributed_payment_id', groupId),
    sb.from('installation_team_accounts').select('amount, team:installation_teams(team_name)').eq('distributed_payment_id', groupId),
    sb.from('custody_accounts').select('initial_amount, current_balance, account_number, custody_name, employee:employees(name)').eq('source_payment_id', groupId),
    sb.from('expenses_withdrawals').select('amount, receiver_name, notes, note').eq('distributed_payment_id', groupId),
    sb.from('expense_payments').select('amount, expense:expenses(description, receiver_name, expense_date)').eq('distributed_payment_id', groupId),
  ]);
  const rows: SideRow[] = [];
  (adv.data || []).forEach((a: any) => rows.push({ kind: 'advance', title: `سلفة — ${a.employee?.name || 'موظف'}`, sub: a.reason || undefined, amount: num(a.amount) }));
  const teams = new Map<string, number>();
  (team.data || []).forEach((t: any) => teams.set(t.team?.team_name || 'فرقة تركيب', (teams.get(t.team?.team_name || 'فرقة تركيب') || 0) + num(t.amount)));
  teams.forEach((v, k) => rows.push({ kind: 'balance', title: `من مستحقات — ${k}`, amount: v }));
  (cust.data || []).forEach((c: any) => rows.push({ kind: 'custody', title: `عهدة — ${c.employee?.name || c.custody_name || 'موظف'}`, sub: `${c.account_number || ''} · الرصيد الحالي ${money(c.current_balance)}`, amount: num(c.initial_amount) }));
  (wd.data || []).forEach((w: any) => rows.push({ kind: 'withdrawal', title: `سحب من الرصيد — ${w.receiver_name || ''}`.trim(), sub: w.notes || w.note || undefined, amount: num(w.amount) }));
  (exp.data || []).forEach((e: any) => rows.push({ kind: 'expense', title: `سداد مصروف — ${e.expense?.description || ''}`.trim(), sub: [e.expense?.receiver_name, dmy(e.expense?.expense_date)].filter(Boolean).join(' · '), amount: num(e.amount) }));
  return rows;
}

const SIDE_ICON = { advance: HandCoins, balance: Users, custody: Briefcase, withdrawal: ArrowDownToLine, expense: Receipt };

export function DistributedPaymentDetailsDialog({
  open, onOpenChange, groupedPayments, totalAmount, onPrintCombined, onPrintIndividual, onDelete, onEdit, customerName,
}: Props) {
  const { confirm } = useSystemDialog();
  const { print: printReceipt, isPrinting } = useUnifiedReceiptPrint();
  const first = groupedPayments[0];
  const groupId = first?.distributed_payment_id || '';

  const [targets, setTargets] = useState<Record<string, TargetInfo> | null>(null);
  const [side, setSide] = useState<SideRow[] | null>(null);
  const [editInter, setEditInter] = useState(false);
  const [inter, setInter] = useState({ on: false, collector: '', receiver: '', location: '', date: '', commission: '', fee: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [interPrintOpen, setInterPrintOpen] = useState(false);
  const [custodyOpen, setCustodyOpen] = useState(false);
  const [printingUnified, setPrintingUnified] = useState(false);

  const reloadSide = () => { if (groupId) loadSide(groupId).then(setSide).catch(() => setSide([])); else setSide([]); };

  useEffect(() => {
    if (!open || !first) return;
    setTargets(null); setSide(null); setEditInter(false);
    loadTargets(groupedPayments).then(setTargets).catch(() => setTargets({}));
    reloadSide();
    setInter({
      on: !!first.collected_via_intermediary,
      collector: first.collector_name || '', receiver: first.receiver_name || '', location: first.delivery_location || '',
      date: first.collection_date || '',
      commission: String(groupedPayments.reduce((s, p) => s + num(p.intermediary_commission), 0) || ''),
      fee: String(groupedPayments.reduce((s, p) => s + num(p.transfer_fee), 0) || ''),
      notes: first.commission_notes || '',
    });
  }, [open, groupedPayments]); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = useMemo(() => {
    const m = new Map<string, { key: string; amount: number; rows: PaymentRow[] }>();
    groupedPayments.forEach(p => {
      const k = targetKey(p);
      const g = m.get(k) || { key: k, amount: 0, rows: [] };
      g.amount += num(p.amount); g.rows.push(p);
      m.set(k, g);
    });
    return [...m.values()].sort((a, b) => (a.key === 'surplus' ? 1 : b.key === 'surplus' ? -1 : b.amount - a.amount));
  }, [groupedPayments]);

  if (!first) return null;

  const fees = groupedPayments.reduce((s, p) => s + num(p.intermediary_commission) + num(p.transfer_fee), 0);
  const surplus = lines.find(l => l.key === 'surplus')?.amount || 0;
  const toTargets = totalAmount - surplus;
  const sideTotal = (side || []).reduce((s, r) => s + r.amount, 0);
  const kept = totalAmount - fees - sideTotal;

  const saveIntermediary = async () => {
    if (!groupId) { toast.error('معرف الدفعة غير موجود'); return; }
    if (inter.on && (!inter.collector.trim() || !inter.receiver.trim())) { toast.error('اسم المحصِّل والمستلِم مطلوبان'); return; }
    setSaving(true);
    try {
      const totalComm = num(inter.commission), totalFee = num(inter.fee);
      // تُوزَّع العمولة والرسوم على أسطر الدفعة بنسبة مبالغها (لتبقى مطابقة لإجمالي الرسوم)
      const sum = groupedPayments.reduce((s, p) => s + num(p.amount), 0) || 1;
      let cAcc = 0, fAcc = 0;
      const updates = groupedPayments.map((p, i) => {
        const last = i === groupedPayments.length - 1;
        const c = inter.on ? (last ? Math.round((totalComm - cAcc) * 100) / 100 : Math.round(totalComm * num(p.amount) / sum * 100) / 100) : 0;
        const f = inter.on ? (last ? Math.round((totalFee - fAcc) * 100) / 100 : Math.round(totalFee * num(p.amount) / sum * 100) / 100) : 0;
        cAcc += c; fAcc += f;
        return sb.from('customer_payments').update({
          collected_via_intermediary: inter.on,
          collector_name: inter.on ? inter.collector.trim() : null,
          receiver_name: inter.on ? inter.receiver.trim() : null,
          delivery_location: inter.on ? inter.location.trim() || null : null,
          collection_date: inter.on ? inter.date || null : null,
          intermediary_commission: c || null,
          transfer_fee: f || null,
          net_amount: Math.round((num(p.amount) - c - f) * 100) / 100,
          commission_notes: inter.on ? inter.notes.trim() || null : null,
        }).eq('id', p.id);
      });
      const res = await Promise.all(updates);
      const bad = res.find((r: any) => r.error);
      if (bad) throw bad.error;
      toast.success('تم حفظ بيانات التحصيل');
      setEditInter(false);
      groupedPayments.forEach(p => Object.assign(p, {
        collected_via_intermediary: inter.on, collector_name: inter.collector, receiver_name: inter.receiver,
        delivery_location: inter.location, collection_date: inter.date, commission_notes: inter.notes,
      }));
    } catch (e: any) { toast.error(`تعذّر الحفظ: ${e.message || e}`); } finally { setSaving(false); }
  };

  const printUnified = async () => {
    setPrintingUnified(true);
    try { await printDistributedUnifiedReceipt(groupedPayments, customerName, totalAmount, printReceipt); }
    catch (e: any) { toast.error(`تعذّرت الطباعة: ${e.message || e}`); } finally { setPrintingUnified(false); }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'حذف الدفعة الموزعة', message: `حذف هذه الدفعة (${money(totalAmount)}) بكل توزيعاتها؟ تعود العقود والفواتير والمصروفات المرتبطة إلى حالتها السابقة.`, confirmText: 'حذف', variant: 'destructive' } as any))) return;
    onDelete();
    onOpenChange(false);
  };

  const Stat = ({ label, value, tone, icon: Icon }: { label: string; value: number; tone?: string; icon: any }) => (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className={cn('mt-1 text-lg font-bold tabular-nums', tone)}>{money(value)}</div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden p-0" dir="rtl">
        <DialogHeader className="border-b border-border px-5 pb-3 pt-5 text-right">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-primary" />دفعة موزعة — {customerName || first.customer_name}
          </DialogTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{dmy(first.paid_at)}</span>
            <span className="flex items-center gap-1"><Banknote className="h-3.5 w-3.5" />{first.method || 'نقدي'}</span>
            {first.reference && <span>مرجع: {first.reference}</span>}
            {first.collected_via_intermediary && <span className="flex items-center gap-1 text-primary"><UserCheck className="h-3.5 w-3.5" />عبر وسيط: {first.collector_name}</span>}
            {groupId && <span dir="ltr" className="font-mono opacity-70">#{groupId.slice(-8)}</span>}
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* الملخص */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="المبلغ المستلم" value={totalAmount} icon={Wallet} />
            <Stat label="على مستحقات الزبون" value={toTargets} icon={FileText} tone="text-emerald-600 dark:text-emerald-400" />
            <Stat label="رسوم التحصيل" value={fees} icon={HandCoins} tone={fees ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'} />
            <Stat label="توزيعات جانبية" value={sideTotal} icon={Users} tone={sideTotal ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground'} />
          </div>
          {(fees > 0 || sideTotal > 0) && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              الصافي الذي بقي في الخزينة: <b className="tabular-nums">{money(kept)}</b>
              <span className="text-muted-foreground"> = {money(totalAmount)}{fees ? ` − رسوم ${money(fees)}` : ''}{sideTotal ? ` − توزيعات ${money(sideTotal)}` : ''}</span>
            </div>
          )}

          {/* التوزيع على المستحقات */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold">التوزيع على مستحقات الزبون</h3>
            <div className="overflow-hidden rounded-xl border border-border">
              {!targets ? <div className="space-y-2 p-3">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div> : lines.map(l => {
                const t = targets[l.key];
                const remaining = t ? Math.max(0, t.due - t.paid) : 0;
                return (
                  <div key={l.key} className="flex flex-wrap items-center gap-3 border-b border-border p-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{l.key === 'surplus' ? 'رصيد زائد لحساب الزبون' : t?.label || 'بند'}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.key === 'surplus' ? 'غير مخصص لعقد أو فاتورة — يُخصم من مستحقاته القادمة'
                          : t ? <>{t.sub ? `${t.sub} · ` : ''}الإجمالي {money(t.due)} · {remaining > 0.009 ? <span className="text-amber-600 dark:text-amber-400">المتبقي الآن {money(remaining)}</span> : <span className="text-emerald-600 dark:text-emerald-400">مسدد بالكامل</span>}</> : null}
                      </div>
                    </div>
                    <div className="text-base font-bold tabular-nums">{money(l.amount)}</div>
                    <Button size="sm" variant="ghost" className="h-8" title="إيصال هذا البند" onClick={() => onPrintIndividual(l.rows[0])}><Printer className="h-3.5 w-3.5" /></Button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* التوزيعات الجانبية */}
          {(side === null || side.length > 0) && (
            <section className="space-y-2">
              <h3 className="text-sm font-bold">التوزيعات الجانبية (من نفس المبلغ)</h3>
              <div className="overflow-hidden rounded-xl border border-border">
                {side === null ? <Skeleton className="m-3 h-10" /> : side.map((r, i) => {
                  const Icon = SIDE_ICON[r.kind];
                  return (
                    <div key={i} className="flex items-center gap-3 border-b border-border p-3 last:border-b-0">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1"><div className="font-medium">{r.title}</div>{r.sub && <div className="text-xs text-muted-foreground">{r.sub}</div>}</div>
                      <div className="font-bold tabular-nums">{money(r.amount)}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* التحصيل والوسيط */}
          <section className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-bold"><UserCheck className="h-4 w-4" />تفاصيل التحصيل</h3>
              {!editInter
                ? <Button size="sm" variant="outline" className="h-8" onClick={() => setEditInter(true)}><Edit className="h-3.5 w-3.5" />تعديل</Button>
                : <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditInter(false)}><X className="h-3.5 w-3.5" />إلغاء</Button>}
            </div>
            {!editInter ? (
              first.collected_via_intermediary ? (
                <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div><span className="text-muted-foreground">المحصِّل: </span>{first.collector_name || '—'}</div>
                  <div><span className="text-muted-foreground">سُلِّم إلى: </span>{first.receiver_name || '—'}</div>
                  <div><span className="text-muted-foreground">مكان التسليم: </span>{first.delivery_location || '—'}</div>
                  <div><span className="text-muted-foreground">تاريخ القبض: </span>{dmy(first.collection_date)}</div>
                  <div><span className="text-muted-foreground">عمولة الوسيط: </span>{money(groupedPayments.reduce((s, p) => s + num(p.intermediary_commission), 0))}</div>
                  <div><span className="text-muted-foreground">رسوم التحويل: </span>{money(groupedPayments.reduce((s, p) => s + num(p.transfer_fee), 0))}</div>
                  {first.commission_notes && <div className="sm:col-span-2"><span className="text-muted-foreground">ملاحظات: </span>{first.commission_notes}</div>}
                </div>
              ) : <p className="text-sm text-muted-foreground">استُلمت الدفعة مباشرة دون وسيط.</p>
            ) : (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm"><Switch checked={inter.on} onCheckedChange={v => setInter(s => ({ ...s, on: v }))} />استُلمت عبر وسيط</label>
                {inter.on && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-xs">المحصِّل (استلم من الزبون)<Input value={inter.collector} onChange={e => setInter(s => ({ ...s, collector: e.target.value }))} /></label>
                    <label className="space-y-1 text-xs">سُلِّم إلى<Input value={inter.receiver} onChange={e => setInter(s => ({ ...s, receiver: e.target.value }))} /></label>
                    <label className="space-y-1 text-xs">مكان التسليم<Input value={inter.location} onChange={e => setInter(s => ({ ...s, location: e.target.value }))} /></label>
                    <label className="space-y-1 text-xs">تاريخ القبض<Input type="date" value={inter.date} onChange={e => setInter(s => ({ ...s, date: e.target.value }))} /></label>
                    <label className="space-y-1 text-xs">عمولة الوسيط (د.ل)<Input type="number" min={0} value={inter.commission} onChange={e => setInter(s => ({ ...s, commission: e.target.value }))} /></label>
                    <label className="space-y-1 text-xs">رسوم التحويل (د.ل)<Input type="number" min={0} value={inter.fee} onChange={e => setInter(s => ({ ...s, fee: e.target.value }))} /></label>
                    <label className="space-y-1 text-xs sm:col-span-2">ملاحظات العمولة<Input value={inter.notes} onChange={e => setInter(s => ({ ...s, notes: e.target.value }))} /></label>
                  </div>
                )}
                <div className="flex justify-end"><Button size="sm" onClick={saveIntermediary} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}حفظ</Button></div>
              </div>
            )}
          </section>
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-5 py-3">
          <Button onClick={printUnified} disabled={printingUnified || isPrinting}>{printingUnified ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}إيصال موحد</Button>
          <Button variant="outline" onClick={onPrintCombined}><Printer className="h-4 w-4" />طباعة مجمعة</Button>
          {first.collected_via_intermediary && <Button variant="outline" onClick={() => setInterPrintOpen(true)}><UserCheck className="h-4 w-4" />إيصال الوسيط</Button>}
          <Button variant="outline" onClick={() => setCustodyOpen(true)}><Briefcase className="h-4 w-4" />تحويل لعهدة</Button>
          <div className="ms-auto flex gap-2">
            {onEdit && <Button variant="secondary" onClick={() => { onEdit(); onOpenChange(false); }}><Edit className="h-4 w-4" />تعديل التوزيع</Button>}
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={remove}><Trash2 className="h-4 w-4" />حذف</Button>
          </div>
        </footer>

        <IntermediaryReceiptPrintDialog open={interPrintOpen} onOpenChange={setInterPrintOpen} groupedPayments={groupedPayments} totalAmount={totalAmount} customerName={customerName} />
        <ConvertToCustodyDialog
          open={custodyOpen}
          onOpenChange={setCustodyOpen}
          groupedPayments={groupedPayments}
          totalAmount={totalAmount}
          distributedPaymentId={groupId}
          onSuccess={() => { toast.success('تم التحويل إلى عهدة'); reloadSide(); }}
        />
      </DialogContent>
    </Dialog>
  );
}
