-- First-class list of multi-block DAGs created via map multi-select Apply.
-- JSON array of { id, blockIds, title, createdAt, updatedAt }.
-- Block edges remain on blocks.next_block_ids; this column is identity + list.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS workspace_dags jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.workspaces.workspace_dags IS
  'Created multi-block DAGs for Creator DAGs tab: [{ "id", "blockIds", "title", "createdAt", "updatedAt" }].';
