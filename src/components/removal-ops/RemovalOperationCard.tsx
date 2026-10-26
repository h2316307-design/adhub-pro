import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CheckCircle2, FolderOpen, ImageOff, MessageCircle, MoreHorizontal, Printer, Trash2, Users } from 'lucide-react';
import { ZoomImage } from '@/components/composite-ops/ImageZoom';
import { useEffect, useState } from 'react';
import { fmtDate, tintStyle } from '@/components/composite-ops/OperationCard';
import { extractDualPaletteFromImage } from '@/components/composite-tasks/list/shared';
import type { RemovalOperation, RemovalStatus, RemovalTeamPart } from '@/services/removalOperations';

export const REMOVAL_STATUS: Record<RemovalStatus, { label: string; cls: string }> = {
  pending: { label: 'بانتظار الإزالة', cls: 'bg-amber-500 text-white' },
  in_progress: { label: 'إزالة جزئية', cls: 'bg-sky-600 text-white' },
  completed: { label: 'أُزيلت', cls: 'bg-emerald-600 text-white' },
};

export interface RemovalActions {
  onBoards: (r: RemovalOperation) => void;
  onPrint: (r: RemovalOperation) => void;
  onComplete: (r: RemovalOperation) => void;
  onWhatsApp: (r: RemovalOperation, p: RemovalTeamPart) => void;
  onDelete: (r: RemovalOperation) => void;
  onNavigate: (path: string) => void;
}

function WhatsAppButton({ r, a, compact }: { r: RemovalOperation; a: RemovalActions; compact?: boolean }) {
  const label = compact ? undefined : 'واتساب الفرقة';
  if (r.parts.length === 1) {
    return <Button variant="outline" className={cn('bg-background/80', compact ? 'h-8 w-8 p-0' : 'h-10')} aria-label="إرسال للفرقة عبر واتساب" onClick={() => a.onWhatsApp(r, r.parts[0])}><MessageCircle className="h-4 w-4" />{label}</Button>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn('bg-background/80', compact ? 'h-8 w-8 p-0' : 'h-10')} aria-label="إرسال للفرقة عبر واتساب"><MessageCircle className="h-4 w-4" />{label}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="text-right">
        <DropdownMenuLabel>اختر الفرقة</DropdownMenuLabel>
        {r.parts.map(p => <DropdownMenuItem key={p.taskId} onClick={() => a.onWhatsApp(r, p)}>{p.teamName} · {p.items.length - p.done} معلقة</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RemovalOperationMenu({ r, a }: { r: RemovalOperation; a: RemovalActions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-9 w-9 p-0" aria-label="المزيد"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="text-right">
        {r.contractId > 0 && <DropdownMenuItem onClick={() => a.onNavigate(`/admin/contracts/edit?contract=${r.contractId}`)}>فتح العقد #{r.contractId}</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={() => a.onDelete(r)}><Trash2 className="ml-2 h-4 w-4" />حذف أمر الإزالة</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RemovalOperationCard({ r, selected, onToggle, a, horizontal = false }: { r: RemovalOperation; selected: boolean; onToggle: () => void; a: RemovalActions; horizontal?: boolean }) {
  const [colors, setColors] = useState<[string, string] | null>(null);
  useEffect(() => {
    let alive = true; setColors(null);
    if (r.designs[0]) extractDualPaletteFromImage(r.designs[0], c => { if (alive) setColors(c); });
    return () => { alive = false; };
  }, [r.designs[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  const gallery = r.designs.map((s, i) => ({ src: s, label: `تصميم ${i + 1}` }));
  const pct = r.boards ? Math.round((r.boardsDone / r.boards) * 100) : 0;
  const accent = colors ? `rgb(${colors[0]})` : undefined;
  const pending = r.boards - r.boardsDone;

  return (
    <article style={tintStyle(colors)} className={cn('flex flex-col overflow-hidden rounded-2xl border-2 bg-card shadow-sm', horizontal && 'sm:flex-row', selected && 'ring-2 ring-primary', !colors && 'border-border')}>
      <div className={cn('relative shrink-0 border-b border-border/60', horizontal && 'sm:min-h-[var(--img-h,230px)] sm:w-[38%] sm:max-w-[320px] sm:self-stretch sm:border-b-0 sm:border-l')} style={horizontal ? undefined : { height: 'var(--img-h,230px)' }}>
        {gallery.length
          ? <ZoomImage src={gallery[0].src} alt={`تصميم ${r.customerName}`} title={`${r.customerName} · عقد #${r.contractId}`} className="h-full w-full bg-black/5" gallery={gallery} />
          : <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/60 text-sm text-muted-foreground"><ImageOff className="h-7 w-7 opacity-60" />بدون تصميم</div>}
        <Checkbox className="absolute right-3 top-3 h-6 w-6 border-2 bg-background" aria-label={`تحديد أمر إزالة ${r.customerName}`} checked={selected} onCheckedChange={onToggle} />
        <span className={cn('absolute left-3 top-3 rounded-lg px-2.5 py-1 text-sm font-semibold shadow', REMOVAL_STATUS[r.status].cls)}>{REMOVAL_STATUS[r.status].label}</span>
        {gallery.length > 1 && <span className="absolute bottom-2 right-3 rounded-lg bg-black/60 px-2 py-0.5 text-xs text-white">{gallery.length} تصاميم</span>}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-tight">{r.customerName}</h2>
            <div className="mt-1 text-base font-semibold" style={{ color: accent }}>{r.amendmentNumber ? `إزالة ملحق ${r.amendmentNumber} · عقد #${r.contractId}` : `إزالة · عقد #${r.contractId}`}</div>
          </div>
          <RemovalOperationMenu r={r} a={a} />
        </div>

        <div className="rounded-lg bg-background/70 px-3 py-1.5 text-sm">
          {r.adType && <div className="font-medium">{r.adType}</div>}
          <div className="tabular-nums text-muted-foreground">{fmtDate(r.contractStart)} ← {fmtDate(r.contractEnd)}</div>
        </div>

        <div className="flex flex-wrap gap-1.5 text-sm">
          {r.parts.map(p => (
            <span key={p.taskId} className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/70 px-2 py-0.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />{p.teamName}<b className="tabular-nums">{p.done}/{p.items.length}</b>
            </span>
          ))}
        </div>

        <div>
          <div className="mb-1 flex justify-between text-sm"><span className="text-muted-foreground">الإزالة</span><span className="font-semibold tabular-nums">{r.boardsDone}/{r.boards} لوحة</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full" style={{ width: `${pct}%`, background: accent || 'hsl(var(--primary))' }} /></div>
          <div className="mt-1 text-xs tabular-nums text-muted-foreground">أُنشئ {fmtDate(r.createdAt)}{r.lastRemoval ? ` · آخر إزالة ${fmtDate(r.lastRemoval)}` : ''}</div>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button className="h-10" disabled={pending === 0} onClick={() => a.onComplete(r)}><CheckCircle2 className="h-4 w-4" />{pending ? `إزالة الكل (${pending})` : 'مكتملة'}</Button>
          <Button variant="outline" className="h-10 bg-background/80" onClick={() => a.onBoards(r)}><FolderOpen className="h-4 w-4" />اللوحات</Button>
          <Button variant="outline" className="h-10 bg-background/80" disabled={pending === 0} onClick={() => a.onPrint(r)}><Printer className="h-4 w-4" />طباعة الإزالة</Button>
          <WhatsAppButton r={r} a={a} />
        </div>
      </div>
    </article>
  );
}

export function RemovalOperationsTable({ rows, selected, onToggle, onToggleAll, a }: { rows: RemovalOperation[]; selected: Set<string>; onToggle: (k: string) => void; onToggleAll: (on: boolean) => void; a: RemovalActions }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="w-10 p-3"><Checkbox aria-label="تحديد الكل" checked={rows.length > 0 && rows.every(r => selected.has(r.key))} onCheckedChange={c => onToggleAll(!!c)} /></th>
            <th className="p-3 text-right">الزبون / العقد</th>
            <th className="p-3 text-right">نهاية العقد</th>
            <th className="p-3 text-right">الفرق</th>
            <th className="p-3">الإزالة</th>
            <th className="p-3 text-right">آخر إزالة</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(r => (
            <tr key={r.key} className={cn('hover:bg-muted/30', selected.has(r.key) && 'bg-primary/5')}>
              <td className="p-3"><Checkbox aria-label={`تحديد ${r.customerName}`} checked={selected.has(r.key)} onCheckedChange={() => onToggle(r.key)} /></td>
              <td className="p-3">
                <div className="text-base font-bold">{r.customerName}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs"><b className="tabular-nums">{r.amendmentNumber ? `ملحق ${r.amendmentNumber} · عقد #${r.contractId}` : `عقد #${r.contractId}`}</b><span className="text-muted-foreground">{r.adType}</span><span className={cn('rounded px-1.5', REMOVAL_STATUS[r.status].cls)}>{REMOVAL_STATUS[r.status].label}</span></div>
              </td>
              <td className="p-3 tabular-nums text-xs">{fmtDate(r.contractEnd)}</td>
              <td className="p-3 text-xs">{r.parts.map(p => <div key={p.taskId}>{p.teamName} <span className="tabular-nums text-muted-foreground">{p.done}/{p.items.length}</span></div>)}</td>
              <td className="p-3 text-center tabular-nums">{r.boardsDone}/{r.boards}</td>
              <td className="p-3 tabular-nums text-xs">{fmtDate(r.lastRemoval)}</td>
              <td className="p-3">
                <div className="flex justify-end gap-1">
                  <Button size="sm" className="h-8" disabled={r.boardsDone === r.boards} onClick={() => a.onComplete(r)}><CheckCircle2 className="h-3.5 w-3.5" />إزالة</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => a.onBoards(r)}><FolderOpen className="h-3.5 w-3.5" />اللوحات</Button>
                  <Button size="sm" variant="outline" className="h-8" disabled={r.boardsDone === r.boards} onClick={() => a.onPrint(r)} aria-label="طباعة الإزالة"><Printer className="h-3.5 w-3.5" /></Button>
                  <WhatsAppButton r={r} a={a} compact />
                  <RemovalOperationMenu r={r} a={a} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
