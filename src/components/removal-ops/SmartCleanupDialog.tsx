import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, MinusCircle, PlusCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { analyzeRemovalCleanup, excludeRemovalItems, type SmartCleanupAnalysis } from '@/services/removalCleanupService';
import { createRemovalForContracts } from '@/services/removalActions';
import { getLocalIgnoredContracts } from '@/components/removal/ExpiredContractsAlert';

/**
 * الفحص الذكي لأوامر الإزالة — معاينة أولاً ثم تنفيذ ما تختاره:
 * استبعاد اللوحات التي أصبحت مؤجرة، وإنشاء أوامر لعقود ظهرت لوحاتها في المتاح دون أمر إزالة.
 */
export function SmartCleanupDialog({ open, onOpenChange, teams, onChanged }: { open: boolean; onOpenChange: (o: boolean) => void; teams: any[]; onChanged: () => void }) {
  const [data, setData] = useState<SmartCleanupAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exSel, setExSel] = useState<Set<string>>(new Set());
  const [addSel, setAddSel] = useState<Set<string>>(new Set()); // `${contract}:${board}`
  const [busy, setBusy] = useState<'ex' | 'add' | null>(null);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const r = await analyzeRemovalCleanup();
      const ignored = getLocalIgnoredContracts();
      r.add = r.add.filter(g => !ignored.has(g.contractId));
      setData(r);
      setExSel(new Set(r.exclude.map(c => c.id)));
      setAddSel(new Set(r.add.filter(g => g.shownInAvailable).flatMap(g => g.boards.map(b => `${g.contractId}:${b.id}`))));
    } catch (e: any) { setError(e?.message || 'تعذر الفحص'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (open) run(); else setData(null); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const addCount = addSel.size;
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, keys: string[], on?: boolean) => {
    const n = new Set(set); const all = keys.every(k => n.has(k));
    keys.forEach(k => ((on ?? !all) ? n.add(k) : n.delete(k))); setter(n);
  };

  const doExclude = async () => {
    if (!data) return;
    setBusy('ex');
    try {
      const r = await excludeRemovalItems(data.exclude.filter(c => exSel.has(c.id)));
      toast.success(`استُبعدت ${r.removed.length} لوحة${r.emptyTasksRemoved ? ` وحُذف ${r.emptyTasksRemoved} أمر فارغ` : ''}`);
      onChanged(); await run();
    } catch (e: any) { toast.error(e?.message || 'فشل الاستبعاد'); }
    finally { setBusy(null); }
  };

  const doAdd = async () => {
    if (!data) return;
    const selection = data.add.map(g => ({ contractId: g.contractId, boardIds: g.boards.filter(b => addSel.has(`${g.contractId}:${b.id}`)).map(b => b.id) })).filter(s => s.boardIds.length);
    setBusy('add');
    try {
      const r = await createRemovalForContracts(selection, teams);
      toast.success(`أُنشئ ${r.created} أمر إزالة بـ ${r.added} لوحة${r.skipped ? ` (${r.skipped} بلا فرقة مناسبة)` : ''}`);
      onChanged(); await run();
    } catch (e: any) { toast.error(e?.message || 'فشل الإنشاء'); }
    finally { setBusy(null); }
  };

  const totalAddBoards = useMemo(() => data?.add.reduce((s, g) => s + g.boards.length, 0) || 0, [data]);

  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <DialogContent dir="rtl" className="flex max-h-[90vh] max-w-3xl flex-col gap-3 overflow-hidden text-right">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" />الفحص الذكي لأوامر الإزالة</DialogTitle>
          <DialogDescription>معاينة أولاً — لا يتغير شيء إلا بما تختاره.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" />جاري فحص اللوحات والعقود…</div>
        ) : error ? (
          <div className="space-y-3 py-6 text-center text-destructive">{error}<div><Button variant="outline" onClick={run}><RefreshCw className="h-4 w-4" />إعادة الفحص</Button></div></div>
        ) : data && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pl-1">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-muted/40 p-2.5">لوحات معلقة فُحصت<div className="text-lg font-bold tabular-nums">{data.checked}</div></div>
              <div className="rounded-lg bg-rose-500/10 p-2.5">لم تعد للإزالة<div className="text-lg font-bold tabular-nums text-rose-600">{data.exclude.length}</div></div>
              <div className="rounded-lg bg-sky-500/10 p-2.5">في المتاح بلا أمر إزالة<div className="text-lg font-bold tabular-nums text-sky-600">{totalAddBoards}</div></div>
            </div>

            <section className="rounded-xl border border-border">
              <header className="flex flex-wrap items-center gap-2 border-b border-border p-3">
                <MinusCircle className="h-4 w-4 text-rose-500" /><b className="flex-1">لوحات تُستبعد من الإزالة (أصبحت مؤجرة أو محجوزة)</b>
                {data.exclude.length > 0 && <Button size="sm" variant="destructive" disabled={!exSel.size || !!busy} onClick={doExclude}>{busy === 'ex' && <Loader2 className="h-4 w-4 animate-spin" />}استبعاد المحدد ({exSel.size})</Button>}
              </header>
              {data.exclude.length === 0 ? <p className="p-3 text-sm text-muted-foreground">كل اللوحات المعلقة ما زالت للإزالة.</p> : (
                <ul className="divide-y divide-border text-sm">
                  {data.exclude.map(c => (
                    <li key={c.id} className="flex items-start gap-2 p-2.5">
                      <Checkbox checked={exSel.has(c.id)} onCheckedChange={() => toggle(exSel, setExSel, [c.id])} aria-label={`استبعاد ${c.name}`} />
                      <div className="min-w-0"><b dir="ltr">{c.name}</b><div className="text-xs text-muted-foreground">{c.contracts ? `مرتبطة بـ ${c.contracts} · ` : ''}{c.reason}</div></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-border">
              <header className="flex flex-wrap items-center gap-2 border-b border-border p-3">
                <PlusCircle className="h-4 w-4 text-sky-500" /><b className="flex-1">عقود في المتاح تحتاج أمر إزالة</b>
                {data.add.length > 0 && <Button size="sm" disabled={!addCount || !!busy} onClick={doAdd}>{busy === 'add' && <Loader2 className="h-4 w-4 animate-spin" />}إنشاء أوامر الإزالة ({addCount})</Button>}
              </header>
              {data.add.length === 0 ? <p className="p-3 text-sm text-muted-foreground">لا توجد لوحات في المتاح تنتظر أمر إزالة.</p> : (
                <div className="divide-y divide-border">
                  {data.add.map(g => {
                    const keys = g.boards.map(b => `${g.contractId}:${b.id}`);
                    const all = keys.every(k => addSel.has(k)); const some = !all && keys.some(k => addSel.has(k));
                    return (
                      <div key={g.contractId} className="p-2.5">
                        <label className="flex cursor-pointer items-start gap-2">
                          <Checkbox checked={all ? true : some ? 'indeterminate' : false} onCheckedChange={() => toggle(addSel, setAddSel, keys)} aria-label={`عقد ${g.contractId}`} />
                          <div className="min-w-0 flex-1 text-sm">
                            <div className="flex flex-wrap items-center gap-2"><b>عقد #{g.contractId}</b><span>{g.customerName}</span>
                              <span className={cn('rounded px-1.5 text-xs', g.shownInAvailable ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400' : 'bg-muted text-muted-foreground')}>{g.shownInAvailable ? 'وُضع في المتاح' : `منتهٍ ${g.endDate}`}</span></div>
                            {g.adType && <div className="text-xs text-muted-foreground">{g.adType}</div>}
                          </div>
                        </label>
                        <div className="mr-6 mt-1.5 flex flex-wrap gap-1.5">
                          {g.boards.map(b => {
                            const k = `${g.contractId}:${b.id}`;
                            return (
                              <button key={k} type="button" onClick={() => toggle(addSel, setAddSel, [k])}
                                className={cn('rounded-md border px-2 py-0.5 text-xs', addSel.has(k) ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground')}>
                                <span dir="ltr">{b.name}</span>{b.size ? ` · ${b.size}` : ''}{b.city ? ` · ${b.city}` : ''}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            <p className="text-xs text-muted-foreground">العقود المعروضة في المتاح محددة مسبقاً؛ العقود المنتهية اخترها يدوياً. اللوحات تذهب للفرقة الأنسب حسب المقاس والمدينة.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
