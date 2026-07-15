-- All-You-Can-Learn: one-time paid workspace access with lifetime link

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS is_all_you_can_learn boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_workspaces_aycl
  ON public.workspaces (is_all_you_can_learn)
  WHERE is_all_you_can_learn = true;

CREATE TABLE IF NOT EXISTS public.aycl_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  forked_workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  access_token_hash text NOT NULL,
  stripe_checkout_session_id text UNIQUE,
  purchaser_email text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aycl_purchases_token_hash
  ON public.aycl_purchases (access_token_hash);

CREATE INDEX IF NOT EXISTS idx_aycl_purchases_source
  ON public.aycl_purchases (source_workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_aycl_purchases_forked
  ON public.aycl_purchases (forked_workspace_id)
  WHERE forked_workspace_id IS NOT NULL;

ALTER TABLE public.aycl_purchases ENABLE ROW LEVEL SECURITY;