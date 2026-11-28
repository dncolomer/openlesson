-- Third workspace product: Calibration (uncertainty mapping).
-- standard = Learning; knowledge_region = Verification; calibration = Calibration.

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_workspace_kind_check;

ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_workspace_kind_check
  CHECK (workspace_kind = ANY (ARRAY['standard'::text, 'knowledge_region'::text, 'calibration'::text]));

COMMENT ON COLUMN public.workspaces.workspace_kind IS
  'standard (Learning map), knowledge_region (Verification flows), calibration (Calibration flows).';
