-- Create physical removal work for installed boards removed by a numbered amendment.
ALTER TABLE public.removal_tasks ADD COLUMN IF NOT EXISTS amendment_number integer;
CREATE INDEX IF NOT EXISTS removal_tasks_amendment ON public.removal_tasks(contract_id,amendment_number);

-- Record already performed force-majeure removal, preserving contract settlement and evidence.
CREATE OR REPLACE FUNCTION public.create_amendment_removal_tasks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE amendment_no integer; final_ids text[]; board_id bigint; task_uuid uuid; team_uuid uuid;
  source_item public.installation_task_items%ROWTYPE;
BEGIN
  IF OLD.billboard_ids IS NOT DISTINCT FROM NEW.billboard_ids THEN RETURN NEW; END IF;
  SELECT amendment_number INTO amendment_no FROM public.contract_amendments
    WHERE contract_number=NEW."Contract_Number" AND transaction_id=txid_current() AND amendment_number>0;
  IF amendment_no IS NULL THEN RETURN NEW; END IF;
  SELECT array_remove(regexp_split_to_array(COALESCE(c.billboard_ids,''),'\s*,\s*'),'') INTO final_ids
    FROM public."Contract" c WHERE c."Contract_Number"=NEW."Contract_Number";
  IF NOT FOUND THEN RETURN NEW; END IF;
  FOR board_id IN SELECT DISTINCT trim(x)::bigint FROM unnest(string_to_array(COALESCE(OLD.billboard_ids,''),',')) x
    WHERE trim(x) ~ '^\d+$' AND NOT(trim(x)=ANY(final_ids))
  LOOP
    IF NOT public.contract_board_is_installed(NEW."Contract_Number"::bigint,board_id) THEN CONTINUE; END IF;
    -- Idempotent across multiple writes to the contract in this transaction.
    IF EXISTS(SELECT 1 FROM public.removal_task_items i JOIN public.removal_tasks t ON t.id=i.task_id
      WHERE t.contract_id=NEW."Contract_Number" AND t.amendment_number=amendment_no AND i.billboard_id=board_id) THEN CONTINUE; END IF;
    SELECT i.* INTO source_item FROM public.installation_task_items i JOIN public.installation_tasks t ON t.id=i.task_id
      WHERE t.contract_id=NEW."Contract_Number" AND i.billboard_id=board_id
        AND (i.status='completed' OR i.installation_date IS NOT NULL OR i.completed_at IS NOT NULL)
      ORDER BY i.completed_at DESC NULLS LAST,i.created_at DESC NULLS LAST LIMIT 1;
    SELECT t.team_id INTO team_uuid FROM public.installation_tasks t WHERE t.id=source_item.task_id;
    IF team_uuid IS NULL THEN
      SELECT t.id INTO team_uuid FROM public.installation_teams t JOIN public.billboards b ON b."ID"=board_id
      ORDER BY (COALESCE(b."Size"=ANY(t.sizes),false)) DESC,
        (COALESCE(cardinality(t.cities),0)=0 OR b."City"=ANY(t.cities)) DESC,t.priority DESC NULLS LAST LIMIT 1;
    END IF;
    SELECT id INTO task_uuid FROM public.removal_tasks WHERE contract_id=NEW."Contract_Number"
      AND amendment_number=amendment_no AND team_id IS NOT DISTINCT FROM team_uuid AND status='pending' LIMIT 1;
    IF task_uuid IS NULL THEN
      INSERT INTO public.removal_tasks(contract_id,team_id,status,amendment_number)
        VALUES(NEW."Contract_Number",team_uuid,'pending',amendment_no) RETURNING id INTO task_uuid;
    END IF;
    -- Reuse existing pending removal work, preserving its photos/notes; never alter completed evidence.
    UPDATE public.removal_task_items SET task_id=task_uuid WHERE id=(
      SELECT i.id FROM public.removal_task_items i JOIN public.removal_tasks t ON i.task_id=t.id
      WHERE t.contract_id=NEW."Contract_Number" AND i.billboard_id=board_id AND i.status='pending'
        AND t.status IN ('pending','in_progress') AND t.amendment_number IS NULL
      ORDER BY i.created_at,i.id LIMIT 1);
    IF NOT FOUND THEN
      INSERT INTO public.removal_task_items(task_id,billboard_id,status,design_face_a,design_face_b,installed_image_url,notes)
        VALUES(task_uuid,board_id,'pending',source_item.design_face_a,source_item.design_face_b,
          source_item.installed_image_face_a_url,'إزالة لوحة بموجب ملحق رقم ' || amendment_no || ' للعقد رقم ' || NEW."Contract_Number");
    END IF;
  END LOOP;
  UPDATE public.removal_task_items i SET status='completed',removal_date=p.pause_date,completed_at=now(),notes=p.notes
    FROM public.removal_tasks t, public.paused_billboards p
    WHERE i.task_id=t.id AND t.contract_id=NEW."Contract_Number" AND t.amendment_number=amendment_no
      AND p.contract_number=t.contract_id AND p.billboard_id=i.billboard_id
      AND p.notes LIKE '[PHYSICAL_REMOVAL]%' AND p.lifecycle_state<>'cancelled' AND i.status='pending';
  UPDATE public.removal_tasks t SET status='completed'
    WHERE t.contract_id=NEW."Contract_Number" AND t.amendment_number=amendment_no
      AND EXISTS(SELECT 1 FROM public.removal_task_items i WHERE i.task_id=t.id)
      AND NOT EXISTS(SELECT 1 FROM public.removal_task_items i WHERE i.task_id=t.id AND i.status<>'completed');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.create_amendment_removal_tasks() FROM PUBLIC;
DROP TRIGGER IF EXISTS amendment_removal_tasks ON public."Contract";
-- Wait for the final saved document: temporary removals during a multi-step save are ignored.
CREATE CONSTRAINT TRIGGER amendment_removal_tasks AFTER UPDATE ON public."Contract"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.create_amendment_removal_tasks();
