-- Combinable creator-mode block effects (Dynamic / Promptable / Generator).
-- JSON shape (snake_case nested):
-- {
--   dynamic: { enabled: bool },
--   promptable: { enabled: bool, framing: string },
--   generator: { enabled: bool, target_block_ids: string[] }
-- }
-- Null = all effects off. Combinable with practice_options, starter, local context.

ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS creator_effects jsonb;

COMMENT ON COLUMN public.blocks.creator_effects IS
  'Creator combinable effects: dynamic (generate on unlock, requires DAG), promptable (learner prompt before practice), generator (generate targets on complete). Null = none.';
