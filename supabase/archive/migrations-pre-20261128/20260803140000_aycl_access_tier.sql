-- Dual AYCL access: learner (practice, fixed scope) vs full (practice + create).
-- Null/missing treated as 'full' in app for legacy purchases.

ALTER TABLE public.aycl_purchases
  ADD COLUMN IF NOT EXISTS access_tier text NOT NULL DEFAULT 'full';

ALTER TABLE public.aycl_purchases
  DROP CONSTRAINT IF EXISTS aycl_purchases_access_tier_check;

ALTER TABLE public.aycl_purchases
  ADD CONSTRAINT aycl_purchases_access_tier_check
  CHECK (access_tier IN ('learner', 'full'));

COMMENT ON COLUMN public.aycl_purchases.access_tier IS
  'learner = practice-only fixed fork; full = practice + creation tools. Legacy rows default full.';

-- Optional link when this checkout upgraded an existing purchase (same access token).
ALTER TABLE public.aycl_purchases
  ADD COLUMN IF NOT EXISTS upgraded_from_purchase_id uuid
  REFERENCES public.aycl_purchases(id) ON DELETE SET NULL;
