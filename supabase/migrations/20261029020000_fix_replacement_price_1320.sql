-- 26: تثبيت سعر اللوحة البديلة #260 في العقد #1320 بالسعر الكامل 5900 (وحدة واحدة)
-- الملف 24 يعمل على التبديلات الجديدة فقط، فهذا تصحيح لمرة واحدة لتبديل تم قبل ذلك.
-- الإجمالي يبقى 9500 (3600 + 5900)، والتفصيل يبقى داخلياً:
--   إيجار متبقٍ 4006.56 + جزء مستهلك من اللوحة المستبدلة 1893.44 = 5900

UPDATE public."Contract" ct
   SET billboard_prices = (
     SELECT COALESCE(jsonb_agg(
       CASE WHEN p->>'billboardId' = '260' AND p->>'_replacement_of' IS NOT NULL
         THEN p || jsonb_build_object(
           'finalPrice', 5900,
           'priceAfterDiscount', 5900,
           'totalBillboardPrice', 5900,
           'contractPrice', 5900,
           'baseRental', 5900,
           'basePriceBeforeDiscount', 5900,
           'priceBeforeDiscount', 5900,
           'remainingRental', 4006.56,
           'consumedCarryover', 1893.44,
           'carriedFromBillboardId', 536,
           'pricingNote', 'السعر الكامل للوحة المستبدلة؛ الجزء المستهلك تكلفة إضافية')
         ELSE p END
     ), '[]'::jsonb)::text
     FROM jsonb_array_elements(COALESCE(NULLIF(ct.billboard_prices, '')::jsonb, '[]'::jsonb)) p
   )
 WHERE ct."Contract_Number" = 1320;

UPDATE public.paused_billboard_replacements
   SET allocated_amount = 5900
 WHERE contract_number = 1320
   AND replacement_billboard_id = 260;
