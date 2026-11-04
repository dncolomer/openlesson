-- Archive flows instead of deleting them. Play-copy tiles keep live references.
-- Publish flags: whether play-copy runs share Path / full proof of work with the author.

alter table public.solve_flows
  add column if not exists archived_at timestamptz;

alter table public.calibrate_flows
  add column if not exists archived_at timestamptz;

alter table public.verify_flows
  add column if not exists archived_at timestamptz;

create index if not exists solve_flows_owner_active_idx
  on public.solve_flows (owner_user_id, created_at desc)
  where archived_at is null;

create index if not exists calibrate_flows_owner_active_idx
  on public.calibrate_flows (owner_user_id, created_at desc)
  where archived_at is null;

create index if not exists verify_flows_owner_active_idx
  on public.verify_flows (owner_user_id, created_at desc)
  where archived_at is null;

comment on column public.solve_flows.archived_at is
  'Set when the owner archives the flow. Row, token, and body remain so play copies still start.';
comment on column public.calibrate_flows.archived_at is
  'Set when the owner archives the flow. Row, token, and body remain so play copies still start.';
comment on column public.verify_flows.archived_at is
  'Set when the owner archives the flow. Row, token, and body remain so play copies still start.';

alter table public.workspaces
  add column if not exists play_share_path boolean not null default false;

alter table public.workspaces
  add column if not exists play_share_pow boolean not null default false;

comment on column public.workspaces.play_share_path is
  'When true, new play-copy runs also write Path embeddings for the map author.';
comment on column public.workspaces.play_share_pow is
  'When true (requires play_share_path), new play-copy runs share full proof of work with the author.';
