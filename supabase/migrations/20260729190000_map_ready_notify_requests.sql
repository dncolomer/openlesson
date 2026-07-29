-- Pending "notify me when Map of Knowledge location is ready" requests (guest placement).

CREATE TABLE IF NOT EXISTS public.map_ready_notify_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  guest_user_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  placement_link text,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS map_ready_notify_requests_pending_idx
  ON public.map_ready_notify_requests (created_at)
  WHERE notified_at IS NULL;

CREATE INDEX IF NOT EXISTS map_ready_notify_requests_guest_ws_idx
  ON public.map_ready_notify_requests (guest_user_id, workspace_id);

-- At most one pending notify per guest + workspace
CREATE UNIQUE INDEX IF NOT EXISTS map_ready_notify_requests_pending_unique
  ON public.map_ready_notify_requests (guest_user_id, workspace_id)
  WHERE notified_at IS NULL;

COMMENT ON TABLE public.map_ready_notify_requests IS
  'Email notify when a Map of Knowledge guest subject appears on the public map after periodic snapshots.';

ALTER TABLE public.map_ready_notify_requests ENABLE ROW LEVEL SECURITY;
-- No public policies: service role / admin client only.
