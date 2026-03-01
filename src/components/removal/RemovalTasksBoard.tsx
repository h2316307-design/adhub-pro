import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, Clock, Package, Users,
  RefreshCw, XCircle, Printer,
  Trash2, ChevronDown, Image as ImageIcon,
  LayoutList, Layers, FileText, X,
  ChevronLeft, ChevronRight, CalendarDays,
  AlertTriangle, Undo2, MapPin, ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

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
  // item selection
  selectedItems: Set<string>;
  onToggleItem: (itemId: string, taskId: string) => void;
  onToggleSelectAll: (taskId: string) => void;
}

type SortField = 'client' | 'contract' | 'billboards' | 'status' | 'date' | 'team';
type SortDir = 'asc' | 'desc';

const STATUS_CONFIG = {
  completed: {
    label: 'مكتملة',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-400',
    icon: CheckCircle2,
  },
  in_progress: {
    label: 'قيد الإزالة',
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
    icon: Clock,
  },
  pending: {
    label: 'معلقة',
    color: 'bg-red-500/15 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
    icon: AlertTriangle,
  },
  cancelled: {
    label: 'ملغاة',
    color: 'bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30',
    dot: 'bg-muted-foreground',
    icon: XCircle,
  },
} as const;

function getDisplayStatus(items: any[]): keyof typeof STATUS_CONFIG {
  if (items.length === 0) return 'pending';
  const completed = items.filter(i => i.status === 'completed').length;
  if (completed === items.length) return 'completed';
  if (completed > 0) return 'in_progress';
  return 'pending';
}

/* ── Progress bar ── */
const ProgressBar = ({ value, total, completed }: { value: number; total: number; completed: number }) => {
  const barColor =
    value === 0 ? 'bg-muted-foreground/20'
    : value < 71 ? 'bg-red-500'
    : value < 100 ? 'bg-amber-500'
    : 'bg-emerald-500';

  const textColor =
    value === 100 ? 'text-emerald-400'
    : value >= 71 ? 'text-amber-400'
    : value > 0 ? 'text-red-400'
    : 'text-muted-foreground/50';

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-muted-foreground text-xs">اللوحات</span>
        <span className="text-xs font-semibold text-foreground/80">{completed}/{total}</span>
      </div>
      <div className="relative h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <span className={`text-xs font-bold ${textColor}`}>{value}%</span>
    </div>
  );
};

/* ── Full-height design panel ── */
const DesignPanel = ({ url, accent }: { url?: string; accent: string }) => {
  const [preview, setPreview] = useState(false);

  return (
    <div
      className="relative flex-shrink-0 overflow-hidden"
      style={{ width: 165, borderRadius: '0 16px 16px 0' }}
      onMouseEnter={() => setPreview(true)}
      onMouseLeave={() => setPreview(false)}
    >
      {url ? (
        <>
          <img
            src={url}
            alt="تصميم"
            className="w-full h-full object-cover"
            style={{ minHeight: 150, maxHeight: 220 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, transparent 60%, ${accent}55 100%)` }}
          />
          <AnimatePresence>
            {preview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-50 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
              >
                <img
                  src={url}
                  alt="معاينة"
                  className="rounded-xl object-contain shadow-2xl"
                  style={{ maxWidth: 240, maxHeight: 280, border: `2px solid ${accent}` }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <div
          className="w-full flex items-center justify-center"
          style={{
            minHeight: 150,
            background: `linear-gradient(135deg, hsl(var(--muted)/0.6), ${accent}18)`,
          }}
        >
          <div className="flex flex-col items-center gap-2 opacity-40">
            <ImageIcon className="h-10 w-10" style={{ color: accent }} />
            <span className="text-[10px] text-muted-foreground">لا يوجد تصميم</span>
          </div>
        </div>
      )}
      {/* accent bar */}
      <div
        className="absolute top-0 left-0 bottom-0 w-[4px]"
        style={{ background: accent, opacity: 0.85 }}
      />
    </div>
  );
};

/* ── Action button ── */
const ActionBtn = ({
  icon: Icon, label, onClick, danger = false,
}: { icon: any; label: string; onClick: (e: React.MouseEvent) => void; danger?: boolean }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={e => { e.stopPropagation(); onClick(e); }}
        className={`
          h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-150 border
          ${danger
            ? 'text-red-400/70 border-red-500/15 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30 hover:shadow-[0_0_12px_rgba(239,68,68,0.25)]'
            : 'text-muted-foreground border-border/40 hover:bg-amber-500/12 hover:text-amber-400 hover:border-amber-500/30 hover:shadow-[0_0_12px_rgba(245,158,11,0.18)]'
          }
        `}
      >
        <Icon className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
  </Tooltip>
);

/* ── Skeleton card ── */
const SkeletonCard = () => (
  <div className="flex rounded-2xl overflow-hidden border border-border/50 bg-card" style={{ minHeight: 160 }}>
    <Skeleton className="w-40 shrink-0 rounded-none rounded-r-2xl" />
    <div className="flex-1 p-5 flex flex-col gap-3">
      <Skeleton className="h-5 w-1/3 rounded-lg" />
      <Skeleton className="h-3.5 w-1/4 rounded" />
      <div className="flex gap-6 mt-2">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
      <Skeleton className="h-2.5 w-full rounded-full mt-2" />
    </div>
  </div>
);

const SortIconEl = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) =>
  sortField !== field
    ? <ArrowUpDown className="h-3 w-3 opacity-30" />
    : sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-red-400" />
      : <ArrowDown className="h-3 w-3 text-red-400" />;

export const RemovalTasksBoard: React.FC<Props> = ({
  tasks, allTaskItems, billboardById, contractByNumber, teamById, teams,
  isLoading, totalTasks, pendingTasks, completedTasks, totalItems, completedItems,
  page, onPageChange,
  onRefresh, onAddTask, onDeleteTask, onPrintTask, onUndoRemoval, onCompleteAll,
  selectedItems, onToggleItem, onToggleSelectAll,
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTeam, setFilterTeam] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const PAGE_SIZE = 15;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    onPageChange(1);
  };

  const itemsByTask = useMemo(() => {
    const m: Record<string, any[]> = {};
    allTaskItems.forEach(i => { if (!m[i.task_id]) m[i.task_id] = []; m[i.task_id].push(i); });
    return m;
  }, [allTaskItems]);

  const enriched = useMemo(() => tasks.map(task => {
    const items = itemsByTask[task.id] || [];
    const contract = contractByNumber[task.contract_id];
    const team = teamById[task.team_id];
    const completed = items.filter(i => i.status === 'completed').length;
    const displayStatus = getDisplayStatus(items);
    const removalDate = items.find(i => i.removal_date)?.removal_date;

    // design image: take first design_face_a available from items
    const designThumb = items.map(i => i.design_face_a || i.design_face_b).find(Boolean) || null;

    // consistent accent color from task id
    let h = 0;
    for (let i = 0; i < task.id.length; i++) h = task.id.charCodeAt(i) + ((h << 5) - h);
    // Use red-ish hues for removal tasks (0-30 or 340-360 degrees)
    const hue = 0 + (Math.abs(h) % 30);
    const accent = `hsl(${hue}, 65%, 55%)`;

    const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
    return {
      ...task, items, contract, team, completed,
      totalItems: items.length, displayStatus,
      removalDate, designThumb, accent, completionPct: pct,
      customerName: contract?.['Customer Name'] || 'غير محدد',
      adType: contract?.['Ad Type'] || '—',
      contractEndDate: contract?.['End Date'] || null,
    };
  }), [tasks, allTaskItems, contractByNumber, teamById, itemsByTask]);

  const filtered = useMemo(() => {
    let r = enriched;
    if (filterStatus !== 'all') r = r.filter(t => t.displayStatus === filterStatus);
    if (filterTeam !== 'all') r = r.filter(t => t.team_id === filterTeam);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(t =>
        t.customerName.toLowerCase().includes(s) ||
        String(t.contract_id).includes(s) ||
        t.adType.toLowerCase().includes(s) ||
        t.team?.team_name?.toLowerCase().includes(s) ||
        t.id.toLowerCase().includes(s)
      );
    }
    return r;
  }, [enriched, filterStatus, filterTeam, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let av: any, bv: any;
    switch (sortField) {
      case 'client': av = a.customerName; bv = b.customerName; break;
      case 'contract': av = a.contract_id; bv = b.contract_id; break;
      case 'billboards': av = a.totalItems; bv = b.totalItems; break;
      case 'status': av = a.displayStatus; bv = b.displayStatus; break;
      case 'date': av = a.removalDate || a.created_at; bv = b.removalDate || b.created_at; break;
      case 'team': av = a.team?.team_name || ''; bv = b.team?.team_name || ''; break;
      default: av = a.created_at; bv = b.created_at;
    }
    const cmp = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
    return sortDir === 'asc' ? cmp : -cmp;
  }), [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allOnPageSel = paginated.length > 0 && paginated.every(t => selected.has(t.id));
  const toggleAll = () => {
    const next = new Set(selected);
    allOnPageSel ? paginated.forEach(t => next.delete(t.id)) : paginated.forEach(t => next.add(t.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const SortPill = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border ${
        sortField === field
          ? 'bg-red-500/15 text-red-400 border-red-500/30'
          : 'text-muted-foreground border-border/40 hover:text-red-400 hover:border-red-500/20'
      }`}
    >
      {label}
      <SortIconEl field={field} sortField={sortField} sortDir={sortDir} />
    </button>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col h-full gap-4" dir="rtl">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
          {[
            { label: 'إجمالي المهام', value: totalTasks, color: 'text-foreground', icon: LayoutList, border: 'border-border' },
            { label: 'معلقة', value: pendingTasks, color: 'text-red-400', icon: AlertTriangle, border: 'border-red-500/30' },
            { label: 'مكتملة', value: completedTasks, color: 'text-emerald-400', icon: CheckCircle2, border: 'border-emerald-500/30' },
            { label: 'إجمالي اللوحات', value: totalItems, color: 'text-blue-400', icon: Layers, border: 'border-blue-500/30' },
            { label: 'لوحات مُزالة', value: completedItems, color: 'text-emerald-400', icon: CheckCircle2, border: 'border-emerald-500/30' },
          ].map(({ label, value, color, icon: Icon, border }) => (
            <div key={label} className={`bg-card border ${border} rounded-2xl p-4 flex items-center gap-3`}>
              <div className="p-2.5 rounded-xl bg-muted/50">
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground leading-none mb-1.5">{label}</p>
                <p className={`text-2xl font-bold leading-none ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="bg-card border border-border rounded-2xl px-5 py-3.5 flex flex-wrap gap-3 items-center shrink-0">
          <div className="relative flex-1 min-w-[140px] sm:min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              placeholder="بحث برقم العقد، الزبون، الفريق..."
              value={search}
              onChange={e => { setSearch(e.target.value); onPageChange(1); }}
              className="pr-9 bg-background border-border h-9 text-sm rounded-xl"
            />
          </div>
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); onPageChange(1); }}>
            <SelectTrigger className="w-[145px] h-9 bg-background border-border text-sm rounded-xl">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="pending">معلقة</SelectItem>
              <SelectItem value="in_progress">قيد الإزالة</SelectItem>
              <SelectItem value="completed">مكتملة</SelectItem>
              <SelectItem value="cancelled">ملغاة</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTeam} onValueChange={v => { setFilterTeam(v); onPageChange(1); }}>
            <SelectTrigger className="w-[155px] h-9 bg-background border-border text-sm rounded-xl">
              <SelectValue placeholder="الفريق" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفرق</SelectItem>
              {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.team_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={onRefresh} className="h-9 gap-1.5 border-border px-3 rounded-xl">
            <RefreshCw className="h-3.5 w-3.5" />
            تحديث
          </Button>

          {/* Sort pills */}
          <div className="hidden lg:flex items-center gap-2 mr-2">
            <span className="text-xs text-muted-foreground/50 shrink-0">ترتيب:</span>
            <SortPill field="date" label="التاريخ" />
            <SortPill field="client" label="العميل" />
            <SortPill field="billboards" label="اللوحات" />
            <SortPill field="status" label="الحالة" />
          </div>

          <div className="mr-auto flex items-center gap-2">
            {selected.size > 0 && (
              <span className="text-xs text-red-400 font-semibold bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
                {selected.size} محدد
              </span>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allOnPageSel}
                onCheckedChange={toggleAll}
                className="border-muted-foreground/30 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
              />
              <span className="text-xs text-muted-foreground">تحديد الكل</span>
            </div>
            <Button
              onClick={onAddTask}
              size="sm"
              className="h-9 gap-1.5 px-5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl"
            >
              <AlertTriangle className="h-4 w-4" />
              مهمة إزالة يدوية
            </Button>
          </div>
        </div>

        {/* ── Bulk bar ── */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="bg-red-500/8 border border-red-500/20 rounded-2xl px-5 py-3 flex flex-wrap gap-2.5 items-center shrink-0"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-red-400 font-bold text-sm">{selected.size} مهمة محددة</span>
              </div>
              <div className="w-px h-5 bg-red-500/25 mx-1" />
              <Button size="sm" variant="ghost" className="h-8 px-3 text-xs gap-1.5 text-amber-400 hover:bg-amber-500/15 rounded-xl">
                <Printer className="h-3.5 w-3.5" /> طباعة المحدد
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-3 text-xs gap-1.5 text-blue-400 hover:bg-blue-500/15 rounded-xl">
                <ChevronDown className="h-3.5 w-3.5" /> تغيير الحالة
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-3 text-xs gap-1.5 text-red-400 hover:bg-red-500/15 mr-auto rounded-xl">
                <Trash2 className="h-3.5 w-3.5" /> حذف المحدد
              </Button>
              <button
                onClick={() => setSelected(new Set())}
                className="h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Card list ── */}
        <div className="flex flex-col gap-4 flex-1 overflow-y-auto pb-4 min-h-0">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 - i * 0.15 }} transition={{ delay: i * 0.06 }}>
                <SkeletonCard />
              </motion.div>
            ))
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-muted-foreground">
              <Package className="h-16 w-16 opacity-10" />
              <span className="text-sm opacity-60">لا توجد مهام مطابقة</span>
            </div>
          ) : (
            paginated.map((task, idx) => {
              const cfg = STATUS_CONFIG[task.displayStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
              const isSelected = selected.has(task.id);
              const pendingCount = task.items.filter((i: any) => i.status === 'pending').length;
              const isExpanded = expandedTaskId === task.id;

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.025, ease: 'easeOut' }}
                  className="group relative rounded-2xl overflow-hidden cursor-pointer"
                  style={{
                    background: isExpanded
                      ? `color-mix(in srgb, ${task.accent} 8%, hsl(var(--card)))`
                      : isSelected
                      ? `color-mix(in srgb, ${task.accent} 5%, hsl(var(--card)))`
                      : 'hsl(var(--card))',
                    border: isExpanded
                      ? `1.5px solid ${task.accent}66`
                      : isSelected
                      ? `1px solid ${task.accent}55`
                      : '1px solid hsl(var(--border))',
                    boxShadow: isExpanded
                      ? `0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px ${task.accent}33`
                      : '0 2px 16px rgba(0,0,0,0.18)',
                  }}
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                >
                  {/* hover shadow */}
                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                    style={{ boxShadow: `0 8px 32px rgba(0,0,0,0.30), 0 0 0 1px ${task.accent}33` }}
                  />

                  {/* Desktop layout */}
                  <div className="hidden md:flex h-full">
                    {/* ── DESIGN PANEL – far right (RTL) ── */}
                    <div
                      className="shrink-0 overflow-hidden relative"
                      style={{ width: 165, borderRadius: isExpanded ? '0 16px 0 0' : '0 16px 16px 0' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <DesignPanel url={task.designThumb || undefined} accent={task.accent} />
                    </div>

                    {/* ── MAIN CONTENT ── */}
                    <div className="flex flex-1 min-w-0 p-0">

                      {/* INFO BLOCK */}
                      <div className="flex-1 min-w-0 px-5 py-4 flex flex-col justify-center gap-2.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xl font-bold text-foreground leading-tight">{task.customerName}</span>
                          <span className="text-[10px] bg-red-500/12 text-red-400 border border-red-500/20 rounded-full px-2 py-0.5 font-semibold flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            إزالة دعاية
                          </span>
                        </div>
                        {task.adType && task.adType !== '—' && (
                          <span className="text-sm text-muted-foreground/80 truncate">{task.adType}</span>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-0.5">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-red-500/70" />
                            <span className="font-mono text-red-400 font-semibold">#{task.contract_id}</span>
                          </span>
                          {task.contractEndDate && (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                              انتهى: {format(new Date(task.contractEndDate), 'dd MMM yyyy', { locale: ar })}
                            </span>
                          )}
                          {task.team && (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                              <span className="truncate max-w-[150px]">{task.team.team_name}</span>
                            </span>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${isExpanded ? 'text-red-400' : 'text-muted-foreground/50 group-hover:text-red-400/70'}`}>
                          {isExpanded
                            ? <><ChevronUp className="h-3 w-3" /> إخفاء اللوحات</>
                            : <><ChevronDown className="h-3 w-3" /> عرض اللوحات ({task.totalItems})</>
                          }
                        </div>
                      </div>

                      {/* PROGRESS BLOCK */}
                      <div
                        className="w-[190px] shrink-0 px-5 py-4 flex flex-col justify-center gap-1 border-r border-border/30"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-baseline gap-1.5 mb-1">
                          <span className="text-3xl font-bold text-foreground">{task.totalItems}</span>
                          <span className="text-xs text-muted-foreground">لوحة</span>
                        </div>
                        <ProgressBar
                          value={task.completionPct}
                          total={task.totalItems}
                          completed={task.completed}
                        />
                      </div>

                      {/* STATUS BLOCK */}
                      <div className="w-[130px] shrink-0 px-4 py-4 flex flex-col justify-center items-center gap-3 border-r border-border/30">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold whitespace-nowrap ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />
                          {cfg.label}
                        </span>
                        {pendingCount > 0 && (
                          <div className="text-center">
                            <div className="text-xs text-red-400/70 font-semibold">{pendingCount} معلقة</div>
                          </div>
                        )}
                      </div>

                      {/* ACTIONS COLUMN */}
                      <div
                        className="w-[56px] shrink-0 flex flex-col items-center justify-center gap-1.5 px-1.5 py-3 border-r border-border/30"
                        onClick={e => e.stopPropagation()}
                      >
                        {deleteConfirmId === task.id ? (
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-[9px] text-red-400 font-medium text-center leading-tight">تأكيد الحذف؟</span>
                            <button
                              onClick={() => { onDeleteTask(task.id); setDeleteConfirmId(null); }}
                              className="w-full h-6 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/35 transition-colors px-1"
                            >نعم</button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="w-full h-6 rounded-lg bg-muted/60 text-muted-foreground text-[10px] hover:bg-muted transition-colors px-1"
                            >لا</button>
                          </div>
                        ) : (
                          <>
                            {onCompleteAll && task.items.some((i: any) => i.status !== 'completed') && (
                              <ActionBtn
                                icon={CheckCircle2}
                                label="إكمال جميع اللوحات"
                                onClick={() => onCompleteAll(task.id)}
                              />
                            )}
                            <ActionBtn
                              icon={Printer}
                              label="طباعة المهمة"
                              onClick={() => onPrintTask(task, task.items)}
                            />
                            {task.items.some((i: any) => i.status === 'completed') && (
                              <ActionBtn
                                icon={Undo2}
                                label="التراجع عن آخر إزالة"
                                onClick={() => {
                                  const lastCompleted = task.items.filter((i: any) => i.status === 'completed').slice(-1)[0];
                                  if (lastCompleted) onUndoRemoval(lastCompleted.id);
                                }}
                              />
                            )}
                            <ActionBtn
                              icon={Trash2}
                              label="حذف المهمة"
                              onClick={() => setDeleteConfirmId(task.id)}
                              danger
                            />
                          </>
                        )}
                      </div>

                      {/* CHECKBOX */}
                      <div
                        className="w-[48px] shrink-0 flex items-center justify-center"
                        onClick={e => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(task.id)}
                          className="border-muted-foreground/30 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mobile layout */}
                  <div className="flex flex-col md:hidden">
                    {/* Header: status + customer + checkbox */}
                    <div className="flex items-center gap-2 px-3 py-3 border-b border-border/20">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(task.id)}
                        onClick={e => e.stopPropagation()}
                        className="border-muted-foreground/30 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-foreground truncate">{task.customerName}</span>
                          <span className="text-[9px] bg-red-500/12 text-red-400 border border-red-500/20 rounded-full px-1.5 py-0.5 font-semibold flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            إزالة
                          </span>
                        </div>
                        {task.adType && task.adType !== '—' && (
                          <span className="text-xs text-muted-foreground/70 truncate block">{task.adType}</span>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-semibold whitespace-nowrap ${cfg.color} shrink-0`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3 text-red-500/70" />
                        <span className="font-mono text-red-400 font-semibold">#{task.contract_id}</span>
                      </span>
                      {task.team && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground/50" />
                          <span className="truncate max-w-[100px]">{task.team.team_name}</span>
                        </span>
                      )}
                      {task.contractEndDate && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-muted-foreground/50" />
                          {format(new Date(task.contractEndDate), 'dd/MM/yyyy', { locale: ar })}
                        </span>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="px-3 py-2 border-t border-border/20" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-foreground">{task.totalItems}</span>
                        <span className="text-xs text-muted-foreground">لوحة</span>
                        {pendingCount > 0 && (
                          <span className="mr-auto text-xs text-red-400/70 font-semibold">{pendingCount} معلقة</span>
                        )}
                      </div>
                      <ProgressBar value={task.completionPct} total={task.totalItems} completed={task.completed} />
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center gap-1 px-3 py-2 border-t border-border/20 flex-wrap" onClick={e => e.stopPropagation()}>
                      {deleteConfirmId === task.id ? (
                        <div className="flex items-center gap-2 w-full">
                          <span className="text-xs text-red-400 font-medium">تأكيد الحذف؟</span>
                          <button onClick={() => { onDeleteTask(task.id); setDeleteConfirmId(null); }} className="h-7 px-3 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/35 transition-colors">نعم</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="h-7 px-3 rounded-lg bg-muted/60 text-muted-foreground text-xs hover:bg-muted transition-colors">لا</button>
                        </div>
                      ) : (
                        <>
                          {onCompleteAll && task.items.some((i: any) => i.status !== 'completed') && (
                            <ActionBtn icon={CheckCircle2} label="إكمال الكل" onClick={() => onCompleteAll(task.id)} />
                          )}
                          <ActionBtn icon={Printer} label="طباعة" onClick={() => onPrintTask(task, task.items)} />
                          {task.items.some((i: any) => i.status === 'completed') && (
                            <ActionBtn icon={Undo2} label="تراجع" onClick={() => { const last = task.items.filter((i: any) => i.status === 'completed').slice(-1)[0]; if (last) onUndoRemoval(last.id); }} />
                          )}
                          <ActionBtn icon={Trash2} label="حذف" onClick={() => setDeleteConfirmId(task.id)} danger />
                        </>
                      )}
                    </div>

                    {/* Expand hint */}
                    <div className={`flex items-center justify-center gap-1 text-[11px] font-medium py-2 border-t border-border/20 transition-colors ${isExpanded ? 'text-red-400' : 'text-muted-foreground/50'}`}>
                      {isExpanded
                        ? <><ChevronUp className="h-3 w-3" /> إخفاء اللوحات</>
                        : <><ChevronDown className="h-3 w-3" /> عرض اللوحات ({task.totalItems})</>
                      }
                    </div>
                  </div>

                  {/* ── EXPANDED: Billboards List ── */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="overflow-hidden border-t border-border/30"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {task.items.map((item: any) => {
                            const billboard = billboardById[item.billboard_id];
                            const isDone = item.status === 'completed';
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs transition-colors ${
                                  isDone
                                    ? 'bg-emerald-500/8 border-emerald-500/25 text-emerald-400'
                                    : 'bg-muted/40 border-border/50 text-muted-foreground'
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full shrink-0 ${isDone ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate text-foreground">
                                    {billboard?.Billboard_Name || `لوحة #${item.billboard_id}`}
                                  </div>
                                  {billboard?.District && (
                                    <div className="flex items-center gap-1 text-[10px] mt-0.5 opacity-70">
                                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                                      {billboard.District}
                                    </div>
                                  )}
                                </div>
                                {isDone && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="border-t border-border px-4 py-3 flex items-center justify-between text-xs text-muted-foreground bg-card rounded-2xl border shrink-0">
            <span>
              {sorted.length > 0
                ? `عرض ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sorted.length)} من ${sorted.length} مهمة`
                : 'لا توجد نتائج'}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-border rounded-lg" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <Button key={p} size="sm"
                    className={`h-7 w-7 p-0 text-xs rounded-lg ${p === page ? 'bg-red-500 hover:bg-red-600 text-white font-bold' : 'bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent'}`}
                    onClick={() => onPageChange(p)}
                  >{p}</Button>
                );
              })}
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-border rounded-lg" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
