import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, Clock, Package, Users,
  Plus, RefreshCw, XCircle, Printer, Palette,
  Trash2, Edit, ChevronDown, Image as ImageIcon,
  LayoutList, Layers, FileText, X,
  ChevronLeft, ChevronRight, Building2, CalendarDays,
  Banknote
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

interface InstallationTask {
  id: string;
  contract_id: number;
  contract_ids?: number[];
  team_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  task_type?: 'installation' | 'reinstallation';
  created_at: string;
}

interface Props {
  tasks: InstallationTask[];
  allTaskItems: any[];
  billboardById: Record<number, any>;
  contractById: Record<number, any>;
  teamById: Record<string, any>;
  teams: any[];
  designsByTask: Record<string, any[]>;
  installationPricingByBillboard: Record<number, number>;
  derivedContractIdsByTaskId?: Map<string, number[]>;
  isLoading: boolean;
  stats: {
    totalTasks: number;
    pendingTasks: number;
    completedTasks: number;
    totalBillboards: number;
    completedBillboards: number;
  };
  // pagination (lifted to parent to preserve across re-renders)
  page: number;
  onPageChange: (page: number) => void;
  onOpenTask: (taskId: string) => void;
  onAddTask: () => void;
  onRefresh: () => void;
  onPrintTask: (taskId: string) => void;
  onPrintAll: (taskId: string) => void;
  onDistributeDesigns: (taskId: string) => void;
  onManageDesigns: (taskId: string) => void;
  onAddBillboard: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string) => void;
  onCompleteAllBillboards?: (taskId: string) => void;
}

type SortField = 'id' | 'client' | 'contract' | 'billboards' | 'status' | 'date' | 'team' | 'cost';
type SortDir = 'asc' | 'desc';

const STATUS_CONFIG = {
  completed: {
    label: 'مكتملة',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-400',
    glow: 'rgba(16,185,129,0.15)',
    icon: CheckCircle2,
  },
  in_progress: {
    label: 'قيد التنفيذ',
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
    glow: 'rgba(245,158,11,0.15)',
    icon: Clock,
  },
  pending: {
    label: 'جديدة',
    color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    dot: 'bg-slate-400',
    glow: 'rgba(148,163,184,0.10)',
    icon: Package,
  },
  cancelled: {
    label: 'ملغاة',
    color: 'bg-red-500/15 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
    glow: 'rgba(239,68,68,0.12)',
    icon: XCircle,
  },
};

function getDisplayStatus(items: any[]): keyof typeof STATUS_CONFIG {
  if (items.length === 0) return 'pending';
  const completed = items.filter(i => i.status === 'completed').length;
  if (completed === items.length) return 'completed';
  if (completed > 0) return 'in_progress';
  return 'pending';
}

/* ── Progress bar with animated fill ── */
const ProgressBar = ({ value, total, completed }: { value: number; total: number; completed: number }) => {
  const barColor =
    value === 0 ? 'bg-muted-foreground/20'
    : value < 71 ? 'bg-amber-500'
    : value < 100 ? 'bg-blue-500'
    : 'bg-emerald-500';

  const textColor =
    value === 100 ? 'text-emerald-400'
    : value >= 71 ? 'text-blue-400'
    : value > 0 ? 'text-amber-400'
    : 'text-muted-foreground/50';

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-muted-foreground text-xs">اللوحات</span>
        <span className="text-xs font-semibold text-foreground/80">
          {completed}/{total}
        </span>
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

/* ── Full-height design panel with multi-design navigation ── */
const DesignPanel = ({ urls, accent, onColorExtracted }: { urls: string[]; accent: string; onColorExtracted?: (color: string | null) => void }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const url = urls.length > 0 ? urls[currentIdx % urls.length] : undefined;

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

  const goNext = (e: React.MouseEvent) => { e.stopPropagation(); setCurrentIdx(i => (i + 1) % urls.length); };
  const goPrev = (e: React.MouseEvent) => { e.stopPropagation(); setCurrentIdx(i => (i - 1 + urls.length) % urls.length); };

  return (
    <>
      <div
        className="relative flex-shrink-0 overflow-hidden h-full cursor-pointer"
        style={{ width: '100%', minHeight: '100%' }}
        onClick={() => url && setLightboxOpen(true)}
      >
        {url ? (
          <>
            {/* Blurred background */}
            <div className="absolute inset-0">
              <img src={url} alt="" className="w-full h-full object-cover scale-150 blur-xl opacity-50" aria-hidden="true" />
              <div className="absolute inset-0 bg-black/40" />
            </div>
            {/* Main image */}
            <img
              src={url}
              alt="تصميم"
              className="relative w-full h-full object-contain z-10 p-2"
              style={{ minHeight: '100%' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {/* Navigation arrows for multiple designs */}
            {urls.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-30 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={goNext}
                  className="absolute left-1 top-1/2 -translate-y-1/2 z-30 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {/* Dots indicator */}
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-30 flex gap-1">
                  {urls.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setCurrentIdx(i); }}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIdx % urls.length ? 'bg-white scale-125' : 'bg-white/40'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ minHeight: '100%', background: `linear-gradient(135deg, hsl(var(--muted)/0.6), ${accent}18)` }}
          >
            <div className="flex flex-col items-center gap-2 opacity-40">
              <ImageIcon className="h-10 w-10" style={{ color: accent }} />
              <span className="text-[10px] text-muted-foreground">لا يوجد تصميم</span>
            </div>
          </div>
        )}

        {/* Accent vertical bar */}
        <div className="absolute top-0 left-0 bottom-0 w-[4px]" style={{ background: accent, opacity: 0.85 }} />
      </div>

      {/* Lightbox via Portal */}
      {lightboxOpen && url && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/20"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          {urls.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentIdx(i => (i - 1 + urls.length) % urls.length); }}
                className="absolute right-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentIdx(i => (i + 1) % urls.length); }}
                className="absolute left-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                {urls.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setCurrentIdx(i); }}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentIdx % urls.length ? 'bg-white scale-125' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            </>
          )}
          <img
            src={url}
            alt="معاينة التصميم"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </>
  );
};

/* ── Compact icon action button ── */
const ActionBtn = ({
  icon: Icon, label, onClick, danger = false,
}: { icon: any; label: string; onClick: (e: React.MouseEvent) => void; danger?: boolean }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
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

/* ── Task Card Row with dominant color ── */
const TaskCardRowInner = ({
  task, idx, cfg, isSelected, deleteConfirmId,
  onOpenTask, onToggle, onPrintTask, onPrintAll, onDistributeDesigns, onManageDesigns,
  onAddBillboard, onDeleteTask, setDeleteConfirmId, onEditTask, onCompleteAllBillboards,
}: any) => {
  const [dominantColor, setDominantColor] = useState<string | null>(null);

  const cardBg = dominantColor
    ? `linear-gradient(to left, rgba(${dominantColor}, 0.25) 0%, rgba(${dominantColor}, 0.12) 35%, rgba(${dominantColor}, 0.04) 70%, hsl(var(--card)) 100%)`
    : isSelected
      ? `color-mix(in srgb, ${task.accent} 6%, hsl(var(--card)))`
      : 'hsl(var(--card))';

  const cardBorder = dominantColor
    ? `2px solid rgba(${dominantColor}, 0.5)`
    : isSelected
      ? `1px solid ${task.accent}55`
      : '1px solid hsl(var(--border))';

  const cardShadow = dominantColor
    ? `0 4px 24px rgba(${dominantColor}, 0.25), 0 0 0 1px rgba(${dominantColor}, 0.1)`
    : `0 2px 16px rgba(0,0,0,0.18)`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.025, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      onClick={() => onOpenTask(task.id)}
      className="group relative rounded-2xl overflow-hidden cursor-pointer"
      style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow, minHeight: 160 }}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{ boxShadow: dominantColor
          ? `0 12px 40px rgba(${dominantColor}, 0.35), 0 0 0 2px rgba(${dominantColor}, 0.3)`
          : `0 8px 32px rgba(0,0,0,0.30), 0 0 0 1px ${task.accent}33`
        }}
      />
      {/* Desktop layout */}
      <div className="hidden md:flex h-full">
        <div className="shrink-0 overflow-hidden relative" style={{ width: 500, borderRadius: '0 16px 16px 0' }} onClick={e => e.stopPropagation()}>
          <DesignPanel urls={task.allDesignUrls || (task.designThumb ? [task.designThumb] : [])} accent={task.accent} onColorExtracted={setDominantColor} />
        </div>
        <div className="flex flex-1 min-w-0 p-0">
          <div className="flex-1 min-w-0 px-5 py-4 flex flex-col justify-center gap-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xl font-bold text-foreground leading-tight">{task.customerName}</span>
              {task.task_type === 'reinstallation' && (
                <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-full px-2 py-0.5 font-semibold">
                  إعادة تركيب رقم {task.reinstallation_number || 1}
                </span>
              )}
              {task.task_type === 'reinstallation' && (
                <span className="text-[10px] font-mono bg-orange-500/15 text-orange-400 border border-orange-500/25 rounded px-1.5 py-0.5">
                  re{task.reinstallation_number || 1}-{task.contract_id}
                </span>
              )}
            </div>
            {task.designName && task.designName !== '—' && (
              <span className="text-sm text-muted-foreground/80 truncate">{task.designName}</span>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-0.5">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                <FileText className="h-3.5 w-3.5 shrink-0 text-amber-500/70" />
                {task.isMerged ? (
                  <span className="flex items-center gap-1 flex-wrap">
                    {task.effectiveContractIds.slice(0, 3).map((cId: number) => (
                      <span key={cId} className="font-mono text-amber-400 font-semibold">#{cId}</span>
                    ))}
                    {task.effectiveContractIds.length > 3 && <span className="text-muted-foreground">+{task.effectiveContractIds.length - 3}</span>}
                    <span className="text-[10px] bg-orange-500/15 text-orange-400 border border-orange-500/20 rounded px-1">مدمجة</span>
                  </span>
                ) : (
                  <span className="font-mono text-amber-400 font-semibold">#{task.contractNumber}</span>
                )}
              </span>
              {task.installDate && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  {format(new Date(task.installDate), 'dd MMM yyyy', { locale: ar })}
                </span>
              )}
              {task.designDate && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Palette className="h-3.5 w-3.5 shrink-0 text-violet-500/70" />
                  <span className="text-violet-400">تصميم: {format(new Date(task.designDate), 'dd MMM yyyy', { locale: ar })}</span>
                </span>
              )}
              {task.team && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  <span className="truncate max-w-[150px]">{task.team.team_name}</span>
                </span>
              )}
              <span className="font-mono text-[10px] text-muted-foreground/40">#{task.id.slice(0, 8)}</span>
            </div>
            {/* مؤشرات الصور والتصاميم */}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                task.hasAllInstallPhotos
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                  : task.itemsWithInstallPhotos > 0
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                    : 'bg-red-500/10 text-red-400 border-red-500/25'
              }`}>
                <ImageIcon className="h-3 w-3" />
                صور التركيب: {task.itemsWithInstallPhotos}/{task.totalItems}
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                task.hasAllDesigns
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                  : task.itemsWithDesigns > 0
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                    : 'bg-red-500/10 text-red-400 border-red-500/25'
              }`}>
                <Palette className="h-3 w-3" />
                التصاميم: {task.itemsWithDesigns}/{task.totalItems}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/40 group-hover:text-amber-400/80 transition-colors font-medium">
              <ChevronRight className="h-3 w-3" />
              فتح التفاصيل
            </div>
          </div>
          <div className="w-[190px] shrink-0 px-5 py-4 flex flex-col justify-center gap-1 border-r border-border/30" onClick={e => e.stopPropagation()}>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-3xl font-bold text-foreground">{task.totalItems}</span>
              <span className="text-xs text-muted-foreground">لوحة</span>
            </div>
            <ProgressBar value={task.completionPct} total={task.totalItems} completed={task.completed} />
          </div>
          <div className="w-[130px] shrink-0 px-4 py-4 flex flex-col justify-center items-center gap-3 border-r border-border/30">
            <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold whitespace-nowrap ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />
              {cfg.label}
            </span>
            {task.totalCost > 0 && (
              <div className="text-center">
                <div className="flex items-baseline gap-1 justify-center">
                  <span className="text-base font-bold text-foreground">{task.totalCost.toLocaleString('ar-LY')}</span>
                  <span className="text-[10px] text-muted-foreground/60">د.ل</span>
                </div>
              </div>
            )}
          </div>
          <div className="w-[56px] shrink-0 flex flex-col items-center justify-center gap-1 px-1.5 py-2 border-r border-border/30 overflow-y-auto max-h-[240px]" onClick={e => e.stopPropagation()}>
            {deleteConfirmId === task.id ? (
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[9px] text-red-400 font-medium text-center leading-tight">تأكيد الحذف؟</span>
                <button onClick={() => { onDeleteTask(task.id); setDeleteConfirmId(null); }} className="w-full h-6 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/35 transition-colors px-1">نعم</button>
                <button onClick={() => setDeleteConfirmId(null)} className="w-full h-6 rounded-lg bg-muted/60 text-muted-foreground text-[10px] hover:bg-muted transition-colors px-1">لا</button>
              </div>
            ) : (
              <>
                <ActionBtn icon={FileText} label="فتح المهمة" onClick={() => onOpenTask(task.id)} />
                {onCompleteAllBillboards && task.completed < task.totalItems && (
                  <ActionBtn icon={CheckCircle2} label="إكمال جميع اللوحات" onClick={() => onCompleteAllBillboards(task.id)} />
                )}
                <ActionBtn icon={Printer} label="طباعة المهمة" onClick={() => onPrintTask(task.id)} />
                <ActionBtn icon={Layers} label="طباعة كل اللوحات" onClick={() => onPrintAll(task.id)} />
                <ActionBtn icon={ImageIcon} label="تعديل التصاميم" onClick={() => onDistributeDesigns(task.id)} />
                <ActionBtn icon={Palette} label="إدارة التصاميم" onClick={() => onManageDesigns(task.id)} />
                <ActionBtn icon={Plus} label="إضافة لوحة" onClick={() => onAddBillboard(task.id)} />
                <ActionBtn icon={Edit} label="تعديل" onClick={() => onEditTask(task.id)} />
                <ActionBtn icon={Trash2} label="حذف" onClick={() => setDeleteConfirmId(task.id)} danger />
              </>
            )}
          </div>
          <div className="w-[48px] shrink-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggle}
              className="border-muted-foreground/30 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col md:hidden">
        {/* Header row: status + customer + checkbox */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border/20">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            onClick={e => e.stopPropagation()}
            className="border-muted-foreground/30 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-foreground truncate">{task.customerName}</span>
              {task.task_type === 'reinstallation' && (
                <span className="text-[9px] bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-full px-1.5 py-0.5 font-semibold">
                  re{task.reinstallation_number || 1}-{task.contract_id}
                </span>
              )}
            </div>
            {task.designName && task.designName !== '—' && (
              <span className="text-xs text-muted-foreground/70 truncate block">{task.designName}</span>
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
            <FileText className="h-3 w-3 text-amber-500/70" />
            <span className="font-mono text-amber-400 font-semibold">#{task.isMerged ? task.effectiveContractIds[0] : task.contractNumber}</span>
            {task.isMerged && <span className="text-[9px] bg-orange-500/15 text-orange-400 rounded px-1">+{task.effectiveContractIds.length - 1}</span>}
          </span>
          {task.team && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground/50" />
              <span className="truncate max-w-[100px]">{task.team.team_name}</span>
            </span>
          )}
          {task.installDate && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-muted-foreground/50" />
              {format(new Date(task.installDate), 'dd/MM/yyyy', { locale: ar })}
            </span>
          )}
          {task.designDate && (
            <span className="flex items-center gap-1 text-violet-400">
              <Palette className="h-3 w-3 text-violet-500/70" />
              تصميم: {format(new Date(task.designDate), 'dd/MM', { locale: ar })}
            </span>
          )}
        </div>
        {/* مؤشرات الصور - موبايل */}
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-t border-border/20">
          <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${
            task.hasAllInstallPhotos ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : task.itemsWithInstallPhotos > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
              : 'bg-red-500/10 text-red-400 border-red-500/25'
          }`}>
            <ImageIcon className="h-2.5 w-2.5" />
            صور التركيب: {task.itemsWithInstallPhotos}/{task.totalItems}
          </span>
          <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${
            task.hasAllDesigns ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : task.itemsWithDesigns > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
              : 'bg-red-500/10 text-red-400 border-red-500/25'
          }`}>
            <Palette className="h-2.5 w-2.5" />
            التصاميم: {task.itemsWithDesigns}/{task.totalItems}
          </span>
        </div>

        {/* Progress row */}
        <div className="px-3 py-2 border-t border-border/20" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-foreground">{task.totalItems}</span>
            <span className="text-xs text-muted-foreground">لوحة</span>
            {task.totalCost > 0 && (
              <span className="mr-auto text-xs font-semibold text-foreground">{task.totalCost.toLocaleString('ar-LY')} <span className="text-[10px] text-muted-foreground/60">د.ل</span></span>
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
              <ActionBtn icon={FileText} label="فتح" onClick={() => onOpenTask(task.id)} />
              {onCompleteAllBillboards && task.completed < task.totalItems && (
                <ActionBtn icon={CheckCircle2} label="إكمال الكل" onClick={() => onCompleteAllBillboards(task.id)} />
              )}
              <ActionBtn icon={Printer} label="طباعة" onClick={() => onPrintTask(task.id)} />
              <ActionBtn icon={Layers} label="طباعة الكل" onClick={() => onPrintAll(task.id)} />
              <ActionBtn icon={ImageIcon} label="تعديل التصاميم" onClick={() => onDistributeDesigns(task.id)} />
              <ActionBtn icon={Plus} label="إضافة" onClick={() => onAddBillboard(task.id)} />
              <ActionBtn icon={Edit} label="تعديل" onClick={() => onEditTask(task.id)} />
              <ActionBtn icon={Trash2} label="حذف" onClick={() => setDeleteConfirmId(task.id)} danger />
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

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

/* ── Sort icon helper ── */
const SortIcon = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) =>
  sortField !== field
    ? <ArrowUpDown className="h-3 w-3 opacity-30" />
    : sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-amber-400" />
      : <ArrowDown className="h-3 w-3 text-amber-400" />;

export const InstallationTasksTable: React.FC<Props> = ({
  tasks, allTaskItems, billboardById, contractById, teamById,
  teams, designsByTask, installationPricingByBillboard,
  derivedContractIdsByTaskId,
  isLoading, stats,
  page, onPageChange,
  onOpenTask, onAddTask, onRefresh,
  onPrintTask, onPrintAll, onDistributeDesigns, onManageDesigns,
  onAddBillboard, onDeleteTask, onEditTask, onCompleteAllBillboards,
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterPhotos, setFilterPhotos] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const PAGE_SIZE = 15;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    onPageChange(1);
  };

  const enriched = useMemo(() => tasks.map(task => {
    const items = allTaskItems.filter(i => i.task_id === task.id);
    const effectiveContractIds = derivedContractIdsByTaskId?.get(task.id) 
      || (task.contract_ids && task.contract_ids.length > 0 ? task.contract_ids : [task.contract_id]);
    const isMerged = effectiveContractIds.length > 1;
    const contract = contractById[task.contract_id];
    const team = teamById[task.team_id];
    const completed = items.filter(i => i.status === 'completed').length;
    const totalCost = items.reduce((s, i) => s + (installationPricingByBillboard[i.billboard_id] || 0), 0);
    const displayStatus = getDisplayStatus(items);
    const installDate = items.find(i => i.installation_date)?.installation_date;
    const designs = designsByTask[task.id] || [];
    const designThumb = designs[0]?.design_face_a_url || null;
    const allDesignUrls = designs
      .flatMap((d: any) => [d.design_face_a_url, d.design_face_b_url].filter(Boolean))
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
    let h = 0;
    for (let i = 0; i < task.id.length; i++) h = task.id.charCodeAt(i) + ((h << 5) - h);
    const accent = `hsl(${Math.abs(h) % 360}, 55%, 58%)`;
    const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
    // نوع الإعلان: إذا مدمجة نجمع الأنواع الفريدة
    const adTypes = isMerged
      ? [...new Set(effectiveContractIds.map((cId: number) => contractById[cId]?.['Ad Type']).filter(Boolean))].join(' / ')
      : contract?.['Ad Type'];
    // حساب عدد صور التركيب والتصاميم المدخلة
    const itemsWithInstallPhotos = items.filter(i => i.installed_image_face_a_url || i.installed_image_face_b_url).length;
    const itemsWithDesigns = items.filter(i => i.design_face_a || i.design_face_b).length;
    const hasAllInstallPhotos = items.length > 0 && itemsWithInstallPhotos === items.length;
    const hasAllDesigns = items.length > 0 && itemsWithDesigns === items.length;

    return {
      ...task, items, contract, team, completed,
      totalItems: items.length, totalCost, displayStatus,
      installDate, designThumb, allDesignUrls, accent, completionPct: pct,
      customerName: contract?.['Customer Name'] || 'غير محدد',
      designName: adTypes || '—',
      contractNumber: task.contract_id,
      effectiveContractIds,
      isMerged,
      itemsWithInstallPhotos,
      itemsWithDesigns,
      hasAllInstallPhotos,
      hasAllDesigns,
      designDate: designs[0]?.created_at || null,
    };
  }), [tasks, allTaskItems, contractById, teamById, installationPricingByBillboard, designsByTask, derivedContractIdsByTaskId]);

  const filtered = useMemo(() => {
    let r = enriched;
    if (filterStatus !== 'all') r = r.filter(t => t.displayStatus === filterStatus);
    if (filterTeam !== 'all') r = r.filter(t => t.team_id === filterTeam);
    if (filterPhotos === 'no_install_photos') r = r.filter(t => !t.hasAllInstallPhotos);
    if (filterPhotos === 'no_designs') r = r.filter(t => !t.hasAllDesigns);
    if (filterPhotos === 'no_any') r = r.filter(t => !t.hasAllInstallPhotos || !t.hasAllDesigns);
    if (search) {
      const s = search.toLowerCase();
      r = r.filter(t =>
        t.customerName.toLowerCase().includes(s) ||
        String(t.contract_id).includes(s) ||
        t.designName.toLowerCase().includes(s) ||
        t.team?.team_name?.toLowerCase().includes(s) ||
        t.id.toLowerCase().includes(s)
      );
    }
    return r;
  }, [enriched, filterStatus, filterTeam, filterPhotos, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let av: any, bv: any;
    switch (sortField) {
      case 'client': av = a.customerName; bv = b.customerName; break;
      case 'contract': av = a.contract_id; bv = b.contract_id; break;
      case 'billboards': av = a.totalItems; bv = b.totalItems; break;
      case 'status': av = a.displayStatus; bv = b.displayStatus; break;
      case 'date': av = a.created_at; bv = b.created_at; break;
      case 'team': av = a.team?.team_name || ''; bv = b.team?.team_name || ''; break;
      case 'cost': av = a.totalCost; bv = b.totalCost; break;
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

  /* ── Sort pill button ── */
  const SortPill = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border ${
        sortField === field
          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
          : 'text-muted-foreground border-border/40 hover:text-amber-400 hover:border-amber-500/20'
      }`}
    >
      {label}
      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </button>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col h-full gap-4" dir="rtl">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
          {[
            { label: 'إجمالي المهام', value: stats.totalTasks, color: 'text-foreground', icon: LayoutList, accent: 'border-border' },
            { label: 'جديدة / معلقة', value: stats.pendingTasks, color: 'text-slate-400', icon: Clock, accent: 'border-slate-500/30' },
            { label: 'مكتملة', value: stats.completedTasks, color: 'text-emerald-400', icon: CheckCircle2, accent: 'border-emerald-500/30' },
            { label: 'إجمالي اللوحات', value: stats.totalBillboards, color: 'text-blue-400', icon: Layers, accent: 'border-blue-500/30' },
            { label: 'لوحات مركبة', value: stats.completedBillboards, color: 'text-amber-400', icon: CheckCircle2, accent: 'border-amber-500/30' },
          ].map(({ label, value, color, icon: Icon, accent }) => (
            <div key={label} className={`bg-card border ${accent} rounded-2xl p-4 flex items-center gap-3`}>
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
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              placeholder="بحث بالاسم، العقد، التصميم..."
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
              <SelectItem value="pending">جديدة</SelectItem>
              <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
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
          <Select value={filterPhotos} onValueChange={v => { setFilterPhotos(v); onPageChange(1); }}>
            <SelectTrigger className="w-[170px] h-9 bg-background border-border text-sm rounded-xl">
              <SelectValue placeholder="الصور" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المهام</SelectItem>
              <SelectItem value="no_install_photos">بدون صور تركيب</SelectItem>
              <SelectItem value="no_designs">بدون تصاميم</SelectItem>
              <SelectItem value="no_any">ناقصة الصور</SelectItem>
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
            <SortPill field="cost" label="التكلفة" />
            <SortPill field="billboards" label="اللوحات" />
          </div>

          <div className="mr-auto flex items-center gap-2">
            {selected.size > 0 && (
              <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
                {selected.size} محدد
              </span>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allOnPageSel}
                onCheckedChange={toggleAll}
                className="border-muted-foreground/30 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
              />
              <span className="text-xs text-muted-foreground">تحديد الكل</span>
            </div>
            <Button onClick={onAddTask} size="sm" className="h-9 gap-1.5 px-5 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl">
              <Plus className="h-4 w-4" />
              مهمة جديدة
            </Button>
          </div>
        </div>

        {/* ── Bulk Actions Bar ── */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="bg-amber-500/8 border border-amber-500/20 rounded-2xl px-5 py-3 flex flex-wrap gap-2.5 items-center shrink-0"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-400 font-bold text-sm">{selected.size} مهمة محددة</span>
              </div>
              <div className="w-px h-5 bg-amber-500/25 mx-1" />
              <Button size="sm" variant="ghost" className="h-8 px-3 text-xs gap-1.5 text-amber-400 hover:bg-amber-500/15 rounded-xl">
                <Printer className="h-3.5 w-3.5" /> طباعة المحدد
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-3 text-xs gap-1.5 text-blue-400 hover:bg-blue-500/15 rounded-xl">
                <ChevronDown className="h-3.5 w-3.5" /> تغيير الحالة
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-3 text-xs gap-1.5 text-slate-400 hover:bg-slate-500/15 rounded-xl">
                <Users className="h-3.5 w-3.5" /> تعيين فريق
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
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 - i * 0.15 }}
                transition={{ delay: i * 0.06 }}
              >
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
              const cfg = STATUS_CONFIG[task.displayStatus];
              const isSelected = selected.has(task.id);

              return (
                <TaskCardRowInner
                  key={task.id}
                  task={task}
                  idx={idx}
                  cfg={cfg}
                  isSelected={isSelected}
                  deleteConfirmId={deleteConfirmId}
                  onOpenTask={onOpenTask}
                  onToggle={() => toggleOne(task.id)}
                  onPrintTask={onPrintTask}
                  onPrintAll={onPrintAll}
                  onDistributeDesigns={onDistributeDesigns}
                  onManageDesigns={onManageDesigns}
                  onAddBillboard={onAddBillboard}
                  onDeleteTask={onDeleteTask}
                  setDeleteConfirmId={setDeleteConfirmId}
                  onEditTask={onEditTask}
                  onCompleteAllBillboards={onCompleteAllBillboards}
                />
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
                    className={`h-7 w-7 p-0 text-xs rounded-lg ${p === page ? 'bg-amber-500 hover:bg-amber-600 text-black font-bold' : 'bg-transparent hover:bg-muted/50 text-muted-foreground border border-transparent'}`}
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
