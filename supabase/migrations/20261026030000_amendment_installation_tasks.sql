-- Numbered addenda have separate installation work, per assigned team.
ALTER TABLE public.installation_tasks ADD COLUMN IF NOT EXISTS amendment_number integer;
CREATE INDEX IF NOT EXISTS installation_tasks_amendment ON public.installation_tasks(contract_id,amendment_number);
-- AFTER triggers run alphabetically: capture the document before automatic task allocation.
DROP TRIGGER IF EXISTS capture_contract_amendment ON public."Contract";
DROP TRIGGER IF EXISTS a00_capture_contract_amendment ON public."Contract";
CREATE TRIGGER a00_capture_contract_amendment AFTER UPDATE ON public."Contract"
  FOR EACH ROW EXECUTE FUNCTION public.capture_contract_amendment();

CREATE OR REPLACE FUNCTION public.auto_create_installation_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  billboard_id_array int[];
  bb RECORD;
  best_team_id uuid;
  task_id_var uuid;
  amendment_no integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.billboard_ids IS NOT DISTINCT FROM NEW.billboard_ids THEN RETURN NEW; END IF;
    SELECT amendment_number INTO amendment_no FROM public.contract_amendments
      WHERE contract_number=NEW."Contract_Number" AND transaction_id=txid_current() AND amendment_number>0;
  END IF;


  SELECT array_agg(trim(val)::int)
  INTO billboard_id_array
  FROM unnest(string_to_array(NEW.billboard_ids, ',')) AS val
  WHERE trim(val) ~ '^\d+$';

  billboard_id_array := COALESCE(billboard_id_array, ARRAY[]::int[]);

  IF TG_OP = 'UPDATE' AND OLD.billboard_ids IS DISTINCT FROM NEW.billboard_ids THEN
    DECLARE
      old_ids int[];
      removed_ids int[];
    BEGIN
      IF OLD.billboard_ids IS NOT NULL AND OLD.billboard_ids != '' THEN
        SELECT array_agg(trim(val)::int)
        INTO old_ids
        FROM unnest(string_to_array(OLD.billboard_ids, ',')) AS val
        WHERE trim(val) ~ '^\d+$';
      END IF;

      IF old_ids IS NOT NULL THEN
        SELECT array_agg(oid)
        INTO removed_ids
        FROM unnest(old_ids) AS oid
        WHERE oid != ALL(billboard_id_array);

        IF removed_ids IS NOT NULL AND array_length(removed_ids, 1) > 0 THEN
          DELETE FROM installation_task_items
          WHERE billboard_id = ANY(removed_ids)
            AND task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number")
            AND COALESCE(status,'pending') != 'completed' AND installation_date IS NULL AND completed_at IS NULL
            AND COALESCE(NULLIF(current_setting('app.contract_edit_installation_removal',true),''),'true')::boolean
            AND NOT EXISTS (SELECT 1 FROM installation_tasks parent_task WHERE parent_task.id=installation_task_items.task_id AND parent_task.status='completed');
        END IF;
      END IF;
    END;

    FOR bb IN
      SELECT b."ID", b."Size", b."City", COALESCE(b."Faces_Count", 2) as faces, b.friend_company_id
      FROM billboards b
      WHERE b."ID" = ANY(billboard_id_array)
        AND b."ID" NOT IN (
          SELECT iti.billboard_id FROM installation_task_items iti
          JOIN installation_tasks it ON iti.task_id = it.id
          WHERE it.contract_id = NEW."Contract_Number"
        )
    LOOP
      best_team_id := NULL;
      
      -- Step 1: match by friend_company + size + city
      IF bb.friend_company_id IS NOT NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
          AND t.friend_company_ids IS NOT NULL
          AND array_length(t.friend_company_ids, 1) > 0
          AND bb.friend_company_id = ANY(t.friend_company_ids)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;
      
      -- Step 2: match by size + city (general teams only)
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
          AND (t.friend_company_ids IS NULL OR array_length(t.friend_company_ids, 1) IS NULL OR array_length(t.friend_company_ids, 1) = 0)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Step 3: match by size + city (ANY team including company-linked)
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Step 4: match by size only
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Step 5 (LAST RESORT): pick any team
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      IF true THEN
        SELECT id INTO task_id_var
        FROM installation_tasks
        WHERE contract_id = NEW."Contract_Number" AND team_id IS NOT DISTINCT FROM best_team_id
          AND amendment_number IS NOT DISTINCT FROM amendment_no
          AND COALESCE(task_type,'installation')='installation'
        ORDER BY created_at ASC
        LIMIT 1;

        IF task_id_var IS NULL THEN
          INSERT INTO installation_tasks (contract_id, team_id, status, task_type, amendment_number)
          VALUES (NEW."Contract_Number", best_team_id, 'pending', 'installation', amendment_no)
          RETURNING id INTO task_id_var;
        END IF;

        INSERT INTO installation_task_items (task_id, billboard_id, status, faces_to_install)
        VALUES (task_id_var, bb."ID", 'pending', bb.faces)
        ON CONFLICT (task_id, billboard_id) DO NOTHING;
      END IF;
    END LOOP;

    DELETE FROM installation_tasks
    WHERE contract_id = NEW."Contract_Number"
      AND id NOT IN (
        SELECT DISTINCT task_id FROM installation_task_items
        WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number")
      );
  ELSE
    FOR bb IN
      SELECT b."ID", b."Size", b."City", COALESCE(b."Faces_Count", 2) as faces, b.friend_company_id
      FROM billboards b
      WHERE b."ID" = ANY(billboard_id_array)
    LOOP
      best_team_id := NULL;
      
      -- Step 1: match by friend_company + size + city
      IF bb.friend_company_id IS NOT NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
          AND t.friend_company_ids IS NOT NULL
          AND array_length(t.friend_company_ids, 1) > 0
          AND bb.friend_company_id = ANY(t.friend_company_ids)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;
      
      -- Step 2: general teams matching size + city
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
          AND (t.friend_company_ids IS NULL OR array_length(t.friend_company_ids, 1) IS NULL OR array_length(t.friend_company_ids, 1) = 0)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Step 3: ANY team matching size + city (including company-linked)
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Step 4: size only
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Step 5: any team
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      IF true THEN
        SELECT id INTO task_id_var
        FROM installation_tasks
        WHERE contract_id = NEW."Contract_Number" AND team_id IS NOT DISTINCT FROM best_team_id
          AND amendment_number IS NOT DISTINCT FROM amendment_no
          AND COALESCE(task_type,'installation')='installation'
        ORDER BY created_at ASC
        LIMIT 1;

        IF task_id_var IS NULL THEN
          INSERT INTO installation_tasks (contract_id, team_id, status, task_type, amendment_number)
          VALUES (NEW."Contract_Number", best_team_id, 'pending', 'installation', amendment_no)
          RETURNING id INTO task_id_var;
        END IF;

        INSERT INTO installation_task_items (task_id, billboard_id, status, faces_to_install)
        VALUES (task_id_var, bb."ID", 'pending', bb.faces)
        ON CONFLICT (task_id, billboard_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.auto_create_installation_tasks() FROM PUBLIC;

-- Legacy contracts can have null prices; still preserve their original document.
CREATE OR REPLACE FUNCTION public.snapshot_contract_document(p_record jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE cn bigint; ids text[]; active_boards jsonb; catalog jsonb; paused jsonb; replacements jsonb;
  customer jsonb; terms jsonb; prices jsonb; yearly_code text;
BEGIN
  cn:=(p_record->>'Contract_Number')::bigint;
  ids:=array_remove(regexp_split_to_array(COALESCE(p_record->>'billboard_ids',''),'\s*,\s*'),'');
  prices:=COALESCE(p_record->'billboard_prices','[]'::jsonb);
  IF jsonb_typeof(prices)='string' THEN prices:=COALESCE(NULLIF(prices#>>'{}','')::jsonb,'[]'::jsonb); END IF;
  IF jsonb_typeof(prices) IS DISTINCT FROM 'array' THEN prices := '[]'::jsonb; END IF;
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

