-- Multi-cell skill-grid footprints: rectangular span from (position_x, position_y).
ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS span_w INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS span_h INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.blocks.span_w IS 'Skill-grid width in cells (default 1). Anchor is position_x/position_y.';
COMMENT ON COLUMN public.blocks.span_h IS 'Skill-grid height in cells (default 1). Anchor is position_x/position_y.';

ALTER TABLE public.blocks
  DROP CONSTRAINT IF EXISTS blocks_span_w_check,
  DROP CONSTRAINT IF EXISTS blocks_span_h_check;

ALTER TABLE public.blocks
  ADD CONSTRAINT blocks_span_w_check CHECK (span_w >= 1 AND span_w <= 24),
  ADD CONSTRAINT blocks_span_h_check CHECK (span_h >= 1 AND span_h <= 24);
