-- Calibration flows for Verification Workspaces.
-- A flow stores a goal and the question pool. Proof rows are canvas events,
-- separate from verification-flow results.

create table if not exists public.workspace_calibration_flows (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  goal text not null,
  questions jsonb not null default '[]'::jsonb,
  public_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_calibration_flows_workspace
  on public.workspace_calibration_flows (workspace_id, created_at desc);

create table if not exists public.workspace_calibration_proofs (
  id uuid primary key,
  flow_id uuid not null references public.workspace_calibration_flows(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_calibration_proofs_flow
  on public.workspace_calibration_proofs (flow_id, created_at desc);

alter table public.workspace_calibration_flows enable row level security;
alter table public.workspace_calibration_proofs enable row level security;

create policy "Owners can view calibration flows"
  on public.workspace_calibration_flows
  for select
  using (
    auth.uid() is not null
    and workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Owners can view calibration proofs"
  on public.workspace_calibration_proofs
  for select
  using (
    auth.uid() is not null
    and workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );
