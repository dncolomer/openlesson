-- Author limits on Explore/Drill × open-ended/timed practice launches per block.
-- JSON shape (snake_case): allow_explore, allow_drill, allow_open_ended, allow_timed,
-- allowed_durations_minutes (int array of minutes from the product duration palette).

ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS practice_options jsonb;

COMMENT ON COLUMN public.blocks.practice_options IS
  'Author practice launch limits: allow_explore/drill/open_ended/timed + allowed_durations_minutes. Null = full surface.';
