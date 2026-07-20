-- Freeform multi-cell footprints: optional cell mask relative to anchor.
-- When null/empty, occupancy is the full span_w×span_h rectangle (legacy).
-- When set, only those relative (dr, dc) cells are occupied by the block.

ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS shape_cells jsonb;

COMMENT ON COLUMN public.blocks.shape_cells IS
  'Optional freeform skill-grid mask: JSON array of { "dr": int, "dc": int } offsets from (position_y, position_x). Null = solid rectangle span_w×span_h.';
