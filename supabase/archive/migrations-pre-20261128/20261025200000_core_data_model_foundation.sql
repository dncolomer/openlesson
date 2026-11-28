-- Core data model foundation.
-- Registry of versioned embedding families, session kind/result/field_model,
-- embedding→session pointer, and drop of empty leftover product tables.
-- Proof of work and xAI file ids stay. Do not CASCADE-delete evidence.

-- 1. Embedding model registry (three families, shared v1 algorithm).
create table if not exists public.embedding_models (
  id text primary key,
  family text not null,
  version text not null,
  algorithm_id text not null,
  dim integer not null,
  created_at timestamptz not null default now(),
  constraint embedding_models_family_check
    check (family = any (array['learn'::text, 'calibrate'::text, 'verify'::text])),
  constraint embedding_models_dim_check
    check (dim > 0 and dim <= 1024)
);

insert into public.embedding_models (id, family, version, algorithm_id, dim)
values
  ('learn-flowcfg-v1-d96', 'learn', 'v1', 'flowcfg-v1-d96', 96),
  ('calibrate-flowcfg-v1-d96', 'calibrate', 'v1', 'flowcfg-v1-d96', 96),
  ('verify-flowcfg-v1-d96', 'verify', 'v1', 'flowcfg-v1-d96', 96)
on conflict (id) do nothing;

comment on table public.embedding_models is
  'Versioned embedding families. Vectors are derived from proof of work + field_model and can be rebuilt.';

-- 2. Sessions: kind, typed result, hidden-state tree, parent pointers.
alter table public.sessions
  add column if not exists kind text;

update public.sessions
set kind = 'learn'
where kind is null;

alter table public.sessions
  alter column kind set default 'learn';

alter table public.sessions
  alter column kind set not null;

alter table public.sessions
  drop constraint if exists sessions_kind_check;

alter table public.sessions
  add constraint sessions_kind_check
  check (kind = any (array['learn'::text, 'calibrate'::text, 'verify'::text]));

alter table public.sessions
  add column if not exists result jsonb;

alter table public.sessions
  add column if not exists field_model jsonb;

alter table public.sessions
  add column if not exists block_id uuid;

alter table public.sessions
  add column if not exists calibrate_flow_id uuid;

alter table public.sessions
  add column if not exists verify_flow_id uuid;

alter table public.sessions
  add column if not exists identity text;

alter table public.sessions
  add column if not exists private_token_hash text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sessions_block_id_fkey'
  ) then
    alter table public.sessions
      add constraint sessions_block_id_fkey
      foreign key (block_id) references public.blocks(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'sessions_calibrate_flow_id_fkey'
  ) then
    alter table public.sessions
      add constraint sessions_calibrate_flow_id_fkey
      foreign key (calibrate_flow_id) references public.workspace_calibration_flows(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'sessions_verify_flow_id_fkey'
  ) then
    alter table public.sessions
      add constraint sessions_verify_flow_id_fkey
      foreign key (verify_flow_id) references public.workspace_verification_flows(id) on delete set null;
  end if;
end $$;

comment on column public.sessions.kind is
  'learn | calibrate | verify. One session table for Learning Maps and product flows.';
comment on column public.sessions.result is
  'Typed session result (Distance, sounding classification). Not a substitute for proof of work.';
comment on column public.sessions.field_model is
  'Hidden-state tree used for this run. Required to retrain Path embeddings.';

-- 3. Point embeddings at a session. Keep raw so old rows can still re-embed.
alter table public.workspace_flow_embeddings
  add column if not exists session_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_flow_embeddings_session_id_fkey'
  ) then
    alter table public.workspace_flow_embeddings
      add constraint workspace_flow_embeddings_session_id_fkey
      foreign key (session_id) references public.sessions(id) on delete set null;
  end if;
end $$;

update public.workspace_flow_embeddings e
set session_id = s.id
from public.sessions s
where e.session_id is null
  and e.run_id is not null
  and e.run_id = s.id::text;

comment on table public.workspace_flow_embeddings is
  'Derived Path vectors. Rebuild from proof of work + field_model / raw.genModel. Do not treat as the corpus.';

-- 4. Proof of work may also list the flow for queries. Never drop this table here.
alter table public.workspace_proof_of_work
  add column if not exists calibrate_flow_id uuid;

alter table public.workspace_proof_of_work
  add column if not exists verify_flow_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_proof_of_work_calibrate_flow_id_fkey'
  ) then
    alter table public.workspace_proof_of_work
      add constraint workspace_proof_of_work_calibrate_flow_id_fkey
      foreign key (calibrate_flow_id) references public.workspace_calibration_flows(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_proof_of_work_verify_flow_id_fkey'
  ) then
    alter table public.workspace_proof_of_work
      add constraint workspace_proof_of_work_verify_flow_id_fkey
      foreign key (verify_flow_id) references public.workspace_verification_flows(id) on delete set null;
  end if;
end $$;

comment on table public.workspace_proof_of_work is
  'Raw evidence corpus. Each row points at an xAI file. Product code must not delete rows or files. Embeddings are derived from this table.';

-- 5. Empty leftover products (zero rows on staging, no remaining live writers).
drop table if exists public.partner_revenue cascade;
drop table if exists public.partner_referrals cascade;
drop table if exists public.partners cascade;
drop table if exists public.agent_proof_batches cascade;
drop table if exists public.agent_proofs cascade;
drop table if exists public.user_solana_wallets cascade;
drop table if exists public.map_type_library cascade;
drop table if exists public.agent_assistant_conversations cascade;
