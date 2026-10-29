-- 24: سبب التبديل الفوري للوحة المركبة
-- يضيف معامل p_reason إلى replace_contract_billboard_lifecycle.
-- الدالة القديمة تُعاد تسميتها (لا حذف)، والغلاف الجديد يستدعيها ثم يسجّل السبب
-- في ملاحظات الإيقاف (paused_billboards.notes) وفي سجل النشاط.
-- يحدّث مهمة التركيب الناتجة لتصبح إعادة تركيب مع رقم تسلسلي وعنوان واضح.

-- 1) إعادة تسمية الدالة الحالية إذا لم تكن قد أُعيدت تسميتها مسبقاً (الاحتفاظ بمنطقها كما هو)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'replace_contract_billboard_lifecycle'
      AND pg_get_function_identity_arguments(p.oid) = 'p_contract_number bigint, p_original_billboard_id bigint, p_replacement_billboard_id bigint, p_user_id text, p_swap_event_id text'
  ) THEN
    ALTER FUNCTION public.replace_contract_billboard_lifecycle(bigint,bigint,bigint,text,text)
      RENAME TO replace_contract_billboard_lifecycle_v1;
  END IF;
END $$;

-- 2) الغلاف الجديد مع p_reason
CREATE OR REPLACE FUNCTION public.replace_contract_billboard_lifecycle(
  p_contract_number bigint,
  p_original_billboard_id bigint,
  p_replacement_billboard_id bigint,
  p_user_id text DEFAULT NULL,
  p_swap_event_id text DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  result jsonb;
  reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  result := public.replace_contract_billboard_lifecycle_v1(
    p_contract_number, p_original_billboard_id, p_replacement_billboard_id, p_user_id, p_swap_event_id
  );

  -- الجزء المستهلك من اللوحة الموقوفة يبقى كتكلفة إضافية على اللوحة البديلة
  -- (اللوحتان وحدة واحدة)، فيبقى مجموع أسعار الأجزاء مساوياً لإجمالي العقد.
  IF result ? 'pause_id' AND (result->>'pause_id') IS NOT NULL THEN
    UPDATE public."Contract" ct
       SET billboard_prices = (
         SELECT COALESCE(jsonb_agg(
           CASE WHEN p->>'_replacement_of' = pb.id::text
             THEN p || jsonb_build_object(
               'consumedCarryover', round(pb.full_price - pb.refund_amount, 2),
               'carriedFromBillboardId', pb.billboard_id,
               'pricingNote', 'تكلفة إضافية: الجزء المستهلك من اللوحة المستبدلة')
             ELSE p END
         ), '[]'::jsonb)::text
         FROM jsonb_array_elements(COALESCE(NULLIF(ct.billboard_prices, '')::jsonb, '[]'::jsonb)) p
         CROSS JOIN public.paused_billboards pb
         WHERE pb.id = (result->>'pause_id')::uuid
       )
     WHERE ct."Contract_Number" = p_contract_number;
  END IF;

  IF reason IS NULL THEN
    RETURN result;
  END IF;

  -- سجل النشاط: يُحدَّث الصف الذي كتبته الدالة الأصلية لنفس الطلب
  UPDATE public.activity_log
     SET details = COALESCE(details, '{}'::jsonb) || jsonb_build_object('reason', reason)
   WHERE action = 'installed_board_swap'
     AND contract_number = p_contract_number
     AND details->>'requestId' = p_swap_event_id;

  -- مهمة التركيب الناتجة عن التبديل: تحمل عنوان الملحق وسبب التبديل
  -- تُفصل مهمة البديل عن تركيب العقد الأصلي: نوعها إعادة تركيب برقم جديد للعقد،
  -- فتظهر كبطاقة مستقلة في أوامر العمل (مفتاح العملية c:<عقد>:re:<رقم>).
  UPDATE public.installation_tasks t
     SET task_name = 'ملحق عقد #' || p_contract_number || COALESCE(' — تبديل لوحة: ' || reason, ''),
         task_type = 'reinstallation',
         reinstallation_number = (
           SELECT COALESCE(MAX(x.reinstallation_number), 0) + 1
             FROM public.installation_tasks x
            WHERE x.contract_id = p_contract_number
         )
    FROM public.installation_task_items i
   WHERE i.task_id = t.id
     AND t.contract_id = p_contract_number
     AND i.billboard_id = p_replacement_billboard_id
     AND COALESCE(i.status, '') <> 'completed';

  -- ملاحظات الإيقاف: سبب التبديل يظهر في سجل الإيقاف
  IF result ? 'pause_id' AND (result->>'pause_id') IS NOT NULL THEN
    UPDATE public.paused_billboards
       SET notes = reason
     WHERE id = (result->>'pause_id')::uuid;
  END IF;

  RETURN result || jsonb_build_object('reason', reason);
END $$;

REVOKE ALL ON FUNCTION public.replace_contract_billboard_lifecycle(bigint,bigint,bigint,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_contract_billboard_lifecycle(bigint,bigint,bigint,text,text,text) TO authenticated;
