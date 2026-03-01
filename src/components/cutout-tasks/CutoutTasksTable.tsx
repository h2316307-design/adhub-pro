import React, { useState, useMemo } from 'react';
import { TaskDesignPanel } from '@/components/shared/TaskDesignPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, Clock, Package, Scissors, Printer,
  Plus, RefreshCw, XCircle,
  LayoutList, Layers, FileText,
  ChevronLeft, ChevronRight, Building2,
  AlertTriangle, TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface CutoutTask {
  id: string;
  contract_id?: number | null;
  customer_name: string | null;
  status: string;
  total_quantity: number;
  unit_cost: number;
  total_cost: number;
  customer_total_amount?: number;
  priority: string;
  created_at: string;
  printer_id?: string | null;
  printers?: { name: string } | null;
}

interface Props {
  tasks: CutoutTask[];
  isLoading: boolean;
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    noPrinter: number;
    totalQuantity: number;
    totalCost: number;
    totalRevenue: number;
  };
  onOpenTask: (task: CutoutTask) => void;
  onAddTask: () => void;
  onRefresh: () => void;
  isFetching?: boolean;
  onStatusChange?: (taskId: string, status: string) => void;
  onPrintInvoice?: (task: CutoutTask, type: 'customer' | 'cutout_vendor') => void;
}

type SortField = 'client' | 'contract' | 'quantity' | 'cost' | 'status' | 'date' | 'printer';
type SortDir = 'asc' | 'desc';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; icon: any }> = {
  completed: { label: 'مكتملة', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400', icon: CheckCircle2 },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400', icon: Clock },
  pending: { label: 'جديدة', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400', icon: Package },
  cancelled: { label: 'ملغاة', color: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400', icon: XCircle },
};

const ActionBtn = ({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: (e: React.MouseEvent) => void }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
        className="h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-150 border text-muted-foreground border-border/40 hover:bg-purple-500/12 hover:text-purple-400 hover:border-purple-500/30"
      >
        <Icon className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
  </Tooltip>
);

const SortIcon = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) =>
  sortField !== field
    ? <ArrowUpDown className="h-3 w-3 opacity-30" />
    : sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-purple-400" />
      : <ArrowDown className="h-3 w-3 text-purple-400" />;

const SkeletonCard = () => (
  <div className="flex rounded-2xl overflow-hidden border border-border/50 bg-card" style={{ minHeight: 100 }}>
    <div className="flex-1 p-5 flex flex-col gap-3">
      <Skeleton className="h-5 w-1/3 rounded-lg" />
      <Skeleton className="h-3.5 w-1/4 rounded" />
      <div className="flex gap-6 mt-2"><Skeleton className="h-3 w-20 rounded" /><Skeleton className="h-3 w-20 rounded" /></div>
    </div>
  </div>
);

/* ── Cutout Task Card with design panel and color tinting ── */
const CutoutTaskCardRow = ({ task, idx, onOpenTask, onStatusChange, onPrintInvoice }: {
  task: CutoutTask; idx: number; onOpenTask: (t: CutoutTask) => void;
  onStatusChange?: (taskId: string, status: string) => void;
  onPrintInvoice?: (task: CutoutTask, type: 'customer' | 'cutout_vendor') => void;
}) => {
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const designUrls = (task as any)._designImages || [];
  let h = 0;
  for (let i = 0; i < task.id.length; i++) h = task.id.charCodeAt(i) + ((h << 5) - h);
  const accent = `hsl(${Math.abs(h) % 360}, 55%, 58%)`;

  const cardBg = dominantColor
    ? `linear-gradient(to left, rgba(${dominantColor}, 0.25) 0%, rgba(${dominantColor}, 0.12) 35%, rgba(${dominantColor}, 0.04) 70%, hsl(var(--card)) 100%)`
    : 'hsl(var(--card))';
  const cardBorder = dominantColor
    ? `2px solid rgba(${dominantColor}, 0.5)`
    : '1px solid hsl(var(--border))';
  const cardShadow = dominantColor
    ? `0 4px 24px rgba(${dominantColor}, 0.25), 0 0 0 1px rgba(${dominantColor}, 0.1)`
    : '0 2px 16px rgba(0,0,0,0.18)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.02, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      onClick={() => onOpenTask(task)}
      className="group relative rounded-2xl overflow-hidden cursor-pointer"
      style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow, minHeight: 140 }}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{ boxShadow: dominantColor
          ? `0 12px 40px rgba(${dominantColor}, 0.35), 0 0 0 2px rgba(${dominantColor}, 0.3)`
          : `0 8px 32px rgba(0,0,0,0.30), 0 0 0 1px ${accent}33`
        }}
      />
      <div className="hidden md:flex h-full">
        {/* Design Panel */}
        <div className="shrink-0 overflow-hidden relative" style={{ width: 220, borderRadius: '0 16px 16px 0' }} onClick={e => e.stopPropagation()}>
          <TaskDesignPanel urls={designUrls} accent={accent} onColorExtracted={setDominantColor} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0 px-5 py-4 flex flex-col justify-center gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xl font-bold text-foreground leading-tight">{task.customer_name || 'بدون اسم'}</span>
            {(task as any)._adType && (
              <span className="text-[10px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 rounded-full px-2 py-0.5 font-semibold">
                {(task as any)._adType}
              </span>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
              (task as any)._source === 'installation'
                ? 'bg-green-500/15 text-green-400 border-green-500/25'
                : (task as any)._source === 'contract'
                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/25'
                  : 'bg-orange-500/15 text-orange-400 border-orange-500/25'
            }`}>
              {(task as any)._source === 'installation' ? 'عبر مهمة تركيب' : (task as any)._source === 'contract' ? 'من عقد مباشرة' : 'إضافة يدوية'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-0.5">
            {task.contract_id && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5 shrink-0 text-purple-500/70" />
                <span className="font-mono text-purple-400 font-semibold">#{task.contract_id}</span>
              </span>
            )}
            {task.printers?.name && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                {task.printers.name}
              </span>
            )}
            <span className="font-mono text-[10px] text-muted-foreground/40">#{task.id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/40 group-hover:text-purple-400/80 transition-colors font-medium">
            <ChevronLeft className="h-3 w-3" />
            فتح التفاصيل
          </div>
        </div>

        {/* Quantity & cost */}
        <div className="w-[180px] shrink-0 px-5 py-4 flex flex-col justify-center gap-1 border-r border-border/30">
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-2xl font-bold text-foreground">{task.total_quantity}</span>
            <span className="text-xs text-muted-foreground">قطعة</span>
          </div>
          <div className={`mt-1.5 px-2.5 py-1.5 rounded-lg border ${(task.customer_total_amount || 0) > 0 ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-muted/30 border-border/30'}`}>
            <div className={`text-[10px] font-medium ${(task.customer_total_amount || 0) > 0 ? 'text-emerald-400/80' : 'text-muted-foreground/60'}`}>المستحق على الزبون</div>
            {(task.customer_total_amount || 0) > 0 ? (
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-emerald-400">{(task.customer_total_amount || 0).toLocaleString('ar-LY')}</span>
                <span className="text-[10px] text-emerald-400/60">د.ل</span>
              </div>
            ) : (
              <div className="text-sm font-semibold text-muted-foreground/50">لا يوجد استحقاق</div>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="w-[120px] shrink-0 px-4 py-4 flex flex-col justify-center items-center gap-2 border-r border-border/30">
          <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold whitespace-nowrap ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />
            {cfg.label}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}
          </span>
        </div>

        {/* Actions - Status + Invoices */}
        <div className="shrink-0 flex flex-col items-center justify-center gap-1.5 px-3 py-3 border-r border-border/30" onClick={e => e.stopPropagation()}>
          {onStatusChange && (
            <Select
              value={task.status}
              onValueChange={(val) => onStatusChange(task.id, val)}
            >
              <SelectTrigger className="h-7 w-28 text-[10px] rounded-lg border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">معلق</SelectItem>
                <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                <SelectItem value="completed">مكتمل</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
          )}
          {onPrintInvoice && (
            <div className="flex gap-1">
              <ActionBtn icon={Printer} label="فاتورة المطبعة" onClick={() => onPrintInvoice(task, 'cutout_vendor')} />
              <ActionBtn icon={FileText} label="فاتورة الزبون" onClick={() => onPrintInvoice(task, 'customer')} />
            </div>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col md:hidden">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border/20">
          <div className="flex-1 min-w-0">
            <span className="text-base font-bold text-foreground truncate block">{task.customer_name || 'بدون اسم'}</span>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-semibold whitespace-nowrap ${cfg.color} shrink-0`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-muted-foreground">
          {task.contract_id && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-purple-500/70" />
              <span className="font-mono text-purple-400 font-semibold">#{task.contract_id}</span>
            </span>
          )}
          <span>{task.total_quantity} قطعة</span>
          <span className={(task.customer_total_amount || 0) > 0 ? 'text-emerald-400 font-semibold' : 'text-muted-foreground/50'}>{(task.customer_total_amount || 0) > 0 ? `${(task.customer_total_amount || 0).toLocaleString('ar-LY')} د.ل` : 'لا يوجد استحقاق'}</span>
          {(task as any)._adType && <span className="text-cyan-400">{(task as any)._adType}</span>}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${(task as any)._source === 'installation' ? 'text-green-400 border-green-500/25' : (task as any)._source === 'contract' ? 'text-purple-400 border-purple-500/25' : 'text-orange-400 border-orange-500/25'}`}>
            {(task as any)._source === 'installation' ? 'عبر تركيب' : (task as any)._source === 'contract' ? 'من عقد' : 'يدوية'}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export const CutoutTasksTable: React.FC<Props> = ({
  tasks, isLoading, stats, onOpenTask, onAddTask, onRefresh, isFetching, onStatusChange, onPrintInvoice,
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    let r = [...tasks];
    if (filterStatus !== 'all') r = r.filter(t => t.status === filterStatus);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(t =>
        t.customer_name?.toLowerCase().includes(s) ||
        String(t.contract_id).includes(s) ||
        t.printers?.name?.toLowerCase().includes(s)
      );
    }
    return r;
  }, [tasks, filterStatus, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let av: any, bv: any;
    switch (sortField) {
      case 'client': av = a.customer_name || ''; bv = b.customer_name || ''; break;
      case 'contract': av = a.contract_id || 0; bv = b.contract_id || 0; break;
      case 'quantity': av = a.total_quantity; bv = b.total_quantity; break;
      case 'cost': av = a.customer_total_amount || 0; bv = b.customer_total_amount || 0; break;
      case 'status': av = a.status; bv = b.status; break;
      case 'date': av = a.created_at; bv = b.created_at; break;
      case 'printer': av = a.printers?.name || ''; bv = b.printers?.name || ''; break;
      default: av = a.created_at; bv = b.created_at;
    }
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  }), [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortPill = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border ${
        sortField === field
          ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
          : 'text-muted-foreground border-border/40 hover:text-purple-400 hover:border-purple-500/20'
      }`}
    >
      {label}
      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </button>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col h-full gap-4" dir="rtl">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
          {[
            { label: 'إجمالي المهام', value: stats.total, color: 'text-foreground', icon: LayoutList, accent: 'border-border' },
            { label: 'معلقة', value: stats.pending, color: 'text-slate-400', icon: Clock, accent: 'border-slate-500/30' },
            { label: 'مكتملة', value: stats.completed, color: 'text-emerald-400', icon: CheckCircle2, accent: 'border-emerald-500/30' },
            { label: 'إجمالي القطع', value: stats.totalQuantity.toLocaleString(), color: 'text-purple-400', icon: Scissors, accent: 'border-purple-500/30' },
            { label: 'الإيرادات', value: `${stats.totalRevenue.toLocaleString()} د.ل`, color: 'text-amber-400', icon: TrendingUp, accent: 'border-amber-500/30' },
          ].map(({ label, value, color, icon: Icon, accent }) => (
            <div key={label} className={`bg-card border ${accent} rounded-2xl p-4 flex items-center gap-3`}>
              <div className="p-2.5 rounded-xl bg-muted/50"><Icon className={`h-4 w-4 ${color}`} /></div>
              <div>
                <p className="text-[11px] text-muted-foreground leading-none mb-1.5">{label}</p>
                <p className={`text-2xl font-bold leading-none ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Warning */}
        {stats.noPrinter > 0 && (
          <div className="flex items-center gap-3 bg-purple-500/10 border border-purple-500/25 rounded-2xl px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-purple-400 shrink-0" />
            <p className="text-sm text-purple-300">{stats.noPrinter} مهمة بدون مطبعة</p>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="بحث بالاسم أو رقم العقد أو المطبعة..." className="pr-10 bg-card border-border/50 rounded-xl h-10" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'pending', 'in_progress', 'completed'] as const).map(s => (
              <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filterStatus === s ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' : 'text-muted-foreground border-border/40 hover:border-purple-500/20'
                }`}
              >
                {s === 'all' ? 'الكل' : STATUS_CONFIG[s]?.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onRefresh} variant="outline" size="sm" className="gap-2 border-border/50" disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />تحديث
            </Button>
            <Button onClick={onAddTask} size="sm" className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25">
              <Plus className="h-4 w-4" />مهمة جديدة
            </Button>
          </div>
        </div>

        {/* Sort pills */}
        <div className="flex flex-wrap gap-2 shrink-0">
          <SortPill field="client" label="الزبون" />
          <SortPill field="contract" label="العقد" />
          <SortPill field="quantity" label="الكمية" />
          <SortPill field="cost" label="الإيرادات" />
          <SortPill field="printer" label="المطبعة" />
          <SortPill field="date" label="التاريخ" />
        </div>

        {/* Task cards */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Scissors className="h-12 w-12 opacity-30" />
              <p className="text-lg font-medium">لا توجد مهام</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginated.map((task, idx) => (
                <CutoutTaskCardRow
                  key={task.id}
                  task={task}
                  idx={idx}
                  onOpenTask={onOpenTask}
                  onStatusChange={onStatusChange}
                  onPrintInvoice={onPrintInvoice}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-3 shrink-0">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="gap-1 border-border/50">
              <ChevronRight className="h-4 w-4" />السابق
            </Button>
            <span className="text-sm text-muted-foreground px-3">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="gap-1 border-border/50">
              التالي<ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
