-- ═══════════════════════════════════════════════════════════════════════════
-- 20 — دورة حياة اللوحات المركبة وحذف قيد BILLBOARD_ALREADY_BOOKED من تعديل العقود
-- ═══════════════════════════════════════════════════════════════════════════

-- Board lifecycle: pending work is removed; installed boards retain service charges.
CREATE OR REPLACE FUNCTION public.contract_board_is_installed(p_contract bigint,p_board bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.installation_task_items i JOIN public.installation_tasks t ON t.id=i.task_id
    WHERE t.contract_id=p_contract AND i.billboard_id=p_board AND (i.status='completed' OR i.installation_date IS NOT NULL OR i.completed_at IS NOT NULL))
  OR EXISTS(SELECT 1 FROM public.billboard_history h WHERE h.contract_number=p_contract AND h.billboard_id=p_board AND h.installation_date IS NOT NULL AND COALESCE(h.task_type,'installation')='installation')
$$;
REVOKE ALL ON FUNCTION public.contract_board_is_installed(bigint,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contract_board_is_installed(bigint,bigint) TO authenticated;

-- Remove BILLBOARD_ALREADY_BOOKED restriction from save_contract_edit_atomic
-- Allows contract editing to reassign / override billboard assignments directly.

CREATE OR REPLACE FUNCTION public.save_contract_edit_atomic(
  p_contract_number bigint, p_updates jsonb, p_expected_revision bigint, p_task_types jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  c public."Contract"%ROWTYPE; b public.billboards%ROWTYPE;
  old_ids text[]; new_ids text[]; columns_sql text; values_sql text; k text;
  installments jsonb; sibling jsonb; patch jsonb; old_prices jsonb; prices jsonb; row_price jsonb; old_price jsonb;
  paid numeric; total numeric; due numeric; rate numeric; old_contribution numeric; new_contribution numeric;
  friend jsonb; target_task_id uuid; board_id text; item_table text; task_table text; kind text; affected bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO STRICT c FROM public."Contract" WHERE "Contract_Number" = p_contract_number FOR UPDATE;
  IF c.edit_revision <> p_expected_revision THEN RAISE EXCEPTION 'CONTRACT_VERSION_CONFLICT'; END IF;
  IF jsonb_typeof(p_updates) <> 'object' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  patch := p_updates - ARRAY['Contract_Number','id','edit_revision','Total Paid','Remaining','created_at','updated_at'];
  prices := COALESCE(patch->'billboard_prices', '[]'::jsonb);
  IF jsonb_typeof(prices) = 'string' THEN prices := (prices #>> '{}')::jsonb; END IF;
  IF jsonb_typeof(prices) <> 'array' THEN RAISE EXCEPTION 'INVALID_PRICES'; END IF;
  old_prices := COALESCE(to_jsonb(c)->'billboard_prices','[]'::jsonb);
  IF jsonb_typeof(old_prices) = 'string' THEN old_prices := COALESCE(NULLIF(old_prices #>> '{}','')::jsonb,'[]'::jsonb); END IF;
  old_ids := regexp_split_to_array(COALESCE(c.billboard_ids,''), '\s*,\s*');
  IF jsonb_typeof(patch->'billboard_ids') = 'array' THEN
    SELECT COALESCE(array_agg(value), ARRAY[]::text[]) INTO new_ids FROM jsonb_array_elements_text(patch->'billboard_ids');
  ELSE new_ids := regexp_split_to_array(COALESCE(patch->>'billboard_ids',''), '\s*,\s*'); END IF;
  new_ids := array_remove(new_ids,'');
  IF EXISTS (SELECT 1 FROM unnest(new_ids) id GROUP BY id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM unnest(new_ids) id WHERE id !~ '^[0-9]+$') THEN RAISE EXCEPTION 'INVALID_BILLBOARD_IDS'; END IF;
  IF cardinality(new_ids) <> jsonb_array_length(prices) THEN RAISE EXCEPTION 'INCOMPLETE_PRICES'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(new_ids) id WHERE
    (SELECT count(*) FROM jsonb_array_elements(prices) p WHERE p->>'billboardId'=id) <> 1) THEN RAISE EXCEPTION 'INVALID_PRICES'; END IF;
  total := (patch->>'Total')::numeric;
  IF total IS NULL OR total < 0 OR total::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'INVALID_TOTAL'; END IF;
  IF (patch->>'End Date')::date < (patch->>'Contract Date')::date THEN RAISE EXCEPTION 'INVALID_DATES'; END IF;
  installments := patch->'installments_data';
  IF jsonb_typeof(installments)='string' THEN installments := (installments #>> '{}')::jsonb; END IF;
  IF installments IS NULL OR jsonb_typeof(installments)<>'array' OR jsonb_array_length(installments)=0 THEN RAISE EXCEPTION 'INVALID_INSTALLMENTS'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(installments) i WHERE
    NULLIF(i->>'amount','') IS NULL OR (i->>'amount')::numeric < 0 OR
    (i->>'amount')::numeric::text IN ('NaN','Infinity','-Infinity') OR
    NULLIF(i->>'dueDate','') IS NULL OR (i->>'dueDate')::date IS NULL) THEN RAISE EXCEPTION 'INVALID_INSTALLMENTS'; END IF;
  SELECT sum((i->>'amount')::numeric) INTO due FROM jsonb_array_elements(installments) i;
  IF round(due,2) <> round(total,2) THEN RAISE EXCEPTION 'INSTALLMENTS_MISMATCH'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(prices) p WHERE
    NULLIF(p->>'finalPrice','') IS NULL OR (p->>'finalPrice')::numeric<0 OR
    (p->>'finalPrice')::numeric::text IN ('NaN','Infinity','-Infinity') OR
    COALESCE(NULLIF(p->>'endDate','')::date,(patch->>'End Date')::date) <
    COALESCE(NULLIF(p->>'startDate','')::date,(patch->>'Contract Date')::date)) THEN RAISE EXCEPTION 'INVALID_PRICES'; END IF;
  -- A completed board must go through the pause settlement, never disappear from billing.
  IF EXISTS(SELECT 1 FROM unnest(old_ids) id WHERE id<>'' AND NOT(id=ANY(new_ids))
    AND public.contract_board_is_installed(p_contract_number,id::bigint)) THEN
    RAISE EXCEPTION 'INSTALLED_BILLBOARD_REQUIRES_PAUSE';
  END IF;
  -- Lock boards in deterministic order.
  FOR b IN SELECT * FROM public.billboards WHERE "ID"::text = ANY(old_ids || new_ids) ORDER BY "ID" FOR UPDATE LOOP
    IF b.is_partnership THEN
      SELECT value INTO row_price FROM jsonb_array_elements(prices) WHERE value->>'billboardId'=b."ID"::text LIMIT 1;
      SELECT value INTO old_price FROM jsonb_array_elements(old_prices) WHERE value->>'billboardId'=b."ID"::text LIMIT 1;
      SELECT COALESCE(pre_capital_pct,30)/100 INTO rate FROM public.shared_billboards WHERE billboard_id=b."ID" LIMIT 1;
      rate := COALESCE(rate,0.30);
      old_contribution := COALESCE((old_price->>'capitalContribution')::numeric,
        COALESCE((old_price->>'finalPrice')::numeric,(old_price->>'priceAfterDiscount')::numeric,0)*rate);
      new_contribution := COALESCE((row_price->>'finalPrice')::numeric,0)*rate;
      UPDATE public.billboards SET capital_remaining=greatest(0,COALESCE(capital_remaining,capital,0)+old_contribution-new_contribution) WHERE "ID"=b."ID";
      IF row_price IS NOT NULL THEN
        SELECT jsonb_agg(CASE WHEN p->>'billboardId'=b."ID"::text THEN p || jsonb_build_object('capitalContribution',new_contribution) ELSE p END) INTO prices FROM jsonb_array_elements(prices) p;
      END IF;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.billboards WHERE "ID"::text=ANY(new_ids)) <> cardinality(new_ids) THEN RAISE EXCEPTION 'MISSING_BILLBOARD'; END IF;
  paid := COALESCE(NULLIF(c."Total Paid"::text,'')::numeric,0);
  patch := patch || jsonb_build_object('billboard_ids',array_to_string(new_ids,','),'billboards_count',cardinality(new_ids),
    'billboard_prices',prices::text,'Remaining',greatest(0,total-paid)::text);
  -- jsonb_populate_record performs the real column-type conversions. Identifiers are quoted,
  -- and only existing writable Contract columns can be updated.
  SELECT string_agg(format('%I',a.attname),','),string_agg(format('r.%I',a.attname),',')
    INTO columns_sql,values_sql FROM pg_attribute a
    WHERE a.attrelid='public."Contract"'::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attgenerated=''
      AND patch ? a.attname;
  PERFORM set_config('app.contract_edit_installation_removal','true',true);
  EXECUTE format('UPDATE public."Contract" SET (%s)=(SELECT %s FROM jsonb_populate_record(NULL::public."Contract",$1) r) WHERE "Contract_Number"=$2',columns_sql,values_sql) USING to_jsonb(c)||patch,p_contract_number;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  UPDATE public.billboards SET "Contract_Number"=NULL,"Customer_Name"=NULL,"Ad_Type"=NULL,"Rent_Start_Date"=NULL,"Rent_End_Date"=NULL,"Status"='متاح'
    WHERE "Contract_Number"=p_contract_number AND "ID"::text=ANY(old_ids) AND NOT ("ID"::text=ANY(new_ids));
  UPDATE public.billboards target_board SET "Contract_Number"=p_contract_number,"Customer_Name"=patch->>'Customer Name',"Ad_Type"=patch->>'Ad Type',
    "Rent_Start_Date"=COALESCE(NULLIF(p->>'startDate','')::date,(patch->>'Contract Date')::date),
    "Rent_End_Date"=COALESCE(NULLIF(p->>'endDate','')::date,(patch->>'End Date')::date),"Status"='مؤجرة'
    FROM jsonb_array_elements(prices) p WHERE target_board."ID"::text=p->>'billboardId';
  -- Historical completed tasks are retained. Only explicitly selected pending work is removed.
  FOREACH kind IN ARRAY ARRAY['installation','print','cutout','removal'] LOOP
    IF kind='installation' OR COALESCE((p_task_types->>kind)::boolean,false) THEN
      item_table := kind || '_task_items'; task_table := kind || '_tasks';
      EXECUTE format('DELETE FROM public.%I i USING public.%I t WHERE i.task_id=t.id AND t.contract_id=$1 AND (COALESCE(t.status,'''')<>''completed'' OR $4=''installation'') AND COALESCE(i.status,'''')<>''completed'' AND i.billboard_id::text=ANY($2) AND NOT (i.billboard_id::text=ANY($3))',item_table,task_table) USING p_contract_number,old_ids,new_ids,kind;
    END IF;
  END LOOP;
  -- Extend existing pending production orders without changing completed history.
  FOR b IN SELECT * FROM public.billboards WHERE "ID"::text=ANY(new_ids) AND NOT ("ID"::text=ANY(old_ids)) LOOP
    SELECT id INTO target_task_id FROM public.print_tasks WHERE contract_id=p_contract_number AND COALESCE(status,'')<>'completed' ORDER BY created_at,id LIMIT 1;
    IF target_task_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.print_task_items i WHERE i.task_id=target_task_id AND billboard_id=b."ID") THEN
      SELECT to_jsonb(i) INTO sibling FROM public.print_task_items i JOIN public.billboards other ON other."ID"=i.billboard_id
        WHERE i.task_id=target_task_id AND other."Size"=b."Size" ORDER BY i.id LIMIT 1;
      INSERT INTO public.print_task_items(task_id,billboard_id,status,quantity,faces_count,unit_cost,customer_unit_cost,customer_unit_price,printer_unit_cost,width,height,area,total_cost,customer_total_cost,customer_total_price)
      VALUES(target_task_id,b."ID",'pending',1,COALESCE(b."Faces_Count",1),(sibling->>'unit_cost')::numeric,(sibling->>'customer_unit_cost')::numeric,
        (sibling->>'customer_unit_price')::numeric,(sibling->>'printer_unit_cost')::numeric,(sibling->>'width')::numeric,(sibling->>'height')::numeric,(sibling->>'area')::numeric,
        COALESCE((sibling->>'unit_cost')::numeric,0)*COALESCE((sibling->>'area')::numeric,1),
        COALESCE((sibling->>'customer_unit_cost')::numeric,0)*COALESCE((sibling->>'area')::numeric,1),
        COALESCE((sibling->>'customer_unit_price')::numeric,0)*COALESCE((sibling->>'area')::numeric,1));
    END IF;
    IF b.has_cutout THEN
      SELECT id INTO target_task_id FROM public.cutout_tasks WHERE contract_id=p_contract_number AND COALESCE(status,'')<>'completed' ORDER BY created_at,id LIMIT 1;
      IF target_task_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.cutout_task_items i WHERE i.task_id=target_task_id AND billboard_id=b."ID") THEN
        SELECT to_jsonb(i) INTO sibling FROM public.cutout_task_items i JOIN public.billboards other ON other."ID"=i.billboard_id
          WHERE i.task_id=target_task_id AND other."Size"=b."Size" ORDER BY i.id LIMIT 1;
        INSERT INTO public.cutout_task_items(task_id,billboard_id,status,quantity,unit_cost,total_cost)
          VALUES(target_task_id,b."ID",'pending',1,COALESCE((sibling->>'unit_cost')::numeric,0),COALESCE((sibling->>'unit_cost')::numeric,0));
      END IF;
    END IF;
  END LOOP;
  UPDATE public.installation_tasks t SET status='in_progress'
    WHERE t.contract_id=p_contract_number AND t.status='completed' AND COALESCE(t.task_type,'installation')='installation'
      AND EXISTS(SELECT 1 FROM public.installation_task_items i WHERE i.task_id=t.id AND i.billboard_id::text=ANY(new_ids) AND COALESCE(i.status,'pending')<>'completed');
  -- Only saves through this operation create addenda; swaps and resumes have their own history.
  IF EXISTS(SELECT 1 FROM unnest(old_ids) id WHERE id<>'' AND public.contract_board_is_installed(p_contract_number,id::bigint)) THEN
    SELECT jsonb_agg(p || jsonb_build_object('billboardName',added_board."Billboard_Name",'size',added_board."Size")) INTO sibling
      FROM jsonb_array_elements(prices) p JOIN public.billboards added_board ON added_board."ID"::text=p->>'billboardId'
      WHERE NOT(p->>'billboardId'=ANY(old_ids));
    IF sibling IS NOT NULL THEN
      INSERT INTO public.activity_log(action,entity_type,entity_id,contract_number,description,details,user_id)
      VALUES('contract_addendum','contract',p_contract_number::text,p_contract_number,'ملحق إضافة لوحات بعد التركيب',
        jsonb_build_object('revision',c.edit_revision+1,'boards',sibling,'currency',COALESCE(patch->>'contract_currency',to_jsonb(c)->>'contract_currency','LYD'),
          'previousTotal',c."Total",'total',total),auth.uid());
    END IF;
  END IF;
  -- Contract triggers retain responsibility for assigning new installation work to teams.
  DELETE FROM public.friend_billboard_rentals WHERE contract_number=p_contract_number AND NOT (billboard_id::text=ANY(new_ids));
  FOR friend IN SELECT value FROM jsonb_array_elements(COALESCE(NULLIF(p_updates->'friend_rental_data','null'::jsonb),'[]'::jsonb)) LOOP
    IF (friend->>'billboardId')=ANY(new_ids) THEN
      INSERT INTO public.friend_billboard_rentals(contract_number,billboard_id,friend_company_id,friend_rental_cost,customer_rental_price,start_date,end_date)
      SELECT p_contract_number,friend_board."ID",friend_board.friend_company_id,(friend->>'friendRentalCost')::numeric,
        COALESCE((p->>'finalPrice')::numeric,0),(patch->>'Contract Date')::date,(patch->>'End Date')::date
      FROM public.billboards friend_board JOIN jsonb_array_elements(prices) p ON p->>'billboardId'=friend_board."ID"::text
      WHERE friend_board."ID"::text=friend->>'billboardId' AND friend_board.friend_company_id IS NOT NULL
      ON CONFLICT (contract_number,billboard_id) DO UPDATE SET friend_company_id=EXCLUDED.friend_company_id,
        friend_rental_cost=EXCLUDED.friend_rental_cost,customer_rental_price=EXCLUDED.customer_rental_price,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date;
    END IF;
  END LOOP;
  INSERT INTO public.activity_log(action,entity_type,entity_id,contract_number,description,details,user_id)
  VALUES('contract_updated','contract',p_contract_number::text,p_contract_number,'تعديل العقد',
    jsonb_build_object('previousRevision',c.edit_revision,'previousTotal',c."Total",'total',total,'previousBillboardIds',old_ids,'billboardIds',new_ids),auth.uid());
  RETURN (SELECT to_jsonb(x) FROM public."Contract" x WHERE "Contract_Number"=p_contract_number);
END $$;
REVOKE ALL ON FUNCTION public.save_contract_edit_atomic(bigint,jsonb,bigint,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_contract_edit_atomic(bigint,jsonb,bigint,jsonb) TO authenticated;

-- Zero pause refund means no contribution. Keep edits and deletion atomic.
CREATE OR REPLACE FUNCTION public.edit_paused_billboard_atomic(p_pause_id uuid,p_patch jsonb,p_delete boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  paused public.paused_billboards%ROWTYPE; c public."Contract"%ROWTYPE; cn bigint;
  full_price numeric; refund numeric; consumed numeric; delta numeric; changed_date date; days integer; elapsed integer;
  affected bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT contract_number INTO STRICT cn FROM public.paused_billboards WHERE id=p_pause_id;
  SELECT * INTO STRICT c FROM public."Contract" WHERE "Contract_Number"=cn FOR UPDATE;
  SELECT * INTO STRICT paused FROM public.paused_billboards WHERE id=p_pause_id FOR UPDATE;
  IF paused.lifecycle_state<>'paused' OR EXISTS(SELECT 1 FROM public.paused_billboard_replacements WHERE paused_billboard_id=p_pause_id) THEN RAISE EXCEPTION 'PAUSE_HAS_DEPENDENT_OPERATION'; END IF;
  IF p_delete THEN delta:=-paused.consumed_amount;
  ELSE
    changed_date:=COALESCE(NULLIF(p_patch->>'pause_date','')::date,paused.pause_date::date);
    IF changed_date<paused.original_start_date::date OR changed_date>paused.original_end_date::date THEN RAISE EXCEPTION 'INVALID_PAUSE_DATE'; END IF;
    full_price:=COALESCE(paused.full_price,paused.original_price);
    days:=paused.original_end_date::date-paused.original_start_date::date+1;
    elapsed:=changed_date-paused.original_start_date::date;
    refund:=CASE WHEN p_patch ? 'manual_refund' THEN (p_patch->>'manual_refund')::numeric ELSE paused.manual_refund END;
    refund:=COALESCE(refund,round(paused.net_rent*(days-elapsed)/greatest(days,1),2));
    IF refund<0 OR refund>paused.net_rent OR refund::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'INVALID_REFUND'; END IF;
    consumed:=CASE WHEN COALESCE((paused.price_snapshot->>'retainExecutedServices')::boolean,false) THEN full_price-refund WHEN refund=0 THEN 0 ELSE full_price-refund END; delta:=consumed-paused.consumed_amount;
    UPDATE public.paused_billboards SET pause_date=changed_date,refund_amount=refund,consumed_amount=consumed,
      manual_refund=CASE WHEN p_patch ? 'manual_refund' THEN (p_patch->>'manual_refund')::numeric ELSE manual_refund END,
      notes=COALESCE(p_patch->>'notes',notes) WHERE id=p_pause_id;
    GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  END IF;
  UPDATE public."Contract" SET "Total"=greatest(0,COALESCE("Total",0)+delta),"Total Rent"=COALESCE("Total Rent",0)+delta,
    "Remaining"=greatest(0,COALESCE("Total",0)+delta-COALESCE(NULLIF("Total Paid"::text,'')::numeric,0))::text WHERE "Contract_Number"=cn;
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  INSERT INTO public.activity_log(action,entity_type,entity_id,contract_number,description,details,user_id)
    VALUES(CASE WHEN p_delete THEN 'pause_deleted' ELSE 'pause_updated' END,'contract',cn::text,cn,'تعديل سجل الإيقاف',
      jsonb_build_object('previous',to_jsonb(paused),'changes',p_patch,'delta',delta),auth.uid());
  IF p_delete THEN
    UPDATE public.paused_billboards SET lifecycle_state='cancelled' WHERE id=p_pause_id;
    GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  END IF;
  RETURN jsonb_build_object('contractNumber',cn,'billboardId',paused.billboard_id,'delta',delta);
END $$;
REVOKE ALL ON FUNCTION public.edit_paused_billboard_atomic(uuid,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_paused_billboard_atomic(uuid,jsonb,boolean) TO authenticated;


CREATE OR REPLACE FUNCTION public.pause_contract_billboard_atomic(
  p_contract_number bigint, p_billboard_id bigint, p_pause_date date,
  p_notes text DEFAULT '', p_manual_refund numeric DEFAULT NULL, p_expected_revision bigint DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  c public."Contract"%ROWTYPE; b public.billboards%ROWTYPE; prices jsonb; price jsonb;
  ids text[]; starts date; ends date; days integer; elapsed integer;
  full_price numeric; services numeric; rental numeric; refund numeric; pause_id uuid;
  affected bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO STRICT c FROM public."Contract" WHERE "Contract_Number"=p_contract_number FOR UPDATE;
  IF p_expected_revision IS NOT NULL AND c.edit_revision<>p_expected_revision THEN RAISE EXCEPTION 'CONTRACT_VERSION_CONFLICT'; END IF;
  SELECT * INTO STRICT b FROM public.billboards WHERE "ID"=p_billboard_id FOR UPDATE;
  ids := regexp_split_to_array(COALESCE(c.billboard_ids,''),'\s*,\s*');
  IF NOT (p_billboard_id::text=ANY(ids)) OR b."Contract_Number" IS DISTINCT FROM p_contract_number THEN RAISE EXCEPTION 'BILLBOARD_NOT_IN_CONTRACT'; END IF;
  prices := COALESCE(NULLIF(c.billboard_prices::text,'')::jsonb,'[]'::jsonb);
  IF jsonb_typeof(prices)='string' THEN prices:=(prices #>> '{}')::jsonb; END IF;
  SELECT p INTO price FROM jsonb_array_elements(prices) p WHERE COALESCE(p->>'billboardId',p->>'billboard_id')=p_billboard_id::text LIMIT 1;
  IF price IS NULL THEN RAISE EXCEPTION 'MISSING_SAVED_PRICE'; END IF;
  starts := COALESCE(NULLIF(price->>'startDate','')::date,b."Rent_Start_Date"::date,c."Contract Date"::date);
  ends := COALESCE(NULLIF(price->>'endDate','')::date,b."Rent_End_Date"::date,c."End Date"::date);
  IF p_pause_date IS NULL OR starts IS NULL OR ends IS NULL OR ends<starts OR p_pause_date<starts OR p_pause_date>ends THEN RAISE EXCEPTION 'INVALID_PAUSE_DATE'; END IF;
  full_price := COALESCE((price->>'finalPrice')::numeric,(price->>'priceAfterDiscount')::numeric,(price->>'contractPrice')::numeric);
  IF full_price IS NULL OR full_price<0 THEN RAISE EXCEPTION 'INVALID_SAVED_PRICE'; END IF;
  IF public.contract_board_is_installed(p_contract_number,p_billboard_id) THEN
    price := price || jsonb_build_object('retainExecutedServices',true,
      'printCost',CASE WHEN COALESCE(to_jsonb(c)->>'print_cost_enabled','false') IN ('true','1') THEN COALESCE((price->>'printCost')::numeric,0) ELSE 0 END,
      'installationCost',CASE WHEN COALESCE(to_jsonb(c)->>'installation_enabled','true') IN ('true','1') THEN COALESCE((price->>'installationCost')::numeric,0) ELSE 0 END);
  END IF;
  services := least(full_price,COALESCE((price->>'printCost')::numeric,0)+COALESCE((price->>'installationCost')::numeric,0));
  rental := greatest(0,full_price-services); days:=ends-starts+1; elapsed:=p_pause_date-starts;
  refund:=COALESCE(p_manual_refund,round(rental*(days-elapsed)/days,2));
  IF refund<0 OR refund>rental OR refund::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'INVALID_REFUND'; END IF;
  INSERT INTO public.paused_billboards(contract_number,billboard_id,billboard_name,pause_date,original_price,net_rent,full_price,
    consumed_amount,refund_amount,manual_refund,original_start_date,original_end_date,deducted_from_contract,notes,price_snapshot,price_before_discount,net_after_discount)
  VALUES(p_contract_number,p_billboard_id,b."Billboard_Name",p_pause_date,full_price,rental,full_price,CASE WHEN COALESCE((price->>'retainExecutedServices')::boolean,false) THEN full_price-refund WHEN refund=0 THEN 0 ELSE full_price-refund END,refund,p_manual_refund,
    starts,ends,true,p_notes,price,COALESCE((price->>'basePriceBeforeDiscount')::numeric,full_price),full_price) RETURNING id INTO pause_id;
  ids:=array_remove(ids,p_billboard_id::text);
  SELECT COALESCE(jsonb_agg(p),'[]'::jsonb) INTO prices FROM jsonb_array_elements(prices) p WHERE COALESCE(p->>'billboardId',p->>'billboard_id')<>p_billboard_id::text;
  -- Remove unfinished installation work even when the last board leaves the contract.
  DELETE FROM public.installation_task_items i USING public.installation_tasks t
    WHERE i.task_id=t.id AND t.contract_id=p_contract_number AND i.billboard_id=p_billboard_id
      AND COALESCE(i.status,'')<>'completed' AND i.installation_date IS NULL AND i.completed_at IS NULL;
  UPDATE public.installation_task_items i SET replacement_status='replaced',replacement_reason='إيقاف بعد التركيب',replacement_cost_bearer='customer'
    FROM public.installation_tasks t WHERE i.task_id=t.id AND t.contract_id=p_contract_number AND i.billboard_id=p_billboard_id;
  UPDATE public."Contract" SET billboard_ids=array_to_string(ids,','),billboards_count=cardinality(ids),billboard_prices=prices::text,
    "Total"=greatest(0,COALESCE("Total",0)-CASE WHEN refund=0 AND NOT COALESCE((price->>'retainExecutedServices')::boolean,false) THEN full_price ELSE refund END),"Total Rent"=COALESCE("Total Rent",0)-CASE WHEN refund=0 AND NOT COALESCE((price->>'retainExecutedServices')::boolean,false) THEN full_price ELSE refund END,
    "Remaining"=greatest(0,COALESCE("Total",0)-CASE WHEN refund=0 AND NOT COALESCE((price->>'retainExecutedServices')::boolean,false) THEN full_price ELSE refund END-COALESCE(NULLIF("Total Paid"::text,'')::numeric,0))::text
    WHERE "Contract_Number"=p_contract_number;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  UPDATE public.billboards SET "Contract_Number"=NULL,"Customer_Name"=NULL,"Ad_Type"=NULL,"Rent_Start_Date"=NULL,"Rent_End_Date"=NULL,"Status"='متاح',is_visible_in_available=CASE WHEN is_visible_in_available=false THEN false ELSE NULL END WHERE "ID"=p_billboard_id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  INSERT INTO public.activity_log(action,entity_type,entity_id,contract_number,description,details,user_id)
    VALUES('billboard_paused','contract',p_contract_number::text,p_contract_number,'إيقاف لوحة من العقد',
      jsonb_build_object('pauseId',pause_id,'billboardId',p_billboard_id,'pauseDate',p_pause_date,'refund',refund,'priceSnapshot',price),auth.uid());
  RETURN jsonb_build_object('success',true,'pauseRefund',refund,'newBillboardIds',to_jsonb(ids),'pauseId',pause_id);
END $$;
REVOKE ALL ON FUNCTION public.pause_contract_billboard_atomic(bigint,bigint,date,text,numeric,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pause_contract_billboard_atomic(bigint,bigint,date,text,numeric,bigint) TO authenticated;



-- Atomic pause + replacement: the old executed services remain billable and the
-- remaining rental allocation funds the new board. Retry returns the same result.
CREATE OR REPLACE FUNCTION public.replace_contract_billboard_lifecycle(
  p_contract_number bigint,p_original_billboard_id bigint,p_replacement_billboard_id bigint,
  p_user_id text DEFAULT NULL,p_swap_event_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c public."Contract"%ROWTYPE; b public.billboards%ROWTYPE; candidate public.billboards%ROWTYPE;
  result jsonb; paused jsonb; record public.paused_billboards%ROWTYPE; effective date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO STRICT c FROM public."Contract" WHERE "Contract_Number"=p_contract_number FOR UPDATE;
  SELECT details->'result' INTO result FROM public.activity_log WHERE contract_number=p_contract_number
    AND action='installed_board_swap' AND details->>'requestId'=p_swap_event_id LIMIT 1;
  IF result IS NOT NULL THEN RETURN result || jsonb_build_object('already_processed',true); END IF;
  IF NOT public.contract_board_is_installed(p_contract_number,p_original_billboard_id) THEN
    RETURN public.execute_instant_billboard_swap(p_contract_number,p_original_billboard_id,p_replacement_billboard_id,p_user_id,p_swap_event_id);
  END IF;
  PERFORM 1 FROM public.billboards WHERE "ID" IN(p_original_billboard_id,p_replacement_billboard_id) ORDER BY "ID" FOR UPDATE;
  SELECT * INTO STRICT b FROM public.billboards WHERE "ID"=p_original_billboard_id;
  SELECT * INTO STRICT candidate FROM public.billboards WHERE "ID"=p_replacement_billboard_id;
  IF p_original_billboard_id=p_replacement_billboard_id THEN RAISE EXCEPTION 'SAME_BILLBOARD'; END IF;
  IF candidate."Contract_Number" IS NOT NULL OR candidate.is_visible_in_available=false OR candidate."Status" IN ('صيانة','إزالة') THEN RAISE EXCEPTION 'CANDIDATE_NOT_AVAILABLE'; END IF;
  IF b.size_id IS NULL OR b.size_id IS DISTINCT FROM candidate.size_id THEN RAISE EXCEPTION 'يجب اختيار لوحة بديلة بنفس المقاس'; END IF;
  effective:=greatest(COALESCE(b."Rent_Start_Date"::date,c."Contract Date"::date),
    least((now() AT TIME ZONE 'Africa/Tripoli')::date,COALESCE(b."Rent_End_Date"::date,c."End Date"::date)));
  paused:=public.pause_contract_billboard_atomic(p_contract_number,p_original_billboard_id,effective,'استبدال لوحة مركبة مع الاحتفاظ بتكاليف الخدمات',NULL,c.edit_revision);
  SELECT * INTO STRICT record FROM public.paused_billboards WHERE id=(paused->>'pauseId')::uuid;
  PERFORM public.replace_paused_billboard_atomic(record.id,p_replacement_billboard_id,effective,record.original_end_date::date,record.refund_amount);
  UPDATE public.installation_tasks t SET status='in_progress' WHERE t.contract_id=p_contract_number AND t.status='completed'
    AND EXISTS(SELECT 1 FROM public.installation_task_items i WHERE i.task_id=t.id AND i.billboard_id=p_replacement_billboard_id AND i.status='pending');
  SELECT * INTO STRICT c FROM public."Contract" WHERE "Contract_Number"=p_contract_number;
  result:=jsonb_build_object('success',true,'contract_number',p_contract_number,'original_billboard_id',p_original_billboard_id,
    'replacement_billboard_id',p_replacement_billboard_id,'preserved_contract_price',record.full_price,
    'contract_total_before',c."Total",'contract_total_after',c."Total",'new_billboard_ids',to_jsonb(string_to_array(c.billboard_ids,',')),
    'updated_billboard_prices',c.billboard_prices::jsonb,'pause_id',record.id);
  INSERT INTO public.activity_log(action,entity_type,entity_id,contract_number,description,details,user_id)
    VALUES('installed_board_swap','contract',p_contract_number::text,p_contract_number,'استبدال لوحة مركبة مع حفظ تكاليفها',
      jsonb_build_object('requestId',p_swap_event_id,'result',result),auth.uid());
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.replace_contract_billboard_lifecycle(bigint,bigint,bigint,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_contract_billboard_lifecycle(bigint,bigint,bigint,text,text) TO authenticated;
