alter table public.workspace_ghc_sessions
  add column if not exists plan_node_id uuid references public.plan_nodes(id) on delete set null,
  add column if not exists session_id uuid references public.sessions(id) on delete set null;

create index if not exists workspace_ghc_sessions_session_idx
  on public.workspace_ghc_sessions(session_id, created_at desc)
  where session_id is not null;

create index if not exists workspace_ghc_sessions_plan_node_idx
  on public.workspace_ghc_sessions(plan_node_id, created_at desc)
  where plan_node_id is not null;
