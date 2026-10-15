import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Wrench, Printer, Scissors, Percent, Search, Loader2, ShieldCheck, ImageIcon, Save } from 'lucide-react';
import { money, applyBulkPrice, computeOperation, lineArea, smartDistribute, type BulkMode, type BulkTarget } from '@/lib/compositeCosts';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { loadEditor, saveEditor, type EditorLine, type EditorState, type OperationRow } from '@/services/compositeOperations';


type Tab = 'installation' | 'print' | 'cutout' | 'discount';

function Num({ value, onChange, disabled, className, label }: { value: number; onChange: (v: number) => void; disabled?: boolean; className?: string; label: string }) {
  const [text, setText] = useState(String(value ?? 0));
  useEffect(() => { setText(String(value ?? 0)); }, [value]);
  return (
    <Input
      dir="ltr"
      inputMode="decimal"
      aria-label={label}
      disabled={disabled}
      value={disabled ? '0' : text}
      onChange={e => {
        const t = e.target.value.replace(/[^0-9.]/g, '');
        setText(t);
        onChange(Math.max(0, Number(t) || 0));
      }}
      onFocus={e => e.currentTarget.select()}
      className={cn('h-9 text-center tabular-nums', className)}
    />
  );
}

function BoardCell({ l, extra }: { l: EditorLine; extra?: string }) {
  const place = [l.area, l.municipality].filter(Boolean).join(' · ');
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
        {l.image ? <img src={l.image} alt="" loading="lazy" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
      </span>
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5"><span className="truncate font-semibold">{l.name}</span><span className="shrink-0 rounded bg-muted px-1.5 text-[10px] tabular-nums">{l.size}</span></div>
        {l.landmark && <div className="truncate text-[11px] text-muted-foreground">{l.landmark}</div>}
        {(place || extra) && <div className="truncate text-[11px] text-muted-foreground/80">{[place, extra].filter(Boolean).join(' · ')}</div>}
      </div>
    </div>
  );
}

function IncludedBanner({ what, contractValue, expense }: { what: string; contractValue: number; expense: number }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      <div className="space-y-1">
        <div className="font-bold text-emerald-700 dark:text-emerald-400">{what} مشمول في سعر العقد — قيمته على الزبون 0 د.ل</div>
        <div className="text-muted-foreground">
          تكلفة التنفيذ ({money(expense)}) تُسجَّل مصروفاً على العقد ولا تُحسب خسارة على المهمة.
          {contractValue > 0 && <> قيمة {what} المسجلة في العقد: <b className="tabular-nums">{money(contractValue)}</b>.</>}
        </div>
      </div>
    </div>
  );
}

export function CostEditorDialog({ op, open, onOpenChange, onSaved }: { op: OperationRow | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const { confirm } = useSystemDialog();
  const [state, setState] = useState<EditorState | null>(null);
  const [lines, setLines] = useState<EditorLine[]>([]);
  const [printEnabled, setPrintEnabled] = useState(false);
  const [printCust, setPrintCust] = useState(0);
  const [printComp, setPrintComp] = useState(0);
  const [printerId, setPrinterId] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [notes, setNotes] = useState('');
  const [tab, setTab] = useState<Tab>('installation');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState<BulkTarget>('company');
  const [bulkMode, setBulkMode] = useState<BulkMode | 'table' | 'total'>('meter');
  const [bulkValue, setBulkValue] = useState(0);
  const [cutTotalCust, setCutTotalCust] = useState(0);
  const [cutTotalComp, setCutTotalComp] = useState(0);

  useEffect(() => {
    if (!open || !op) return;
    let cancelled = false;
    setState(null); setError(null); setTab('installation'); setQ(''); setTeam('all'); setSelected(new Set());
    loadEditor(op).then(s => {
      if (cancelled) return;
      setState(s);
      setLines(s.lines);
      setPrintEnabled(s.draft.printEnabled);
      // سعر متر الطباعة للزبون: الحالي، أو من آخر عملية سابقة له
      const incPrint = s.draft.type === 'new_installation' && s.draft.contractIncludesPrint;
      setPrintCust(s.draft.printCustomerPerMeter || (incPrint ? 0 : s.suggested.printPerMeter));
      setPrintComp(s.draft.printCompanyPerMeter);
      setPrinterId(s.printerId);
      setDiscount(s.draft.discount);
      setDiscountReason(s.discountReason);
      setNotes(s.notes);
      const cut = computeOperation(s.draft).cutout;
      setCutTotalCust(cut.customer);
      setCutTotalComp(cut.company);
      const incInst = s.draft.contractIncludesInstallation && s.draft.type === 'new_installation';
      setBulkTarget(incInst ? 'company' : 'customer');
      setBulkMode('meter');
      // سعر المتر المحفوظ لهذه العملية إن وُجد، وإلا المقترح من آخر عملية للزبون
      const savedRates = [...new Set(s.lines.map(l => l.customerPerMeter).filter(Boolean))];
      setBulkValue(incInst ? 0 : savedRates.length === 1 ? Number(savedRates[0]) : s.suggested.installPerMeter);
    }).catch(e => !cancelled && setError(e.message || 'تعذر تحميل البيانات'));
    return () => { cancelled = true; };
  }, [open, op]);

  const draft = useMemo(() => state ? {
    ...state.draft, lines, printEnabled, printCustomerPerMeter: printCust, printCompanyPerMeter: printComp, discount,
  } : null, [state, lines, printEnabled, printCust, printComp, discount]);
  const totals = useMemo(() => draft ? computeOperation(draft) : null, [draft]);

  const teams = useMemo(() => [...new Set(lines.map(l => l.teamName))], [lines]);
  const sizes = useMemo(() => [...new Set(lines.map(l => l.size))], [lines]);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return lines.filter(l => (team === 'all' || l.teamName === team)
      && (!s || l.name.toLowerCase().includes(s) || String(l.billboardId).includes(s) || l.size.toLowerCase().includes(s) || (l.landmark || '').toLowerCase().includes(s)));
  }, [lines, q, team]);

  const dirty = useMemo(() => {
    if (!state) return false;
    return JSON.stringify(lines) !== JSON.stringify(state.lines) || printEnabled !== state.draft.printEnabled
      || printCust !== state.draft.printCustomerPerMeter || printComp !== state.draft.printCompanyPerMeter
      || discount !== state.draft.discount || discountReason !== state.discountReason || notes !== state.notes || printerId !== state.printerId;
  }, [state, lines, printEnabled, printCust, printComp, discount, discountReason, notes, printerId]);

  const update = (id: string, patch: Partial<EditorLine>) => setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));

  const [scope, setScope] = useState<string>('visible');
  const applyBulk = () => {
    const ids = new Set(
      scope === 'selected' ? [...selected]
        : scope === 'visible' ? visible.map(l => l.id)
        : lines.filter(l => l.size === scope.replace(/^size:/, '')).map(l => l.id),
    );
    if (!ids.size) { toast.error('لا توجد لوحات ضمن النطاق المحدد'); return; }
    if (bulkMode === 'total') {
      const shares = smartDistribute(bulkValue, lines.filter(l => ids.has(l.id)).map(l => ({ id: l.id, weight: lineArea(l) })));
      setLines(prev => prev.map(l => !shares.has(l.id) ? l : bulkTarget === 'customer' ? { ...l, customer: shares.get(l.id)!, customerPerMeter: null } : { ...l, company: shares.get(l.id)! }));
      toast.success(`تم توزيع ${money(bulkValue)} على ${ids.size} لوحة حسب المساحة`);
      return;
    }
    if (bulkMode === 'table') {
      setLines(prev => prev.map(l => !ids.has(l.id) ? l : bulkTarget === 'customer' ? { ...l, customer: l.sizeInstallPrice, customerPerMeter: null } : { ...l, company: l.sizeInstallPrice }));
    } else {
      // سعر المتر على الزبون يُحفظ مع كل لوحة ليظهر في المحرر والفاتورة
      const rate = bulkTarget === 'customer' && bulkMode === 'meter' && bulkValue > 0 ? Math.round(bulkValue * 100) / 100 : null;
      setLines(prev => (applyBulkPrice(prev, ids, bulkTarget, bulkMode, bulkValue) as EditorLine[])
        .map(l => ids.has(l.id) && bulkTarget === 'customer' ? { ...l, customerPerMeter: rate } : l));
    }
    toast.success(`تم تطبيق السعر على ${ids.size} لوحة`);
  };

  const distributeCutout = () => {
    const active = lines.filter(l => l.hasCutout);
    if (!active.length) { toast.error('فعّل المجسم على لوحة واحدة على الأقل'); return; }
    const weights = active.map(l => ({ id: l.id, weight: lineArea(l) }));
    const cust = smartDistribute(cutTotalCust, weights);
    const comp = smartDistribute(cutTotalComp, weights);
    setLines(prev => prev.map(l => {
      if (!l.hasCutout) return l;
      const q = Math.max(1, Math.round(l.cutoutCount) || 1);
      return { ...l, cutoutCount: q, cutoutCustomerUnit: Math.round(((cust.get(l.id) || 0) / q) * 100) / 100, cutoutCompanyUnit: Math.round(((comp.get(l.id) || 0) / q) * 100) / 100 };
    }));
    toast.success(`تم التوزيع على ${active.length} لوحة`);
  };

  const close = async (o: boolean) => {
    if (!o && dirty && !saving) {
      const ok = await confirm({ title: 'تعديلات غير محفوظة', message: 'هل تريد الإغلاق دون حفظ التعديلات؟', confirmText: 'إغلاق دون حفظ' } as any);
      if (!ok) return;
    }
    onOpenChange(o);
  };

  const save = async () => {
    if (!state || !draft) return;
    if (printEnabled && !lines.some(l => l.inPrint)) { toast.error('اختر لوحة واحدة على الأقل للطباعة أو أوقف الطباعة'); setTab('print'); return; }
    setSaving(true);
    try {
      await saveEditor(state, lines, draft, { discountReason, notes, printerId });
      toast.success('تم حفظ التكاليف');
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const instIncluded = !!totals?.installation.included;
  const printIncluded = !!totals?.print.included;

  const tabs: { key: Tab; label: string; icon: any; value?: string }[] = [
    { key: 'installation', label: 'التركيب', icon: Wrench, value: totals ? (instIncluded ? 'مشمول' : money(totals.installation.customer)) : '' },
    { key: 'print', label: 'الطباعة', icon: Printer, value: totals ? (!printEnabled ? 'متوقفة' : printIncluded ? 'مشمولة' : money(totals.print.customer)) : '' },
    { key: 'cutout', label: 'المجسمات', icon: Scissors, value: totals ? (totals.cutout.count ? money(totals.cutout.customer) : '—') : '' },
    { key: 'discount', label: 'الخصم والملاحظات', icon: Percent, value: discount ? money(discount) : '' },
  ];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent dir="rtl" className="flex h-[94vh] max-w-[1280px] flex-col gap-0 overflow-hidden p-0 text-right">
        <header className="border-b border-border px-5 py-4 pl-12">
          <DialogTitle className="text-lg font-bold">تكاليف {op?.label}</DialogTitle>
          <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-foreground">{op?.customerName}</span>
            {op?.contractIds.map(n => <span key={n} className="rounded-md border border-border px-2 py-0.5 tabular-nums">عقد #{n}</span>)}
            {op?.teams.map(t => <span key={t} className="rounded-md bg-muted px-2 py-0.5">{t}</span>)}
            {instIncluded && <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">التركيب مشمول بالعقد</span>}
            {printIncluded && <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">الطباعة مشمولة بالعقد</span>}
          </DialogDescription>
        </header>

        {error ? (
          <div className="p-8 text-center text-destructive">{error}</div>
        ) : !state || !totals ? (
          <div className="space-y-3 p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_340px]">
            <div className="flex min-h-0 flex-col">
              <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-2" role="tablist">
                {tabs.map(t => (
                  <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                    className={cn('flex shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm transition-colors',
                      tab === t.key ? 'border-primary font-bold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                    <t.icon className="h-4 w-4" />{t.label}
                    {t.value && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums">{t.value}</span>}
                  </button>
                ))}
              </nav>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {tab === 'installation' && (
                  <div className="space-y-3">
                    {instIncluded && <IncludedBanner what="التركيب" contractValue={state.contractValues.installation} expense={totals.installation.contractExpense} />}

                    <section className="rounded-xl border border-border bg-muted/30 p-3">
                      <div className="mb-2 text-xs font-bold text-muted-foreground">تسعير جماعي</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={bulkTarget} onValueChange={v => setBulkTarget(v as BulkTarget)}>
                          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer" disabled={instIncluded}>سعر الزبون</SelectItem>
                            <SelectItem value="company">تكلفة الفرقة</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={bulkMode} onValueChange={v => setBulkMode(v as any)}>
                          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="piece">مبلغ لكل لوحة</SelectItem>
                            <SelectItem value="meter">سعر المتر × المساحة</SelectItem>
                            <SelectItem value="table">السعر الافتراضي للمقاس</SelectItem>
                            <SelectItem value="total">توزيع مبلغ إجمالي (حسب المساحة)</SelectItem>
                          </SelectContent>
                        </Select>
                        {bulkMode !== 'table' && <Num label="القيمة" value={bulkValue} onChange={setBulkValue} className="w-[110px]" />}
                        <Select value={scope} onValueChange={setScope}>
                          <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="visible">اللوحات الظاهرة ({visible.length})</SelectItem>
                            <SelectItem value="selected" disabled={!selected.size}>المحددة ({selected.size})</SelectItem>
                            {sizes.map(s => <SelectItem key={s} value={`size:${s}`}>مقاس {s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-9" onClick={applyBulk}>تطبيق</Button>
                        <Button size="sm" variant="outline" className="h-9 ms-auto" onClick={() => {
                          const missing = lines.filter(l => !l.sizeInstallPrice).length;
                          setLines(prev => prev.map(l => ({ ...l, company: l.sizeInstallPrice || l.company })));
                          toast.success(missing ? `تم جلب تكلفة الفرقة من الأسعار الافتراضية؛ ${missing} لوحة بلا سعر افتراضي لمقاسها` : 'تم جلب تكلفة الفرقة من الأسعار الافتراضية للمقاسات');
                        }}>تكلفة الفرقة من الأسعار الافتراضية</Button>
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground">السعر الافتراضي = سعر تركيب المقاس في الإعدادات (نصفه للوحة ذات الوجه الواحد).</div>
                    </section>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative min-w-[200px] flex-1">
                        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث باسم اللوحة أو الرقم أو المقاس" className="h-9 pr-9" />
                      </div>
                      {teams.length > 1 && (
                        <Select value={team} onValueChange={setTeam}>
                          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">كل الفرق</SelectItem>
                            {teams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                          <tr>
                            <th className="w-10 p-2"><Checkbox aria-label="تحديد الكل" checked={visible.length > 0 && visible.every(l => selected.has(l.id))}
                              onCheckedChange={c => setSelected(c ? new Set(visible.map(l => l.id)) : new Set())} /></th>
                            <th className="p-2 text-right">اللوحة</th>
                            <th className="p-2">الأوجه / المساحة</th>
                            <th className="p-2">سعر الزبون</th>
                            <th className="p-2">تكلفة الفرقة</th>
                            <th className="p-2">إضافي زبون</th>
                            <th className="p-2">إضافي شركة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map(l => (
                            <tr key={l.id} className="border-t border-border">
                              <td className="p-2 text-center"><Checkbox aria-label={`تحديد ${l.name}`} checked={selected.has(l.id)}
                                onCheckedChange={c => setSelected(prev => { const n = new Set(prev); c ? n.add(l.id) : n.delete(l.id); return n; })} /></td>
                              <td className="p-2"><BoardCell l={l} extra={[teams.length > 1 ? l.teamName : '', op && op.contractIds.length > 1 && l.contractNumber ? `عقد #${l.contractNumber}` : ''].filter(Boolean).join(' · ')} /></td>
                              <td className="p-2 text-center text-xs tabular-nums text-muted-foreground">{l.faces} وجه · {lineArea(l).toFixed(1)} م²</td>
                              <td className="p-2 w-[120px]">
                                <Num label="سعر الزبون" value={l.customer} disabled={instIncluded} onChange={v => update(l.id, { customer: v, customerPerMeter: null })} />
                                {!instIncluded && l.customerPerMeter ? <div className="mt-0.5 text-center text-[10px] tabular-nums text-primary">{l.customerPerMeter} د.ل/م²</div> : null}
                              </td>
                              <td className="p-2 w-[120px]">
                                <Num label="تكلفة الفرقة" value={l.company} onChange={v => update(l.id, { company: v })} />
                                {l.sizeInstallPrice > 0 && l.company !== l.sizeInstallPrice && (
                                  <button type="button" className="mt-0.5 w-full text-center text-[10px] text-primary hover:underline" onClick={() => update(l.id, { company: l.sizeInstallPrice })}>الافتراضي {l.sizeInstallPrice}</button>
                                )}
                              </td>
                              <td className="p-2 w-[100px]"><Num label="إضافي زبون" value={l.customerExtra} onChange={v => update(l.id, { customerExtra: v })} /></td>
                              <td className="p-2 w-[100px]"><Num label="إضافي شركة" value={l.companyExtra} onChange={v => update(l.id, { companyExtra: v })} /></td>
                            </tr>
                          ))}
                          {!visible.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد لوحات</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {tab === 'print' && (
                  <div className="space-y-3">
                    <label className="flex items-center justify-between rounded-xl border border-border p-3">
                      <span className="font-semibold">تفعيل الطباعة لهذه العملية</span>
                      <Switch checked={printEnabled} onCheckedChange={setPrintEnabled} />
                    </label>
                    {printEnabled && (
                      <>
                        {printIncluded && <IncludedBanner what="الطباعة" contractValue={state.contractValues.print} expense={totals.print.contractExpense} />}
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">المطبعة</div>
                            <Select value={printerId || 'none'} onValueChange={v => setPrinterId(v === 'none' ? null : v)}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">بدون تحديد</SelectItem>
                                {state.printers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">سعر المتر على الزبون {printIncluded && '(مشمول)'}</div>
                            <Num label="سعر المتر على الزبون" value={printCust} disabled={printIncluded} onChange={setPrintCust} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">تكلفة المتر على الشركة</div>
                            <Num label="تكلفة المتر على الشركة" value={printComp} onChange={setPrintComp} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{totals.print.boards} لوحة · <b className="tabular-nums text-foreground">{totals.print.area.toFixed(2)} م²</b></span>
                          <span className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setLines(p => p.map(l => ({ ...l, inPrint: true })))}>تحديد الكل</Button>
                            <Button variant="outline" size="sm" onClick={() => setLines(p => p.map(l => ({ ...l, inPrint: false })))}>إلغاء الكل</Button>
                          </span>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {lines.map(l => (
                            <label key={l.id} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm transition-colors', l.inPrint ? 'border-primary/50 bg-primary/5' : 'border-border opacity-60')}>
                              <Checkbox checked={l.inPrint} onCheckedChange={c => update(l.id, { inPrint: !!c })} />
                              <div className="min-w-0 flex-1"><BoardCell l={l} /></div>
                              <div className="shrink-0 text-left text-xs tabular-nums">
                                <div className="font-semibold">{lineArea(l).toFixed(1)} م²</div>
                                <div className="text-muted-foreground">{l.faces} وجه</div>
                                {l.inPrint && !printIncluded && printCust > 0 && <div className="text-muted-foreground">{money(lineArea(l) * printCust)}</div>}
                              </div>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {tab === 'cutout' && (
                  <div className="space-y-3">
                    <section className="rounded-xl border border-border bg-muted/30 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold text-muted-foreground">إجمالي المجسمات — يوزَّع تلقائياً على اللوحات المفعّلة حسب المساحة وبأرقام مقرّبة</div>
                        <div className="text-xs text-muted-foreground">{lines.filter(l => l.hasCutout).length} لوحة مفعّلة · {totals.cutout.count} مجسم</div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <div className="space-y-1"><div className="text-xs">الإجمالي على الزبون</div><Num label="إجمالي المجسمات على الزبون" value={cutTotalCust} onChange={setCutTotalCust} /></div>
                        <div className="space-y-1"><div className="text-xs">الإجمالي على الشركة</div><Num label="إجمالي المجسمات على الشركة" value={cutTotalComp} onChange={setCutTotalComp} /></div>
                        <Button className="h-9" onClick={distributeCutout}>توزيع ذكي</Button>
                      </div>
                    </section>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setLines(p => p.map(l => ({ ...l, hasCutout: true })))}>تفعيل الكل</Button>
                      <Button variant="outline" size="sm" onClick={() => setLines(p => p.map(l => ({ ...l, hasCutout: false })))}>إلغاء الكل</Button>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                          <tr><th className="p-2">مجسم</th><th className="p-2 text-right">اللوحة</th><th className="p-2">العدد</th><th className="p-2">الوحدة للزبون</th><th className="p-2">الوحدة على الشركة</th><th className="p-2">الإجمالي (زبون / شركة)</th></tr>
                        </thead>
                        <tbody>
                          {lines.map(l => (
                            <tr key={l.id} className={cn('border-t border-border', !l.hasCutout && 'opacity-60')}>
                              <td className="p-2 text-center"><Switch checked={l.hasCutout} onCheckedChange={c => update(l.id, { hasCutout: c })} aria-label={`مجسم ${l.name}`} /></td>
                              <td className="p-2"><BoardCell l={l} /></td>
                              <td className="p-2 w-[80px]"><Num label="العدد" value={l.cutoutCount} disabled={!l.hasCutout} onChange={v => update(l.id, { cutoutCount: Math.max(1, Math.round(v)) })} /></td>
                              <td className="p-2 w-[110px]"><Num label="سعر الوحدة للزبون" value={l.cutoutCustomerUnit} disabled={!l.hasCutout} onChange={v => update(l.id, { cutoutCustomerUnit: v })} /></td>
                              <td className="p-2 w-[110px]"><Num label="تكلفة الوحدة على الشركة" value={l.cutoutCompanyUnit} disabled={!l.hasCutout} onChange={v => update(l.id, { cutoutCompanyUnit: v })} /></td>
                              <td className="p-2 text-center text-xs tabular-nums">{l.hasCutout ? <>{money(Math.max(1, l.cutoutCount) * l.cutoutCustomerUnit)}<div className="text-muted-foreground">{money(Math.max(1, l.cutoutCount) * l.cutoutCompanyUnit)}</div></> : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {tab === 'discount' && (
                  <div className="max-w-xl space-y-4">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">خصم على المهمة</div>
                      <Num label="الخصم" value={discount} onChange={setDiscount} className="w-[180px]" />
                      {discount > totals.customerSubtotal && <div className="text-xs text-amber-600">الخصم أكبر من المستحق؛ سيُطبَّق بحد {money(totals.customerSubtotal)} فقط.</div>}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">سبب الخصم</div>
                      <Input value={discountReason} onChange={e => setDiscountReason(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">ملاحظات</div>
                      <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <aside className="flex min-h-0 flex-col border-t border-border bg-muted/20 lg:border-r lg:border-t-0">
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <table className="w-full text-sm">
                  <thead className="text-[11px] text-muted-foreground"><tr><th className="pb-2 text-right">الخدمة</th><th className="pb-2 text-left">على الزبون</th><th className="pb-2 text-left">تكلفة التنفيذ</th></tr></thead>
                  <tbody className="tabular-nums">
                    {[
                      { label: 'التركيب', s: totals.installation, show: true },
                      { label: 'الطباعة', s: totals.print, show: printEnabled },
                      { label: 'المجسمات', s: totals.cutout, show: totals.cutout.count > 0 },
                    ].filter(r => r.show).map(r => (
                      <tr key={r.label} className="border-t border-border/60">
                        <td className="py-2">{r.label}{r.s.included && <span className="mr-1 rounded bg-emerald-500/10 px-1 text-[10px] text-emerald-700 dark:text-emerald-400">مشمول</span>}</td>
                        <td className="py-2 text-left">{money(r.s.customer)}</td>
                        <td className="py-2 text-left text-muted-foreground">{money(r.s.company)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <dl className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm tabular-nums">
                  <div className="flex justify-between"><dt className="text-muted-foreground">إجمالي الزبون</dt><dd>{money(totals.customerSubtotal)}</dd></div>
                  {totals.discount > 0 && <div className="flex justify-between text-amber-600"><dt>الخصم</dt><dd>− {money(totals.discount)}</dd></div>}
                  <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><dt>المستحق على الزبون</dt><dd>{money(totals.customerTotal)}</dd></div>
                </dl>

                <dl className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm tabular-nums">
                  <div className="flex justify-between"><dt className="text-muted-foreground">تكلفة التنفيذ الكلية</dt><dd>{money(totals.companyTotal)}</dd></div>
                  {totals.contractExpense > 0 && (
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><dt>منها مصروف على العقد</dt><dd>{money(totals.contractExpense)}</dd></div>
                  )}
                  <div className="flex justify-between"><dt className="text-muted-foreground">تكلفة المهمة</dt><dd>{money(totals.taskCost)}</dd></div>
                  <div className={cn('flex justify-between border-t border-border pt-2 text-base font-bold', totals.profit < 0 ? 'text-destructive' : 'text-emerald-600')}>
                    <dt>ربح المهمة</dt><dd>{money(totals.profit)}{totals.customerTotal > 0 && <span className="mr-1 text-xs font-normal">({totals.margin}%)</span>}</dd>
                  </div>
                </dl>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  ربح المهمة = المستحق على الزبون − تكلفة الخدمات غير المشمولة. تكلفة الخدمات المشمولة في العقد تُحمَّل على العقد نفسه.
                </p>
              </div>
              <footer className="flex gap-2 border-t border-border p-3">
                <Button className="h-11 flex-1" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  حفظ التكاليف{dirty && <span className="h-2 w-2 rounded-full bg-amber-400" aria-label="توجد تعديلات" />}
                </Button>
                <Button variant="outline" className="h-11" onClick={() => close(false)} disabled={saving}>إغلاق</Button>
              </footer>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
