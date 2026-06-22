create table if not exists public.workspace_ghc_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.learning_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_by_api_key_id uuid references public.agent_api_keys(id) on delete set null,
  private_token_hash text unique,
  duration_seconds integer not null default 0,
  requested_duration_seconds integer not null default 0,
  mode text not null default 'curious',
  focus_node_ids uuid[] not null default '{}',
  voice_id text not null default 'ara',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  transcript jsonb not null default '[]'::jsonb,
  summary text,
  analysis jsonb not null default '{}'::jsonb,
  overall_score integer,
  marker_scores jsonb not null default '[]'::jsonb,
  xai_conversation_id text,
  xai_response_id text,
  xai_file_id text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

alter table public.workspace_ghc_sessions enable row level security;

create policy "Users can read own workspace GHC sessions"
  on public.workspace_ghc_sessions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own workspace GHC sessions"
  on public.workspace_ghc_sessions
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own workspace GHC sessions"
  on public.workspace_ghc_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists workspace_ghc_sessions_plan_user_idx
  on public.workspace_ghc_sessions(plan_id, user_id, created_at desc);

create index if not exists workspace_ghc_sessions_token_hash_idx
  on public.workspace_ghc_sessions(private_token_hash)
  where private_token_hash is not null;

create index if not exists workspace_ghc_sessions_api_key_idx
  on public.workspace_ghc_sessions(created_by_api_key_id, created_at desc)
  where created_by_api_key_id is not null;
