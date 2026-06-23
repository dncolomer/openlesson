-- Workspace-level performance evidence uploaded via Agentic API (xAI file storage).

create table if not exists public.workspace_evidence (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.learning_plans(id) on delete cascade,
  plan_node_id uuid references public.plan_nodes(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  evidence_type text not null check (evidence_type in ('tool', 'screen', 'video', 'eeg')),
  file_name text not null,
  mime_type text not null,
  file_size integer,
  xai_file_id text not null,
  timestamp_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  chunk_index integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  tool_name text,
  tool_action text,
  band_powers jsonb,
  device_name text,
  sample_count integer,
  user_id uuid references auth.users(id) on delete set null,
  guest_user_id uuid references public.organization_guest_users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  created_by_api_key_id uuid references public.agent_api_keys(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_evidence_plan
  on public.workspace_evidence(plan_id, created_at desc);

create index if not exists idx_workspace_evidence_block
  on public.workspace_evidence(plan_node_id, created_at desc)
  where plan_node_id is not null;

create index if not exists idx_workspace_evidence_guest
  on public.workspace_evidence(guest_user_id, created_at desc)
  where guest_user_id is not null;

create index if not exists idx_workspace_evidence_session
  on public.workspace_evidence(session_id, created_at desc)
  where session_id is not null;

alter table public.workspace_evidence enable row level security;

create policy "Workspace owners can read evidence"
  on public.workspace_evidence for select
  using (
    exists (
      select 1 from public.learning_plans lp
      where lp.id = workspace_evidence.plan_id
        and lp.user_id = auth.uid()
    )
  );