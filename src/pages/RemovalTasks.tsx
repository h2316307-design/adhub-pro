import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BarChart3, CheckCircle2, CheckSquare, ChevronDown, LayoutGrid, Merge, Package, Printer, RefreshCw, RotateCcw, Search, ShieldAlert, Table2, Trash2, Wrench, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { CARD_GRID, CardSizeControl, cardVars, useCardSize } from '@/components/composite-ops/CardSize';
import { UnifiedPrintAllDialog, type BillboardPrintItem } from '@/components/shared/printing/UnifiedPrintAllDialog';
import { ExpiredContractsAlert } from '@/components/removal/ExpiredContractsAlert';
import { ManualRemovalTaskDialog } from '@/components/removal/ManualRemovalTaskDialog';
import { QuickRemovalDialog } from '@/components/removal/QuickRemovalDialog';
import { RemovalStatsDialog } from '@/components/reports/RemovalStatsDialog';
import { CompleteRemovalDialog } from '@/components/removal-ops/CompleteRemovalDialog';
import { RemovalBoardsWorkspace } from '@/components/removal-ops/RemovalBoardsWorkspace';
import { RemovalOperationCard, RemovalOperationsTable, type RemovalActions } from '@/components/removal-ops/RemovalOperationCard';
import { useRemovalData } from '@/hooks/useRemovalData';
import { buildRemovalOperations, removalPrintItems, removalWhatsAppMessage, type RemovalOperation } from '@/services/removalOperations';
import { cleanupDuplicateRemovals, completeRemovalItems, deleteRemovalTasks, mergeRemovalTasks, redistributeRemovals } from '@/services/removalActions';
import { SmartCleanupDialog } from '@/components/removal-ops/SmartCleanupDialog';

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();

/** أوامر إزالة الدعاية: كل عملية إزالة (عقد) بفرقها ولوحاتها في بطاقة واحدة — بنفس فكرة أوامر العمل */
export default function RemovalTasks() {
  const navigate = useNavigate();
  const { confirm } = useSystemDialog();
  const data = useRemovalData();
  const { tasks, teams, teamById, allTaskItems, itemsByTask, billboardById, contractByNumber, existingTaskContractIds, existingTaskBillboardIds, duplicateTasksCount, isLoading, refresh } = data;

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [team, setTeam] = useState('all');
  const [sort, setSort] = useState('newest');
  const [limit, setLimit] = useState(24);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [view, setViewState] = useState<'cards' | 'table'>(() => { try { return localStorage.getItem('removal-ops-view') === 'table' ? 'table' : 'cards'; } catch { return 'cards'; } });
  const setView = (v: 'cards' | 'table') => { setViewState(v); try { localStorage.setItem('removal-ops-view', v); } catch { /* تجاهل */ } };
  const [cardSize] = useCardSize();

  const [boardsKey, setBoardsKey] = useState<string | null>(null);
  const [complete, setComplete] = useState<{ ids: string[]; subtitle: string } | null>(null);
  const [print, setPrint] = useState<{ items: BillboardPrintItem[]; number: string | number; customer: string; adType?: string; title: string } | null>(null);
  const [teamPrintOpen, setTeamPrintOpen] = useState(false);
  const [teamForPrint, setTeamForPrint] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const ops = useMemo(() => buildRemovalOperations(tasks, itemsByTask, contractByNumber, teamById, billboardById),
    [tasks, itemsByTask, contractByNumber, teamById, billboardById]);
  const boardsOp = boardsKey ? ops.find(o => o.key === boardsKey) || null : null;
  const selectedOps = useMemo(() => ops.filter(o => selected.has(o.key)), [ops, selected]);

  const rows = useMemo(() => {
    const s = norm(q);
    let list = ops.filter(r =>
      (status === 'all' || (status === 'active' ? r.status !== 'completed' : r.status === status))
      && (team === 'all' || r.parts.some(p => String(p.teamId) === team))
      && (!s || norm(r.customerName).includes(s) || String(r.contractId).includes(s) || norm(r.adType).includes(s)
        || r.teams.some(t => norm(t).includes(s))
        || r.items.some(i => norm(billboardById[i.billboard_id]?.Billboard_Name).includes(s))));
    if (sort === 'oldest') list = [...list].reverse();
    if (sort === 'pending') list = [...list].sort((a, b) => (b.boards - b.boardsDone) - (a.boards - a.boardsDone));
    if (sort === 'end') list = [...list].sort((a, b) => String(a.contractEnd || '').localeCompare(String(b.contractEnd || '')));
    return list;
  }, [ops, q, status, team, sort, billboardById]);

  const kpi = useMemo(() => {
    const active = ops.filter(o => o.status !== 'completed');
    return {
      ops: active.length,
      pending: ops.reduce((s, o) => s + o.boards - o.boardsDone, 0),
      done: ops.reduce((s, o) => s + o.boardsDone, 0),
      teams: new Set(active.flatMap(o => o.parts.filter(p => p.done < p.items.length).map(p => p.teamId))).size,
      completed: ops.length - active.length,
    };
  }, [ops]);

  const toggleSel = (key: string) => setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const openPrint = (list: RemovalOperation[], onlyTeamId?: string) => {
    const items = removalPrintItems(list, billboardById, onlyTeamId) as BillboardPrintItem[];
    if (!items.length) { toast.info('لا توجد لوحات معلقة للطباعة'); return; }
    const one = list.length === 1 ? list[0] : null;
    const teamName = onlyTeamId ? (teamById[onlyTeamId]?.team_name || 'فرقة') : null;
    setPrint({
      items,
      number: one ? one.contractId : (teamName || 'متعدد'),
      customer: one ? one.customerName : (teamName || 'عدة زبائن'),
      adType: one?.adType,
      title: one ? `طباعة الإزالة - ${one.customerName} - عقد #${one.contractId} (${items.length} لوحة)` : `طباعة لوحات الإزالة - ${teamName || `${list.length} أمر`} (${items.length} لوحة)`,
    });
  };

  const askComplete = (list: RemovalOperation[]) => {
    const ids = list.flatMap(o => o.items.filter(i => i.status !== 'completed').map(i => i.id));
    if (!ids.length) { toast.info('كل اللوحات المحددة مُزالة بالفعل'); return; }
    setComplete({ ids, subtitle: list.length === 1 ? `${list[0].customerName} · عقد #${list[0].contractId}` : `${list.length} أوامر إزالة` });
  };

  const doComplete = async (date: string, notes: string) => {
    if (!complete) return;
    try {
      const n = await completeRemovalItems(complete.ids, date, notes || null, allTaskItems);
      toast.success(`وُثّقت إزالة ${n} لوحة`);
      setSelected(new Set());
      refresh();
    } catch (e: any) { toast.error('تعذر توثيق الإزالة: ' + (e?.message || e)); throw e; }
  };

  const doDelete = async (list: RemovalOperation[]) => {
    const done = list.reduce((s, o) => s + o.boardsDone, 0);
    const ok = await confirm({
      title: list.length === 1 ? 'حذف أمر الإزالة' : `حذف ${list.length} أوامر إزالة`,
      message: `${list.length === 1 ? `${list[0].customerName} · عقد #${list[0].contractId}` : 'الأوامر المحددة'} — ${list.reduce((s, o) => s + o.boards, 0)} لوحة${done ? `، منها ${done} موثّقة الإزالة وسيُحذف توثيقها` : ''}.`,
      confirmText: 'حذف', variant: 'destructive',
    } as any);
    if (!ok) return;
    try { await deleteRemovalTasks(list.flatMap(o => o.tasks.map(t => t.id))); toast.success('تم الحذف'); setSelected(new Set()); refresh(); }
    catch (e: any) { toast.error('فشل الحذف: ' + (e?.message || e)); }
  };

  const runTool = async (key: string, fn: () => Promise<any>, ok: (r: any) => string) => {
    setBusy(key);
    try { const r = await fn(); toast.success(ok(r)); refresh(); }
    catch (e: any) { toast.error(e?.message || 'تعذر التنفيذ'); }
    finally { setBusy(null); }
  };


  const actions: RemovalActions = {
    onBoards: r => setBoardsKey(r.key),
    onPrint: r => openPrint([r]),
    onComplete: r => askComplete([r]),
    onWhatsApp: (r, p) => {
      const msg = removalWhatsAppMessage(r, p, billboardById);
      const phone = p.phone ? String(p.phone).replace(/[^0-9+]/g, '').replace(/^\+/, '') : '';
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    },
    onDelete: r => doDelete([r]),
    onNavigate: path => navigate(path),
  };

  const teamsWithWork = useMemo(() => {
    const m = new Map<string, number>();
    ops.forEach(o => o.parts.forEach(p => { const left = p.items.length - p.done; if (left) m.set(String(p.teamId), (m.get(String(p.teamId)) || 0) + left); }));
    return m;
  }, [ops]);

  return (
    <div dir="rtl" className="space-y-4 p-4 text-right md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">أوامر الإزالة</h1>
          <p className="text-sm text-muted-foreground">كل عملية إزالة بفرقها ولوحاتها في مكان واحد</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setManualOpen(true)}><Package className="h-4 w-4" />أمر إزالة</Button>
          <Button variant="secondary" onClick={() => setQuickOpen(true)} disabled={isLoading}><CheckSquare className="h-4 w-4" />الإزالة السريعة</Button>
          <Button variant="outline" onClick={() => setSmartOpen(true)}><ShieldAlert className="h-4 w-4" />الفحص الذكي</Button>
          <Button variant="outline" onClick={() => openPrint(ops)}><Printer className="h-4 w-4" />طباعة كل المعلق</Button>
          <Button variant="outline" onClick={() => { setTeamForPrint([...teamsWithWork.keys()][0] || ''); setTeamPrintOpen(true); }}><Printer className="h-4 w-4" />طباعة فرقة</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" disabled={!!busy}><Wrench className="h-4 w-4" />أدوات<ChevronDown className="h-3 w-3 opacity-60" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 text-right">
              <DropdownMenuLabel>أدوات التنظيم</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSmartOpen(true)}><ShieldAlert className="ml-2 h-4 w-4 text-rose-500" />الفحص الذكي (المؤجرة والمتاح)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => runTool('redist', () => redistributeRemovals(allTaskItems, tasks, billboardById), n => `نُقلت ${n} لوحة إلى الفرق الأنسب`)}><RotateCcw className="ml-2 h-4 w-4 text-amber-500" />إعادة التوزيع الذكي</DropdownMenuItem>
              <DropdownMenuItem onClick={() => runTool('merge', () => mergeRemovalTasks(tasks), n => n ? `دُمج ${n} أمر متفرق` : 'لا توجد أوامر متفرقة')}><Merge className="ml-2 h-4 w-4 text-indigo-500" />تجميع الأوامر المتفرقة</DropdownMenuItem>
              {duplicateTasksCount > 0 && (<>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => runTool('dup', () => cleanupDuplicateRemovals(allTaskItems, tasks, teams), n => `حُذفت ${n} لوحة مكررة`)}><Trash2 className="ml-2 h-4 w-4" />حذف {duplicateTasksCount} مكررات</DropdownMenuItem>
              </>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => setStatsOpen(true)}><BarChart3 className="h-4 w-4" />الإحصائيات</Button>
          <Button variant="outline" onClick={refresh} aria-label="تحديث"><RefreshCw className={cn('h-4 w-4', (isLoading || busy) && 'animate-spin')} />تحديث</Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {[
          { label: 'أوامر قيد التنفيذ', value: kpi.ops },
          { label: 'لوحات بانتظار الإزالة', value: kpi.pending, tone: kpi.pending ? 'text-amber-600' : '' },
          { label: 'لوحات أُزيلت', value: kpi.done, tone: 'text-emerald-600' },
          { label: 'فرق لديها أعمال', value: kpi.teams },
          { label: 'أوامر مكتملة', value: kpi.completed, tone: 'text-muted-foreground' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className={cn('mt-1 text-lg font-bold tabular-nums', s.tone)}>{s.value.toLocaleString('en-US')}</div>
          </div>
        ))}
      </section>

      <ExpiredContractsAlert teams={teams} existingTaskContractIds={existingTaskContractIds} onTaskCreated={refresh} />

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => { setQ(e.target.value); setLimit(24); }} placeholder="زبون، رقم عقد، فرقة، لوحة، نوع إعلان" className="h-10 pr-9" />
        </div>
        <Select value={status} onValueChange={v => { setStatus(v); setLimit(24); }}>
          <SelectTrigger className="h-10 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">غير المكتملة</SelectItem>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="pending">بانتظار الإزالة</SelectItem>
            <SelectItem value="in_progress">إزالة جزئية</SelectItem>
            <SelectItem value="completed">أُزيلت</SelectItem>
          </SelectContent>
        </Select>
        <Select value={team} onValueChange={v => { setTeam(v); setLimit(24); }}>
          <SelectTrigger className="h-10 w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفرق</SelectItem>
            {teams.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.team_name}{teamsWithWork.get(String(t.id)) ? ` (${teamsWithWork.get(String(t.id))})` : ''}</SelectItem>)}
          </SelectContent>
        </Select>
        <div role="radiogroup" aria-label="طريقة العرض" className="flex rounded-lg border border-border p-0.5">
          <button type="button" role="radio" aria-checked={view === 'cards'} onClick={() => setView('cards')} className={cn('flex h-9 items-center gap-1 rounded-md px-3 text-sm', view === 'cards' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}><LayoutGrid className="h-4 w-4" />بطاقات</button>
          <button type="button" role="radio" aria-checked={view === 'table'} onClick={() => setView('table')} className={cn('flex h-9 items-center gap-1 rounded-md px-3 text-sm', view === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}><Table2 className="h-4 w-4" />جدول</button>
        </div>
        {view === 'cards' && <CardSizeControl />}
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-10 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">الأحدث</SelectItem>
            <SelectItem value="oldest">الأقدم</SelectItem>
            <SelectItem value="pending">الأكثر لوحات معلقة</SelectItem>
            <SelectItem value="end">الأقدم انتهاءً</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}</div>
      ) : !rows.length ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">لا توجد أوامر إزالة مطابقة</div>
      ) : (
        <div className="space-y-4">
          {view === 'table' ? (
            <RemovalOperationsTable rows={rows.slice(0, limit)} selected={selected} onToggle={toggleSel} a={actions}
              onToggleAll={on => setSelected(on ? new Set(rows.slice(0, limit).map(r => r.key)) : new Set())} />
          ) : (
            <div className={cn(CARD_GRID[cardSize].grid, CARD_GRID[cardSize].text)} style={cardVars(cardSize)}>
              {rows.slice(0, limit).map(r => <RemovalOperationCard key={r.key} r={r} selected={selected.has(r.key)} onToggle={() => toggleSel(r.key)} a={actions} />)}
            </div>
          )}
          {rows.length > limit && <div className="text-center"><Button variant="outline" onClick={() => setLimit(l => l + 24)}>عرض المزيد ({rows.length - limit})</Button></div>}
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-20 z-20 mx-auto flex w-fit flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 shadow-lg lg:bottom-3">
          <span className="text-sm font-semibold">{selected.size} أمر محدد</span>
          <span className="text-xs tabular-nums text-muted-foreground">{selectedOps.reduce((s, o) => s + o.boards - o.boardsDone, 0)} لوحة معلقة</span>
          <Button size="sm" onClick={() => askComplete(selectedOps)}><CheckCircle2 className="h-4 w-4" />توثيق الإزالة</Button>
          <Button size="sm" variant="outline" onClick={() => openPrint(selectedOps)}><Printer className="h-4 w-4" />طباعة</Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => doDelete(selectedOps)}><Trash2 className="h-4 w-4" />حذف</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}><X className="h-4 w-4" />إلغاء</Button>
        </div>
      )}

      {boardsOp && <RemovalBoardsWorkspace op={boardsOp} billboardById={billboardById} allItems={allTaskItems} onClose={() => setBoardsKey(null)} onChanged={refresh} />}

      <CompleteRemovalDialog open={!!complete} count={complete?.ids.length || 0} subtitle={complete?.subtitle}
        onOpenChange={o => { if (!o) setComplete(null); }} onConfirm={doComplete} />

      {print && (
        <UnifiedPrintAllDialog
          open
          onOpenChange={o => { if (!o) setPrint(null); }}
          contextType="removal"
          contextNumber={print.number as any}
          customerName={print.customer}
          adType={print.adType}
          items={print.items}
          billboards={billboardById as any}
          teams={teamById}
          showTeamFilter
          title={print.title}
        />
      )}

      <Dialog open={teamPrintOpen} onOpenChange={setTeamPrintOpen}>
        <DialogContent dir="rtl" className="max-w-md text-right">
          <DialogHeader className="text-right">
            <DialogTitle>طباعة لوحات فرقة</DialogTitle>
            <DialogDescription>كل اللوحات المعلقة للفرقة في جميع أوامر الإزالة</DialogDescription>
          </DialogHeader>
          <Select value={teamForPrint} onValueChange={setTeamForPrint}>
            <SelectTrigger><SelectValue placeholder="اختر الفرقة" /></SelectTrigger>
            <SelectContent>{teams.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.team_name} · {teamsWithWork.get(String(t.id)) || 0} معلقة</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTeamPrintOpen(false)}>إلغاء</Button>
            <Button disabled={!teamForPrint} onClick={() => { setTeamPrintOpen(false); openPrint(ops, teamForPrint); }}><Printer className="h-4 w-4" />طباعة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SmartCleanupDialog open={smartOpen} onOpenChange={setSmartOpen} teams={teams} onChanged={refresh} />

      <QuickRemovalDialog open={quickOpen} onOpenChange={setQuickOpen} items={allTaskItems} tasks={tasks} billboards={billboardById as any} contracts={contractByNumber as any} teams={teamById} />
      <ManualRemovalTaskDialog open={manualOpen} onOpenChange={setManualOpen} teams={teams} existingTaskBillboardIds={existingTaskBillboardIds} />
      <RemovalStatsDialog open={statsOpen} onOpenChange={setStatsOpen} />
    </div>
  );
}
