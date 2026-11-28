-- Guest checkout fulfillment: paid before account exists (subscribe-first flow).
CREATE TABLE IF NOT EXISTS public.pending_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text NOT NULL UNIQUE,
  stripe_customer_id text,
  stripe_subscription_id text,
  email text NOT NULL,
  price_type text NOT NULL,
  plan text NOT NULL,
  monthly_volume integer,
  current_period_end timestamptz,
  claimed_at timestamptz,
  claimed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_checkouts_email_unclaimed
  ON public.pending_checkouts (lower(email))
  WHERE claimed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pending_checkouts_customer
  ON public.pending_checkouts (stripe_customer_id)
  WHERE claimed_at IS NULL;

ALTER TABLE public.pending_checkouts ENABLE ROW LEVEL SECURITY;