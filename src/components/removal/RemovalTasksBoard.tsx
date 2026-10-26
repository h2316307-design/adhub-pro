import { normalizeGoogleImageUrl } from '@/utils/imageUtils';
import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Search, CheckCircle2, Clock, Users, ChevronDown, ChevronLeft, ChevronRight, Printer, Trash2, RotateCcw, RefreshCw, MessageCircle, Layers } from 'lucide-react';
import { RemovalTaskItemCard } from './RemovalTaskItemCard';

interface Props {
  tasks: any[];
  allTaskItems: any[];
  billboardById: Record<number, any>;
  contractByNumber: Record<number, any>;
  teamById: Record<string, any>;
  teams: any[];
  isLoading: boolean;
  // stats
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  totalItems: number;
  completedItems: number;
  // pagination (lifted to parent to preserve across re-renders)
  page: number;
  onPageChange: (page: number) => void;
  // actions
  onRefresh: () => void;
  onAddTask: () => void;
  onDeleteTask: (taskId: string) => void;
  onPrintTask: (task: any, items: any[]) => void;
  onUndoRemoval: (itemId: string) => void;
  onCompleteAll?: (taskId: string) => void;
  onCompleteItem?: (itemId: string, taskId: string) => void;
  onPrintAllTeam?: (teamId: string) => void;
  onPrintAllPending?: () => void;
  onSyncMissingBillboards?: (contractId: number, taskIds: string[]) => void;
  onBulkComplete?: (taskIds: string[]) => void;
  onBulkPrint?: (taskIds: string[]) => void;
  onBulkDelete?: (taskIds: string[]) => void;
  onSendWhatsApp?: (task: any, items: any[]) => void;
  // item selection
  selectedItems: Set<string>;
  onToggleItem: (itemId: string, taskId: string) => void;
  onToggleSelectAll: (taskId: string) => void;
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
}

export const RemovalTasksBoard: React.FC<Props> = (props) => {
  const { tasks, allTaskItems, billboardById, contractByNumber, teamById, teams,
    selectedItems, onToggleItem, onToggleSelectAll, onPageChange } = props;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [teamId, setTeamId] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [sort, setSort] = useState('newest');
  const itemsByTask = useMemo(() => {
    const result = new Map<string, any[]>();
    allTaskItems.forEach(item => result.set(item.task_id, [...(result.get(item.task_id) || []), item]));
    return result;
  }, [allTaskItems]);
  const rows = useMemo(() => tasks.map(task => {
    const items = itemsByTask.get(task.id) || [];
    const contract = contractByNumber[task.contract_id] || contractByNumber[String(task.contract_id)] || contractByNumber[Number(task.contract_id)] || task.Contract || {};
    const team = teamById[task.team_id] || teamById[String(task.team_id)] || task.installation_teams || {};
    const completed = items.filter(item => item.status === 'completed').length;
    const state = task.status === 'cancelled' ? 'cancelled' : task.status === 'completed' ? 'completed' : items.length && completed === items.length ? 'completed' : 'active';
    const text = [contract['Customer Name'], task.contract_id, ...(task.contract_ids || []), team.team_name,
      ...items.flatMap(item => { const bb = billboardById[item.billboard_id] || {}; return [bb.Billboard_Name, item.billboard_id, bb.Municipality, bb.District]; })].map(normalize).join(' ');
    return { ...task, contract, team, items, completed, state, text };
  }).filter(row => row.items.length > 0), [tasks, itemsByTask, contractByNumber, teamById, billboardById]);
  const filtered = useMemo(() => rows.filter(row => (status === 'all' || row.state === status) &&
    (teamId === 'all' || row.team_id === teamId) && (!search.trim() || row.text.includes(normalize(search))))
    .sort((a, b) => sort === 'customer' ? String(a.contract['Customer Name'] || '').localeCompare(String(b.contract['Customer Name'] || ''), 'ar') :
      sort === 'remaining' ? (b.items.length - b.completed) - (a.items.length - a.completed) : String(b.created_at).localeCompare(String(a.created_at))), [rows, status, teamId, search, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 12));
  const page = Math.min(Math.max(1, props.page), pageCount);
  const visible = filtered.slice((page - 1) * 12, page * 12);
  const chosen = filtered.filter(row => selected.has(row.id));
  const allVisibleSelected = visible.length > 0 && visible.every(row => selected.has(row.id));
  useEffect(() => { if (props.page !== page) onPageChange(page); }, [page, props.page, onPageChange]);
  useEffect(() => { setSelected(current => new Set([...current].filter(id => rows.some(row => row.id === id)))); }, [rows]);
  function changeFilter(action: () => void) { action(); onPageChange(1); setSelected(new Set()); }
  function toggle(id: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) {
    setter(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  const control = 'cursor-pointer transition-all duration-200';
  return <section className="space-y-4" aria-label="مساحة إدارة الإزالة">
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="p-4 sm:p-5 space-y-4 border-b">
        <div className="flex flex-wrap justify-between items-center gap-3"><div><h2 className="font-bold text-lg">قائمة التنفيذ</h2><p className="text-sm text-muted-foreground mt-1">ابحث برمز اللوحة أو العميل، وافتح المهمة لعرض الصور وتوثيق الإزالة.</p></div><Button variant="outline" className={control} onClick={props.onRefresh}><RefreshCw className="h-4 w-4 ml-2" />تحديث</Button></div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="حالة المهام">{[{ id: 'active', label: 'بانتظار التنفيذ' }, { id: 'completed', label: 'المكتملة' }, { id: 'cancelled', label: 'الملغاة' }, { id: 'all', label: 'جميع المهام' }].map(tab => <Button key={tab.id} variant={status === tab.id ? 'default' : 'outline'} aria-pressed={status === tab.id} className={control} onClick={() => changeFilter(() => setStatus(tab.id))}>{tab.label}<span className="mr-2 tabular-nums">{tab.id === 'all' ? rows.length : rows.filter(row => row.state === tab.id).length}</span></Button>)}</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input aria-label="بحث اللوحات والمهام" className="pr-9 h-11" placeholder="رمز اللوحة، العميل أو العقد... مثال TR-SJ0160" value={search} onChange={e => changeFilter(() => setSearch(e.target.value))} />
          </div>
          <select aria-label="تصفية حسب الفريق" className="h-11 rounded-md border bg-background px-3 cursor-pointer min-w-[180px]" value={teamId} onChange={e => changeFilter(() => setTeamId(e.target.value))}>
            <option value="all">جميع الفرق</option>
            {teams.map(team => <option key={team.id} value={team.id}>{team.team_name}</option>)}
          </select>
          <select aria-label="ترتيب المهام" className="h-11 rounded-md border bg-background px-3 cursor-pointer min-w-[160px]" value={sort} onChange={e => changeFilter(() => setSort(e.target.value))}>
            <option value="newest">الأحدث أولًا</option>
            <option value="remaining">الأكثر لوحات متبقية</option>
            <option value="customer">اسم العميل</option>
          </select>

          {/* زر طباعة جميع مهام فرقة معينة أو طباعة الكل */}
          {teamId !== 'all' ? (
            <Button
              variant="default"
              className="h-11 cursor-pointer gap-2 rounded-md bg-primary px-4 text-xs font-black text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95 shrink-0"
              onClick={() => props.onPrintAllTeam?.(teamId)}
            >
              <Printer className="h-4 w-4" />
              طباعة كل مهام {teams.find(t => t.id === teamId)?.team_name || 'الفرقة'}
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              {props.onPrintAllPending && (
                <Button
                  variant="default"
                  className="h-11 cursor-pointer gap-2 rounded-md bg-amber-500 px-4 text-xs font-black text-slate-950 shadow-sm transition-all hover:bg-amber-400 active:scale-95 shrink-0"
                  onClick={() => props.onPrintAllPending?.()}
                >
                  <Printer className="h-4 w-4" />
                  طباعة الكل (جميع الفرق)
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 cursor-pointer gap-2 rounded-md border-primary/30 bg-primary/5 px-3.5 text-xs font-bold text-primary transition-all hover:bg-primary/10 active:scale-95 shrink-0"
                  >
                    <Printer className="h-4 w-4" />
                    طباعة فرقة...
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 rounded-xl">
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-bold">
                    اختر الفرقة لطباعة كافة مهامها المعلقة
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {teams.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      className="cursor-pointer gap-2"
                      onClick={() => props.onPrintAllTeam?.(t.id)}
                    >
                      <Printer className="h-3.5 w-3.5 text-primary" />
                      <span>{t.team_name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-between gap-3 items-center text-sm"><label className="flex gap-2 items-center cursor-pointer"><Checkbox aria-label="تحديد مهام الصفحة" checked={allVisibleSelected} onCheckedChange={() => setSelected(current => { const next = new Set(current); visible.forEach(row => allVisibleSelected ? next.delete(row.id) : next.add(row.id)); return next; })} />تحديد مهام الصفحة</label><span className="text-muted-foreground">{filtered.length} مهمة مطابقة</span></div>
        {chosen.length > 0 && <div className="flex flex-wrap gap-2 items-center rounded-xl bg-primary/10 p-3"><strong className="ml-auto text-sm">{chosen.length} مهام محددة</strong><Button variant="outline" className={control} onClick={() => props.onBulkPrint?.(chosen.map(row => row.id))}><Printer className="h-4 w-4 ml-2" />طباعة</Button><Button className={control} disabled={!chosen.some(row => row.state === 'active')} onClick={() => props.onBulkComplete?.(chosen.filter(row => row.state === 'active').map(row => row.id))}>توثيق الإزالة</Button><Button variant="outline" className={`${control} text-destructive`} onClick={() => setDeleteIds(chosen.map(row => row.id))}>حذف المهام</Button><Button variant="ghost" className={control} onClick={() => setSelected(new Set())}>إلغاء التحديد</Button></div>}
      </div>
      {props.isLoading ? <div role="status" className="p-12 text-center text-muted-foreground">جاري تحميل مهام الإزالة...</div> : !visible.length ? <div className="p-12 text-center space-y-3"><Layers className="h-10 w-10 mx-auto text-primary" /><h3 className="font-bold">لا توجد مهام ضمن هذا العرض</h3><p className="text-sm text-muted-foreground">جرّب البحث في جميع المهام أو إعادة ضبط الفلاتر.</p><Button variant="outline" className={control} onClick={() => changeFilter(() => { setSearch(''); setTeamId('all'); setStatus('all'); })}>عرض جميع المهام</Button></div> : <div className="divide-y">{visible.map(row => {
        const open = expanded.has(row.id) || !!search.trim();
        const remaining = row.items.length - row.completed;
        const coverDesign = normalizeGoogleImageUrl(row.items.map((item: any) => item.design_face_a || item.design_face_b).find(Boolean));
        return <article key={row.id} className="p-4 sm:p-5 space-y-4">
          {coverDesign && <figure className="rounded-xl overflow-hidden border bg-muted/20"><img src={coverDesign} alt={`تصميم عقد ${row.contract_id || ''}`} className="w-full h-44 sm:h-56 object-contain" loading="lazy" onError={e => { e.currentTarget.closest('figure')?.setAttribute('hidden', ''); }} /><figcaption className="px-3 py-2 text-xs text-muted-foreground border-t">تصميم العقد · {row.contract['Customer Name'] || 'مهمة إزالة'}</figcaption></figure>}
          <div className="flex items-start gap-3"><Checkbox aria-label={`تحديد مهمة العقد ${row.contract_id}`} className="mt-2" checked={selected.has(row.id)} onCheckedChange={() => toggle(row.id, setSelected)} /><button className={`flex-1 min-w-0 text-right ${control}`} aria-expanded={open} onClick={() => toggle(row.id, setExpanded)}><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-base sm:text-lg">{row.contract['Customer Name'] || 'مهمة إزالة يدوية'}</h3><Badge variant="outline">{row.amendment_number ? `إزالة ملحق ${row.amendment_number} · عقد ${row.contract_id}` : `عقد ${row.contract_id || 'يدوي'}`}</Badge><Badge className={row.state === 'completed' ? 'bg-emerald-600 text-white' : 'bg-primary/10 text-foreground'}>{row.state === 'cancelled' ? 'ملغاة' : row.state === 'completed' ? 'مكتملة' : remaining + ' لوحة متبقية'}</Badge></div><div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-muted-foreground"><span>{row.team.team_name || 'بدون فريق'}</span><span>{row.contract['Ad Type'] || 'لم يُحدد نوع الإعلان'}</span><span>اكتمل {row.completed} من {row.items.length}</span></div></button><Button size="icon" variant="ghost" aria-label="عرض لوحات المهمة" className={control} onClick={() => toggle(row.id, setExpanded)}><ChevronDown className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} /></Button></div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-label="تقدم الإزالة" aria-valuenow={row.completed} aria-valuemin={0} aria-valuemax={row.items.length}><div className="h-full bg-primary rounded-full" style={{ width: `${row.completed / row.items.length * 100}%` }} /></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" className={control} onClick={() => props.onPrintTask(row, row.items)}><Printer className="h-4 w-4 ml-1" />طباعة المهمة</Button>{props.onSendWhatsApp && <Button variant="outline" size="sm" className={control} onClick={() => props.onSendWhatsApp?.(row, row.items)}><MessageCircle className="h-4 w-4 ml-1" />إرسال للفريق</Button>}{row.state === 'active' && <><Button size="sm" className={control} onClick={() => props.onCompleteAll?.(row.id)}>توثيق إزالة المهمة</Button>{props.onSyncMissingBillboards && row.contract_id && !row.amendment_number && <Button variant="ghost" size="sm" className={control} onClick={() => props.onSyncMissingBillboards?.(row.contract_id, tasks.filter(t => t.contract_id === row.contract_id && !t.amendment_number).map(t => t.id))}>فحص اللوحات الناقصة</Button>}</>}<Button variant="ghost" size="sm" className={`${control} text-destructive mr-auto`} onClick={() => setDeleteIds([row.id])}><Trash2 className="h-4 w-4 ml-1" />حذف</Button></div>
          {open && <div className="rounded-xl bg-muted/25 border p-3 space-y-3">{row.state === 'active' && <Button variant="outline" size="sm" className={control} onClick={() => onToggleSelectAll(row.id)}>تحديد / إلغاء لوحات المهمة</Button>}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{row.items.filter((item: any) => row.state !== 'active' || item.status !== 'completed').map((item: any) => <div key={item.id}><RemovalTaskItemCard item={item} billboard={billboardById[item.billboard_id] || billboardById[Number(item.billboard_id)] || billboardById[String(item.billboard_id)] || { ID: item.billboard_id }} contract={row.contract} isSelected={selectedItems.has(item.id)} onSelectChange={() => row.state !== 'cancelled' && onToggleItem(item.id, row.id)} onComplete={row.state === 'active' && item.status !== 'completed' ? () => props.onCompleteItem?.(item.id, row.id) : undefined} />{item.status === 'completed' && <Button variant="ghost" size="sm" className={`${control} mt-2`} onClick={() => props.onUndoRemoval(item.id)}><RotateCcw className="h-4 w-4 ml-1" />التراجع عن الإزالة</Button>}</div>)}</div></div>}
        </article>;
      })}</div>}
      <div className="border-t p-4 flex items-center justify-between gap-2 text-sm"><span>صفحة {page} من {pageCount}</span><div className="flex gap-2"><Button variant="outline" size="sm" className={control} disabled={page === 1} onClick={() => onPageChange(page - 1)}><ChevronRight className="h-4 w-4" />السابق</Button><Button variant="outline" size="sm" className={control} disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>التالي<ChevronLeft className="h-4 w-4" /></Button></div></div>
    </div>
    <Dialog open={deleteIds.length > 0} onOpenChange={open => !open && setDeleteIds([])}><DialogContent dir="rtl"><DialogHeader><DialogTitle>حذف {deleteIds.length} مهمة إزالة؟</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">سيُحذف سجل المهمة وعناصرها. لتنظيف اللوحات المؤجرة استخدم «فحص وتنظيف المؤجرة» للحفاظ على سجلات التنفيذ.</p><div className="flex gap-2"><Button variant="destructive" className={control} onClick={() => { if (deleteIds.length === 1) props.onDeleteTask(deleteIds[0]); else props.onBulkDelete?.(deleteIds); setDeleteIds([]); setSelected(new Set()); }}>حذف المهام</Button><Button variant="outline" className={control} onClick={() => setDeleteIds([])}>إلغاء</Button></div></DialogContent></Dialog>
  </section>;
};
