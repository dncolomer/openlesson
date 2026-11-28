-- AYCL marketplace listing metadata on catalog workspaces.
-- Nullable prices fall back to global defaults in app code.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS aycl_category text,
  ADD COLUMN IF NOT EXISTS aycl_summary text,
  ADD COLUMN IF NOT EXISTS aycl_author_name text,
  ADD COLUMN IF NOT EXISTS aycl_author_avatar_url text,
  ADD COLUMN IF NOT EXISTS aycl_learner_price_cents integer,
  ADD COLUMN IF NOT EXISTS aycl_full_price_cents integer;

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_aycl_learner_price_cents_check;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_aycl_learner_price_cents_check
  CHECK (
    aycl_learner_price_cents IS NULL
    OR (aycl_learner_price_cents >= 0 AND aycl_learner_price_cents <= 10000000)
  );

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_aycl_full_price_cents_check;
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_aycl_full_price_cents_check
  CHECK (
    aycl_full_price_cents IS NULL
    OR (aycl_full_price_cents >= 0 AND aycl_full_price_cents <= 10000000)
  );

COMMENT ON COLUMN public.workspaces.aycl_category IS
  'Marketplace category label for All-You-Can-Learn catalog filtering.';
COMMENT ON COLUMN public.workspaces.aycl_summary IS
  'Marketplace listing summary (preferred over workspace description on catalog).';
COMMENT ON COLUMN public.workspaces.aycl_author_name IS
  'Display author name on AYCL marketplace cards and landings.';
COMMENT ON COLUMN public.workspaces.aycl_author_avatar_url IS
  'Author avatar image URL for AYCL marketplace listing.';
COMMENT ON COLUMN public.workspaces.aycl_learner_price_cents IS
  'Optional practice-access price in USD cents; null uses global default.';
COMMENT ON COLUMN public.workspaces.aycl_full_price_cents IS
  'Optional full-access price in USD cents; null uses global default.';

CREATE INDEX IF NOT EXISTS idx_workspaces_aycl_category
  ON public.workspaces (aycl_category)
  WHERE is_all_you_can_learn = true AND aycl_category IS NOT NULL;
