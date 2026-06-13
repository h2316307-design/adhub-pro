// @ts-nocheck
import React, { useEffect, useRef, useState, useDeferredValue } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BillboardImage } from '@/components/BillboardImage';
import { BillboardImageZoom } from './BillboardImageZoom';
import {
  PauseCircle, Trash2, Save, Calendar, RotateCcw,
  Printer, Wrench, Clock, Repeat2, X as XIcon,
} from 'lucide-react';
import { formatAmount } from '@/lib/formatUtils';
import { updatePausedBillboard, deletePausedBillboard, resumePausedBillboard } from '@/services/pausedBillboardsService';
import {
  getReplacementByPausedId,
  removeReplacement,
  type PausedBillboardReplacement,
} from '@/services/pausedBillboardReplacementService';
import { ReplacePausedBillboardDialog } from './ReplacePausedBillboardDialog';
import type { PausedItemWithPricing } from '@/hooks/usePausedBillboardsPricing';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { toast } from 'sonner';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Info } from 'lucide-react';


interface Props {
  item: PausedItemWithPricing;
  highlight?: boolean;
  onChanged?: () => void;
  contractStartDate?: string | null;
  printCostEnabled?: boolean;
  includePrintInPrice?: boolean;
  installationEnabled?: boolean;
  includeInstallationInPrice?: boolean;
  currencySymbol?: string;
  onToggleSingleFace?: (billboardId: string) => void;
  pricingMode?: 'months' | 'days';
  durationMonths?: number;
  durationDays?: number;
}

function PausedBillboardCardImpl({
  item,
  highlight,
  onChanged,
  contractStartDate,
  printCostEnabled = false,
  includePrintInPrice = true,
  installationEnabled = false,
  includeInstallationInPrice = true,
  currencySymbol = 'د.ل',
  onToggleSingleFace,
  pricingMode = 'months',
  durationMonths = 0,
  durationDays = 0,
}: Props) {
  const { confirm } = useSystemDialog();
  const raw = item.raw;
  const bb = item.billboard || {};
  const billboardId = String(raw.billboard_id);

  // Default pause date = stored value, else effectivePauseDate from hook (today clamped to source span)
  const defaultPauseDate = raw.pause_date || item.effectivePauseDate || contractStartDate || '';
  const [pauseDate, setPauseDate] = useState(defaultPauseDate);
  const [manualRefund, setManualRefund] = useState<number | null>(
    item.isManualRefund ? Number(raw.manual_refund) : null
  );
  // ✅ Defer heavy recalculation until user stops typing — fields stay snappy
  const deferredPauseDate = useDeferredValue(pauseDate);
  const deferredManualRefund = useDeferredValue(manualRefund);
  const [saving, setSaving] = useState(false);
  const [replacement, setReplacement] = useState<PausedBillboardReplacement | null>(null);
  const [replacementBillboard, setReplacementBillboard] = useState<any>(null);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);

  useEffect(() => {
    setPauseDate(raw.pause_date || item.effectivePauseDate || contractStartDate || '');
    setManualRefund(item.isManualRefund ? Number(raw.manual_refund) : null);
  }, [raw.id, raw.pause_date, raw.manual_refund, item.isManualRefund, item.effectivePauseDate, contractStartDate]);

  // Load replacement if any
  const loadReplacement = React.useCallback(async () => {
    try {
      const r = await getReplacementByPausedId(raw.id);
      setReplacement(r);
      if (r) {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, City, Size, Image_URL, Nearest_Landmark, Price')
          .eq('ID', r.replacement_billboard_id)
          .maybeSingle();
        setReplacementBillboard(data || null);

        // Replacement sync is now centralised in ContractEdit (on load via
        // syncContractIdsWithPaused). No need to re-heal here or reload.
      } else {
        setReplacementBillboard(null);
      }
    } catch (e) {
      console.warn('loadReplacement failed', e);
    }
  }, [raw.id]);

  useEffect(() => { loadReplacement(); }, [loadReplacement]);

  const handleRemoveReplacement = async () => {
    if (!replacement) return;
    const ok = await confirm({
      title: 'إلغاء التبديل',
      message: 'هل تريد إلغاء تبديل اللوحة الموقوفة وإزالة البديلة من العقد؟',
      confirmText: 'إلغاء التبديل',
      cancelText: 'تراجع',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await removeReplacement(replacement.id);
      toast.success('تم إلغاء التبديل');
      await loadReplacement();
      onChanged?.();
    } catch (e: any) {
      toast.error('فشل: ' + (e?.message || ''));
    }
  };

  const name = bb.Billboard_Name || bb.name || raw.billboard_name || `#${raw.billboard_id}`;
  const sourceContract = (raw as any).source_contract_number || (raw as any).original_contract_number;

  // Round refund to nearest 50 LYD for clean readable numbers
  const roundToBucket = (v: number, bucket = 50) =>
    !Number.isFinite(v) || bucket <= 0 ? Math.round(v || 0) : Math.round(v / bucket) * bucket;

  // Live preview based on edits
  const previewElapsed = (() => {
    if (!deferredPauseDate || item.totalDays <= 0) return item.elapsedDays;
    const start = (raw as any).original_start_date || contractStartDate || null;
    if (!start) return item.elapsedDays;
    return Math.max(
      0,
      Math.min(item.totalDays, Math.round((new Date(deferredPauseDate).getTime() - new Date(start).getTime()) / 86400000))
    );
  })();
  const previewRemaining = Math.max(0, item.totalDays - previewElapsed);
  // ✅ Refund is calculated on RENTAL ONLY. Print & install are non-refundable.
  const rentalBase = Math.max(0, Math.round((item as any).rentalBase ?? item.netRentalAfterDiscount ?? 0));
  const nonRefundable = Math.max(0, ((item as any).printAdded || 0) + ((item as any).installAdded || 0));
  const previewRefundAutoRaw = (rentalBase * previewRemaining) / Math.max(1, item.totalDays);
  const previewRefundAuto = Math.min(rentalBase, roundToBucket(previewRefundAutoRaw, 50));
  const previewConsumedAuto = Math.max(0, rentalBase - previewRefundAuto) + nonRefundable;
  const effectiveRefund = deferredManualRefund === null
    ? previewRefundAuto
    : Math.min(rentalBase, Math.max(0, Number(deferredManualRefund)));
  const effectiveConsumedRental = Math.max(0, rentalBase - effectiveRefund);
  const effectiveConsumed = effectiveConsumedRental + nonRefundable;

  const dirty =
    pauseDate !== (raw.pause_date || '') ||
    (manualRefund === null) !== !item.isManualRefund ||
    (manualRefund !== null && Number(manualRefund) !== Number(raw.manual_refund || 0));

  const isSingleFace = item.isSingleFace;

  const handleSave = async () => {
    try {
      setSaving(true);
      await updatePausedBillboard(raw.id, {
        pause_date: pauseDate,
        manual_refund: manualRefund,
        refund_amount: effectiveRefund,
        consumed_amount: effectiveConsumed,
        full_price: item.fullPrice,
      });
      toast.success('تم حفظ التعديلات');
      onChanged?.();
    } catch (e: any) {
      toast.error('فشل الحفظ: ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  // 🔄 Auto-persist computed pause pricing whenever the stored DB values
  // drift from the live calculation (not just when they're zero). This
  // ensures stale legacy rows (e.g. consumed=7250, full=8700 from old
  // pricing logic) get rewritten with the correct values that match the
  // billboard card so the print/PDF table reads matching numbers.
  const autoSyncedRef = useRef<string | null>(null);
  const autoSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (item.fullPrice <= 0) return;
    if (item.isManualRefund) return; // respect manual override
    const dbConsumed = Number((raw as any).consumed_amount) || 0;
    const dbFull = Number((raw as any).full_price) || 0;
    const dbRefund = Number((raw as any).refund_amount) || 0;
    const dbBefore = Number((raw as any).price_before_discount) || 0;
    const dbNetAfter = Number((raw as any).net_after_discount) || 0;
    // ✅ منع تذبذب قيمة الإيقاف بين الزيارات:
    // الـ Auto-sync لا يعمل إلا للصفوف القديمة التي لم تُكتب فيها أي قيمة من قبل
    // (legacy rows). بمجرد أن تُحفظ القيم، تبقى ثابتة في DB ولا يُعاد حسابها
    // تلقائياً عند كل فتح للعقد. أي تعديل لاحق يجب أن يتم يدوياً.
    const hasPersistedValues = dbFull > 0 || dbConsumed > 0 || dbRefund > 0;
    if (hasPersistedValues) return;
    const newBefore = Math.round(item.baseRental || 0);
    // Middle strikethrough in print = "Final Total" (totalForBoard / fullPrice), not netRentalAfterDiscount.
    const newNetAfter = Math.round((item as any).totalForBoard || item.fullPrice || 0);
    const drift =
      Math.abs(dbConsumed - effectiveConsumed) > 1 ||
      Math.abs(dbFull - item.fullPrice) > 1 ||
      Math.abs(dbRefund - effectiveRefund) > 1 ||
      Math.abs(dbBefore - newBefore) > 1 ||
      Math.abs(dbNetAfter - newNetAfter) > 1;
    if (!drift) return;
    const syncKey = `${raw.id}|${Math.round(item.fullPrice)}|${Math.round(effectiveConsumed)}|${Math.round(effectiveRefund)}|${newBefore}|${newNetAfter}`;
    if (autoSyncedRef.current === syncKey) return;
    // ✅ Debounce auto-sync — avoids hammering the DB on every keystroke and
    // breaks the re-fetch loop that caused the page to "vibrate" while typing.
    if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current);
    autoSyncTimerRef.current = setTimeout(async () => {
      autoSyncedRef.current = syncKey;
      try {
        await updatePausedBillboard(raw.id, {
          pause_date: deferredPauseDate,
          manual_refund: deferredManualRefund,
          refund_amount: effectiveRefund,
          consumed_amount: effectiveConsumed,
          full_price: item.fullPrice,
          price_before_discount: newBefore,
          net_after_discount: newNetAfter,
        });
        // ✅ لا نستدعي onChanged هنا — الـ auto-sync يكتب نفس القيم المعروضة،
        // واستدعاء onChanged كان يسبب refetch لكل اللوحات الموقوفة عند الكتابة.
      } catch (e) {
        console.warn('Auto-sync paused pricing failed:', e);
      }
    }, 700);
    return () => {
      if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current);
    };
  }, [raw.id, item.fullPrice, item.baseRental, (item as any).totalForBoard, item.isManualRefund, effectiveConsumed, effectiveRefund, deferredPauseDate, deferredManualRefund, onChanged]);

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'حذف اللوحة الموقوفة',
      message: `هل تريد حذف اللوحة الموقوفة ${name}؟`,
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await deletePausedBillboard(raw.id);
      toast.success('تم الحذف');
      onChanged?.();
    } catch (e: any) {
      toast.error('فشل الحذف: ' + (e?.message || ''));
    }
  };

  const canResume = (() => {
    const status = String(bb?.Status || '').trim();
    const otherCN = bb?.Contract_Number;
    if (!bb) return true; // optimistic — server will validate
    if (otherCN && Number(otherCN) !== Number(raw.contract_number)) return false;
    if (status && status !== 'متاح' && Number(otherCN) !== Number(raw.contract_number)) return false;
    return true;
  })();

  const handleResume = async () => {
    const ok = await confirm({
      title: 'استئناف اللوحة',
      message: `هل تريد إعادة اللوحة ${name} إلى العقد كلوحة فعّالة؟`,
      confirmText: 'استئناف',
      cancelText: 'إلغاء',
      variant: 'default',
    });
    if (!ok) return;
    try {
      await resumePausedBillboard(raw.id);
      toast.success('تم استئناف اللوحة');
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || 'فشل الاستئناف');
    }
  };

  const getDisplaySize = (b: any) => b?.Size || b?.size || raw.size || '-';
  const getFacesCount = (b: any) =>
    isSingleFace ? '1' : (b?.Faces_Count || b?.faces_count || '2');

  const hasIncludedCosts = item.includedPrintCost > 0 || item.includedInstallCost > 0;
  const hasExtraCosts = item.extraPrintCost > 0 || item.extraInstallCost > 0;
  const showFinalTotal = item.discountApplied > 0 || hasExtraCosts;

  return (
    <div
      data-paused-bb={raw.billboard_id}
      className={`group relative h-full flex flex-col bg-card border-2 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 min-w-0 ${
        highlight
          ? 'border-emerald-500 ring-4 ring-emerald-400/40 shadow-2xl'
          : 'border-amber-500/60 hover:border-amber-500'
      }`}
    >
      {/* Top Pause Strip — bold red banner so it cannot be missed */}
      <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 text-white px-3 py-2 flex items-center justify-between gap-2 shadow-md">
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <PauseCircle className="h-5 w-5 animate-pulse" />
          <span className="uppercase tracking-wider">موقوفة</span>
          <span className="opacity-95 tabular-nums bg-black/25 rounded px-2 py-0.5" dir="ltr">
            {pauseDate || raw.pause_date || '—'}
          </span>
          <span className="opacity-95 tabular-nums hidden sm:inline" dir="ltr">
            • {previewElapsed} / {item.totalDays} يوم
          </span>
        </div>
        {sourceContract ? (
          <Badge className="bg-white/25 text-white border-0 text-[10px] font-bold">من العقد #{sourceContract}</Badge>
        ) : (
          <Badge className="bg-white/25 text-white border-0 text-[10px] font-bold">مضافة للعقد</Badge>
        )}
      </div>

      {/* Top Action Bar — primary actions sit above everything, never overlap image */}
      <div className="border-b border-border bg-muted/40 px-2 py-2 flex items-center gap-1 h-12 shrink-0">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`flex-1 h-8 text-xs gap-1 ${dirty ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? '...' : dirty ? 'حفظ' : 'محفوظ'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleResume}
          disabled={!canResume}
          className="h-8 px-2 text-xs gap-1 text-emerald-700 border-emerald-500/40 hover:bg-emerald-500/10"
          title={canResume ? 'استئناف اللوحة' : 'محجوزة في عقد آخر'}
        >
          <RotateCcw className="h-3.5 w-3.5" /> استئناف
        </Button>
        {replacement ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 px-2 text-xs gap-1 text-blue-700 border-blue-500/40 hover:bg-blue-500/10">
                <Repeat2 className="h-3.5 w-3.5" /> البديل
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                <Repeat2 className="h-4 w-4" /> لوحة بديلة
              </div>
              <div className="flex items-center gap-3">
                {replacementBillboard?.Image_URL && (
                  <img src={replacementBillboard.Image_URL} alt="" className="w-16 h-16 object-cover rounded border border-border" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">
                    {replacementBillboard?.Billboard_Name || replacement.replacement_billboard_name || `#${replacement.replacement_billboard_id}`}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {replacementBillboard?.City || ''} {replacementBillboard?.Size ? `• ${replacementBillboard.Size}` : ''}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {replacementBillboard?.Nearest_Landmark || ''}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-background/60 rounded px-2 py-1.5 border border-blue-500/20">
                  <div className="text-muted-foreground">تبدأ من</div>
                  <div className="font-bold tabular-nums" dir="ltr">{replacement.start_date}</div>
                </div>
                <div className="bg-background/60 rounded px-2 py-1.5 border border-blue-500/20">
                  <div className="text-muted-foreground">المبلغ المخصص</div>
                  <div className="font-bold text-primary tabular-nums" dir="ltr">
                    {formatAmount(Number(replacement.allocated_amount) || 0)} {currencySymbol}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 pt-1">
                <button
                  onClick={() => setReplaceDialogOpen(true)}
                  className="flex-1 text-[11px] px-2 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  تغيير البديل
                </button>
                <button
                  onClick={handleRemoveReplacement}
                  className="flex-1 text-[11px] px-2 py-1.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center gap-1"
                >
                  <XIcon className="h-3 w-3" /> إلغاء التبديل
                </button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReplaceDialogOpen(true)}
            className="h-8 px-2 text-xs gap-1 text-blue-700 border-blue-500/40 hover:bg-blue-500/10"
            title="تبديل ببديلة"
          >
            <Repeat2 className="h-3.5 w-3.5" /> بديل
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleDelete}
          className="h-8 w-8 p-0 text-destructive border-destructive/40 hover:bg-destructive/10"
          title="حذف"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Image — clean, click to zoom */}
      <div className="relative h-44 bg-muted shrink-0">
        <BillboardImageZoom billboard={item.billboard} alt={name} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-3 right-3 text-white pointer-events-none">
          <h4 className="text-lg font-bold drop-shadow-lg">{name}</h4>
        </div>
        {replacement && (
          <div className="absolute top-2 left-2 pointer-events-none">
            <Badge className="bg-blue-600 text-white border-0 text-[10px] font-bold flex items-center gap-1">
              <Repeat2 className="h-3 w-3" /> بديلة
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 flex-1 flex flex-col min-w-0">
        {/* Location */}
        <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed min-h-[2.5rem]">
          {bb.location || bb.Nearest_Landmark || raw.billboard_name || 'لا يوجد موقع'}
        </p>

        {/* Details Grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center bg-primary/10 border border-primary/20 rounded-lg py-2.5 px-1">
            <div className="text-[10px] text-primary/70 mb-0.5 font-medium">الحجم</div>
            <div className="text-sm font-bold text-primary font-manrope">{getDisplaySize(bb)}</div>
          </div>
          <div className="text-center bg-muted border border-border rounded-lg py-2.5 px-1">
            <div className="text-[10px] text-muted-foreground mb-0.5 font-medium">الوجوه</div>
            <div className="text-sm font-bold text-foreground font-manrope">{getFacesCount(bb)}</div>
          </div>
          <div className="text-center bg-muted border border-border rounded-lg py-2.5 px-1">
            <div className="text-[10px] text-muted-foreground mb-0.5 font-medium">المدينة</div>
            <div className="text-sm font-bold text-foreground">{bb.city || bb.City || '-'}</div>
          </div>
          <div className="text-center bg-primary/10 border border-primary/30 rounded-lg py-2.5 px-1">
            <div className="text-[10px] text-primary/80 mb-0.5 font-medium">المستوى</div>
            <div className="text-sm font-bold text-primary">{bb.level || bb.Level || '-'}</div>
          </div>
        </div>

        {/* Single face toggle */}
        {onToggleSingleFace && (
          <button
            onClick={() => onToggleSingleFace(billboardId)}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition-all duration-200 font-medium text-sm ${
              isSingleFace
                ? 'bg-amber-500/15 border-amber-500 text-amber-600'
                : 'bg-muted/50 border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                isSingleFace ? 'bg-amber-500 border-amber-500 text-white' : 'border-border text-muted-foreground'
              }`}>
                {isSingleFace ? '١' : '٢'}
              </span>
              عدد الوجوه
            </span>
            <span className="text-xs">
              {isSingleFace ? '⚡ وجه واحد' : 'انقر للتغيير'}
            </span>
          </button>
        )}

        {/* Pricing Section */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-2.5 min-h-[180px]">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">الإيجار الأساسي</span>
            <span className="text-lg font-bold text-primary font-manrope">
              {item.baseRental.toLocaleString('ar-LY')} {currencySymbol}
            </span>
          </div>

          {printCostEnabled && includePrintInPrice && item.printCost > 0 && (
            <div className="flex justify-between items-center bg-orange-500/10 rounded-lg px-3 py-1.5 -mx-1">
              <span className="text-xs font-medium text-orange-600 flex items-center gap-1.5">
                <Printer className="h-3 w-3" /> طباعة مضمنة
              </span>
              <span className="text-sm font-bold text-orange-600 font-manrope">
                - {item.printCost.toLocaleString('ar-LY')} {currencySymbol}
              </span>
            </div>
          )}
          {printCostEnabled && !includePrintInPrice && item.printCost > 0 && (
            <div className="flex justify-between items-center bg-blue-500/10 rounded-lg px-3 py-1.5 -mx-1">
              <span className="text-xs font-medium text-blue-600 flex items-center gap-1.5">
                <Printer className="h-3 w-3" /> تكلفة الطباعة
              </span>
              <span className="text-sm font-bold text-blue-600 font-manrope">
                + {item.printCost.toLocaleString('ar-LY')} {currencySymbol}
              </span>
            </div>
          )}

          {installationEnabled && includeInstallationInPrice && item.installPrice > 0 && (
            <div className="flex justify-between items-center bg-amber-500/10 rounded-lg px-3 py-1.5 -mx-1">
              <span className="text-xs font-medium text-amber-600 flex items-center gap-1.5">
                <Wrench className="h-3 w-3" /> تركيب مضمن
              </span>
              <span className="text-sm font-bold text-amber-600 font-manrope">
                - {item.installPrice.toLocaleString('ar-LY')} {currencySymbol}
              </span>
            </div>
          )}
          {installationEnabled && !includeInstallationInPrice && item.installPrice > 0 && (
            <div className="flex justify-between items-center bg-accent/10 rounded-lg px-3 py-1.5 -mx-1">
              <span className="text-xs font-medium text-accent flex items-center gap-1.5">
                <Wrench className="h-3 w-3" /> تكلفة التركيب
              </span>
              <span className="text-sm font-bold text-accent font-manrope">
                + {item.installPrice.toLocaleString('ar-LY')} {currencySymbol}
              </span>
            </div>
          )}

          {/* Net rental before discount (only when included costs were applied) */}
          {hasIncludedCosts && (
            <div className="flex justify-between items-center bg-emerald-500/10 rounded-lg px-3 py-2 -mx-1 border border-emerald-500/20">
              <span className="text-xs font-bold text-emerald-600">صافي الإيجار</span>
              <span className="text-base font-bold text-emerald-600 font-manrope" dir="ltr">
                {formatAmount(item.baseRentalBeforeDiscount)} {currencySymbol}
              </span>
            </div>
          )}

          {/* Discount */}
          {item.hasDistributedDiscount && item.discountApplied > 0 && (
            <div className="flex justify-between items-center bg-destructive/10 rounded-lg px-3 py-1.5 -mx-1">
              <span className="text-xs font-medium text-destructive">الخصم</span>
              <span className="text-sm font-bold text-destructive font-manrope" dir="ltr">
                - {formatAmount(item.discountApplied)} {currencySymbol}
              </span>
            </div>
          )}

          {/* After discount */}
          {item.hasDistributedDiscount && item.discountApplied > 0 && (
            <div className="flex justify-between items-center bg-green-500/10 rounded-lg px-3 py-2 -mx-1 border border-green-500/20">
              <span className="text-xs font-bold text-green-600">بعد الخصم</span>
              <span className="text-base font-bold text-green-600 font-manrope" dir="ltr">
                {formatAmount(item.netRentalAfterDiscount)} {currencySymbol}
              </span>
            </div>
          )}

          {/* الإجمالي النهائي — same as selected card */}
          {showFinalTotal && (
            <div className="flex justify-between items-center bg-primary/10 rounded-lg px-3 py-2.5 -mx-1 border border-primary/30 mt-1">
              <span className="text-sm font-bold text-primary">الإجمالي النهائي</span>
              <div className="text-left">
                <span className="text-lg font-bold text-primary font-manrope" dir="ltr">
                  {formatAmount(item.totalForBoard)} {currencySymbol}
                </span>
                {(durationMonths > 0 || durationDays > 0) && (
                  <span className="text-[10px] text-primary/60 font-normal mr-1">
                    /{pricingMode === 'months' ? `${durationMonths} شهر` : `${durationDays} يوم`}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pause Section */}
        <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-3 space-y-3 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 flex-wrap min-w-0">
            <PauseCircle className="h-4 w-4 shrink-0" />
            <span>تفاصيل الإيقاف</span>
            <span className="ms-auto text-[10px] font-semibold text-foreground/80 tabular-nums bg-background/70 border border-amber-500/30 rounded px-2 py-0.5 whitespace-nowrap" dir="ltr">
              <Clock className="inline h-3 w-3 -mt-0.5" /> {previewElapsed}/{item.totalDays} • متبقي {previewRemaining}
            </span>
          </div>

          <div className="space-y-1 min-w-0">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1 whitespace-nowrap">
              <Calendar className="h-3 w-3" /> تاريخ الإيقاف
            </Label>
            <Input
              type="date"
              value={pauseDate}
              onChange={(e) => setPauseDate(e.target.value)}
              className="h-9 text-sm w-full min-w-0 [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          {/* Refund — full width to keep number readable */}
          <div className="space-y-1 min-w-0">
            <Label className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center justify-between gap-1">
              <span className="font-semibold">خصم الإيقاف</span>
              <button
                type="button"
                onClick={() => setManualRefund(null)}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                title="حسب المتبقي (تلقائي)"
              >
                <RotateCcw className="h-3 w-3" /> تلقائي
              </button>
            </Label>
            <Input
              type="number"
              value={effectiveRefund}
              onChange={(e) => setManualRefund(Number(e.target.value) || 0)}
              className="h-10 text-base font-bold text-amber-600 tabular-nums w-full min-w-0"
              dir="ltr"
            />
            <div className="text-[10px] text-muted-foreground text-center">
              التلقائي: <span className="tabular-nums font-semibold" dir="ltr">{formatAmount(previewRefundAuto)}</span> {currencySymbol}
            </div>
            {nonRefundable > 0 && (
              <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 text-center">
                يُحسب على الإيجار فقط (سقف: <span className="tabular-nums" dir="ltr">{formatAmount(rentalBase)}</span>)
              </div>
            )}
          </div>

          {/* Added to contract — full width readout */}
          <div className="space-y-1 min-w-0">
            <Label className="text-[11px] text-primary font-semibold flex items-center justify-between gap-1">
              <span>المضاف للعقد</span>
              {nonRefundable > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                      title="تفاصيل المضاف للعقد"
                    >
                      <Info className="h-3 w-3" /> تفاصيل
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-2 text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">إيجار مستهلك</span>
                      <span className="tabular-nums font-semibold" dir="ltr">{formatAmount(effectiveConsumedRental)} {currencySymbol}</span>
                    </div>
                    {((item as any).printAdded || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-orange-600 flex items-center gap-1"><Printer className="h-3 w-3" /> طباعة</span>
                        <span className="tabular-nums font-semibold text-orange-600" dir="ltr">+ {formatAmount((item as any).printAdded)} {currencySymbol}</span>
                      </div>
                    )}
                    {((item as any).installAdded || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-amber-600 flex items-center gap-1"><Wrench className="h-3 w-3" /> تركيب</span>
                        <span className="tabular-nums font-semibold text-amber-600" dir="ltr">+ {formatAmount((item as any).installAdded)} {currencySymbol}</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-1 mt-1 flex justify-between">
                      <span className="font-bold text-primary">الإجمالي</span>
                      <span className="tabular-nums font-bold text-primary" dir="ltr">{formatAmount(effectiveConsumed)} {currencySymbol}</span>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </Label>
            <div className="h-10 px-3 rounded-md border-2 border-primary/40 bg-primary/10 flex items-center justify-end font-bold text-primary tabular-nums text-base w-full min-w-0 overflow-hidden" dir="ltr">
              <span className="truncate">{formatAmount(effectiveConsumed)} {currencySymbol}</span>
            </div>
            <div className="text-[10px] text-muted-foreground text-center" dir="ltr">
              إيجار: {formatAmount(Math.round(rentalBase / Math.max(1, item.totalDays)))} {currencySymbol} / يوم
            </div>
          </div>

        </div>
      </div>

      <ReplacePausedBillboardDialog
        open={replaceDialogOpen}
        onOpenChange={setReplaceDialogOpen}
        pausedBillboardId={raw.id}
        contractNumber={Number(raw.contract_number)}
        contractEndDate={(raw as any).original_end_date || ''}
        pauseDate={pauseDate}
        pausedBillboardName={name}
        remainingAmount={effectiveRefund}
        onSaved={() => { loadReplacement(); onChanged?.(); }}
      />
    </div>
  );
}

// ✅ React.memo — same item.raw.id + same item.fullPrice/refund/manual_refund means same render
export const PausedBillboardCard = React.memo(PausedBillboardCardImpl, (prev, next) => {
  if (prev.highlight !== next.highlight) return false;
  if (prev.printCostEnabled !== next.printCostEnabled) return false;
  if (prev.includePrintInPrice !== next.includePrintInPrice) return false;
  if (prev.installationEnabled !== next.installationEnabled) return false;
  if (prev.includeInstallationInPrice !== next.includeInstallationInPrice) return false;
  if (prev.currencySymbol !== next.currencySymbol) return false;
  if (prev.pricingMode !== next.pricingMode) return false;
  if (prev.durationMonths !== next.durationMonths) return false;
  if (prev.durationDays !== next.durationDays) return false;
  if (prev.contractStartDate !== next.contractStartDate) return false;
  // ⚠️ نتعمد تجاهل تغيّر مرجع الدوال (onChanged/onToggleSingleFace)
  // لأنها تُعاد كل render من الأب وتسبب اهتزاز الكروت دون أي تغيير مرئي.
  const a: any = prev.item, b: any = next.item;
  if (a.raw?.id !== b.raw?.id) return false;
  if (a.fullPrice !== b.fullPrice) return false;
  if (a.totalForBoard !== b.totalForBoard) return false;
  if (a.baseRental !== b.baseRental) return false;
  if (a.refund !== b.refund) return false;
  if (a.isSingleFace !== b.isSingleFace) return false;
  if (a.isManualRefund !== b.isManualRefund) return false;
  if (a.totalDays !== b.totalDays) return false;
  if (a.effectivePauseDate !== b.effectivePauseDate) return false;
  if (a.raw?.pause_date !== b.raw?.pause_date) return false;
  if (a.raw?.manual_refund !== b.raw?.manual_refund) return false;
  // billboard مرجع جديد بعد كل refetch — نقارن الحقول المؤثرة فقط
  const pb = a.billboard || {}; const nb = b.billboard || {};
  if (pb.ID !== nb.ID) return false;
  if (pb.Image_URL !== nb.Image_URL) return false;
  if (pb.Billboard_Name !== nb.Billboard_Name) return false;
  if (pb.Size !== nb.Size) return false;
  if (pb.Status !== nb.Status) return false;
  if (pb.Contract_Number !== nb.Contract_Number) return false;
  return true;
});

