-- Recoverable embeddings for completed Calibrate, Learn, and Verify runs.
-- Vector + raw gen-model / projected policy / proof-of-work. Not an LWM snapshot.

create table if not exists public.workspace_flow_embeddings (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  flow_kind text not null check (flow_kind in ('calibrate', 'learn', 'verify')),
  flow_id text,
  run_id text,
  identity text,
  source text,
  embedding_model_id text not null,
  dim integer not null,
  vector jsonb not null,
  raw jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_flow_embeddings_workspace
  on public.workspace_flow_embeddings (workspace_id, created_at desc);

create index if not exists idx_workspace_flow_embeddings_flow
  on public.workspace_flow_embeddings (workspace_id, flow_kind, flow_id);

alter table public.workspace_flow_embeddings enable row level security;

create policy "Owners can view flow embeddings"
  on public.workspace_flow_embeddings
  for select
  using (
    auth.uid() is not null
    and workspace_id in (
      select id from public.workspaces where user_id = auth.uid()
    )
  );
