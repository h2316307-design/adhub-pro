-- Freeze the original once installation is complete, then number subsequent edits.
-- Contract remains the current operational record; documents below are immutable to clients.
CREATE TABLE IF NOT EXISTS public.contract_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number bigint NOT NULL,
  amendment_number integer NOT NULL CHECK (amendment_number >= 0),
  transaction_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  snapshot jsonb NOT NULL,
  previous_snapshot jsonb NOT NULL,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_before numeric NOT NULL DEFAULT 0,
  total_after numeric NOT NULL DEFAULT 0,
  UNIQUE(contract_number, amendment_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS contract_amendment_transaction
  ON public.contract_amendments(contract_number,transaction_id) WHERE amendment_number > 0;
ALTER TABLE public.contract_amendments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_amendments FROM anon, authenticated;
GRANT SELECT ON public.contract_amendments TO authenticated;
DROP POLICY IF EXISTS contract_amendments_read ON public.contract_amendments;
CREATE POLICY contract_amendments_read ON public.contract_amendments FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public."Contract" c WHERE c."Contract_Number"=contract_amendments.contract_number));

CREATE OR REPLACE FUNCTION public.contract_version_business_data(p_record jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE result jsonb; key text;
BEGIN
  result:=p_record - ARRAY['id','edit_revision','created_at','updated_at','Total Paid','Remaining',
    'billboards_data','saved_billboards_data','pricing_snapshot'];
  SELECT COALESCE(jsonb_object_agg(e.key,e.value),'{}'::jsonb) INTO result
    FROM jsonb_each(result) e WHERE left(e.key,1)<>'_';
  FOREACH key IN ARRAY ARRAY['billboard_prices','installments_data','design_data','single_face_billboards','friend_rental_data','partnership_operating_data'] LOOP
    IF jsonb_typeof(result->key)='string' THEN
      BEGIN result:=jsonb_set(result,ARRAY[key],(result->>key)::jsonb);
      EXCEPTION WHEN invalid_text_representation THEN NULL; END;
    END IF;
  END LOOP;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.snapshot_contract_document(p_record jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE cn bigint; ids text[]; active_boards jsonb; catalog jsonb; paused jsonb; replacements jsonb;
  customer jsonb; terms jsonb; prices jsonb; yearly_code text;
BEGIN
  cn:=(p_record->>'Contract_Number')::bigint;
  ids:=array_remove(regexp_split_to_array(COALESCE(p_record->>'billboard_ids',''),'\s*,\s*'),'');
  prices:=COALESCE(p_record->'billboard_prices','[]'::jsonb);
  IF jsonb_typeof(prices)='string' THEN prices:=COALESCE(NULLIF(prices#>>'{}','')::jsonb,'[]'::jsonb); END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(b) || jsonb_build_object(
    'Rent_Start_Date',COALESCE(p->>'startDate',p_record->>'Contract Date'),
    'Rent_End_Date',COALESCE(p->>'endDate',p_record->>'End Date')) ORDER BY b."ID"),'[]'::jsonb)
    INTO active_boards FROM public.billboards b LEFT JOIN jsonb_array_elements(prices) p ON p->>'billboardId'=b."ID"::text
    WHERE b."ID"::text=ANY(ids);
  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) INTO paused FROM public.paused_billboards p
    WHERE p.contract_number=cn AND p.lifecycle_state<>'cancelled' AND NOT(p.billboard_id::text=ANY(ids));
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) INTO replacements
    FROM public.paused_billboard_replacements r WHERE r.contract_number=cn;
  SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b."ID"),'[]'::jsonb) INTO catalog FROM public.billboards b
    WHERE b."ID"::text=ANY(ids) OR b."ID" IN(SELECT p.billboard_id FROM public.paused_billboards p WHERE p.contract_number=cn)
      OR b."ID" IN(SELECT r.replacement_billboard_id FROM public.paused_billboard_replacements r WHERE r.contract_number=cn);
  SELECT to_jsonb(c) INTO customer FROM public.customers c WHERE c.id::text=p_record->>'customer_id' LIMIT 1;
  customer:=COALESCE(customer,'{}'::jsonb) || jsonb_build_object('name',p_record->>'Customer Name');
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.term_order),'[]'::jsonb) INTO terms FROM public.contract_terms t WHERE t.is_active;
  SELECT count(*)::text || '/' || to_char((p_record->>'Contract Date')::date,'YY') INTO yearly_code FROM public."Contract" c
    WHERE extract(year FROM c."Contract Date"::date)=extract(year FROM (p_record->>'Contract Date')::date) AND c."Contract_Number"<=cn;
  RETURN p_record || jsonb_build_object('_snapshot_yearly_code',yearly_code,'_document_snapshot',true,'_snapshot_billboards',active_boards,
    '_snapshot_catalog',catalog,'_snapshot_paused',paused,'_snapshot_replacements',replacements,
    '_snapshot_customer',customer,'_snapshot_terms',terms);
END $$;

REVOKE ALL ON FUNCTION public.snapshot_contract_document(jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.contract_amendment_status(p_contract_number bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE c public."Contract"%ROWTYPE; ids text[]; latest integer; fully_installed boolean;
BEGIN
  SELECT * INTO STRICT c FROM public."Contract" WHERE "Contract_Number"=p_contract_number;
  ids:=array_remove(regexp_split_to_array(COALESCE(c.billboard_ids,''),'\s*,\s*'),'');
  SELECT max(amendment_number) INTO latest FROM public.contract_amendments WHERE contract_number=p_contract_number;
  fully_installed:=cardinality(ids)>0 AND NOT EXISTS(SELECT 1 FROM unnest(ids) id
    WHERE NOT public.contract_board_is_installed(p_contract_number,id::bigint));
  RETURN jsonb_build_object('enabled',fully_installed OR latest IS NOT NULL,'fullyInstalled',fully_installed,
    'latestNumber',COALESCE(latest,0),'originalSaved',latest IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.contract_amendment_status(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contract_amendment_status(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_contract_amendment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_data jsonb; new_data jsonb; ids text[]; latest integer; existing public.contract_amendments%ROWTYPE;
  before_doc jsonb; after_doc jsonb; diff jsonb;
BEGIN
  old_data:=public.contract_version_business_data(to_jsonb(OLD));
  new_data:=public.contract_version_business_data(to_jsonb(NEW));
  IF old_data=new_data THEN RETURN NEW; END IF;
  SELECT max(amendment_number) INTO latest FROM public.contract_amendments WHERE contract_number=NEW."Contract_Number";
  IF latest IS NULL THEN
    ids:=array_remove(regexp_split_to_array(COALESCE(OLD.billboard_ids,''),'\s*,\s*'),'');
    IF cardinality(ids)=0 OR EXISTS(SELECT 1 FROM unnest(ids) id
        WHERE NOT public.contract_board_is_installed(OLD."Contract_Number"::bigint,id::bigint)) THEN RETURN NEW; END IF;
    before_doc:=public.snapshot_contract_document(to_jsonb(OLD));
    INSERT INTO public.contract_amendments(contract_number,amendment_number,transaction_id,created_by,snapshot,previous_snapshot,total_before,total_after)
      VALUES(OLD."Contract_Number",0,txid_current(),auth.uid(),before_doc,before_doc,COALESCE(OLD."Total",0),COALESCE(OLD."Total",0));
    latest:=0;
  END IF;
  -- A pause + replacement may update Contract twice: preserve one numbered document per transaction.
  SELECT * INTO existing FROM public.contract_amendments WHERE contract_number=NEW."Contract_Number"
    AND transaction_id=txid_current() AND amendment_number>0;
  before_doc:=COALESCE(existing.previous_snapshot,before_doc,public.snapshot_contract_document(to_jsonb(OLD)));
  old_data:=public.contract_version_business_data(before_doc);
  IF old_data=new_data THEN
    IF existing.id IS NOT NULL THEN DELETE FROM public.contract_amendments WHERE id=existing.id; END IF;
    RETURN NEW;
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('field',k,'before',old_data->k,'after',new_data->k) ORDER BY k),'[]'::jsonb)
    INTO diff FROM (SELECT jsonb_object_keys(old_data||new_data) k) keys WHERE old_data->k IS DISTINCT FROM new_data->k;
  after_doc:=public.snapshot_contract_document(to_jsonb(NEW));
  IF existing.id IS NULL THEN
    INSERT INTO public.contract_amendments(contract_number,amendment_number,transaction_id,created_by,snapshot,previous_snapshot,changes,total_before,total_after)
      VALUES(NEW."Contract_Number",latest+1,txid_current(),auth.uid(),after_doc,before_doc,diff,COALESCE(OLD."Total",0),COALESCE(NEW."Total",0));
  ELSE
    UPDATE public.contract_amendments SET snapshot=after_doc,changes=diff,total_after=COALESCE(NEW."Total",0) WHERE id=existing.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.capture_contract_amendment() FROM PUBLIC;
DROP TRIGGER IF EXISTS capture_contract_amendment ON public."Contract";
CREATE TRIGGER capture_contract_amendment AFTER UPDATE ON public."Contract"
  FOR EACH ROW EXECUTE FUNCTION public.capture_contract_amendment();
