-- Restore optional workspace_id on verify/calibrate flows (solve already has it).
-- Dashboard create can omit it; map tiles stamp it. Prod dropped these columns
-- in 20261025260000 and PostgREST then refused inserts that still sent them.

alter table public.calibrate_flows
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.verify_flows
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

create index if not exists calibrate_flows_workspace_id_idx
  on public.calibrate_flows (workspace_id)
  where workspace_id is not null;

create index if not exists verify_flows_workspace_id_idx
  on public.verify_flows (workspace_id)
  where workspace_id is not null;

comment on column public.calibrate_flows.workspace_id is
  'Optional Learning Map that owns this flow. Null for dashboard-created owner flows.';

comment on column public.verify_flows.workspace_id is
  'Optional Learning Map that owns this flow. Null for dashboard-created owner flows.';
