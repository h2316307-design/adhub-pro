import { useDefaultPricingCategory } from '@/hooks/useDefaultPricingCategory';
import { usePricingDurations } from '@/hooks/usePricingDurations';
import { durationPrice } from '@/utils/pricingDuration';
// Hook مشترك لحساب الأسعار من قاعدة البيانات (موحد لإنشاء/تعديل العقد)
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import { normalizeSize } from '@/lib/utils';

export function useContractPricing() {
  const { category: defaultPricingCategory } = useDefaultPricingCategory();
  const { data: durations } = usePricingDurations();
  const [pricingData, setPricingData] = useState<any[]>([]);
  const [sizeNames, setSizeNames] = useState(() => new Map<number, string>());
  const [loading, setLoading] = useState(true);

  // تحميل بيانات التسعير وأسماء المقاسات — يُعاد عند العودة للصفحة
  const loadPricing = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      const [pricingRes, sizesRes] = await Promise.all([
        supabase.from('pricing').select('*').order('size', { ascending: true }),
        supabase.from('sizes').select('id, name'),
      ]);

      if (!pricingRes.error && Array.isArray(pricingRes.data)) {
        setPricingData(pricingRes.data);
      } else if (pricingRes.error) {
        console.error('❌ Failed to load pricing data:', pricingRes.error);
      }

      if (!sizesRes.error && Array.isArray(sizesRes.data)) {
        const sizeMap = new Map<number, string>(sizesRes.data.map((s: any) => [s.id as number, s.name as string]));
        setSizeNames(sizeMap);
      } else if (sizesRes.error) {
        console.error('❌ Failed to load size names:', sizesRes.error);
      }
    } catch (e) {
      console.warn('Failed to load pricing/size data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPricing();

    // إعادة التحميل عند العودة للصفحة فقط، وبحد أقصى مرة كل دقيقة
    // (أُزيل اشتراك Realtime: جدول الأسعار غير منشور في Realtime فلم يكن يستقبل أي تحديث)
    let lastLoad = Date.now();
    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastLoad < 60_000) return;
      lastLoad = Date.now();
      loadPricing({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [loadPricing]);

  // أدوات مساعدة
  // مثل تعديل العقد: 12x4 و 4x12 مقاس واحد
  const normalizeSizeName = (val: any) => normalizeSize(String(val || '').replace(/\*/g, 'x')).toLowerCase().replace(/\s+/g, '');

  const pickPrice = (row: any, months: number): number | null => {
    return durationPrice(row, months, durations);
  };

  // ✅ موحد مع تعديل العقد: البحث بمعرّف المقاس (size_id) فقط
  const findPricingRow = (
    sizeRef: number | string | null,
    level: any,
    customer: string,
    pick: (row: any) => number | null,
    sizeNameHint?: string,
  ): number | null => {
    const normLevel = String(level || '').trim().toUpperCase();
    const normCustomer = String(customer || '').trim().toUpperCase();
    const matches = (p: any) =>
      String(p.billboard_level || '').trim().toUpperCase() === normLevel &&
      String(p.customer_category || '').trim().toUpperCase() === normCustomer;

    let sizeId: number | null = null;
    let sizeName: string | null = sizeNameHint ? normalizeSizeName(sizeNameHint) : null;
    if (typeof sizeRef === 'number') {
      sizeId = sizeRef;
    } else if (typeof sizeRef === 'string' && sizeRef.trim()) {
      const maybeNum = Number(sizeRef.trim());
      if (!Number.isNaN(maybeNum)) sizeId = maybeNum;
      else sizeName = normalizeSizeName(sizeRef);
    }

    const byId = (id: number | null) => {
      if (!id) return null;
      const row = pricingData.find((p) => p.size_id !== null && p.size_id !== undefined && Number(p.size_id) === id && matches(p));
      return row ? pick(row) : null;
    };

    // البحث بمعرّف المقاس فقط؛ الاسم يُستخدم فقط إذا لم يكن للوحة معرّف مقاس
    if (sizeId) return byId(sizeId);
    if (sizeName) {
      const rowByName = pricingData.find((p) => normalizeSizeName(p.size) === sizeName && matches(p));
      return rowByName ? pick(rowByName) : null;
    }
    return null;
  };

  const getPriceFromDatabase = (
    sizeRef: number | string | null,
    level: any,
    customer: string,
    months: number,
    sizeName?: string,
  ): number | null => {
    const price = findPricingRow(sizeRef, level, customer, (row) => pickPrice(row, months), sizeName);
    if (price !== null) return price;
    // الرجوع للفئة الافتراضية المحددة في الإعدادات (نفس منطق العقد والعرض)
    if (String(customer || '').trim() !== defaultPricingCategory) {
      return getPriceFromDatabase(sizeRef, level, defaultPricingCategory, months, sizeName);
    }
    return null;
  };

  const getDailyPriceFromDatabase = (
    sizeRef: number | string | null,
    level: any,
    customer: string,
    sizeName?: string,
  ): number | null => {
    const pickDaily = (row: any): number | null => {
      const v = row?.one_day;
      if (v === null || v === undefined) return null;
      return Number(v) || 0;
    };
    const daily = findPricingRow(sizeRef, level, customer, pickDaily, sizeName);
    if (daily !== null) return daily;
    if (String(customer || '').trim() !== defaultPricingCategory) {
      return getDailyPriceFromDatabase(sizeRef, level, defaultPricingCategory, sizeName);
    }
    return null;
  };

  // ✅ موحد: حساب سعر اللوحة (أشهر/أيام) باستخدام الداتا +Fallback للبيانات الثابتة
  const calculateBillboardPrice = (
    billboard: any,
    pricingMode: 'months' | 'days',
    durationMonths: number,
    durationDays: number,
    pricingCategory: string,
    convertPrice: (price: number) => number = (p) => p
  ): number => {
    const rawSizeId = billboard.size_id || billboard.Size_ID || null;
    const sizeId = rawSizeId !== null ? Number(rawSizeId) : null;
    const size = (billboard.size || billboard.Size || '') as string;
    const level = (billboard.level || billboard.Level) as any;

    if (pricingMode === 'months') {
      const months = Math.max(0, Number(durationMonths || 0));
      let price = getPriceFromDatabase(sizeId, level, pricingCategory, months, size);
      if (price === null) {
        price = getPriceFor(size, level, pricingCategory as CustomerType, months);
      }
      return price !== null ? convertPrice(price) : 0;
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      let daily = getDailyPriceFromDatabase(sizeId, level, pricingCategory, size);
      if (daily === null) {
        daily = getDailyPriceFor(size, level, pricingCategory as CustomerType);
      }
      if (daily === null) {
        let monthlyPrice = getPriceFromDatabase(sizeId, level, pricingCategory, 1, size);
        if (monthlyPrice === null) {
          monthlyPrice = getPriceFor(size, level, pricingCategory as CustomerType, 1) || 0;
        }
        daily = monthlyPrice ? Math.round((monthlyPrice / 30) * 100) / 100 : 0;
      }
      return convertPrice((daily || 0) * days);
    }
  };

  return {
    pricingData,
    sizeNames,
    defaultPricingCategory,
    loading,
    getPriceFromDatabase,
    getDailyPriceFromDatabase,
    calculateBillboardPrice,
    refetch: loadPricing,
  };
}
