-- PR 7 schema: guest TAP/ILE columns live on sessions so dual-write can
-- share one id. Chapter maps and ILE probes move off satellite tables.
-- Product code must not delete proof of work.

alter table public.sessions
  add column if not exists workspace_id uuid;

alter table public.sessions
  add column if not exists guest_user_id uuid;

alter table public.sessions
  add column if not exists assigned_user_id uuid;

alter table public.sessions
  add column if not exists organization_id uuid;

alter table public.sessions
  add column if not exists public_token text;

alter table public.sessions
  add column if not exists access_mode text;

alter table public.sessions
  add column if not exists guest_link jsonb not null default '{}'::jsonb;

alter table public.sessions
  add column if not exists chapter_map jsonb;

alter table public.sessions
  add column if not exists probes jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sessions_workspace_id_fkey'
  ) then
    alter table public.sessions
      add constraint sessions_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete set null;
  end if;
end $$;

create unique index if not exists sessions_private_token_hash_key
  on public.sessions (private_token_hash)
  where private_token_hash is not null;

create unique index if not exists sessions_public_token_key
  on public.sessions (public_token)
  where public_token is not null;

create index if not exists sessions_kind_workspace_idx
  on public.sessions (kind, workspace_id, created_at desc);

create index if not exists sessions_block_id_idx
  on public.sessions (block_id, created_at desc)
  where block_id is not null;

comment on column public.sessions.guest_link is
  'TAP/ILE link fields dual-written onto the unified session (duration, shell, tokens).';
comment on column public.sessions.chapter_map is
  'Learn chapter board previously stored in session_plans.';
comment on column public.sessions.probes is
  'ILE probe events previously stored in probes. Proof of work stays separate.';
