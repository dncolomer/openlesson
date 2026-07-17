-- Skill-grid coordinates on blocks (restored after baseline omitted pre-baseline 009).
-- Used by workspace generate / agent create / chapter maps.
ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS position_x INTEGER,
  ADD COLUMN IF NOT EXISTS position_y INTEGER;

COMMENT ON COLUMN public.blocks.position_x IS 'Skill-grid column (may be negative). Start block is typically 0.';
COMMENT ON COLUMN public.blocks.position_y IS 'Skill-grid row (may be negative). Start block is typically 0.';
