import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, Clock, Package, Users,
  RefreshCw, XCircle, Printer, Scissors,
  Trash2, Edit, ChevronDown, Image as ImageIcon,
  LayoutList, Layers, FileText, X,
  ChevronLeft, ChevronRight, CalendarDays,
  DollarSign, TrendingUp, TrendingDown, Wrench,
  FileOutput, Loader2, AlertTriangle, ChevronUp, Percent
} from 'lucide-react';
import { EnhancedEditCompositeTaskCostsDialog } from './EnhancedEditCompositeTaskCostsDialog';
import { UnifiedTaskInvoice, InvoiceType } from './UnifiedTaskInvoice';
import { CompositeTaskWithDetails, UpdateCompositeTaskCostsInput } from '@/types/composite-task';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CompositeTasksListEnhancedProps {
  customerId?: string;
  filter?: 'all' | 'pending' | 'completed';
}

type SortField = 'client' | 'contract' | 'revenue' | 'cost' | 'profit' | 'date' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_CONFIG = {
  completed: {
    label: 'مكتمل',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-400',
    icon: CheckCircle2,
  },
  in_progress: {
    label: 'قيد التنفيذ',
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
    icon: Clock,
  },
  pending: {
    label: 'معلقة',
    color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    dot: 'bg-slate-400',
    icon: Clock,
  },
  cancelled: {
    label: 'ملغاة',
    color: 'bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30',
    dot: 'bg-muted-foreground',
    icon: XCircle,
  },
} as const;

/* ── Design Panel ── */
const DesignPanel = ({
  urls, accent, onColorExtracted,
}: { urls: string[]; accent: string; onColorExtracted?: (c: string | null) => void }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const url = urls[currentIdx % urls.length] || '';

  useEffect(() => {
    if (!url || !onColorExtracted) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = 50; canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const br = (data[i] + data[i+1] + data[i+2]) / 3;
          if (br > 30 && br < 225) { r += data[i]; g += data[i+1]; b += data[i+2]; count++; }
        }
        if (count > 0) onColorExtracted(`${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)}`);
      } catch { onColorExtracted(null); }
    };
    img.onerror = () => onColorExtracted?.(null);
    img.src = url;
  }, [url]);

  return (
    <>
      <div
        className="relative flex-shrink-0 overflow-hidden h-full cursor-pointer"
        style={{ width: '100%', minHeight: '100%' }}
        onClick={() => url && setLightboxOpen(true)}
      >
        {url ? (
          <>
            <div className="absolute inset-0">
              <img src={url} alt="" className="w-full h-full object-cover scale-150 blur-xl opacity-50" aria-hidden="true" />
              <div className="absolute inset-0 bg-black/40" />
            </div>
            <img src={url} alt="تصميم" className="relative w-full h-full object-contain z-10 p-2" style={{ minHeight: '100%' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            {urls.length > 1 && (
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-30 flex gap-1">
                {urls.map((_, i) => (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setCurrentIdx(i); }}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIdx % urls.length ? 'bg-white scale-125' : 'bg-white/40'}`} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ minHeight: '100%', background: `linear-gradient(135deg, hsl(var(--muted)/0.6), ${accent}18)` }}>
            <div className="flex flex-col items-center gap-2 opacity-40">
              <ImageIcon className="h-10 w-10" style={{ color: accent }} />
              <span className="text-[10px] text-muted-foreground">لا يوجد تصميم</span>
            </div>
          </div>
        )}
        <div className="absolute top-0 left-0 bottom-0 w-[4px]" style={{ background: accent, opacity: 0.85 }} />
      </div>
      {lightboxOpen && url && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center" onClick={() => setLightboxOpen(false)}>
          <button onClick={() => setLightboxOpen(false)} className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/20">
            <X className="w-6 h-6 text-white" />
          </button>
          <img src={url} alt="معاينة" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>, document.body
      )}
    </>
  );
};

/* ── Compact action button ── */
const ActionBtn = ({ icon: Icon, label, onClick, danger = false, className: cls = '' }: {
  icon: any; label: string; onClick: (e: React.MouseEvent) => void; danger?: boolean; className?: string;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button onClick={e => { e.stopPropagation(); onClick(e); }}
        className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-150 border
          ${danger
            ? 'text-red-400/70 border-red-500/15 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30'
            : 'text-muted-foreground border-border/40 hover:bg-indigo-500/12 hover:text-indigo-400 hover:border-indigo-500/30'
          } ${cls}`}>
        <Icon className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
  </Tooltip>
);

/* ── Profit indicator ── */
const ProfitIndicator = ({ profit, percentage }: { profit: number; percentage: number }) => {
  const isProfit = profit >= 0;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-baseline gap-1">
        {isProfit ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />}
        <span className={`text-sm font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
          {profit.toLocaleString('ar-LY')}
        </span>
      </div>
      <span className={`text-[10px] font-medium ${isProfit ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
};

/* ── Sort icon ── */
const SortIcon = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) =>
  sortField !== field
    ? <ArrowUpDown className="h-3 w-3 opacity-30" />
    : sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-indigo-400" />
      : <ArrowDown className="h-3 w-3 text-indigo-400" />;

/* ── Skeleton ── */
const SkeletonCard = () => (
  <div className="flex rounded-2xl overflow-hidden border border-border/50 bg-card" style={{ minHeight: 140 }}>
    <Skeleton className="w-40 shrink-0 rounded-none rounded-r-2xl" />
    <div className="flex-1 p-5 flex flex-col gap-3">
      <Skeleton className="h-5 w-1/3 rounded-lg" />
      <Skeleton className="h-3.5 w-1/4 rounded" />
      <div className="flex gap-6 mt-2">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
    </div>
  </div>
);

/* ── Task Card Row ── */
const TaskCardRow = ({
  task, idx, onEditCosts, onDelete, onOpenInvoice,
}: {
  task: any; idx: number;
  onEditCosts: (task: any) => void;
  onDelete: (task: any) => void;
  onOpenInvoice: (task: any, type: InvoiceType) => void;
}) => {
  const [dominantColor, setDominantColor] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const cfg = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const hasCutouts = task.customer_cutout_cost > 0 || task.company_cutout_cost > 0;

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
      transition={{ delay: idx * 0.025, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      className="group relative rounded-2xl overflow-hidden"
      style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow, minHeight: 140 }}
    >
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{ boxShadow: dominantColor
          ? `0 12px 40px rgba(${dominantColor}, 0.35), 0 0 0 2px rgba(${dominantColor}, 0.3)`
          : `0 8px 32px rgba(0,0,0,0.30), 0 0 0 1px ${task.accent}33`
        }} />

      {/* Desktop layout */}
      <div className="hidden md:flex h-full">
        {/* Design panel */}
        <div className="shrink-0 overflow-hidden relative" style={{ width: 220, borderRadius: '0 16px 16px 0' }} onClick={e => e.stopPropagation()}>
          <DesignPanel urls={task.designUrls} accent={task.accent} onColorExtracted={setDominantColor} />
        </div>

        <div className="flex flex-1 min-w-0 p-0">
          {/* Info block */}
          <div className="flex-1 min-w-0 px-5 py-4 flex flex-col justify-center gap-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xl font-bold text-foreground leading-tight">{task.customer_name || 'غير محدد'}</span>
              <span className={`text-[10px] rounded-full px-2 py-0.5 font-semibold border ${
                task.task_type === 'new_installation'
                  ? 'bg-blue-500/12 text-blue-400 border-blue-500/20'
                  : 'bg-orange-500/12 text-orange-400 border-orange-500/20'
              }`}>
                {task.task_type === 'new_installation' ? 'تركيب جديد' : `إعادة تركيب ${task.reinstallationNumber ? `(re${task.reinstallationNumber})` : ''}`}
              </span>
              {task.reinstallationNumber != null && (
                <span className="text-[10px] font-mono bg-orange-500/15 text-orange-400 border border-orange-500/25 rounded px-1.5 py-0.5 font-semibold">
                  re{task.reinstallationNumber}-{task.contract_id}
                </span>
              )}
            </div>

            {task.adType && task.adType !== 'غير محدد' && (
              <span className="text-sm text-muted-foreground/80 truncate">{task.adType}</span>
            )}

            {/* فرقة التركيب - بارزة */}
            {task.teamName && (
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-primary">{task.teamName}</span>
              </div>
            )}

            {/* عناصر المهمة - كبيرة وواضحة */}
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              {task.installation_task_id && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  <Wrench className="h-3.5 w-3.5" /> تركيب{task.teamName ? ` - ${task.teamName}` : ''}
                </span>
              )}
              {task.print_task_id && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/25">
                  <Printer className="h-3.5 w-3.5" /> طباعة
                </span>
              )}
              {hasCutouts && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  <Scissors className="h-3.5 w-3.5" /> مجسمات
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5 shrink-0 text-indigo-500/70" />
                {task.contractIds && task.contractIds.length > 1 ? (
                  <span className="flex items-center gap-1 flex-wrap">
                    {task.contractIds.slice(0, 3).map((cId: number) => (
                      <span key={cId} className="font-mono text-indigo-400 font-semibold">#{cId}</span>
                    ))}
                    {task.contractIds.length > 3 && <span className="text-muted-foreground">+{task.contractIds.length - 3}</span>}
                  </span>
                ) : (
                  <span className="font-mono text-indigo-400 font-semibold">#{task.contract_id}</span>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                {format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}
              </span>
            </div>
          </div>

          {/* Customer Due - prominent */}
          <div className={`w-[140px] shrink-0 px-3 py-3 flex flex-col justify-center items-center gap-1 border-r border-border/30 ${(task.customer_total || 0) > 0 ? 'bg-emerald-500/5' : 'bg-muted/20'}`} onClick={e => e.stopPropagation()}>
            <span className={`text-[10px] font-medium ${(task.customer_total || 0) > 0 ? 'text-emerald-500/70' : 'text-muted-foreground/50'}`}>المستحق على الزبون</span>
            {(task.customer_total || 0) > 0 ? (
              <>
                <span className="text-xl font-bold text-emerald-500">{(task.customer_total || 0).toLocaleString('ar-LY')}</span>
                <span className="text-[10px] text-emerald-500/60">د.ل</span>
                <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5">
                  {(task.customer_installation_cost || 0) > 0 && (
                    <span className="text-[9px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">تركيب {(task.customer_installation_cost || 0).toLocaleString('ar-LY')}</span>
                  )}
                  {(task.customer_print_cost || 0) > 0 && (
                    <span className="text-[9px] bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded">طباعة {(task.customer_print_cost || 0).toLocaleString('ar-LY')}</span>
                  )}
                  {(task.customer_cutout_cost || 0) > 0 && (
                    <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">مجسمات {(task.customer_cutout_cost || 0).toLocaleString('ar-LY')}</span>
                  )}
                </div>
              </>
            ) : (
              <span className="text-xs font-semibold text-muted-foreground/40">لا يوجد استحقاق</span>
            )}
          </div>

          {/* Financial block */}
          <div className="w-[160px] shrink-0 px-4 py-4 flex flex-col justify-center gap-2 border-r border-border/30" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">تكلفة</span>
              <span className="text-sm font-bold text-orange-400">{(task.company_total || 0).toLocaleString('ar-LY')}</span>
            </div>
            <div className="h-px bg-border/30" />
            <ProfitIndicator profit={task.net_profit || 0} percentage={task.profit_percentage || 0} />
          </div>

          {/* Status block */}
          <div className="w-[110px] shrink-0 px-3 py-4 flex flex-col justify-center items-center gap-2 border-r border-border/30">
            <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold whitespace-nowrap ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />
              {cfg.label}
            </span>
            {task.invoice_generated && (
              <span className="text-[10px] text-indigo-400/70 flex items-center gap-1">
                <FileText className="h-2.5 w-2.5" /> فاتورة
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="w-[56px] shrink-0 flex flex-col items-center justify-center gap-1.5 px-1.5 py-3 border-r border-border/30" onClick={e => e.stopPropagation()}>
            {deleteConfirm ? (
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[9px] text-red-400 font-medium text-center leading-tight">حذف؟</span>
                <button onClick={() => { onDelete(task); setDeleteConfirm(false); }} className="w-full h-6 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/35 transition-colors px-1">نعم</button>
                <button onClick={() => setDeleteConfirm(false)} className="w-full h-6 rounded-lg bg-muted/60 text-muted-foreground text-[10px] hover:bg-muted transition-colors px-1">لا</button>
              </div>
            ) : (
              <>
                <ActionBtn icon={FileText} label="فاتورة الزبون" onClick={() => onOpenInvoice(task, 'customer')} />
                {task.print_task_id && <ActionBtn icon={Printer} label="فاتورة المطبعة" onClick={() => onOpenInvoice(task, 'print_vendor')} />}
                {task.installation_task_id && <ActionBtn icon={Users} label="فاتورة الفرقة" onClick={() => onOpenInvoice(task, 'installation_team')} />}
                <ActionBtn icon={Edit} label="تعديل التكاليف" onClick={() => onEditCosts(task)} />
                <ActionBtn icon={Trash2} label="حذف" onClick={() => setDeleteConfirm(true)} danger />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col md:hidden">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border/20">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-foreground truncate">{task.customer_name || 'غير محدد'}</span>
              <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-semibold border ${
                task.task_type === 'new_installation'
                  ? 'bg-blue-500/12 text-blue-400 border-blue-500/20'
                  : 'bg-orange-500/12 text-orange-400 border-orange-500/20'
              }`}>
                {task.task_type === 'new_installation' ? 'جديد' : `إعادة ${task.reinstallationNumber ? `re${task.reinstallationNumber}` : ''}`}
              </span>
              {task.reinstallationNumber != null && (
                <span className="text-[9px] font-mono bg-orange-500/15 text-orange-400 border border-orange-500/25 rounded px-1.5 py-0.5 font-semibold">
                  re{task.reinstallationNumber}-{task.contract_id}
                </span>
              )}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-semibold whitespace-nowrap ${cfg.color} shrink-0`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-indigo-500/70" />
            <span className="font-mono text-indigo-400 font-semibold">#{task.contract_id}</span>
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3 text-muted-foreground/50" />
            {format(new Date(task.created_at), 'dd/MM/yyyy', { locale: ar })}
          </span>
        </div>

        {/* فرقة التركيب + عناصر المهمة - موبايل */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-border/20">
          {task.teamName && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
              <Users className="h-3.5 w-3.5" /> {task.teamName}
            </span>
          )}
          {task.installation_task_id && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/25">
              <Wrench className="h-3 w-3" /> تركيب{task.teamName ? ` - ${task.teamName}` : ''}
            </span>
          )}
          {task.print_task_id && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/25">
              <Printer className="h-3 w-3" /> طباعة
            </span>
          )}
          {hasCutouts && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/25">
              <Scissors className="h-3 w-3" /> مجسمات
            </span>
          )}
        </div>

        <div className="px-3 py-2 border-t border-border/20 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] text-muted-foreground">المستحق على الزبون</div>
            {(task.customer_total || 0) > 0 ? (
              <div className="text-sm font-bold text-emerald-400">{(task.customer_total || 0).toLocaleString('ar-LY')}</div>
            ) : (
              <div className="text-[10px] font-semibold text-muted-foreground/50">لا يوجد استحقاق</div>
            )}
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">تكلفة</div>
            <div className="text-sm font-bold text-orange-400">{(task.company_total || 0).toLocaleString('ar-LY')}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">ربح</div>
            <ProfitIndicator profit={task.net_profit || 0} percentage={task.profit_percentage || 0} />
          </div>
        </div>

        <div className="flex items-center gap-1 px-3 py-2 border-t border-border/20 flex-wrap" onClick={e => e.stopPropagation()}>
          {deleteConfirm ? (
            <div className="flex items-center gap-2 w-full">
              <span className="text-xs text-red-400 font-medium">تأكيد الحذف؟</span>
              <button onClick={() => { onDelete(task); setDeleteConfirm(false); }} className="h-7 px-3 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold">نعم</button>
              <button onClick={() => setDeleteConfirm(false)} className="h-7 px-3 rounded-lg bg-muted/60 text-muted-foreground text-xs">لا</button>
            </div>
          ) : (
            <>
              <ActionBtn icon={FileText} label="فاتورة الزبون" onClick={() => onOpenInvoice(task, 'customer')} />
              {task.print_task_id && <ActionBtn icon={Printer} label="فاتورة المطبعة" onClick={() => onOpenInvoice(task, 'print_vendor')} />}
              {task.installation_task_id && <ActionBtn icon={Users} label="فاتورة الفرقة" onClick={() => onOpenInvoice(task, 'installation_team')} />}
              <ActionBtn icon={Edit} label="تعديل" onClick={() => onEditCosts(task)} />
              <ActionBtn icon={Trash2} label="حذف" onClick={() => setDeleteConfirm(true)} danger />
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════════════════════════
   ██ MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */
export const CompositeTasksListEnhanced: React.FC<CompositeTasksListEnhancedProps> = ({
  customerId,
  filter = 'all'
}) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [editingTask, setEditingTask] = useState<CompositeTaskWithDetails | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [invoiceTask, setInvoiceTask] = useState<any>(null);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('customer');
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [deleteTask, setDeleteTask] = useState<any>(null);
  const PAGE_SIZE = 15;

  // Fetch composite tasks
  const { data: compositeTasks = [], isLoading, refetch } = useQuery({
    queryKey: ['composite-tasks', customerId, filter],
    queryFn: async () => {
      let query = supabase
        .from('composite_tasks')
        .select(`*, customer:customers(id, name, company, phone)`)
        .order('created_at', { ascending: false });

      if (customerId) query = query.eq('customer_id', customerId);
      if (filter === 'pending') query = query.in('status', ['pending', 'in_progress']);
      else if (filter === 'completed') query = query.eq('status', 'completed');

      const { data, error } = await query;
      if (error) throw error;

      const tasks = (data || []) as CompositeTaskWithDetails[];

      // Fetch contract IDs from installation task items
      const installationTaskIds = Array.from(
        new Set(tasks.map(t => t.installation_task_id).filter((id): id is string => Boolean(id)))
      );

      if (installationTaskIds.length > 0) {
        // Fetch contract IDs and reinstallation info in parallel
        const [installItemsRes, installTasksRes] = await Promise.all([
          supabase
            .from('installation_task_items')
            .select('task_id, billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)')
            .in('task_id', installationTaskIds),
          supabase
            .from('installation_tasks')
            .select('id, task_type, reinstallation_number, contract_id')
            .in('id', installationTaskIds)
        ]);

        const installItems = installItemsRes.data || [];
        const installTasksData = installTasksRes.data || [];

        const map = new Map<string, Set<number>>();
        installItems.forEach((row: any) => {
          const taskId = row.task_id as string;
          const contractNo = row.billboard?.Contract_Number;
          if (!taskId || !contractNo) return;
          if (!map.has(taskId)) map.set(taskId, new Set());
          map.get(taskId)!.add(Number(contractNo));
        });

        // Map reinstallation info
        const reinstallInfoMap = new Map<string, { number: number | null; taskType: string }>();
        installTasksData.forEach((it: any) => {
          reinstallInfoMap.set(it.id, { 
            number: it.reinstallation_number, 
            taskType: it.task_type || 'installation' 
          });
        });

        tasks.forEach((t: any) => {
          const set = t.installation_task_id ? map.get(t.installation_task_id) : undefined;
          const derived = set ? Array.from(set) : [];
          t._contractIds = derived.length > 0 ? derived : [t.contract_id].filter(Boolean);
          
          // Set reinstallation info
          const reinstallInfo = t.installation_task_id ? reinstallInfoMap.get(t.installation_task_id) : undefined;
          t._reinstallationNumber = reinstallInfo?.number ?? null;
        });
      }

      tasks.forEach((t: any) => {
        if (!t._contractIds || !Array.isArray(t._contractIds) || t._contractIds.length === 0) {
          t._contractIds = [t.contract_id].filter(Boolean);
        }
      });

      return tasks;
    },
  });

  // Fetch design images and ad types for tasks
  const { data: taskExtras = {} } = useQuery({
    queryKey: ['composite-task-extras', compositeTasks.map(t => t.id).join(',')],
    enabled: compositeTasks.length > 0,
    queryFn: async () => {
      const extras: Record<string, { designUrls: string[]; adType: string; teamName: string; reinstallationNumber: number | null }> = {};

      // Batch fetch designs from installation tasks
      const installIds = compositeTasks.map(t => t.installation_task_id).filter(Boolean) as string[];
      const printIds = compositeTasks.map(t => t.print_task_id).filter(Boolean) as string[];
      const contractIds = [...new Set(compositeTasks.map(t => t.contract_id).filter(Boolean))];

      let installDesigns: any[] = [];
      let printDesigns: any[] = [];
      let billboardDesigns: any[] = [];
      let contracts: any[] = [];
      let installTasks: any[] = [];
      let taskDesignsData: any[] = [];

      const promises: Promise<any>[] = [];

      if (installIds.length > 0) {
        // PRIMARY: Fetch from task_designs table (the actual design source)
        promises.push(
          Promise.resolve(supabase.from('task_designs')
            .select('task_id, design_face_a_url, design_face_b_url, design_order')
            .in('task_id', installIds)
            .order('design_order', { ascending: true }))
            .then(({ data }) => { taskDesignsData = data || []; })
        );
        promises.push(
          Promise.resolve(supabase.from('installation_task_items')
            .select('task_id, design_face_a, design_face_b')
            .in('task_id', installIds))
            .then(({ data }) => { installDesigns = data || []; })
        );
        promises.push(
          Promise.resolve(supabase.from('installation_tasks')
            .select('id, task_type, reinstallation_number, contract_id, team:installation_teams(team_name)')
            .in('id', installIds))
            .then(({ data }) => { installTasks = data || []; })
        );
      }

      if (printIds.length > 0) {
        promises.push(
          Promise.resolve(supabase.from('print_task_items')
            .select('task_id, design_face_a, design_face_b')
            .in('task_id', printIds))
            .then(({ data }) => { printDesigns = data || []; })
        );
      }

      if (contractIds.length > 0) {
        promises.push(
          Promise.resolve(supabase.from('Contract')
            .select('"Contract_Number", "Ad Type"')
            .in('Contract_Number', contractIds))
            .then(({ data }) => { contracts = data || []; })
        );
      }

      await Promise.all(promises);

      // For tasks with no designs, fetch from billboard_history scoped to the SAME contract
      const taskIdsWithNoDesigns = new Set<string>();
      const fallbackItemsByTask = new Map<string, Array<{ billboard_id: number; installation_date: string | null }>>();
      const contractByInstallTaskId = new Map<string, number>();

      compositeTasks.forEach(task => {
        if (task.installation_task_id && task.contract_id) {
          contractByInstallTaskId.set(task.installation_task_id, Number(task.contract_id));
        }
      });

      installTasks.forEach((t: any) => {
        if (t.id && t.contract_id) {
          contractByInstallTaskId.set(t.id, Number(t.contract_id));
        }
      });

      compositeTasks.forEach(task => {
        if (!task.installation_task_id) return;
        const hasDesign = installDesigns.some(d => d.task_id === task.installation_task_id && (d.design_face_a || d.design_face_b));
        if (!hasDesign) taskIdsWithNoDesigns.add(task.installation_task_id);
      });

      let historyDesigns: any[] = [];
      const historyByBillboardAndContract = new Map<string, any[]>();

      if (taskIdsWithNoDesigns.size > 0) {
        const { data: itemsWithBillboards } = await supabase
          .from('installation_task_items')
          .select('task_id, billboard_id, installation_date')
          .in('task_id', Array.from(taskIdsWithNoDesigns));

        (itemsWithBillboards || []).forEach((item: any) => {
          if (!item.task_id || !item.billboard_id) return;
          if (!fallbackItemsByTask.has(item.task_id)) fallbackItemsByTask.set(item.task_id, []);
          fallbackItemsByTask.get(item.task_id)!.push({
            billboard_id: Number(item.billboard_id),
            installation_date: item.installation_date || null,
          });
        });

        const allBillboardIds = [...new Set((itemsWithBillboards || []).map((i: any) => i.billboard_id).filter(Boolean))];
        const fallbackContractIds = [...new Set(
          Array.from(taskIdsWithNoDesigns)
            .map(taskId => contractByInstallTaskId.get(taskId))
            .filter((contractId): contractId is number => Number.isFinite(contractId))
        )];

        if (allBillboardIds.length > 0 && fallbackContractIds.length > 0) {
          const { data: histData } = await supabase
            .from('billboard_history')
            .select('billboard_id, contract_number, design_face_a_url, design_face_b_url, installation_date')
            .in('billboard_id', allBillboardIds)
            .in('contract_number', fallbackContractIds)
            .order('installation_date', { ascending: false });

          historyDesigns = histData || [];

          historyDesigns.forEach((row: any) => {
            const key = `${row.billboard_id}:${row.contract_number}`;
            if (!historyByBillboardAndContract.has(key)) historyByBillboardAndContract.set(key, []);
            historyByBillboardAndContract.get(key)!.push(row);
          });
        }
      }

      const adTypeMap = new Map<number, string>();
      contracts.forEach((c: any) => { adTypeMap.set(c.Contract_Number, c['Ad Type'] || ''); });

      const teamNameMap = new Map<string, string>();
      const reinstallMap = new Map<string, number | null>();
      installTasks.forEach((t: any) => { 
        teamNameMap.set(t.id, t.team?.team_name || ''); 
        reinstallMap.set(t.id, t.task_type === 'reinstallation' ? (t.reinstallation_number || 1) : null);
      });

      compositeTasks.forEach(task => {
        const seen = new Set<string>();
        const urls: string[] = [];

        // PRIMARY: From task_designs table (main design source)
        taskDesignsData.filter(d => d.task_id === task.installation_task_id).forEach(d => {
          if (d.design_face_a_url && !seen.has(d.design_face_a_url)) { seen.add(d.design_face_a_url); urls.push(d.design_face_a_url); }
          if (d.design_face_b_url && !seen.has(d.design_face_b_url)) { seen.add(d.design_face_b_url); urls.push(d.design_face_b_url); }
        });

        // From print task items
        if (urls.length === 0) {
          printDesigns.filter(d => d.task_id === task.print_task_id).forEach(d => {
            if (d.design_face_a && !seen.has(d.design_face_a)) { seen.add(d.design_face_a); urls.push(d.design_face_a); }
            if (d.design_face_b && !seen.has(d.design_face_b)) { seen.add(d.design_face_b); urls.push(d.design_face_b); }
          });
        }

        // From installation task items
        if (urls.length === 0) {
          installDesigns.filter(d => d.task_id === task.installation_task_id).forEach(d => {
            if (d.design_face_a && !seen.has(d.design_face_a)) { seen.add(d.design_face_a); urls.push(d.design_face_a); }
            if (d.design_face_b && !seen.has(d.design_face_b)) { seen.add(d.design_face_b); urls.push(d.design_face_b); }
          });
        }

        // Fallback: only from billboard_history of the SAME contract linked to this composite task
        if (urls.length === 0 && task.installation_task_id && task.contract_id) {
          const taskItems = fallbackItemsByTask.get(task.installation_task_id) || [];
          const contractNo = contractByInstallTaskId.get(task.installation_task_id) ?? Number(task.contract_id);
          const seenBillboards = new Set<number>();

          taskItems.forEach(item => {
            if (!item.billboard_id || seenBillboards.has(item.billboard_id)) return;
            seenBillboards.add(item.billboard_id);

            const historyKey = `${item.billboard_id}:${contractNo}`;
            const candidates = historyByBillboardAndContract.get(historyKey) || [];
            if (candidates.length === 0) return;

            const picked = item.installation_date
              ? candidates.find((h: any) => h.installation_date === item.installation_date) || candidates[0]
              : candidates[0];

            if (picked?.design_face_a_url && !seen.has(picked.design_face_a_url)) {
              seen.add(picked.design_face_a_url);
              urls.push(picked.design_face_a_url);
            }
            if (picked?.design_face_b_url && !seen.has(picked.design_face_b_url)) {
              seen.add(picked.design_face_b_url);
              urls.push(picked.design_face_b_url);
            }
          });
        }

        // NOTE: Removed billboards fallback - it shows current billboard designs
        // which may belong to newer/different contracts, not the composite task's contract

        extras[task.id] = {
          designUrls: urls.slice(0, 4),
          adType: adTypeMap.get(task.contract_id) || '',
          teamName: task.installation_task_id ? teamNameMap.get(task.installation_task_id) || '' : '',
          reinstallationNumber: task.installation_task_id ? reinstallMap.get(task.installation_task_id) ?? null : null,
        };
      });

      return extras;
    },
  });

  // Enrich tasks
  const enriched = useMemo(() => compositeTasks.map((task: any) => {
    const extra = taskExtras[task.id] || { designUrls: [], adType: '', teamName: '', reinstallationNumber: null };
    let h = 0;
    for (let i = 0; i < task.id.length; i++) h = task.id.charCodeAt(i) + ((h << 5) - h);
    const accent = `hsl(${Math.abs(h) % 360}, 55%, 58%)`;
    return {
      ...task,
      designUrls: extra.designUrls,
      adType: extra.adType,
      teamName: extra.teamName,
      reinstallationNumber: task._reinstallationNumber ?? extra.reinstallationNumber ?? null,
      accent,
      contractIds: task._contractIds || [task.contract_id],
    };
  }), [compositeTasks, taskExtras]);

  // Stats
  const stats = useMemo(() => ({
    total: enriched.length,
    pending: enriched.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
    completed: enriched.filter(t => t.status === 'completed').length,
    totalRevenue: enriched.reduce((s, t) => s + (t.customer_total || 0), 0),
    totalProfit: enriched.reduce((s, t) => s + (t.net_profit || 0), 0),
  }), [enriched]);

  // Filter
  const filtered = useMemo(() => {
    let r = enriched;
    if (filterStatus !== 'all') r = r.filter(t => t.status === filterStatus);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(t =>
        (t.customer_name || '').toLowerCase().includes(s) ||
        String(t.contract_id).includes(s) ||
        (t.adType || '').toLowerCase().includes(s)
      );
    }
    return r;
  }, [enriched, filterStatus, search]);

  // Sort
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let av: any, bv: any;
    switch (sortField) {
      case 'client': av = a.customer_name; bv = b.customer_name; break;
      case 'contract': av = a.contract_id; bv = b.contract_id; break;
      case 'revenue': av = a.customer_total; bv = b.customer_total; break;
      case 'cost': av = a.company_total; bv = b.company_total; break;
      case 'profit': av = a.net_profit; bv = b.net_profit; break;
      case 'status': av = a.status; bv = b.status; break;
      case 'date': default: av = a.created_at; bv = b.created_at;
    }
    const cmp = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
    return sortDir === 'asc' ? cmp : -cmp;
  }), [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  // Update costs mutation
  const updateCostsMutation = useMutation({
    mutationFn: async (data: UpdateCompositeTaskCostsInput) => {
      const customerInstall = data.customer_installation_cost ?? 0;
      const companyInstall = data.company_installation_cost ?? 0;
      const customerPrint = data.customer_print_cost ?? 0;
      const companyPrint = data.company_print_cost ?? 0;
      const customerCutout = data.customer_cutout_cost ?? 0;
      const companyCutout = data.company_cutout_cost ?? 0;
      const discountAmount = data.discount_amount ?? 0;
      const customerSubtotal = customerInstall + customerPrint + customerCutout;
      const customerTotal = customerSubtotal - discountAmount;
      const companyTotal = companyInstall + companyPrint + companyCutout;
      const netProfit = customerTotal - companyTotal;
      const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

      const { error } = await supabase.from('composite_tasks').update({
        customer_installation_cost: customerInstall, company_installation_cost: companyInstall,
        customer_print_cost: customerPrint, company_print_cost: companyPrint,
        customer_cutout_cost: customerCutout, company_cutout_cost: companyCutout,
        discount_amount: discountAmount, discount_reason: data.discount_reason || null,
        customer_total: customerTotal, company_total: companyTotal,
        net_profit: netProfit, profit_percentage: profitPercentage,
        notes: data.notes, updated_at: new Date().toISOString(),
        cost_allocation: data.cost_allocation || null,
        print_discount: data.print_discount || 0,
        print_discount_reason: data.print_discount_reason || null,
        cutout_discount: data.cutout_discount || 0,
        cutout_discount_reason: data.cutout_discount_reason || null,
        installation_discount: data.installation_discount || 0,
        installation_discount_reason: data.installation_discount_reason || null,
      }).eq('id', data.id);
      if (error) throw error;

      // Sync related tables
      const { data: taskData } = await supabase.from('composite_tasks')
        .select('print_task_id, cutout_task_id, combined_invoice_id')
        .eq('id', data.id).single();

      if (taskData?.print_task_id) {
        // Fetch total_area to calculate correct price_per_meter
        const { data: printTask } = await supabase.from('print_tasks')
          .select('total_area')
          .eq('id', taskData.print_task_id).single();
        const totalArea = printTask?.total_area || 0;
        const newPricePerMeter = totalArea > 0 ? companyPrint / totalArea : 0;
        await supabase.from('print_tasks').update({
          total_cost: companyPrint, customer_total_amount: customerPrint, 
          price_per_meter: Math.round(newPricePerMeter * 100) / 100,
          updated_at: new Date().toISOString()
        }).eq('id', taskData.print_task_id);
      }
      if (taskData?.cutout_task_id) {
        await supabase.from('cutout_tasks').update({
          total_cost: companyCutout, customer_total_amount: customerCutout, updated_at: new Date().toISOString()
        }).eq('id', taskData.cutout_task_id);
      }
      if (taskData?.combined_invoice_id) {
        // تحديث الفاتورة الموحدة بجميع البيانات
        await supabase.from('printed_invoices').update({
          print_cost: companyPrint + companyCutout,
          total_amount: customerTotal,
          notes: `فاتورة موحدة للمهمة المجمعة\n` +
                 `تركيب: ${customerInstall.toLocaleString()} د.ل\n` +
                 (customerPrint > 0 ? `طباعة: ${customerPrint.toLocaleString()} د.ل\n` : '') +
                 (customerCutout > 0 ? `قص: ${customerCutout.toLocaleString()} د.ل\n` : '') +
                 (discountAmount > 0 ? `خصم: ${discountAmount.toLocaleString()} د.ل\n` : '') +
                 (data.notes ? `\nملاحظات: ${data.notes}` : ''),
          updated_at: new Date().toISOString()
        }).eq('id', taskData.combined_invoice_id);

        // مزامنة سجل الدين في حساب الزبون مع المبلغ الجديد
        const { data: compositeTask } = await supabase.from('composite_tasks')
          .select('customer_id, customer_name, contract_id')
          .eq('id', data.id).single();

        if (compositeTask) {
          // تحديث سجل الدين المرتبط بالفاتورة
          await supabase.from('customer_payments')
            .update({
              amount: -customerTotal,
              notes: `مهمة مجمعة - عقد #${compositeTask.contract_id}`
            })
            .eq('printed_invoice_id', taskData.combined_invoice_id)
            .eq('entry_type', 'invoice');
        }
      }
    },
    onSuccess: () => {
      toast.success('تم تحديث التكاليف بنجاح');
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['printer-accounts'] });
      setEditDialogOpen(false);
      setEditingTask(null);
    },
    onError: (err: any) => toast.error(err.message || 'فشل التحديث'),
  });

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: async (task: any) => {
      if (task.combined_invoice_id) {
        await supabase.from('customer_payments').delete().eq('printed_invoice_id', task.combined_invoice_id);
        await supabase.from('printed_invoices').delete().eq('id', task.combined_invoice_id);
      }
      await supabase.from('composite_tasks').update({
        installation_task_id: null, print_task_id: null, cutout_task_id: null, combined_invoice_id: null
      }).eq('id', task.id);
      const { error } = await supabase.from('composite_tasks').delete().eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف المهمة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
      setDeleteTask(null);
    },
    onError: (err: any) => toast.error(err.message || 'فشل الحذف'),
  });

  const SortPill = ({ field, label }: { field: SortField; label: string }) => (
    <button onClick={() => handleSort(field)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border ${
        sortField === field
          ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
          : 'text-muted-foreground border-border/40 hover:text-indigo-400 hover:border-indigo-500/20'
      }`}>
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
            { label: 'إجمالي المهام', value: stats.total, color: 'text-foreground', icon: LayoutList, border: 'border-border' },
            { label: 'قيد التنفيذ', value: stats.pending, color: 'text-amber-400', icon: Clock, border: 'border-amber-500/30' },
            { label: 'مكتملة', value: stats.completed, color: 'text-emerald-400', icon: CheckCircle2, border: 'border-emerald-500/30' },
            { label: 'الإيرادات', value: stats.totalRevenue.toLocaleString('ar-LY'), color: 'text-indigo-400', icon: DollarSign, border: 'border-indigo-500/30' },
            { label: 'صافي الربح', value: stats.totalProfit.toLocaleString('ar-LY'), color: stats.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400', icon: stats.totalProfit >= 0 ? TrendingUp : TrendingDown, border: stats.totalProfit >= 0 ? 'border-emerald-500/30' : 'border-red-500/30' },
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

        {/* Toolbar */}
        <div className="bg-card border border-border rounded-2xl px-5 py-3.5 flex flex-wrap gap-3 items-center shrink-0">
          <div className="relative flex-1 min-w-[140px] sm:min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input placeholder="بحث بالاسم، العقد..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pr-9 bg-background border-border h-9 text-sm rounded-xl" />
          </div>
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[145px] h-9 bg-background border-border text-sm rounded-xl">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="pending">معلقة</SelectItem>
              <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
              <SelectItem value="completed">مكتملة</SelectItem>
              <SelectItem value="cancelled">ملغاة</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 gap-1.5 border-border px-3 rounded-xl">
            <RefreshCw className="h-3.5 w-3.5" />
            تحديث
          </Button>

          <div className="hidden lg:flex items-center gap-2 mr-2">
            <span className="text-xs text-muted-foreground/50 shrink-0">ترتيب:</span>
            <SortPill field="date" label="التاريخ" />
            <SortPill field="client" label="العميل" />
            <SortPill field="revenue" label="الإيراد" />
            <SortPill field="profit" label="الربح" />
          </div>
        </div>

        {/* Card list */}
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
            paginated.map((task, idx) => (
              <TaskCardRow
                key={task.id}
                task={task}
                idx={idx}
                onEditCosts={(t) => { setEditingTask(t); setEditDialogOpen(true); }}
                onDelete={(t) => setDeleteTask(t)}
                onOpenInvoice={(t, type) => { setInvoiceTask(t); setInvoiceType(type); setInvoiceOpen(true); }}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-border px-4 py-3 flex items-center justify-between text-xs text-muted-foreground bg-card rounded-2xl border shrink-0">
            <span>
              {sorted.length > 0
                ? `عرض ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sorted.length)} من ${sorted.length} مهمة`
                : 'لا توجد نتائج'}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-border rounded-lg" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <Button key={p} size="sm"
                    className={`h-7 w-7 p-0 text-xs rounded-lg ${p === page ? 'bg-indigo-500 hover:bg-indigo-600 text-white font-bold' : 'bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent'}`}
                    onClick={() => setPage(p)}>{p}</Button>
                );
              })}
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-border rounded-lg" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Costs Dialog */}
      <EnhancedEditCompositeTaskCostsDialog
        task={editingTask}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={(data) => updateCostsMutation.mutate(data)}
        isSaving={updateCostsMutation.isPending}
      />

      {/* Invoice Dialog */}
      {invoiceTask && (
        <UnifiedTaskInvoice
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
          task={invoiceTask}
          invoiceType={invoiceType}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteTask !== null} onOpenChange={() => setDeleteTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد حذف المهمة
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المهمة المجمعة والفواتير المرتبطة. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTask && deleteMutation.mutate(deleteTask)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              حذف المهمة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};

export default CompositeTasksListEnhanced;
