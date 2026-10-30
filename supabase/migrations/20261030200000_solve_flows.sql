-- Owner-scoped Solve flows: third product flow beside calibrate_flows and
-- verify_flows. Sessions, embeddings, and knowledge regions attach to them.

create table if not exists public.solve_flows (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  topic text not null default '',
  duration_minutes integer not null default 15,
  action_catalog integer not null default 4,
  public_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists solve_flows_owner_user_id_idx
  on public.solve_flows (owner_user_id, created_at desc);

alter table public.solve_flows enable row level security;

drop policy if exists "Owners can read own solve flows" on public.solve_flows;
create policy "Owners can read own solve flows"
  on public.solve_flows for select
  using (auth.uid() = owner_user_id);

drop policy if exists "Owners can write own solve flows" on public.solve_flows;
create policy "Owners can write own solve flows"
  on public.solve_flows for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

comment on table public.solve_flows is
  'Owner-scoped Solve flows. Name + topic only. Independent of Learning Maps.';

alter table public.sessions
  add column if not exists solve_flow_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sessions_solve_flow_id_fkey'
  ) then
    alter table public.sessions
      add constraint sessions_solve_flow_id_fkey
      foreign key (solve_flow_id) references public.solve_flows(id) on delete set null;
  end if;
end $$;

create index if not exists sessions_solve_flow_id_idx
  on public.sessions (solve_flow_id)
  where solve_flow_id is not null;

alter table public.sessions
  drop constraint if exists sessions_kind_check;

alter table public.sessions
  add constraint sessions_kind_check
  check (kind = any (array['learn'::text, 'calibrate'::text, 'verify'::text, 'solve'::text]));

comment on column public.sessions.solve_flow_id is
  'Parent Solve flow. Set when kind is solve. Distinguishes a Solve run from a map Learn session.';

alter table public.knowledge_regions
  add column if not exists solve_flow_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knowledge_regions_solve_flow_id_fkey'
  ) then
    alter table public.knowledge_regions
      add constraint knowledge_regions_solve_flow_id_fkey
      foreign key (solve_flow_id) references public.solve_flows(id) on delete set null;
  end if;
end $$;

alter table public.knowledge_regions
  drop constraint if exists custom_verification_models_product_check;

alter table public.knowledge_regions
  drop constraint if exists knowledge_regions_product_check;

alter table public.knowledge_regions
  add constraint knowledge_regions_product_check
  check (
    product is null
    or product = any (array['verification'::text, 'calibration'::text, 'solve'::text])
  );

alter table public.embedding_models
  drop constraint if exists embedding_models_family_check;

alter table public.embedding_models
  add constraint embedding_models_family_check
  check (family = any (array['learn'::text, 'calibrate'::text, 'verify'::text, 'solve'::text]));

insert into public.embedding_models (id, family, version, algorithm_id, dim)
values ('solve-flowcfg-v1-d96', 'solve', 'v1', 'flowcfg-v1-d96', 96)
on conflict (id) do nothing;

alter table public.session_embeddings
  drop constraint if exists workspace_flow_embeddings_flow_kind_check;

alter table public.session_embeddings
  drop constraint if exists session_embeddings_flow_kind_check;

alter table public.session_embeddings
  add constraint session_embeddings_flow_kind_check
  check (flow_kind = any (array['calibrate'::text, 'learn'::text, 'verify'::text, 'solve'::text]));
