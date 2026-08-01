-- Workspace + block context architecture:
-- 1) Block-local context (notes, local file materials, refs into workspace-global files)
-- 2) Lock-until-completed prerequisites (map ground authoring)
-- 3) Unusable map cells that shape paths (workspace-level ground)

-- Block local context: JSON { notes?, local_files?: [{name, excerpt?}], global_file_refs?: string[] }
ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS local_context jsonb;

COMMENT ON COLUMN public.blocks.local_context IS
  'Optional block-local prompt materials: { "notes": string, "local_files": [{ "name", "excerpt"? }], "global_file_refs": [workspace file names] }. Prefer global_file_refs over duplicating workspace_files blobs.';

-- Lock until other blocks are completed (prerequisite unlock rules)
ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS lock_until_block_ids uuid[] DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.blocks.lock_until_block_ids IS
  'Block ids that must be completed before this block unlocks for play. Empty = no lock.';

-- Unusable map ground cells (absolute row/col) — shapes paths, not placeable open ground
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS unusable_cells jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.workspaces.unusable_cells IS
  'Skill-grid cells marked unusable: JSON array of { "row": int, "col": int }. Shapes paths; excluded from free placement.';
