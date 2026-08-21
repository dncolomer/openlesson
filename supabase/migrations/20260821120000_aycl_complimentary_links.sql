-- Complimentary (free) AYCL special URLs: play vs full, optional usage and/or time expiration.
-- Tokens are stored hashed like paid aycl_purchases.access_token_hash.
-- public_token is durable so Settings > AYCL can list/copy the share URL.

CREATE TABLE IF NOT EXISTS public.aycl_complimentary_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  access_tier text NOT NULL
    CHECK (access_tier IN ('learner', 'full')),
  access_token_hash text NOT NULL,
  public_token text NOT NULL,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT aycl_complimentary_links_max_uses_check
    CHECK (max_uses IS NULL OR max_uses >= 1),
  CONSTRAINT aycl_complimentary_links_use_count_check
    CHECK (use_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aycl_complimentary_links_token_hash
  ON public.aycl_complimentary_links (access_token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aycl_complimentary_links_public_token
  ON public.aycl_complimentary_links (public_token);

CREATE INDEX IF NOT EXISTS idx_aycl_complimentary_links_workspace
  ON public.aycl_complimentary_links (workspace_id, created_at DESC);

COMMENT ON TABLE public.aycl_complimentary_links IS
  'Owner-created free AYCL URLs. learner = play/practice-only; full = Play + Build. Usage and expires_at are optional.';

ALTER TABLE public.aycl_purchases
  ADD COLUMN IF NOT EXISTS complimentary_link_id uuid
  REFERENCES public.aycl_complimentary_links(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_aycl_purchases_complimentary_link
  ON public.aycl_purchases (complimentary_link_id)
  WHERE complimentary_link_id IS NOT NULL;

ALTER TABLE public.aycl_complimentary_links ENABLE ROW LEVEL SECURITY;
