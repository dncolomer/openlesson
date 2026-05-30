create table if not exists public.rabbit_hole_top_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  discipline text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rabbit_hole_nodes (
  id uuid primary key default gen_random_uuid(),
  top_question_id uuid not null references public.rabbit_hole_top_questions(id) on delete cascade,
  parent_id uuid references public.rabbit_hole_nodes(id) on delete cascade,
  question text not null,
  depth integer not null default 0,
  branch_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.rabbit_hole_plays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  top_question_id uuid references public.rabbit_hole_top_questions(id),
  timezone text not null default 'UTC',
  local_day text not null,
  used_bonus_play boolean not null default false,
  path jsonb not null default '[]'::jsonb,
  interview jsonb,
  score integer,
  depth integer not null default 0,
  questions_explored integer not null default 0,
  shared_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists rabbit_hole_bonus_plays integer not null default 0;
alter table public.profiles add column if not exists rabbit_hole_bonus_points integer not null default 0;

create index if not exists rabbit_hole_nodes_top_parent_idx on public.rabbit_hole_nodes(top_question_id, parent_id, branch_order);
create index if not exists rabbit_hole_plays_user_day_idx on public.rabbit_hole_plays(user_id, local_day);

alter table public.rabbit_hole_top_questions enable row level security;
alter table public.rabbit_hole_nodes enable row level security;
alter table public.rabbit_hole_plays enable row level security;

drop policy if exists "Rabbit hole questions are readable" on public.rabbit_hole_top_questions;
create policy "Rabbit hole questions are readable" on public.rabbit_hole_top_questions for select using (active = true);

drop policy if exists "Rabbit hole nodes are readable" on public.rabbit_hole_nodes;
create policy "Rabbit hole nodes are readable" on public.rabbit_hole_nodes for select using (true);

drop policy if exists "Users can read own rabbit hole plays" on public.rabbit_hole_plays;
create policy "Users can read own rabbit hole plays" on public.rabbit_hole_plays for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own rabbit hole plays" on public.rabbit_hole_plays;
create policy "Users can insert own rabbit hole plays" on public.rabbit_hole_plays for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own rabbit hole plays" on public.rabbit_hole_plays;
create policy "Users can update own rabbit hole plays" on public.rabbit_hole_plays for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
