ALTER TABLE public.session_plans
  ADD COLUMN IF NOT EXISTS unusable_cells jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.session_plans.unusable_cells IS
  'Skill-grid cells marked blocked/unusable: JSON array of { "row": int, "col": int }. Shapes ILE chapter-map corridors; excluded from free placement.';
