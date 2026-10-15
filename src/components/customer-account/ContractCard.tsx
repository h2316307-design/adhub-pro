import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Pencil } from 'lucide-react';
import { ZoomImage } from '@/components/composite-ops/ImageZoom';
import { tintStyle, useDesignPalette } from '@/components/composite-ops/OperationCard';

export interface ContractCardRow {
  number: number; adType: string; start: string; end: string; active: boolean;
  total: number; paid: number; remaining: number; boards: number;
}

const dmy = (v: string) => (v ? v.split('-').reverse().join('/') : '—');

/** بطاقة عقد: التصميم بعرض 3/8 وبارتفاع البطاقة، ولون خفيف مستخرج من التصميم */
export function ContractCard({ r, selected, onToggle, onPay, onEdit, fmt }: {
  r: ContractCardRow; selected: boolean; onToggle: (on: boolean) => void; onPay: () => void; onEdit: () => void; fmt: (n: number) => string;
}) {
  const { urls, colors } = useDesignPalette(r.number);
  const pct = r.total > 0 ? Math.min(100, Math.max(0, Math.round((r.paid / r.total) * 100))) : 0;
  const daysLeft = r.end ? Math.ceil((new Date(r.end).getTime() - Date.now()) / 86400000) : null;
  return (
    <article style={tintStyle(colors)} className={cn('flex min-h-[230px] overflow-hidden rounded-2xl border-2 bg-card', selected && 'ring-2 ring-primary', !colors && 'border-border')}>
      <div className="relative w-[37.5%] shrink-0 border-l border-border/60">
        <ZoomImage src={urls[0]} alt={`تصميم عقد ${r.number}`} title={`عقد #${r.number}`} className="h-full w-full bg-black/5"
          gallery={urls.map((s, i) => ({ src: s, label: `تصميم ${i + 1}` }))} />
        <input type="checkbox" aria-label={`تحديد العقد ${r.number}`} checked={selected} onChange={e => onToggle(e.target.checked)}
          className="absolute right-2 top-2 h-5 w-5 accent-primary" />
        <span className={cn('absolute bottom-2 right-2 rounded-md px-2 py-0.5 text-xs font-semibold shadow', r.active ? 'bg-emerald-600 text-white' : 'bg-zinc-600 text-white')}>{r.active ? 'ساري' : 'منتهي'}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-bold tabular-nums">عقد #{r.number}</span>
          <span className="min-w-0 truncate text-sm text-muted-foreground">{r.adType || '—'} · {r.boards} لوحة</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-background/70 px-2 py-1.5"><div className="text-muted-foreground">البداية</div><div className="text-sm font-semibold tabular-nums">{dmy(r.start)}</div></div>
          <div className="rounded-lg bg-background/70 px-2 py-1.5"><div className="text-muted-foreground">النهاية</div><div className="text-sm font-semibold tabular-nums">{dmy(r.end)}</div>
            {daysLeft !== null && <div className={cn('text-[11px]', daysLeft < 0 ? 'text-muted-foreground' : daysLeft <= 15 ? 'text-amber-600' : 'text-emerald-600')}>{daysLeft < 0 ? `منذ ${-daysLeft} يوم` : `بعد ${daysLeft} يوم`}</div>}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div><div className="text-muted-foreground">القيمة</div><div className="font-semibold tabular-nums">{fmt(r.total)}</div></div>
          <div><div className="text-muted-foreground">المدفوع</div><div className="font-semibold tabular-nums text-emerald-600">{fmt(r.paid)}</div></div>
          <div><div className="text-muted-foreground">المتبقي</div><div className={cn('font-semibold tabular-nums', r.remaining > 0.01 ? 'text-destructive' : 'text-emerald-600')}>{r.remaining < -0.01 ? `فائض ${fmt(-r.remaining)}` : fmt(Math.max(0, r.remaining))}</div></div>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-2 flex-1" />
          <span className={cn('w-12 text-left text-base font-bold tabular-nums', pct >= 100 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-destructive')}>{pct}%</span>
        </div>
        <div className="mt-auto flex justify-end gap-1">
          {r.remaining > 0.01 && <Button size="sm" variant="outline" className="h-8 bg-background/80 text-xs" onClick={onPay}>دفعة</Button>}
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onEdit}><Pencil className="h-3.5 w-3.5" />تعديل</Button>
        </div>
      </div>
    </article>
  );
}
