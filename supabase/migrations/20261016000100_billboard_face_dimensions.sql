-- One optional dimension override per physical face, and explicit operation selection.
ALTER TABLE public.billboards ADD COLUMN IF NOT EXISTS face_dimensions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.installation_task_items ADD COLUMN IF NOT EXISTS selected_faces integer[];
COMMENT ON COLUMN public.billboards.face_dimensions IS 'Ordered face dimensions in metres; null entries inherit Size.';
COMMENT ON COLUMN public.installation_task_items.selected_faces IS 'One-based physical face numbers selected for this installation operation.';
ALTER TABLE public.installation_task_items ADD COLUMN IF NOT EXISTS company_installation_price_per_meter numeric;
