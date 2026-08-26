-- One TAPBench key may mint many guest subjects (runs).
CREATE TABLE public.tapbench_key_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id uuid NOT NULL REFERENCES public.tapbench_task_keys(id) ON DELETE CASCADE,
  guest_user_id uuid NOT NULL REFERENCES public.organization_guest_users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz,
  UNIQUE (key_id, guest_user_id)
);

CREATE INDEX tapbench_key_guests_key_idx
  ON public.tapbench_key_guests (key_id, created_at DESC);

CREATE INDEX tapbench_key_guests_guest_idx
  ON public.tapbench_key_guests (guest_user_id);

COMMENT ON TABLE public.tapbench_key_guests IS
  'Guest subjects minted by a TAPBench operator key. Each guest is one run; the tbk_ key stays live.';

ALTER TABLE public.tapbench_key_guests ENABLE ROW LEVEL SECURITY;
