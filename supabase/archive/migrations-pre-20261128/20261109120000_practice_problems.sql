-- Practice library: platform catalog of problems that mint a per-user virtual
-- Solve flow on start. Authored Solve flows keep practice_problem_id null.

create table if not exists public.practice_problems (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null,
  subcategory text not null,
  title text not null,
  prompt text not null,
  sort_order integer not null default 0,
  duration_minutes integer not null default 15,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists practice_problems_catalog_idx
  on public.practice_problems (published, category, subcategory, sort_order);

comment on table public.practice_problems is
  'Platform catalog of practice problems. Seeded, not authored in the dashboard.';

alter table public.practice_problems enable row level security;

drop policy if exists "Authenticated users can read published practice problems"
  on public.practice_problems;
create policy "Authenticated users can read published practice problems"
  on public.practice_problems for select
  to authenticated
  using (published = true);

alter table public.solve_flows
  add column if not exists practice_problem_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'solve_flows_practice_problem_id_fkey'
  ) then
    alter table public.solve_flows
      add constraint solve_flows_practice_problem_id_fkey
      foreign key (practice_problem_id)
      references public.practice_problems(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists solve_flows_owner_practice_problem_uidx
  on public.solve_flows (owner_user_id, practice_problem_id)
  where practice_problem_id is not null;

comment on column public.solve_flows.practice_problem_id is
  'When set, this Solve flow is a per-user virtual practice flow for that catalog problem.';
