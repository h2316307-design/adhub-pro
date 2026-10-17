import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { fetchContractDesignUrls } from '@/lib/contractDesignUtils';
import { extractDualPaletteFromImage } from '@/components/composite-tasks/list/shared';
import {
  Calculator, FileText, FolderOpen, ImagePlus, Layers, MoreHorizontal, Palette, Plus, Printer, Scissors, ShieldCheck, Trash2, Users,
} from 'lucide-react';
import { ZoomImage } from '@/components/composite-ops/ImageZoom';
import { money } from '@/lib/compositeCosts';
import type { OperationRow } from '@/services/compositeOperations';

export const STATUS: Record<OperationRow['status'], { label: string; cls: string }> = {
  pending: { label: 'قيد الانتظار', cls: 'bg-amber-500 text-white' },
  in_progress: { label: 'قيد التنفيذ', cls: 'bg-sky-600 text-white' },
  completed: { label: 'مكتملة', cls: 'bg-emerald-600 text-white' },
  cancelled: { label: 'ملغاة', cls: 'bg-muted text-muted-foreground' },
};
export const fmtDate = (s?: string | null) => { try { return s ? format(new Date(s), 'dd/MM/yyyy') : '—'; } catch { return '—'; } };

/** تصاميم العقد + لونان مستخرجان من التصميم الأول لتمييز البطاقة */
export function useDesignPalette(contractId: number) {
  const [urls, setUrls] = useState<string[]>([]);
  const [colors, setColors] = useState<[string, string] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setUrls([]); setColors(null);
    if (!contractId) return;
    fetchContractDesignUrls(contractId).then(u => {
      if (cancelled) return;
      const list = (u || []).filter(Boolean);
      setUrls(list);
      if (list[0]) extractDualPaletteFromImage(list[0], c => { if (!cancelled) setColors(c); });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [contractId]);
  return { urls, colors };
}

export const tintStyle = (colors: [string, string] | null): React.CSSProperties | undefined => colors ? {
  backgroundImage: `linear-gradient(135deg, rgba(${colors[0]}, 0.16), rgba(${colors[1]}, 0.07) 60%, transparent)`,
  borderColor: `rgba(${colors[0]}, 0.55)`,
} : undefined;

export interface OperationActions {
  onCosts: (r: OperationRow) => void;
  onBoards: (r: OperationRow) => void;
  onDesigns: (r: OperationRow) => void;
  onDistribute: (r: OperationRow) => void;
  onPrint: (r: OperationRow) => void;
  onInvoice: (r: OperationRow) => void;
  onReinstall: (r: OperationRow) => void;
  onDelete: (r: OperationRow) => void;
  onNavigate: (path: string) => void;
}

export function OperationMenu({ r, a }: { r: OperationRow; a: OperationActions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-9 w-9 p-0" aria-label="المزيد"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="text-right">
        {r.customerId && <DropdownMenuItem onClick={() => a.onNavigate(`/admin/customer-account?id=${encodeURIComponent(r.customerId!)}`)}>حساب الزبون</DropdownMenuItem>}
        {r.contractIds.map(n => <DropdownMenuItem key={n} onClick={() => a.onNavigate(`/admin/contracts/edit?contract=${n}`)}>فتح العقد #{n}</DropdownMenuItem>)}
        <DropdownMenuItem onClick={() => a.onReinstall(r)}><Plus className="ml-2 h-4 w-4" />إعادة تركيب جديدة</DropdownMenuItem>
        <DropdownMenuItem onClick={() => a.onNavigate('/admin/composite-tasks-classic')}>العرض السابق</DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" disabled={r.boardsDone > 0 || r.money.paid > 0} onClick={() => a.onDelete(r)}>
          <Trash2 className="ml-2 h-4 w-4" />{r.boardsDone > 0 ? 'لا يمكن الحذف (بها لوحات مركبة)' : r.money.paid > 0 ? 'لا يمكن الحذف (عليها دفعات)' : 'حذف العملية'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OperationCard({ r, selected, onToggle, busy, a, layout = 'vertical' }: { r: OperationRow; selected: boolean; onToggle: () => void; busy: boolean; a: OperationActions; layout?: 'horizontal' | 'vertical' }) {
  const { urls, colors } = useDesignPalette(r.contractIds[0] || 0);
  const pct = r.boards ? Math.round((r.boardsDone / r.boards) * 100) : 0;
  const paidPct = r.money.customerTotal > 0 ? Math.min(100, Math.round((r.money.paid / r.money.customerTotal) * 100)) : 100;
  const accent = colors ? `rgb(${colors[0]})` : undefined;
  /** عرضي: الصورة بجانب التفاصيل (مثل بطاقات العقود) */
  const H = layout === 'horizontal';

  return (
    <article style={tintStyle(colors)} className={cn('flex flex-col overflow-hidden rounded-2xl border-2 bg-card shadow-sm', H && 'md:flex-row', selected ? 'ring-2 ring-primary' : '', !colors && 'border-border')}>
      <div className={cn('relative h-[var(--img-h,230px)] shrink-0 border-b border-border/60', H && 'md:h-auto md:min-h-[var(--img-h,230px)] md:w-[42%] md:border-b-0 md:border-l')}>
        {/* الصورة الرئيسية التصميم دائماً؛ صور التركيب مصغّرة في الزاوية */}
        <ZoomImage src={urls[0]} alt={`تصميم ${r.customerName}`} title={`${r.customerName} · ${r.label}`} className="h-full w-full bg-black/5"
          gallery={[...urls.map((s, i) => ({ src: s, label: `تصميم ${i + 1}` })), ...r.installedPhotos.map((s, i) => ({ src: s, label: `تركيب ${i + 1}` }))]} />
        {r.installedPhotos.length > 0 && (
          <div className="absolute bottom-2 left-2 flex items-end gap-1.5">
            <div className="h-12 w-16 overflow-hidden rounded-md border-2 border-white shadow">
              <ZoomImage src={r.installedPhotos[0]} alt={`تركيب ${r.customerName}`} title={`${r.customerName} · ${r.label}`} className="h-full w-full" imgClassName="object-cover"
                gallery={[...urls.map((s, i) => ({ src: s, label: `تصميم ${i + 1}` })), ...r.installedPhotos.map((s, i) => ({ src: s, label: `تركيب ${i + 1}` }))]} />
            </div>
            <span className="rounded-lg bg-emerald-600 px-2 py-0.5 text-xs text-white shadow">صور تركيب {r.installedPhotos.length}</span>
          </div>
        )}
        <Checkbox className="absolute right-3 top-3 h-6 w-6 border-2 bg-background" aria-label={`تحديد ${r.label} - ${r.customerName}`} checked={selected} onCheckedChange={onToggle} />
        <div className="absolute left-3 top-3 flex flex-col items-end gap-1">
          <span className={cn('rounded-lg px-2.5 py-1 text-sm font-semibold shadow', STATUS[r.status].cls)}>{STATUS[r.status].label}</span>
          {r.contractIds.length > 1 && <span className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-sm text-white shadow"><Layers className="h-4 w-4" />{r.contractIds.length} عقود</span>}
        </div>
        {urls.length > 1 && <span className="absolute bottom-2 right-3 rounded-lg bg-black/60 px-2 py-0.5 text-xs text-white">{urls.length} تصاميم</span>}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-tight">{r.customerName}</h2>
            <div className="mt-1 text-base font-semibold" style={{ color: accent }}>{r.label}</div>
          </div>
          <OperationMenu r={r} a={a} />
        </div>

        <div className="space-y-1.5">
          {r.contracts.map(c => (
            <div key={c.number} className="rounded-lg bg-background/70 px-3 py-1.5 text-sm">
              <div className="flex flex-wrap items-center gap-x-2"><b className="tabular-nums">عقد #{c.number}</b>{c.adType && <span className="text-muted-foreground">{c.adType}</span>}</div>
              <div className="tabular-nums text-muted-foreground">{fmtDate(c.start)} ← {fmtDate(c.end)}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-4 w-4" />{r.teams.join('، ')}</span>
          {(r.hasPrint || r.money.printIncluded) && <span className={cn('flex items-center gap-1', r.money.printIncluded && 'text-emerald-700 dark:text-emerald-400')}><Printer className="h-4 w-4" />{r.money.printIncluded ? 'الطباعة مشمولة' : 'طباعة'}</span>}
          {r.hasCutout && <span className="flex items-center gap-1"><Scissors className="h-4 w-4" />مجسمات</span>}
          {r.money.instIncluded && <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><ShieldCheck className="h-4 w-4" />التركيب مشمول</span>}
        </div>

        <div>
          <div className="mb-1 flex justify-between text-sm"><span className="text-muted-foreground">التركيب</span><span className="font-semibold tabular-nums">{r.boardsDone}/{r.boards} لوحة</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full" style={{ width: `${pct}%`, background: accent || 'hsl(var(--primary))' }} /></div>
        </div>

        <div className={cn('grid grid-cols-2 gap-3 rounded-xl bg-background/70 p-3', H && 'lg:grid-cols-4')}>
          <div><div className="text-xs text-muted-foreground">المستحق على الزبون</div><div className="text-lg font-bold tabular-nums">{money(r.money.customerTotal)}</div></div>
          <div><div className="text-xs text-muted-foreground">المتبقي</div><div className={cn('text-lg font-bold tabular-nums', r.money.remaining > 0.5 ? 'text-amber-600' : 'text-emerald-600')}>{money(r.money.remaining)}</div></div>
          <div><div className="text-xs text-muted-foreground">تكلفة التنفيذ</div><div className="tabular-nums">{money(r.money.companyTotal)}</div>
            {r.money.contractExpense > 0 && <div className="text-xs text-emerald-700 dark:text-emerald-400">منها {money(r.money.contractExpense)} على العقد</div>}</div>
          <div><div className="text-xs text-muted-foreground">ربح المهمة</div><div className={cn('font-bold tabular-nums', r.money.profit < 0 ? 'text-destructive' : 'text-emerald-600')}>{money(r.money.profit)}</div></div>
          <div className={cn('col-span-2', H && 'lg:col-span-4')}>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn('h-full', paidPct >= 100 ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${paidPct}%` }} /></div>
            <div className="mt-1 text-xs tabular-nums text-muted-foreground">مدفوع {money(r.money.paid)} · {paidPct}% · {fmtDate(r.createdAt)}</div>
          </div>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <Button className="h-9 text-sm" onClick={() => a.onCosts(r)}><Calculator className="h-4 w-4" />التكاليف</Button>
          <Button variant="outline" className="h-9 bg-background/80 text-sm" disabled={!r.tasks.some(t => t.installation_task_id)} onClick={() => a.onBoards(r)}><FolderOpen className="h-4 w-4" />اللوحات</Button>
          <Button variant="outline" className="h-9 bg-background/80 text-sm" onClick={() => a.onInvoice(r)}><FileText className="h-4 w-4" />الفاتورة</Button>
          <Button variant="outline" className="h-9 bg-background/80 text-sm" disabled={busy} onClick={() => a.onDesigns(r)}><ImagePlus className="h-4 w-4" />التصاميم</Button>
          <Button variant="outline" className="h-9 bg-background/80 text-sm" disabled={busy} onClick={() => a.onDistribute(r)}><Palette className="h-4 w-4" />توزيع التصاميم</Button>
          <Button variant="outline" className="h-9 bg-background/80 text-sm" disabled={busy} onClick={() => a.onPrint(r)}><Printer className="h-4 w-4" />طباعة التركيب</Button>
        </div>
      </div>
    </article>
  );
}

export function OperationsTable({ rows, selected, onToggle, onToggleAll, a }: { rows: OperationRow[]; selected: Set<string>; onToggle: (k: string) => void; onToggleAll: (on: boolean) => void; a: OperationActions }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="w-10 p-3"><Checkbox aria-label="تحديد الكل" checked={rows.length > 0 && rows.every(r => selected.has(r.key))} onCheckedChange={c => onToggleAll(!!c)} /></th>
            <th className="p-3 text-right">الزبون / العملية</th>
            <th className="p-3 text-right">العقود</th>
            <th className="p-3 text-right">الفرق</th>
            <th className="p-3">التركيب</th>
            <th className="p-3 text-left">المستحق</th>
            <th className="p-3 text-left">المتبقي</th>
            <th className="p-3 text-left">الربح</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(r => (
            <tr key={r.key} className={cn('hover:bg-muted/30', selected.has(r.key) && 'bg-primary/5')}>
              <td className="p-3"><Checkbox aria-label={`تحديد ${r.customerName}`} checked={selected.has(r.key)} onCheckedChange={() => onToggle(r.key)} /></td>
              <td className="p-3">
                <div className="text-base font-bold">{r.customerName}</div>
                <div className="flex items-center gap-2 text-xs"><span className="text-primary">{r.label}</span><span className={cn('rounded px-1.5', STATUS[r.status].cls)}>{STATUS[r.status].label}</span></div>
              </td>
              <td className="p-3 text-xs">{r.contracts.map(c => <div key={c.number}><b className="tabular-nums">#{c.number}</b> <span className="text-muted-foreground">{c.adType} · {fmtDate(c.start)} ← {fmtDate(c.end)}</span></div>)}</td>
              <td className="p-3 text-xs">{r.teams.join('، ')}</td>
              <td className="p-3 text-center tabular-nums">{r.boardsDone}/{r.boards}</td>
              <td className="p-3 text-left font-semibold tabular-nums">{money(r.money.customerTotal)}</td>
              <td className={cn('p-3 text-left font-semibold tabular-nums', r.money.remaining > 0.5 ? 'text-amber-600' : 'text-emerald-600')}>{money(r.money.remaining)}</td>
              <td className={cn('p-3 text-left tabular-nums', r.money.profit < 0 ? 'text-destructive' : 'text-emerald-600')}>{money(r.money.profit)}</td>
              <td className="p-3">
                <div className="flex justify-end gap-1">
                  <Button size="sm" className="h-8" onClick={() => a.onCosts(r)}><Calculator className="h-3.5 w-3.5" />التكاليف</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => a.onBoards(r)}><FolderOpen className="h-3.5 w-3.5" />اللوحات</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => a.onInvoice(r)}><FileText className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => a.onPrint(r)} aria-label="طباعة التركيب"><Printer className="h-3.5 w-3.5" /></Button>
                  <OperationMenu r={r} a={a} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
