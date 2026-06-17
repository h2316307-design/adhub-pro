// @ts-nocheck
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { listPausedBillboards, PausedBillboard } from '@/services/pausedBillboardsService';

export interface PausedItemWithPricing {
  raw: PausedBillboard;
  billboard: any | null;
  /** Net rental BEFORE distributed contract discount (= baseRental − includedCosts) */
  baseRentalBeforeDiscount: number;
  /** Discount distributed to this billboard from contract total (0 if no distribution) */
  discountApplied: number;
  /** True when the contract-level discount distribution is active for this billboard */
  hasDistributedDiscount: boolean;
  /** Base rental from pricing table (live) */
  baseRental: number;
  /** Print cost adjusted for single-face */
  printCost: number;
  /** Installation cost adjusted for single-face */
  installPrice: number;
  /** Print cost included inside the rental */
  includedPrintCost: number;
  /** Installation cost included inside the rental */
  includedInstallCost: number;
  /** Print cost added on top */
  extraPrintCost: number;
  /** Installation cost added on top */
  extraInstallCost: number;
  /** Net rental after distributed discount (base − included − discount). */
  netRentalAfterDiscount: number;
  /** Final total per board (matches selected card's "الإجمالي النهائي"). Pause math is based on this. */
  totalForBoard: number;
  /** Alias retained for backward compatibility — equals totalForBoard. */
  fullPrice: number;
  /** Rental-only base used for pause refund/consumed calculation (excludes print & install) */
  rentalBase: number;
  /** Consumed portion of rental only (rentalBase − refund) */
  consumedRental: number;
  /** Print cost fully added to contract (not refundable on pause) */
  printAdded: number;
  /** Install cost fully added to contract (not refundable on pause) */
  installAdded: number;
  /** @deprecated kept for compatibility */
  netRentalWithExtras: number;
  /** Whether single-face mode is active */
  isSingleFace: boolean;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  dailyRate: number;
  consumedAuto: number;
  refundAuto: number;
  /** Effective refund (manual override if present, else auto). */
  refund: number;
  /** Allocated amount for replacement (0 if no replacement). */
  allocatedForReplacement: number;
  /** Refund effectively deducted from contract = max(0, refund − allocatedForReplacement). */
  effectiveRefund: number;
  /** Whether this paused board has been replaced with another billboard. */
  hasReplacement: boolean;
  /** Effective consumed = max(0, fullPrice - refund). */
  consumed: number;
  isManualRefund: boolean;
  /** Effective pause date used for preview (falls back to contract start) */
  effectivePauseDate: string;
}

export interface PausedTotals {
  count: number;
  fullSum: number;
  consumedSum: number;
  /** Raw sum of refund (before deducting replacement allocations) */
  refundSum: number;
  /** Effective refund deducted from contract base = max(0, refund − allocated). */
  effectiveRefundSum: number;
  /** Sum of allocated_amount for paused boards that have a replacement */
  allocatedSum: number;
  /** Sum of print costs for paused billboards (after single-face adjustment) */
  printSum: number;
  /** Sum of installation costs for paused billboards (after single-face adjustment) */
  installSum: number;
  /** Sum of raw baseRental BEFORE included costs and BEFORE distributed discount */
  baseRentalSum: number;
  /** Sum of distributed contract-level discount applied to paused billboards */
  discountSum: number;
  /** Sum of included print costs (already inside baseRental) */
  includedPrintSum: number;
  /** Sum of included installation costs (already inside baseRental) */
  includedInstallSum: number;
}

export interface PausedPricingOptions {
  calculateBillboardPrice?: (billboard: any) => number;
  printCostDetails?: Array<{ billboardId: string; printCost: number }>;
  installationDetails?: Array<{ billboardId: string; installationPrice: number; adjustedPrice?: number }>;
  printCostEnabled?: boolean;
  includePrintInPrice?: boolean;
  installationEnabled?: boolean;
  includeInstallationInPrice?: boolean;
  singleFaceBillboards?: Set<string>;
  /** Per-billboard pricing (matches selected billboards' discount distribution). */
  pricingByBillboard?: Map<string, { discountPerBillboard?: number; netRentalAfterDiscount?: number; totalForBoard?: number }>;
  useStoredPrices?: boolean;
}

export interface UsePausedBillboardsPricingResult {
  items: PausedItemWithPricing[];
  totals: PausedTotals;
  loading: boolean;
  refetch: () => Promise<void>;
}

const DAY_MS = 1000 * 60 * 60 * 24;

const daysBetween = (a?: string | null, b?: string | null): number => {
  if (!a || !b) return 0;
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  if (isNaN(d1) || isNaN(d2)) return 0;
  return Math.max(0, Math.round((d2 - d1) / DAY_MS));
};

/** Round to nearest bucket (default 50 LYD) for clean refund/consumed amounts. */
const roundToBucket = (value: number, bucket: number = 50): number => {
  if (!Number.isFinite(value) || bucket <= 0) return Math.round(value || 0);
  return Math.round(value / bucket) * bucket;
};

export function usePausedBillboardsPricing(
  contractNumber: number | null | undefined,
  contractStartDate?: string | null,
  contractEndDate?: string | null,
  options?: PausedPricingOptions,
): UsePausedBillboardsPricingResult {
  const [rows, setRows] = useState<PausedBillboard[]>([]);
  const [billboardsMap, setBillboardsMap] = useState<Record<string, any>>({});
  const [replacementsByPausedId, setReplacementsByPausedId] = useState<Record<string, { allocated: number; replacement_billboard_id: number | string }>>({});
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!contractNumber) {
      setRows([]);
      setBillboardsMap({});
      setReplacementsByPausedId({});
      return;
    }
    try {
      setLoading(true);
      const data = await listPausedBillboards(Number(contractNumber));
      setRows(data);
      const ids = Array.from(new Set(data.map((d) => Number(d.billboard_id)).filter(Boolean)));
      if (ids.length > 0) {
        const { data: bbs } = await supabase
          .from('billboards')
          .select('*')
          .in('ID', ids as any);
        const map: Record<string, any> = {};
        (bbs || []).forEach((b: any) => { map[String(b.ID)] = b; });
        setBillboardsMap(map);
      } else {
        setBillboardsMap({});
      }
      // Load replacements for this contract so we can compute effectiveRefund
      try {
        const { data: repls } = await supabase
          .from('paused_billboard_replacements' as any)
          .select('paused_billboard_id, replacement_billboard_id, allocated_amount')
          .eq('contract_number', Number(contractNumber));
        const rmap: Record<string, { allocated: number; replacement_billboard_id: number | string }> = {};
        (repls || []).forEach((r: any) => {
          rmap[String(r.paused_billboard_id)] = {
            allocated: Number(r.allocated_amount) || 0,
            replacement_billboard_id: r.replacement_billboard_id,
          };
        });
        setReplacementsByPausedId(rmap);
      } catch (e) {
        setReplacementsByPausedId({});
      }
    } catch (e) {
      console.error('usePausedBillboardsPricing:', e);
    } finally {
      setLoading(false);
    }
  }, [contractNumber]);

  useEffect(() => { refetch(); }, [refetch]);

  // Refresh on global event
  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail;
      const eventCN = typeof detail === 'object' ? Number(detail?.contractNumber) : Number(detail);
      // ✅ تجاهل أحداث "updated" — الـ auto-sync يكتب نفس القيم المعروضة،
      // فلا داعي لإعادة جلب كل اللوحات الموقوفة (كان يسبب اهتزاز كامل القائمة عند الكتابة).
      const action = typeof detail === 'object' ? detail?.action : null;
      if (action === 'updated') return;
      if (!detail || !contractNumber || eventCN === Number(contractNumber)) {
        refetch();
      }
    };
    window.addEventListener('paused-billboards-changed', handler);
    return () => window.removeEventListener('paused-billboards-changed', handler);
  }, [contractNumber, refetch]);

  const printMap = useMemo(() => {
    const m = new Map<string, number>();
    (options?.printCostDetails || []).forEach((p) => m.set(String(p.billboardId), Number(p.printCost) || 0));
    return m;
  }, [options?.printCostDetails]);

  const installMap = useMemo(() => {
    const m = new Map<string, number>();
    (options?.installationDetails || []).forEach((i) =>
      m.set(String(i.billboardId), Number((i as any).adjustedPrice ?? i.installationPrice) || 0)
    );
    return m;
  }, [options?.installationDetails]);

  const items = useMemo<PausedItemWithPricing[]>(() => {
    const printCostEnabled = !!options?.printCostEnabled;
    const includePrintInPrice = options?.includePrintInPrice !== false;
    const installEnabled = !!options?.installationEnabled;
    const includeInstallInPrice = options?.includeInstallationInPrice !== false;
    const calcPrice = options?.calculateBillboardPrice;
    const pricingByBb = options?.pricingByBillboard;

    return rows.map((r) => {
      const bb = billboardsMap[String(r.billboard_id)] || null;
      const bbId = String(r.billboard_id);
      const isSingleFace = !!options?.singleFaceBillboards?.has(bbId);

      // ✅ مطابقة سلوك اللوحات المختارة بالضبط: نستخدم نفس مصدر السعر
      // (calculateBillboardPrice) الذي يقرأ من سناب-شوت أسعار العقد المحفوظة.
      // هذا يضمن أن الإيجار الأساسي للوحة الموقوفة = الإيجار الأساسي للوحة المختارة لنفس اللوحة.
      // نسقط للقيمة المحفوظة في صف الإيقاف فقط إذا تعذّر الحساب اللحظي (لا يوجد بيانات لوحة).
      let baseRental = 0;
      if (options?.useStoredPrices) {
        baseRental = Number((r as any).price_before_discount ?? r.net_rent ?? r.original_price ?? r.full_price ?? 0);
      }
      if (!baseRental && calcPrice && bb) {
        try { baseRental = Number(calcPrice(bb)) || 0; } catch { baseRental = 0; }
      }
      if (!baseRental) {
        baseRental = Number((r as any).price_before_discount ?? r.net_rent ?? r.original_price ?? r.full_price ?? 0);
      }

      const rawPrint = printMap.get(bbId) || 0;
      const rawInstall = installMap.get(bbId) || 0;
      const printCost = isSingleFace ? Math.round(rawPrint / 2) : rawPrint;
      const installPrice = isSingleFace ? Math.round(rawInstall / 2) : rawInstall;

      const includedPrintCost = printCostEnabled && includePrintInPrice ? printCost : 0;
      const includedInstallCost = installEnabled && includeInstallInPrice ? installPrice : 0;
      const extraPrintCost = printCostEnabled && !includePrintInPrice ? printCost : 0;
      const extraInstallCost = installEnabled && !includeInstallInPrice ? installPrice : 0;

      // Apply contract-level discount distribution if provided (matches selected billboards)
      const perBb = pricingByBb?.get(bbId);
      const baseRentalBeforeDiscount = Math.max(0, baseRental - includedPrintCost - includedInstallCost);
      const hasDistributedDiscount = !!(perBb && Number.isFinite((perBb as any).netRentalAfterDiscount));
      const netRentalAfterDiscount = hasDistributedDiscount
        ? Math.max(0, Number((perBb as any).netRentalAfterDiscount))
        : baseRentalBeforeDiscount;
      const discountApplied = hasDistributedDiscount
        ? Math.max(0, baseRentalBeforeDiscount - netRentalAfterDiscount)
        : 0;
      // ✅ Final total per board — matches selected card's "الإجمالي النهائي".
      // Pause math (refund/consumed) is based on THIS value, not net rental.
      const totalForBoard = (perBb as any)?.totalForBoard != null
        ? Number((perBb as any).totalForBoard)
        : (netRentalAfterDiscount + includedPrintCost + includedInstallCost + extraPrintCost + extraInstallCost);
      const fullPrice = totalForBoard;
      const netRentalWithExtras = netRentalAfterDiscount + extraPrintCost + extraInstallCost;

      // Use TARGET contract dates as source of truth (saved into original_*_date)
      const start = (r as any).original_start_date || contractStartDate || null;
      const end = (r as any).original_end_date || contractEndDate || null;

      // ✅ ثابت بين الزيارات: لا نستخدم تاريخ اليوم (new Date) كاحتياط للـ pause_date
      // لأن ذلك كان يجعل remainingDays/refundAuto يتغيران كل يوم → تذبذب قيمة الإيقاف.
      // إذا غابت pause_date في DB نستخدم created_at للصف ثم تاريخ بداية العقد كاحتياط.
      const createdAtRaw = (r as any).created_at ? String((r as any).created_at).split('T')[0] : '';
      const clampedCreated = createdAtRaw && start && createdAtRaw < start
        ? start
        : (createdAtRaw && end && createdAtRaw > end ? end : createdAtRaw);
      const effectivePauseDate = r.pause_date || clampedCreated || start || '';

      const rawTotal = daysBetween(start, end);
      const totalDays = Math.max(1, rawTotal || 30);
      const elapsedDays = effectivePauseDate
        ? Math.max(0, Math.min(totalDays, daysBetween(start, effectivePauseDate)))
        : 0;
      const remainingDays = Math.max(0, totalDays - elapsedDays);
      const dailyRate = fullPrice / totalDays;
      // ✅ Pause refund applies ONLY to the rental portion. Print & install costs
      // are real expenses that have already been incurred and must NOT be refunded.
      const rentalBase = Math.max(0, Math.round(netRentalAfterDiscount));
      const printAdded = includedPrintCost + extraPrintCost;
      const installAdded = includedInstallCost + extraInstallCost;
      const nonRefundable = printAdded + installAdded;

      const refundAutoRaw = (rentalBase * remainingDays) / Math.max(1, totalDays);
      const refundAuto = Math.min(rentalBase, roundToBucket(refundAutoRaw, 50));
      const consumedRentalAuto = Math.max(0, rentalBase - refundAuto);
      const consumedAuto = consumedRentalAuto + nonRefundable;

      const manual = (r as any).manual_refund;
      const isManualRefund = manual !== null && manual !== undefined;
      
      let refund = refundAuto;
      if (options?.useStoredPrices && r.refund_amount !== undefined && r.refund_amount !== null) {
        refund = Number(r.refund_amount) || 0;
      } else if (isManualRefund) {
        refund = Math.min(rentalBase, Math.max(0, Number(manual)));
      }

      const consumedRental = Math.max(0, rentalBase - refund);
      const consumed = consumedRental + nonRefundable;

      // ✅ Replacement-aware refund: if this paused board has a replacement,
      // the customer pays again via the replacement's allocated_amount (which
      // already counts in the contract base via billboard_ids). So only the
      // un-covered portion should reduce the contract base.
      const replInfo = replacementsByPausedId[String((r as any).id)];
      const allocatedForReplacement = replInfo ? Number(replInfo.allocated) || 0 : 0;
      const hasReplacement = !!replInfo;
      const effectiveRefund = Math.max(0, refund - allocatedForReplacement);

      return {
        raw: r,
        billboard: bb,
        baseRentalBeforeDiscount,
        discountApplied,
        hasDistributedDiscount,
        baseRental,
        printCost,
        installPrice,
        includedPrintCost,
        includedInstallCost,
        extraPrintCost,
        extraInstallCost,
        netRentalAfterDiscount,
        totalForBoard,
        fullPrice,
        rentalBase,
        consumedRental,
        printAdded,
        installAdded,
        netRentalWithExtras,
        isSingleFace,
        totalDays,
        elapsedDays,
        remainingDays,
        dailyRate,
        consumedAuto,
        refundAuto,
        refund,
        allocatedForReplacement,
        effectiveRefund,
        hasReplacement,
        consumed,
        isManualRefund,
        effectivePauseDate,
      };
    });
  }, [rows, billboardsMap, replacementsByPausedId, contractStartDate, contractEndDate, options, printMap, installMap]);

  const totals = useMemo<PausedTotals>(() => ({
    count: items.length,
    fullSum: items.reduce((s, i) => s + i.fullPrice, 0),
    consumedSum: items.reduce((s, i) => s + i.consumed, 0),
    refundSum: items.reduce((s, i) => s + i.refund, 0),
    effectiveRefundSum: items.reduce((s, i) => s + (i.effectiveRefund || 0), 0),
    allocatedSum: items.reduce((s, i) => s + (i.allocatedForReplacement || 0), 0),
    printSum: items.reduce((s, i) => s + (i.printCost || 0), 0),
    installSum: items.reduce((s, i) => s + (i.installPrice || 0), 0),
    // ✅ Exclude paused boards that have a replacement: their replacement
    // billboard is already in Contract.billboard_ids and counts inside the
    // selected baseTotal. Including them again would double-count the price.
    baseRentalSum: items.reduce((s, i) => s + (i.baseRental || 0), 0),
    discountSum: items.reduce((s, i) => s + (i.discountApplied || 0), 0),
    includedPrintSum: items.reduce((s, i) => s + (i.includedPrintCost || 0), 0),
    includedInstallSum: items.reduce((s, i) => s + (i.includedInstallCost || 0), 0),
  }), [items]);

  return { items, totals, loading, refetch };
}
