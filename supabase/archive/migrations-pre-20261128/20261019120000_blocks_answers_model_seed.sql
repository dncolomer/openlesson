-- Author seed of the block unsys answers-model (inspect / edit / Calibrate).
-- JSON shape: { model: SessionBranchModel, calibrate: { taps, classification, tappedBranchIds } | null }
-- Null = students still get on-the-fly generation at session start.

ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS answers_model_seed jsonb;

COMMENT ON COLUMN public.blocks.answers_model_seed IS
  'Author unsys answers-model seed plus optional Calibrate result. Null = generate on the fly.';
