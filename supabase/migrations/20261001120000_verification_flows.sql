-- Verification flows for Verification Workspaces (workspace_kind = knowledge_region).
-- A flow is the container for its question pool, participant identities, and results.

create table if not exists public.workspace_verification_flows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  topic text not null,
  questions jsonb not null default '[]'::jsonb,
  public_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_verification_flows_workspace
  on public.workspace_verification_flows (workspace_id, created_at desc);

create table if not exists public.workspace_verification_identities (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.workspace_verification_flows(id) on delete cascade,
  identity text not null,
  created_at timestamptz not null default now(),
  unique (flow_id, identity)
);

create table if not exists public.workspace_verification_results (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.workspace_verification_flows(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  identity text not null,
  source text not null check (source in ('runner', 'skill')),
  question_id text,
  prompt text not null,
  embedding jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_verification_results_flow
  on public.workspace_verification_results (flow_id, created_at desc);

create index if not exists idx_workspace_verification_results_workspace
  on public.workspace_verification_results (workspace_id, created_at desc);

alter table public.workspace_verification_flows enable row level security;
alter table public.workspace_verification_identities enable row level security;
alter table public.workspace_verification_results enable row level security;

create policy "Owners can view verification flows"
  on public.workspace_verification_flows
  for select
  using (
    auth.uid() is not null
    and workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );

create policy "Owners can view verification identities"
  on public.workspace_verification_identities
  for select
  using (
    auth.uid() is not null
    and flow_id in (
      select id from public.workspace_verification_flows
      where workspace_id in (
        select id from public.workspaces where user_id = auth.uid()
      )
    )
  );

create policy "Owners can view verification results"
  on public.workspace_verification_results
  for select
  using (
    auth.uid() is not null
    and workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );
