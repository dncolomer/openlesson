create table if not exists public.workspace_teach_backs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.learning_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  duration_seconds integer not null default 0,
  requested_duration_seconds integer not null default 0,
  mode text not null default 'curious',
  focus_node_ids uuid[] not null default '{}',
  voice_id text not null default 'ara',
  status text not null default 'completed',
  transcript jsonb not null default '[]'::jsonb,
  summary text,
  analysis jsonb not null default '{}'::jsonb,
  xai_conversation_id text,
  xai_response_id text,
  xai_file_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.workspace_teach_backs enable row level security;

create policy "Users can read own workspace teach backs"
  on public.workspace_teach_backs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own workspace teach backs"
  on public.workspace_teach_backs
  for insert
  with check (auth.uid() = user_id);

create index if not exists workspace_teach_backs_plan_user_idx
  on public.workspace_teach_backs(plan_id, user_id, created_at desc);
