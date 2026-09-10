-- ILE docked chapters use string step ids (step_1_seed), not workspace
-- block UUIDs. insights.block_id stays uuid; chapter_id holds any link.

ALTER TABLE public.insights
  ADD COLUMN IF NOT EXISTS chapter_id text;

COMMENT ON COLUMN public.insights.chapter_id IS
  'Linked ILE chapter / plan step id (string-safe). Distinct from block_id, which is a workspace block UUID.';

CREATE INDEX IF NOT EXISTS insights_chapter_id_idx
  ON public.insights (chapter_id)
  WHERE chapter_id IS NOT NULL;
