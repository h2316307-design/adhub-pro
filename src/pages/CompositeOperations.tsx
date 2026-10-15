import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { TaskDesignManager } from '@/components/tasks/TaskDesignManager';
import { BulkDesignAssigner } from '@/components/tasks/BulkDesignAssigner';
import { fetchInstallationWorkflowData, type InstallationWorkflowData } from '@/components/composite-tasks/list/shared';
import { ImagePlus, Palette, Trash2, X, Plus, Calculator, FileText, FolderOpen, MoreHorizontal, RefreshCw, Search, ShieldCheck, Users, Printer, Scissors, Layers } from 'lucide-react';
import { OperationCard, OperationsTable, type OperationActions } from '@/components/composite-ops/OperationCard';
import { LayoutGrid, Table2 } from 'lucide-react';
import { CARD_GRID, CardSizeControl, cardVars, useCardSize } from '@/components/composite-ops/CardSize';
import { UnifiedTaskInvoice } from '@/components/composite-tasks/UnifiedTaskInvoice';
import { CostEditorDialog } from '@/components/composite-ops/CostEditorDialog';
import { money } from '@/lib/compositeCosts';
import { OperationBoardsWorkspace } from '@/components/composite-ops/OperationBoardsWorkspace';
import { EnhancedAddInstallationTaskDialog } from '@/components/installation/EnhancedAddInstallationTaskDialog';
import { UnifiedPrintAllDialog } from '@/components/shared/printing/UnifiedPrintAllDialog';
import { createInstallationOperation } from '@/services/installationOperationCreate';
import { loadOperations, type OperationRow } from '@/services/compositeOperations';


const STATUS: Record<OperationRow['status'], { label: string; cls: string }> = {
  pending: { label: 'قيد الانتظار', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  in_progress: { label: 'قيد التنفيذ', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' },
  completed: { label: 'مكتملة', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  cancelled: { label: 'ملغاة', cls: 'bg-muted text-muted-foreground' },
};

const d = (s?: string | null) => { try { return s ? format(new Date(s), 'dd/MM/yyyy') : '—'; } catch { return '—'; } };
const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();

export default function CompositeOperations() {
  return <CompositeOperationsView />;
}

/** نظام أوامر العمل الموحد: يُستخدم في صفحته وفي حساب الزبون (مع customerId) */
export function CompositeOperationsView({ customerId, embedded = false }: { customerId?: string | null; embedded?: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['composite-operations'], queryFn: loadOperations, staleTime: 30_000 });
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState(embedded ? 'all' : 'active');
  const [money_, setMoney] = useState('all');
  const [sort, setSort] = useState('newest');
  const [limit, setLimit] = useState(24);
  const [editing, setEditing] = useState<OperationRow | null>(null);
  const [invoiceOp, setInvoiceOp] = useState<OperationRow | null>(null);
  const [invoiceTasks, setInvoiceTasks] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [workflow, setWorkflow] = useState<{ op: OperationRow; data: InstallationWorkflowData; mode: 'designs' | 'distribution' | 'print' } | null>(null);
  const [boardsOp, setBoardsOp] = useState<OperationRow | null>(null);
  // إبقاء نافذة إدارة اللوحات على أحدث بيانات العملية (بعد نقل/إضافة فرقة)
  useEffect(() => {
    if (!boardsOp || !data) return;
    const ids = new Set(boardsOp.tasks.map(t => t.id));
    const fresh = data.find(r => r.tasks.some(t => ids.has(t.id)));
    if (fresh) setBoardsOp(fresh);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const [createType, setCreateType] = useState<'installation' | 'reinstallation' | null>(null);
  const [creating, setCreating] = useState(false);
  const { data: teamsList = [] } = useQuery({ queryKey: ['installation-teams-all'], queryFn: async () => {
    const { data, error } = await supabase.from('installation_teams').select('*');
    if (error) throw error;
    return data || [];
  }, staleTime: 300_000 });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { confirm } = useSystemDialog();

  const [view, setViewState] = useState<'cards' | 'table'>(() => { try { return localStorage.getItem('composite-ops-view') === 'table' ? 'table' : 'cards'; } catch { return 'cards'; } });
  const setView = (v: 'cards' | 'table') => { setViewState(v); try { localStorage.setItem('composite-ops-view', v); } catch { /* ignore */ } };
  const [cardSize] = useCardSize();
  const selectedOps = useMemo(() => (data || []).filter(r => selected.has(r.key)), [data, selected]);
  const toggleSel = (key: string) => setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const openWorkflow = async (op: OperationRow, mode: 'designs' | 'distribution' | 'print') => {
    const ids = op.tasks.map(t => t.installation_task_id).filter(Boolean);
    if (!ids.length) { toast.error('لا توجد أمر تركيب مرتبط'); return; }
    setBusyKey(op.key);
    try {
      const wf = await fetchInstallationWorkflowData(ids[0], ids, op.contractIds.length === 1 ? op.contractIds[0] : null);
      if (mode === 'distribution' && !wf.designs.length) { toast.info('أضف تصميماً أولاً ثم وزّعه على اللوحات'); mode = 'designs'; }
      if (mode === 'print' && !wf.items.length) { toast.info('لا توجد لوحات في هذه العملية'); return; }
      setWorkflow({ op, data: wf, mode });
    } catch (e: any) { toast.error(e.message || 'تعذر تحميل التصاميم'); }
    finally { setBusyKey(null); }
  };
  const reloadWorkflow = async () => {
    if (!workflow) return;
    const ids = workflow.data.taskIds;
    const wf = await fetchInstallationWorkflowData(ids[0], ids, workflow.op.contractIds.length === 1 ? workflow.op.contractIds[0] : null);
    setWorkflow(w => w ? { ...w, data: wf } : w);
  };

  const deleteOp = async (op: OperationRow) => {
    if (op.boardsDone > 0) { toast.error(`لا يمكن الحذف: تم تركيب ${op.boardsDone} لوحة في هذه العملية`); return; }
    if (op.money.paid > 0) { toast.error('لا يمكن الحذف: توجد دفعات مسجلة على هذه العملية'); return; }
    const ok = await confirm({ title: 'حذف العملية المجمعة', message: `سيتم حذف ${op.label} للزبون ${op.customerName} (${op.tasks.length} مهمة). لن تُحذف أوامر التركيب نفسها.`, confirmText: 'حذف', variant: 'destructive' } as any);
    if (!ok) return;
    try {
      for (const t of op.tasks) {
        if (t.combined_invoice_id) {
          await supabase.from('customer_payments').delete().eq('printed_invoice_id', t.combined_invoice_id).eq('entry_type', 'invoice');
          await supabase.from('printed_invoices').delete().eq('id', t.combined_invoice_id);
        }
        await supabase.from('composite_tasks').update({ installation_task_id: null, print_task_id: null, cutout_task_id: null, combined_invoice_id: null } as any).eq('id', t.id);
        const { error } = await supabase.from('composite_tasks').delete().eq('id', t.id);
        if (error) throw error;
      }
      toast.success('تم حذف العملية');
      refresh();
    } catch (e: any) { toast.error(e.message || 'فشل الحذف'); }
  };

  const actions: OperationActions = {
    onCosts: r => setEditing(r),
    onBoards: r => setBoardsOp(r),
    onDesigns: r => openWorkflow(r, 'designs'),
    onDistribute: r => openWorkflow(r, 'distribution'),
    onPrint: r => openWorkflow(r, 'print'),
    onInvoice: r => setInvoiceOp(r),
    onReinstall: () => setCreateType('reinstallation'),
    onDelete: r => deleteOp(r),
    onNavigate: path => navigate(path),
  };

  const groupInvoice = () => {
    const customers = new Set(selectedOps.map(o => o.customerId || o.customerName));
    if (customers.size > 1) { toast.error('اختر عمليات لزبون واحد فقط لإصدار فاتورة مجمعة'); return; }
    const tasks = selectedOps.flatMap(o => o.tasks.map(t => ({ ...t, adType: o.adTypes.join(' / ') })));
    setInvoiceTasks(tasks);
  };

  const rows = useMemo(() => {
    const s = norm(q);
    let list = (data || []).filter(r => (!customerId || r.customerId === customerId) &&
      (type === 'all' || r.type === type)
      && (status === 'all' || (status === 'active' ? r.status !== 'completed' && r.status !== 'cancelled' : r.status === status))
      && (money_ === 'all' || (money_ === 'unpaid' ? r.money.remaining > 0.5 : money_ === 'loss' ? r.money.profit < 0 : r.money.contractExpense > 0))
      && (!s || norm(r.customerName).includes(s) || r.contractIds.some(n => String(n).includes(s)) || r.teams.some(t => norm(t).includes(s)) || r.adTypes.some(a => norm(a).includes(s))));
    if (sort === 'remaining') list = [...list].sort((a, b) => b.money.remaining - a.money.remaining);
    if (sort === 'oldest') list = [...list].reverse();
    return list;
  }, [data, q, type, status, money_, sort]);

  const kpi = useMemo(() => rows.reduce((k, r) => ({
    count: k.count + 1,
    customer: k.customer + r.money.customerTotal,
    paid: k.paid + r.money.paid,
    remaining: k.remaining + r.money.remaining,
    expense: k.expense + r.money.contractExpense,
    profit: k.profit + r.money.profit,
  }), { count: 0, customer: 0, paid: 0, remaining: 0, expense: 0, profit: 0 }), [rows]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ['composite-operations'] }); qc.invalidateQueries({ queryKey: ['composite-tasks'] }); };


  return (
    <div dir="rtl" className={cn('space-y-4 text-right', embedded ? '' : 'p-4 md:p-6')}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        {embedded ? <div className="text-base font-bold">عمليات التركيب وإعادة التركيب</div> : (
          <div>
            <h1 className="text-2xl font-bold">أوامر العمل</h1>
            <p className="text-sm text-muted-foreground">كل عملية تركيب أو إعادة تركيب بتكاليفها في مكان واحد</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCreateType('installation')}><Plus className="h-4 w-4" />أمر تركيب</Button>
          <Button variant="secondary" onClick={() => setCreateType('reinstallation')}><Plus className="h-4 w-4" />إعادة تركيب</Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />تحديث</Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'العمليات', value: kpi.count.toLocaleString('en-US') },
          { label: 'المستحق على الزبائن', value: money(kpi.customer) },
          { label: 'المدفوع', value: money(kpi.paid) },
          { label: 'المتبقي', value: money(kpi.remaining), tone: kpi.remaining > 0 ? 'text-amber-600' : '' },
          { label: 'مصروف على العقود', value: money(kpi.expense), tone: 'text-emerald-700 dark:text-emerald-400' },
          { label: 'ربح المهام', value: money(kpi.profit), tone: kpi.profit < 0 ? 'text-destructive' : 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className={cn('mt-1 text-lg font-bold tabular-nums', s.tone)}>{s.value}</div>
          </div>
        ))}
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => { setQ(e.target.value); setLimit(24); }} placeholder="زبون، رقم عقد، فرقة، نوع إعلان" className="h-10 pr-9" />
        </div>
        <Select value={status} onValueChange={v => { setStatus(v); setLimit(24); }}>
          <SelectTrigger className="h-10 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">غير المكتملة</SelectItem>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="pending">قيد الانتظار</SelectItem>
            <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
            <SelectItem value="completed">مكتملة</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={v => { setType(v); setLimit(24); }}>
          <SelectTrigger className="h-10 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            <SelectItem value="new_installation">تركيب أول</SelectItem>
            <SelectItem value="reinstallation">إعادة تركيب</SelectItem>
          </SelectContent>
        </Select>
        <Select value={money_} onValueChange={v => { setMoney(v); setLimit(24); }}>
          <SelectTrigger className="h-10 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المبالغ</SelectItem>
            <SelectItem value="unpaid">عليها متبقي</SelectItem>
            <SelectItem value="included">مشمولة بالعقد</SelectItem>
            <SelectItem value="loss">ربح سالب</SelectItem>
          </SelectContent>
        </Select>
        <div role="radiogroup" aria-label="طريقة العرض" className="flex rounded-lg border border-border p-0.5">
          <button type="button" role="radio" aria-checked={view === 'cards'} aria-label="بطاقات" onClick={() => setView('cards')} className={cn('flex h-9 items-center gap-1 rounded-md px-3 text-sm', view === 'cards' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}><LayoutGrid className="h-4 w-4" />بطاقات</button>
          <button type="button" role="radio" aria-checked={view === 'table'} aria-label="جدول" onClick={() => setView('table')} className={cn('flex h-9 items-center gap-1 rounded-md px-3 text-sm', view === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}><Table2 className="h-4 w-4" />جدول</button>
        </div>
        {view === 'cards' && <CardSizeControl />}
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-10 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">الأحدث</SelectItem>
            <SelectItem value="oldest">الأقدم</SelectItem>
            <SelectItem value="remaining">الأعلى متبقياً</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {error ? (
        <div className="rounded-xl border border-destructive/40 p-6 text-center text-destructive">{(error as Error).message}</div>
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}</div>
      ) : !rows.length ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">لا توجد عمليات مطابقة</div>
      ) : (
        <div className="space-y-4">
          {view === 'table' ? (
            <OperationsTable rows={rows.slice(0, limit)} selected={selected} onToggle={toggleSel} a={actions}
              onToggleAll={on => setSelected(on ? new Set(rows.slice(0, limit).map(r => r.key)) : new Set())} />
          ) : (
            <div className={cn(CARD_GRID[cardSize].grid, CARD_GRID[cardSize].text)} style={cardVars(cardSize)}>
              {rows.slice(0, limit).map(r => (
                <OperationCard key={r.key} r={r} selected={selected.has(r.key)} onToggle={() => toggleSel(r.key)} busy={busyKey === r.key} a={actions} />
              ))}
            </div>
          )}
          {rows.length > limit && (
            <div className="col-span-full text-center"><Button variant="outline" onClick={() => setLimit(l => l + 24)}>عرض المزيد ({rows.length - limit})</Button></div>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-3 z-20 mx-auto flex w-fit flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 shadow-lg">
          <span className="text-sm font-semibold">{selected.size} عملية محددة</span>
          <span className="text-xs tabular-nums text-muted-foreground">المستحق {money(selectedOps.reduce((s, o) => s + o.money.customerTotal, 0))} · المتبقي {money(selectedOps.reduce((s, o) => s + o.money.remaining, 0))}</span>
          <Button size="sm" onClick={groupInvoice}><FileText className="h-4 w-4" />فاتورة مجمعة</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}><X className="h-4 w-4" />إلغاء التحديد</Button>
        </div>
      )}

      {boardsOp && (
        <OperationBoardsWorkspace
          op={boardsOp}
          onClose={() => setBoardsOp(null)}
          onChanged={refresh}
          onEditCosts={() => setEditing(boardsOp)}
          onDesigns={() => openWorkflow(boardsOp, 'designs')}
          onDistribute={() => openWorkflow(boardsOp, 'distribution')}
          onPrint={() => openWorkflow(boardsOp, 'print')}
        />
      )}

      {workflow?.mode === 'designs' && (
        <Dialog open onOpenChange={o => { if (!o) setWorkflow(null); }}>
          <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto" dir="rtl">
            <DialogHeader className="text-right"><DialogTitle>تصاميم {workflow.op.label} · {workflow.op.customerName}</DialogTitle></DialogHeader>
            <TaskDesignManager
              taskId={workflow.data.primaryTaskId}
              designs={workflow.data.designs}
              replicateToTaskIds={workflow.data.taskIds.filter(id => id !== workflow.data.primaryTaskId)}
              contractNumber={workflow.op.contractIds[0]}
              customerName={workflow.op.customerName}
              adType={workflow.op.adTypes.join(' / ')}
              onDesignsUpdate={() => { reloadWorkflow().catch((e: any) => toast.error(e?.message || 'تعذر التحديث')); }}
            />
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline" onClick={() => setWorkflow(w => w && w.data.designs.length ? { ...w, mode: 'distribution' } : w)} disabled={!workflow.data.designs.length}><Palette className="h-4 w-4" />توزيع على اللوحات</Button>
              <Button onClick={() => setWorkflow(null)}>تم</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {workflow?.mode === 'distribution' && (
        <BulkDesignAssigner
          open
          onOpenChange={(o: boolean) => { if (!o) setWorkflow(null); }}
          taskItems={workflow.data.items.map((item: any) => ({ ...item, billboards: workflow.data.billboards[Number(item.billboard_id)] }))}
          taskDesigns={workflow.data.designs}
          onSuccess={() => { toast.success('تم توزيع التصاميم'); setWorkflow(null); refresh(); }}
        />
      )}

      {invoiceTasks && invoiceTasks.length > 0 && (
        <UnifiedTaskInvoice
          open
          onOpenChange={(o: boolean) => { if (!o) setInvoiceTasks(null); }}
          task={invoiceTasks[0] as any}
          tasks={invoiceTasks.length > 1 ? invoiceTasks as any : undefined}
          invoiceType="customer"
        />
      )}

      {workflow?.mode === 'print' && (() => {
        const wf = workflow.data;
        const taskById = new Map(wf.installationTasks.map((t: any) => [t.id, t]));
        const items = wf.items.map((item: any) => {
          const t: any = taskById.get(item.task_id);
          return {
            id: item.id, billboard_id: Number(item.billboard_id), design_face_a: item.design_face_a, design_face_b: item.design_face_b,
            faces_to_install: item.faces_to_install, installed_image_face_a_url: item.installed_image_face_a_url, installed_image_face_b_url: item.installed_image_face_b_url,
            installation_date: item.installation_date, team_id: t?.team_id, has_cutout: item.has_cutout,
            contract_number: t?.contract_id || workflow.op.contractIds[0], ad_type: workflow.op.adTypes.join(' / ') || null,
            overlay_config: item.overlay_config || wf.billboards[Number(item.billboard_id)]?.overlay_config,
          };
        });
        return (
          <UnifiedPrintAllDialog
            open
            onOpenChange={(o: boolean) => { if (!o) setWorkflow(null); }}
            contextType="installation"
            contextNumber={workflow.op.contractIds[0]}
            customerName={workflow.op.customerName}
            adType={workflow.op.adTypes.join(' / ')}
            items={items as any}
            billboards={wf.billboards}
            teams={wf.allTeams || {}}
            showTeamFilter
            title={`طباعة ${workflow.op.label} - ${workflow.op.contractIds.map(n => '#' + n).join('، ')} (${items.length} لوحة)`}
            taskId={wf.primaryTaskId}
            taskIds={wf.taskIds}
            taskType={workflow.op.type === 'reinstallation' ? 'reinstallation' : 'installation'}
            reinstallationNumber={workflow.op.tasks[0]?.reinstallationNumber ?? null}
          />
        );
      })()}

      {createType && (
        <EnhancedAddInstallationTaskDialog
          open
          onOpenChange={o => { if (!o && !creating) setCreateType(null); }}
          taskType={createType}
          onTaskTypeChange={setCreateType}
          teams={teamsList as any}
          isSubmitting={creating}
          onSubmit={async ({ contractIds, billboardIds, teamAssignments, task_name, acceptedInactiveContractIds }) => {
            setCreating(true);
            try {
              const res = await createInstallationOperation({ contractIds, billboardIds, teamAssignments, taskType: createType, taskName: task_name, acceptedInactiveContractIds });
              toast.success(`تم إنشاء العملية (${res.taskIds.length} ${res.taskIds.length === 1 ? 'فرقة' : 'فرق'})`);
              setCreateType(null);
              refresh();
            } catch (e: any) { toast.error(e.message || 'تعذر إنشاء المهمة'); }
            finally { setCreating(false); }
          }}
        />
      )}

      <CostEditorDialog op={editing} open={!!editing} onOpenChange={o => { if (!o) setEditing(null); }} onSaved={refresh} />

      {invoiceOp && (
        <UnifiedTaskInvoice
          open={!!invoiceOp}
          onOpenChange={(o: boolean) => { if (!o) setInvoiceOp(null); }}
          task={{ ...invoiceOp.tasks[0], adType: invoiceOp.adTypes.join(' / ') } as any}
          tasks={invoiceOp.tasks.length > 1 ? invoiceOp.tasks.map(t => ({ ...t, adType: invoiceOp.adTypes.join(' / ') })) as any : undefined}
          invoiceType="customer"
        />
      )}
    </div>
  );
}
