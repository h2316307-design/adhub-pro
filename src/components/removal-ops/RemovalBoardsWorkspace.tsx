import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, MapPin, Undo2, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { ZoomImage } from '@/components/composite-ops/ImageZoom';
import { fmtDate } from '@/components/composite-ops/OperationCard';
import { formatFacesCountArabic } from '@/lib/utils';
import { CompleteRemovalDialog } from '@/components/removal-ops/CompleteRemovalDialog';
import { REMOVAL_STATUS } from '@/components/removal-ops/RemovalOperationCard';
import { completeRemovalItems, undoRemovalItem } from '@/services/removalActions';
import type { RemovalOperation } from '@/services/removalOperations';
import type { RemovalTaskItem } from '@/hooks/useRemovalData';

type Filter = 'all' | 'pending' | 'done';

/** لوحات أمر الإزالة مقسّمة حسب الفرق: تحديد، توثيق الإزالة بتاريخ، تراجع، وتكبير الصور */
export function RemovalBoardsWorkspace({ op, billboardById, allItems, onClose, onChanged }: {
  op: RemovalOperation; billboardById: Record<string | number, any>; allItems: RemovalTaskItem[];
  onClose: () => void; onChanged: () => void;
}) {
  const [filter, setFilter] = useState<Filter>(op.boardsDone === op.boards ? 'all' : 'pending');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [completeIds, setCompleteIds] = useState<string[] | null>(null);
  const { confirm } = useSystemDialog();

  const pendingIds = useMemo(() => op.items.filter(i => i.status !== 'completed').map(i => i.id), [op]);
  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const show = (i: RemovalTaskItem) => filter === 'all' || (filter === 'done' ? i.status === 'completed' : i.status !== 'completed');

  const doComplete = async (date: string, notes: string) => {
    if (!completeIds) return;
    try {
      const n = await completeRemovalItems(completeIds, date, notes || null, allItems);
      toast.success(`وُثّقت إزالة ${n} لوحة`);
      setSelected(new Set());
      onChanged();
    } catch (e: any) { toast.error('تعذر توثيق الإزالة: ' + (e?.message || e)); throw e; }
  };

  const undo = async (item: RemovalTaskItem) => {
    const name = billboardById[item.billboard_id]?.Billboard_Name || `لوحة ${item.billboard_id}`;
    const ok = await confirm({ title: 'التراجع عن الإزالة', message: `ستعود ${name} إلى قائمة الإزالة المعلقة.`, confirmText: 'تراجع' } as any);
    if (!ok) return;
    try { await undoRemovalItem(item); toast.success('تم التراجع'); onChanged(); }
    catch (e: any) { toast.error('فشل التراجع: ' + (e?.message || e)); }
  };

  const counts = { all: op.boards, pending: op.boards - op.boardsDone, done: op.boardsDone };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent dir="rtl" className="flex h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden p-0 text-right">
        <header className="space-y-3 border-b border-border p-4 pl-12">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-lg font-bold">{op.customerName} · إزالة عقد #{op.contractId}</DialogTitle>
            <span className={cn('rounded-lg px-2 py-0.5 text-xs font-semibold', REMOVAL_STATUS[op.status].cls)}>{REMOVAL_STATUS[op.status].label}</span>
          </div>
          <DialogDescription>{op.adType || '—'} · {op.boardsDone}/{op.boards} لوحة أُزيلت · {op.teams.join('، ')}</DialogDescription>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="تصفية اللوحات">
              {([['pending', 'المعلقة'], ['done', 'المُزالة'], ['all', 'الكل']] as const).map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={filter === k} onClick={() => setFilter(k)}
                  className={cn('h-8 rounded-md px-3 text-sm', filter === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                  {l} <span className="tabular-nums opacity-70">({counts[k]})</span>
                </button>
              ))}
            </div>
            {pendingIds.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setSelected(selected.size === pendingIds.length ? new Set() : new Set(pendingIds))}>
                {selected.size === pendingIds.length ? 'إلغاء التحديد' : `تحديد كل المعلقة (${pendingIds.length})`}
              </Button>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          {op.parts.map(part => {
            const list = part.items.filter(show);
            if (!list.length) return null;
            return (
              <section key={part.taskId} className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4 text-muted-foreground" />{part.teamName}<span className="font-normal tabular-nums text-muted-foreground">{part.done}/{part.items.length}</span></h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map(item => {
                    const bb = billboardById[item.billboard_id] || {};
                    const done = item.status === 'completed';
                    const gallery = [
                      { src: item.removed_image_url, label: 'بعد الإزالة' },
                      { src: item.installed_image_face_a_url || item.installed_image_url, label: 'صورة التركيب' },
                      { src: item.installed_image_face_b_url, label: 'صورة التركيب (خلفي)' },
                      { src: item.design_face_a, label: 'التصميم الأمامي' },
                      { src: item.design_face_b, label: 'التصميم الخلفي' },
                      { src: bb.Image_URL, label: 'صورة اللوحة' },
                    ].filter(g => !!g.src) as { src: string; label: string }[];
                    const sel = selected.has(item.id);
                    return (
                      <article key={item.id} className={cn('overflow-hidden rounded-xl border bg-card', sel && 'ring-2 ring-primary', done && 'opacity-90')}>
                        <div className="relative h-36">
                          <ZoomImage src={gallery[0]?.src} alt={bb.Billboard_Name || 'لوحة'} title={bb.Billboard_Name} className="h-full w-full" gallery={gallery} />
                          {!done && <Checkbox className="absolute right-2 top-2 h-5 w-5 border-2 bg-background" aria-label={`تحديد ${bb.Billboard_Name || item.billboard_id}`} checked={sel} onCheckedChange={() => toggle(item.id)} />}
                          <span className={cn('absolute left-2 top-2 rounded-md px-2 py-0.5 text-xs font-semibold shadow', done ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white')}>{done ? `أُزيلت ${fmtDate(item.removal_date)}` : 'معلقة'}</span>
                        </div>
                        <div className="space-y-1.5 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <b className="truncate">{bb.Billboard_Name || `لوحة ${item.billboard_id}`}</b>
                            {bb.Size && <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums">{bb.Size}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">{formatFacesCountArabic(Number(bb.Faces_Count) || 1)}</div>
                          <div className="flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{[bb.Municipality || bb.City, bb.District, bb.Nearest_Landmark].filter(Boolean).join(' · ') || '—'}</span></div>
                          {item.notes && <div className="rounded bg-muted/50 px-2 py-1 text-xs">{item.notes}</div>}
                          <div className="pt-1">
                            {done
                              ? <Button size="sm" variant="ghost" className="h-8 w-full" onClick={() => undo(item)}><Undo2 className="h-4 w-4" />تراجع عن الإزالة</Button>
                              : <Button size="sm" className="h-8 w-full" onClick={() => setCompleteIds([item.id])}><CheckCircle2 className="h-4 w-4" />تمت الإزالة</Button>}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {selected.size > 0 && (
          <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-card p-3">
            <span className="text-sm font-semibold">{selected.size} لوحة محددة</span>
            <Button size="sm" onClick={() => setCompleteIds([...selected])}><CheckCircle2 className="h-4 w-4" />توثيق إزالة المحدد</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>إلغاء</Button>
          </footer>
        )}

        <CompleteRemovalDialog open={!!completeIds} count={completeIds?.length || 0} subtitle={`${op.customerName} · عقد #${op.contractId}`}
          onOpenChange={o => { if (!o) setCompleteIds(null); }} onConfirm={doComplete} />
      </DialogContent>
    </Dialog>
  );
}
