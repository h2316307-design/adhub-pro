-- 27: دمج الملحقين #1 و#2 للعقد #1320 في ملحق واحد (تغيير واحد)
-- سبب التكرار: الملف 26 عُدّل في معاملة قاعدة بيانات مستقلة، فسجّله المشغّل ملحقاً جديداً (#2).
-- هنا: الملحق #2 يُنقل إلى أرشيف (لا يُحذف)، ويُحدَّث الملحق #1 بالحالة النهائية.

-- 1) أرشيف للملاحق المنقولة (بنفس بنية الجدول بدون قيود التفرد)
CREATE TABLE IF NOT EXISTS public.contract_amendments_archive
  (LIKE public.contract_amendments INCLUDING DEFAULTS);

-- 2) نسخ الملحق #2 إلى الأرشيف
INSERT INTO public.contract_amendments_archive
SELECT a.* FROM public.contract_amendments a
 WHERE a.contract_number = 1320 AND a.amendment_number = 2;

-- 3) تحديث الملحق #1 بالحالة النهائية: اللقطة والإجمالي بعد التعديل، وبيانات سعر البديلة من #2
UPDATE public.contract_amendments a1
   SET snapshot = a2.snapshot,
       total_after = a2.total_after,
       changes = (
         SELECT COALESCE(jsonb_agg(
           CASE WHEN c->>'field' = 'billboard_prices'
             THEN jsonb_set(c, '{after}', (
               SELECT x->'after' FROM jsonb_array_elements(a2.changes) x WHERE x->>'field' = 'billboard_prices' LIMIT 1
             ))
             ELSE c END
         ), '[]'::jsonb)
         FROM jsonb_array_elements(a1.changes) c
       )
  FROM public.contract_amendments a2
 WHERE a1.contract_number = 1320 AND a1.amendment_number = 1
   AND a2.contract_number = 1320 AND a2.amendment_number = 2;

-- 4) إزالة الملحق #2 من الجدول الأساسي بعد أرشفته
DELETE FROM public.contract_amendments
 WHERE contract_number = 1320 AND amendment_number = 2;
