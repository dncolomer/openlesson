-- Durable headless Calibrate / Learn / Verify / TAPBench sessions.
-- Tree, clock, proof, and inferred sequence must survive a new process.

create table if not exists public.workspace_headless_sessions (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  flow_kind text not null,
  status text not null,
  catalog_size integer,
  started_at_ms bigint not null,
  expires_at_ms bigint not null,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_headless_sessions_workspace
  on public.workspace_headless_sessions (workspace_id, started_at_ms desc);

alter table public.workspace_headless_sessions enable row level security;

create policy "Owners can view headless sessions"
  on public.workspace_headless_sessions
  for select
  using (
    auth.uid() is not null
    and workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );
