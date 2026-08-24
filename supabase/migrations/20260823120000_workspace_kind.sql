-- Durable workspace kind so Knowledge Region shells survive reload.
-- standard = Blank / Template / Files+Goal maps; knowledge_region = Goals/Knowledge/Settings.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS workspace_kind text NOT NULL DEFAULT 'standard';

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_workspace_kind_check;

ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_workspace_kind_check
  CHECK (workspace_kind = ANY (ARRAY['standard'::text, 'knowledge_region'::text]));

COMMENT ON COLUMN public.workspaces.workspace_kind IS
  'standard (map workspace) or knowledge_region (Goals/Knowledge/Settings; PoW is external).';
