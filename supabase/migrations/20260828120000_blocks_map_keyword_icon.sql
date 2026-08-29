-- Workspace map-tile glyph: one keyword + one Lucide icon name, generated with the block.

ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS map_keyword text,
  ADD COLUMN IF NOT EXISTS map_icon text;

COMMENT ON COLUMN public.blocks.map_keyword IS
  'Single-word map-tile label generated with the block (shown instead of the truncated title).';

COMMENT ON COLUMN public.blocks.map_icon IS
  'Lucide (lucide-react) icon name from the workspace map catalog; one icon per block.';
