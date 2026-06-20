import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  ArrowRight, CheckCircle2, Clock, Package, Users, MapPin,
  Phone, FileText, Building2, ChevronDown, ChevronUp, Printer,
  Edit, Plus, RefreshCw, Save, AlertCircle, Image, XCircle,
  Calendar as CalendarIcon, Layers, Wrench, Search, X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BillboardTaskCard } from '@/components/tasks/BillboardTaskCard';
import { TaskTotalCostSummary } from '@/components/tasks/TaskTotalCostSummary';
import ImageLightbox from '@/components/Map/ImageLightbox';
// Calendar and Popover kept for potential future use

interface Props {
  task: any;
  taskItems: any[];
  taskDesigns: any[];
  contract: any;
  team: any;
  billboardById: Record<number, any>;
  contractById?: Record<number, any>;
  installationPricingByBillboard: Record<number, number>;
  sizeOrderMap?: Record<string, number>;
  selectedItemsForCompletion: string[];
  selectedItemsForDate: string[];
  showCompletionDialog: boolean;
  selectedTaskIdForCompletion: string | null;
  derivedContractIds?: number[];
  onBack: () => void;
  onManageDesigns: () => void;
  onDistributeDesigns: () => void;
  onEditTaskType: () => void;
  onTransferBillboards: () => void;
  onPrintAll: () => void;
  onDelete: () => void;
  onCreatePrintTask: () => void;
  onCompleteBillboards: () => void;
  onSetInstallationDate: () => void;
  onAddBillboards: () => void;
  onCreateCompositeTask?: () => void;
  onUnmerge?: () => void;
  onDeletePrintTask?: () => void;
  onNavigateToPrint: () => void;
  onNavigateToCutout: () => void;
  onSelectionChange: (itemId: string, checked: boolean) => void;
  onUncomplete: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onAddInstalledImage: (item: any) => void;
  onPrintBillboard: (taskId: string) => void;
  onRefreshItems: () => void;
  isMergedTask: boolean;
  onDuplicateAsReinstallation?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  completed: { label: 'مكتملة', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  pending: { label: 'جديدة', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' },
  cancelled: { label: 'ملغاة', color: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400' },
};

function getDisplayStatus(items: any[]) {
  if (!items.length) return 'pending';
  const completed = items.filter(i => i.status === 'completed').length;
  if (completed === items.length) return 'completed';
  if (completed > 0) return 'in_progress';
  return 'pending';
}

export const InstallationTaskDetail: React.FC<Props> = ({
  task,
  taskItems,
  taskDesigns,
  contract,
  team,
  billboardById,
  contractById = {},
  installationPricingByBillboard,
  sizeOrderMap = {},
  selectedItemsForCompletion,
  selectedItemsForDate,
  showCompletionDialog,
  selectedTaskIdForCompletion,
  derivedContractIds,
  onBack,
  onManageDesigns,
  onDistributeDesigns,
  onEditTaskType,
  onTransferBillboards,
  onPrintAll,
  onDelete,
  onCreatePrintTask,
  onCompleteBillboards,
  onSetInstallationDate,
  onAddBillboards,
  onCreateCompositeTask,
  onUnmerge,
  onDeletePrintTask,
  onNavigateToPrint,
  onNavigateToCutout,
  onSelectionChange,
  onUncomplete,
  onDeleteItem,
  onAddInstalledImage,
  onPrintBillboard,
  onRefreshItems,
  isMergedTask,
  onDuplicateAsReinstallation,
}) => {
  // استخدام derivedContractIds لتحديد العقود الفعلية للمهمة
  const effectiveContractIds = derivedContractIds && derivedContractIds.length > 0
    ? derivedContractIds
    : (task.contract_ids && task.contract_ids.length > 0 ? task.contract_ids : [task.contract_id]);
  const completedItems = taskItems.filter(i => i.status === 'completed').length;
  const completionPct = taskItems.length > 0 ? Math.round((completedItems / taskItems.length) * 100) : 0;
  const displayStatus = getDisplayStatus(taskItems);
  const cfg = STATUS_CONFIG[displayStatus];
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const totalCost = taskItems.reduce((sum, item) => {
    const hasCost = item.company_installation_cost !== null && item.company_installation_cost !== undefined;
    const cost = hasCost ? item.company_installation_cost : (installationPricingByBillboard[item.billboard_id] || 0);
    return sum + cost;
  }, 0);
  const designImage = taskDesigns[0]?.design_face_a_url || taskItems.find(i => i.design_face_a)?.design_face_a;
  const firstInstallDate = taskItems.find(i => i.installation_date)?.installation_date;

  // ترتيب اللوحات حسب sort_order من sizes ثم البلدية ثم رقم اللوحة (ثابت)
  const sortBillboards = useCallback((list: typeof billboardsWithData) => {
    return [...list].sort((a, b) => {
      const sizeA = a.billboard?.Size || '';
      const sizeB = b.billboard?.Size || '';
      const orderA = sizeOrderMap[sizeA] ?? 999;
      const orderB = sizeOrderMap[sizeB] ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      const munA = a.billboard?.Municipality || '';
      const munB = b.billboard?.Municipality || '';
      const munCmp = munA.localeCompare(munB, 'ar');
      if (munCmp !== 0) return munCmp;
      // ترتيب ثابت حسب رقم اللوحة لمنع التحرك عند التحديث
      return (a.item.billboard_id || 0) - (b.item.billboard_id || 0);
    });
  }, [sizeOrderMap]);

  const billboardsWithData = useMemo(() =>
    taskItems.map(item => ({
      item,
      billboard: billboardById[item.billboard_id],
      price: installationPricingByBillboard[item.billboard_id] || 0,
    })),
    [taskItems, billboardById, installationPricingByBillboard]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [inlineDate] = useState<Date | undefined>(undefined);

  const filterBySearch = useCallback((list: typeof billboardsWithData) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter(({ item, billboard }) => {
      const name = (billboard?.Billboard_Name || '').toLowerCase();
      const id = String(item.billboard_id);
      const city = (billboard?.City || '').toLowerCase();
      const municipality = (billboard?.Municipality || '').toLowerCase();
      const landmark = (billboard?.Nearest_Landmark || '').toLowerCase();
      const size = (billboard?.Size || '').toLowerCase();
      return name.includes(q) || id.includes(q) || city.includes(q) || municipality.includes(q) || landmark.includes(q) || size.includes(q);
    });
  }, [searchQuery]);

  const replacedBillboards = useMemo(() =>
    filterBySearch(sortBillboards(billboardsWithData.filter(b => 
      b.item.replacement_status === 'replaced' || b.item.replacement_status === 'reinstalled'
    ))),
    [billboardsWithData, sortBillboards, filterBySearch]
  );

  const replacedIds = useMemo(() => new Set(replacedBillboards.map(b => b.item.id)), [replacedBillboards]);

  const incompleteBillboards = useMemo(() =>
    filterBySearch(sortBillboards(billboardsWithData.filter(b => 
      b.item.status !== 'completed' && !replacedIds.has(b.item.id)
    ))),
    [billboardsWithData, sortBillboards, filterBySearch, replacedIds]
  );
  const completedBillboards = useMemo(() =>
    filterBySearch(sortBillboards(billboardsWithData.filter(b => 
      b.item.status === 'completed' && !replacedIds.has(b.item.id)
    ))),
    [billboardsWithData, sortBillboards, filterBySearch, replacedIds]
  );

  const selectedCount = selectedItemsForCompletion.length + selectedItemsForDate.length;
  const hasSelection = selectedCount > 0;

  // ── Paused billboards + replacements maps (keep replaced billboards in tasks with badges) ──
  const [pausedMap, setPausedMap] = useState<Record<number, { pauseDate?: string }>>({});
  const [replacementMap, setReplacementMap] = useState<Record<number, { replacedName?: string; startDate?: string }>>({});

  useEffect(() => {
    const ids = (effectiveContractIds || []).map((x: any) => Number(x)).filter(Boolean);
    if (ids.length === 0) {
      setPausedMap({});
      setReplacementMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [{ data: paused }, { data: reps }] = await Promise.all([
          supabase
            .from('paused_billboards' as any)
            .select('billboard_id, pause_date')
            .in('contract_number', ids),
          supabase
            .from('paused_billboard_replacements' as any)
            .select('replacement_billboard_id, start_date, paused_billboard_id')
            .in('contract_number', ids),
        ]);
        if (cancelled) return;
        const pMap: Record<number, { pauseDate?: string }> = {};
        (paused || []).forEach((p: any) => {
          if (p?.billboard_id != null) pMap[Number(p.billboard_id)] = { pauseDate: p.pause_date };
        });

        // Resolve replaced billboard names via paused_billboards lookup
        const pausedIds = Array.from(new Set((reps || []).map((r: any) => r?.paused_billboard_id).filter(Boolean)));
        let nameByPausedId: Record<string, string> = {};
        if (pausedIds.length > 0) {
          const { data: pBoards } = await supabase
            .from('paused_billboards' as any)
            .select('id, billboard_id, billboard_name')
            .in('id', pausedIds);
          (pBoards || []).forEach((pb: any) => {
            nameByPausedId[String(pb.id)] = pb.billboard_name || (pb.billboard_id != null ? `لوحة #${pb.billboard_id}` : '');
          });
        }
        const rMap: Record<number, { replacedName?: string; startDate?: string }> = {};
        (reps || []).forEach((r: any) => {
          if (r?.replacement_billboard_id != null) {
            rMap[Number(r.replacement_billboard_id)] = {
              replacedName: nameByPausedId[String(r.paused_billboard_id)],
              startDate: r.start_date,
            };
          }
        });
        setPausedMap(pMap);
        setReplacementMap(rMap);
      } catch (e) {
        console.warn('Failed to load paused/replacement maps:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(effectiveContractIds)]);

  const handleApplyFacesToAll = useCallback(async (faces: number) => {
    const ids = incompleteBillboards.map(b => b.item.id);
    if (!ids.length) return;
    const { error } = await supabase
      .from('installation_task_items')
      .update({ faces_to_install: faces } as any)
      .in('id', ids);
    if (error) {
      toast.error('فشل في تعميم الوجه');
    } else {
      toast.success(`تم تعميم "${faces === 1 ? 'وجه واحد' : 'وجهان'}" على ${ids.length} لوحة`);
      onRefreshItems();
    }
  }, [incompleteBillboards, onRefreshItems]);

  return (
    <div className="flex flex-col bg-background/95 min-h-screen" dir="rtl">
      {/* ── Top Nav Bar ── */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-card/65 backdrop-blur-md border-b border-border/40 sticky top-0 z-10 shadow-sm transition-all duration-200">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/65 border-border/40 h-9 px-4 rounded-xl shadow-sm transition-all hover:scale-[1.02]"
        >
          <ArrowRight className="h-4 w-4 text-primary dark:text-white" />
          العودة
        </Button>
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <span className="text-muted-foreground/60">مهام التركيب</span>
          <span className="text-muted-foreground/30">/</span>
          <span className="font-bold text-foreground truncate max-w-[200px]">
            {contract?.['Customer Name'] || 'غير محدد'}
          </span>
          <span className="text-muted-foreground/30">/</span>
          <span className="text-xs font-mono text-muted-foreground/50 bg-muted px-2 py-0.5 rounded-lg border border-border/20">#{task.id.slice(0, 8)}</span>
        </div>

        <div className="mr-auto flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          {task.task_type === 'reinstallation' && (
            <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded px-1.5 py-0.5">
              إعادة تركيب رقم {task.reinstallation_number || 1}
            </span>
          )}
          {task.task_type === 'reinstallation' && (
            <span className="text-[10px] font-mono bg-orange-500/15 text-orange-400 border border-orange-500/25 rounded px-1.5 py-0.5">
              re{task.reinstallation_number || 1}-{task.contract_id}
            </span>
          )}
        </div>
      </div>

      {/* External actions grid removed — actions restored inside the right Info Panel below */}

      {/* ── Split Layout ── */}
      <div className="flex flex-col lg:flex-row">

        {/* ── RIGHT: Info Panel ── */}
        <div className="w-full lg:w-80 xl:w-96 shrink-0 border-b lg:border-b-0 lg:border-l border-border bg-card flex flex-col">

          {/* Design Preview */}
          <div className="aspect-video bg-muted/50 relative overflow-hidden border-b border-border shrink-0">
            {designImage ? (
              <div 
                className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightboxImage(designImage)}
              >
                <img
                  src={designImage}
                  alt="تصميم الإعلان"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Image className="h-10 w-10 opacity-30" />
                <span className="text-xs">لا يوجد تصميم</span>
                <Button variant="outline" size="sm" onClick={onManageDesigns} className="text-xs h-7 mt-1">
                  إضافة تصميم
                </Button>
              </div>
            )}
            {designImage && (
              <div className="absolute bottom-2 right-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onManageDesigns}
                  className="h-6 text-[10px] px-2 bg-black/60 text-white border-0 hover:bg-black/80"
                >
                  <Edit className="h-2.5 w-2.5 mr-1" />
                  إدارة التصاميم
                </Button>
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="p-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">تقدم التنفيذ</span>
              <span className="text-sm font-bold text-foreground">{completionPct}%</span>
            </div>
            <Progress value={completionPct} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1.5">
              {completedItems} من {taskItems.length} لوحة مكتملة
            </p>
          </div>

          {/* Client Info */}
          <div className="p-4 border-b border-border shrink-0 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">معلومات العميل</h3>
            {[
              { icon: Building2, label: 'العميل', value: contract?.['Customer Name'] },
              { icon: Package, label: 'عدد اللوحات', value: `${taskItems.length} لوحة` },
              { icon: Users, label: 'فريق التركيب', value: team?.team_name },
              { icon: CalendarIcon, label: 'تاريخ التركيب', value: firstInstallDate ? format(new Date(firstInstallDate), 'dd MMM yyyy', { locale: ar }) : undefined },
              { icon: Layers, label: 'تاريخ إدخال التصاميم', value: taskDesigns.length > 0 && taskDesigns[0]?.created_at ? format(new Date(taskDesigns[0].created_at), 'dd MMM yyyy', { locale: ar }) + (taskDesigns.length > 1 ? ` (${taskDesigns.length} تصاميم)` : '') : undefined },
            ].map(({ icon: Icon, label, value }) => value && (
              <div key={label} className="flex items-start gap-3">
                <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
                  <p className="text-xs font-bold text-foreground truncate">{value}</p>
                </div>
              </div>
            ))}
            {/* عرض العقود (واحد أو متعددة) */}
            <div className="flex items-start gap-2.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">{effectiveContractIds.length > 1 ? 'أرقام العقود' : 'رقم العقد'}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {effectiveContractIds.map((cId: number) => {
                    const c = contractById[cId];
                    return (
                      <div key={cId} className="flex items-center gap-1">
                        <span className="text-xs font-mono font-bold text-amber-400">#{cId}</span>
                        {c?.['Ad Type'] && <span className="text-[10px] text-muted-foreground">({c['Ad Type']})</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {effectiveContractIds.length > 1 && (
              <div className="mt-1 px-2 py-1 rounded bg-orange-500/10 border border-orange-500/20">
                <p className="text-[10px] font-medium text-orange-400">مهمة مدمجة من {effectiveContractIds.length} عقود</p>
              </div>
            )}
          </div>

          {/* Cost Summary */}
          <div className="p-4 border-b border-border shrink-0">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">ملخص التكاليف</h3>
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">تكلفة التركيب</span>
                <span className="font-semibold text-foreground">{totalCost.toLocaleString('ar-LY')} د.ل</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">عدد اللوحات</span>
                <span className="font-semibold">{taskItems.length}</span>
              </div>
              {totalCost > 0 && taskItems.length > 0 && (
                <div className="flex justify-between text-xs border-t border-border pt-2 mt-2">
                  <span className="text-muted-foreground">متوسط لكل لوحة</span>
                  <span className="font-semibold">{Math.round(totalCost / taskItems.length).toLocaleString('ar-LY')} د.ل</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions (restored to sidebar) */}
          <div className="p-5 border-b border-border/40 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-4">الإجراءات</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { onClick: onManageDesigns, icon: Edit, label: 'إدارة التصاميم', color: 'text-foreground' },
                { onClick: onDistributeDesigns, icon: Layers, label: 'توزيع التصاميم', color: 'text-amber-500' },
                { onClick: onAddBillboards, icon: Plus, label: 'إضافة لوحات', color: 'text-emerald-500' },
                { onClick: onCompleteBillboards, icon: CheckCircle2, label: 'إكمال لوحات', color: 'text-emerald-500' },
                { onClick: onCreatePrintTask, icon: Printer, label: task.print_task_id ? 'مهمة طباعة مرتبطة' : 'إنشاء مهمة طباعة', color: 'text-blue-500', disabled: !!task.print_task_id },
                { onClick: onTransferBillboards, icon: ArrowRight, label: 'نقل لوحات', color: 'text-foreground' },
                { onClick: onPrintAll, icon: Printer, label: 'طباعة الكل', color: 'text-foreground' },
                ...(onCreateCompositeTask ? [{ onClick: onCreateCompositeTask, icon: Layers, label: 'إنشاء مهمة مجمعة', color: 'text-purple-500' }] : []),
                ...(isMergedTask && onUnmerge ? [{ onClick: onUnmerge, icon: AlertCircle, label: 'إلغاء الدمج', color: 'text-orange-500' }] : []),
                ...(onDuplicateAsReinstallation ? [{ onClick: onDuplicateAsReinstallation, icon: RefreshCw, label: 'تكرار كإعادة تركيب', color: 'text-amber-600' }] : []),
              ].map(({ onClick, icon: Icon, label, color, disabled }) => (
                <Button
                  key={label}
                  variant="outline"
                  onClick={onClick}
                  disabled={disabled}
                  className="h-16 flex-col gap-1.5 px-2 py-2 border-border/40 bg-muted/10 hover:bg-primary/5 hover:border-primary/30 text-[11px] font-semibold whitespace-normal text-center leading-tight transition-all duration-200 hover:scale-[1.03] rounded-xl"
                >
                  <Icon className={`h-4.5 w-4.5 ${color}`} />
                  <span>{label}</span>
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={onDelete}
              className="mt-3.5 w-full h-11 gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40 rounded-xl transition-all duration-200"
            >
              <XCircle className="h-4 w-4" />
              حذف المهمة
            </Button>
          </div>

        </div>

        {/* ── LEFT: Main Content Panel ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 p-4 lg:p-6">

          {/* Cost Summary Component */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-400" />
                ملخص تكاليف التركيب
              </h2>
            </div>
            <div className="p-4">
              <TaskTotalCostSummary
                taskId={task.id}
                taskItems={taskItems}
                installationPrices={installationPricingByBillboard}
                billboards={billboardById}
                onRefresh={onRefreshItems}
              />
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground/60" />
            <Input
              placeholder="بحث عن لوحة... (الاسم، الرقم، المدينة، الحجم)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pr-11 h-11 bg-card/50 border-border/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-xl"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-muted/65 rounded-lg"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Inline Floating Action Bar when items selected */}
          <AnimatePresence>
            {hasSelection && !showCompletionDialog && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-primary/95 backdrop-blur-md text-primary-foreground px-4 py-3.5 rounded-2xl flex items-center gap-3 flex-wrap justify-between shadow-lg border border-primary/20"
              >
                <Badge variant="secondary" className="bg-white/15 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg">
                  {selectedCount} لوحة محددة
                </Badge>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={onCompleteBillboards}
                    className="gap-1.5 bg-white text-primary hover:bg-white/90 h-9 px-4 text-xs font-bold rounded-xl shadow-sm hover:scale-[1.02] transition-transform"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    إكمال اللوحات
                  </Button>
                  <Button
                    size="sm"
                    onClick={onSetInstallationDate}
                    variant="secondary"
                    className="gap-1.5 bg-white/15 hover:bg-white/25 text-white border-0 h-9 px-4 text-xs font-bold rounded-xl hover:scale-[1.02] transition-transform"
                  >
                    <CalendarIcon className="h-4 w-4 text-white" />
                    تحديد تاريخ التركيب
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Incomplete Billboards */}
          {incompleteBillboards.length > 0 && (
            <BillboardSection
              title={`لوحات قيد التنفيذ (${incompleteBillboards.length})`}
              icon={<Clock className="h-4 w-4 text-amber-400" />}
              defaultOpen
              highlight
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {incompleteBillboards.map(({ item, billboard, price }) => (
                  <BillboardTaskCard
                    key={item.id}
                    item={item}
                    billboard={billboard}
                    installationPrice={price}
                    isSelected={selectedItemsForCompletion.includes(item.id) || selectedItemsForDate.includes(item.id)}
                    isCompleted={false}
                    taskDesigns={taskDesigns}
                    allItems={taskItems}
                    onDelete={() => onDeleteItem(item.id)}
                    onSelectionChange={checked => onSelectionChange(item.id, checked)}
                    onUncomplete={undefined}
                    onEditDesign={onManageDesigns}
                    onPrint={() => onPrintBillboard(item.task_id)}
                    onAddInstalledImage={() => onAddInstalledImage(item)}
                    onRefresh={onRefreshItems}
                    onApplyFacesToAll={handleApplyFacesToAll}
                    pausedInfo={pausedMap[Number(item.billboard_id)]}
                    replacementInfo={replacementMap[Number(item.billboard_id)]}
                  />
                ))}
              </div>
            </BillboardSection>
          )}

          {/* Completed Billboards */}
          {completedBillboards.length > 0 && (
            <BillboardSection
              title={`لوحات مكتملة (${completedBillboards.length})`}
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              defaultOpen={true}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {completedBillboards.map(({ item, billboard, price }) => (
                  <BillboardTaskCard
                    key={item.id}
                    item={item}
                    billboard={billboard}
                    installationPrice={price}
                    isSelected={selectedItemsForCompletion.includes(item.id) || selectedItemsForDate.includes(item.id)}
                    isCompleted
                    taskDesigns={taskDesigns}
                    allItems={taskItems}
                    onDelete={undefined}
                    onSelectionChange={checked => onSelectionChange(item.id, checked)}
                    onUncomplete={() => onUncomplete(item.id)}
                    onEditDesign={onManageDesigns}
                    onPrint={() => onPrintBillboard(item.task_id)}
                    onAddInstalledImage={() => onAddInstalledImage(item)}
                    onRefresh={onRefreshItems}
                    pausedInfo={pausedMap[Number(item.billboard_id)]}
                    replacementInfo={replacementMap[Number(item.billboard_id)]}
                  />
                ))}
              </div>
            </BillboardSection>
          )}

          {/* Replaced / Reinstalled Billboards */}
          {replacedBillboards.length > 0 && (
            <BillboardSection
              title={`لوحات مستبدلة / معاد تركيبها (${replacedBillboards.length})`}
              icon={<RefreshCw className="h-4 w-4 text-orange-400" />}
              defaultOpen={true}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {replacedBillboards.map(({ item, billboard, price }) => (
                  <BillboardTaskCard
                    key={item.id}
                    item={item}
                    billboard={billboard}
                    installationPrice={price}
                    isSelected={selectedItemsForCompletion.includes(item.id) || selectedItemsForDate.includes(item.id)}
                    isCompleted={item.status === 'completed'}
                    taskDesigns={taskDesigns}
                    allItems={taskItems}
                    onDelete={undefined}
                    onSelectionChange={checked => onSelectionChange(item.id, checked)}
                    onUncomplete={item.status === 'completed' ? () => onUncomplete(item.id) : undefined}
                    onEditDesign={onManageDesigns}
                    onPrint={() => onPrintBillboard(item.task_id)}
                    onAddInstalledImage={() => onAddInstalledImage(item)}
                    onRefresh={onRefreshItems}
                    pausedInfo={pausedMap[Number(item.billboard_id)]}
                    replacementInfo={replacementMap[Number(item.billboard_id)]}
                  />
                ))}
              </div>
            </BillboardSection>
          )}

          {taskItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground bg-card border border-border rounded-xl">
              <Package className="h-12 w-12 opacity-30" />
              <p>لا توجد لوحات في هذه المهمة</p>
              <Button variant="outline" size="sm" onClick={onAddBillboards}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                إضافة لوحات
              </Button>
            </div>
          )}
        </div>
      </div>
      {/* Lightbox لتكبير الصور */}
      {lightboxImage && createPortal(
        <ImageLightbox
          imageUrl={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />,
        document.body
      )}
    </div>
  );
};

// Accordion Section Helper
const BillboardSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  highlight?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, defaultOpen = false, highlight, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  // Update open state when defaultOpen changes (e.g. when a billboard moves from pending to completed)
  const prevDefaultOpen = React.useRef(defaultOpen);
  React.useEffect(() => {
    if (prevDefaultOpen.current !== defaultOpen) {
      prevDefaultOpen.current = defaultOpen;
      setOpen(defaultOpen);
    }
  }, [defaultOpen]);
  return (
    <div className={`bg-card border rounded-xl overflow-hidden ${highlight ? 'border-amber-500/30' : 'border-border'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted/30 ${highlight ? 'border-b border-amber-500/20' : 'border-b border-border'}`}
      >
        <span className="flex items-center gap-2 text-foreground">
          {icon}
          {title}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
