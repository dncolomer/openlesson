-- Same participant identity as verification flows: a unique free-text string
-- per calibration flow, stored with that run's canvas proof.

create table if not exists public.workspace_calibration_identities (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.workspace_calibration_flows(id) on delete cascade,
  identity text not null,
  created_at timestamptz not null default now(),
  unique (flow_id, identity)
);

alter table public.workspace_calibration_proofs
  add column if not exists identity text;

update public.workspace_calibration_proofs
  set identity = ''
  where identity is null;

alter table public.workspace_calibration_proofs
  alter column identity set not null;

alter table public.workspace_calibration_identities enable row level security;

drop policy if exists "Owners can view calibration identities"
  on public.workspace_calibration_identities;

create policy "Owners can view calibration identities"
  on public.workspace_calibration_identities
  for select
  using (
    auth.uid() is not null
    and flow_id in (
      select id from public.workspace_calibration_flows
      where workspace_id in (
        select id from public.workspaces where user_id = auth.uid()
      )
    )
  );
