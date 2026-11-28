-- Guest TAP / ILE links: public vs private access, stable public tokens,
-- entry query-param history, and indexes for PoW source-link metadata queries.

-- ── TAP links (workspace_tap_sessions) ───────────────────────────────────────
alter table public.workspace_tap_sessions
  add column if not exists access_mode text not null default 'private';

alter table public.workspace_tap_sessions
  drop constraint if exists workspace_tap_sessions_access_mode_check;

alter table public.workspace_tap_sessions
  add constraint workspace_tap_sessions_access_mode_check
  check (access_mode in ('private', 'public'));

alter table public.workspace_tap_sessions
  add column if not exists public_token text;

alter table public.workspace_tap_sessions
  add column if not exists entry_query_params jsonb not null default '[]'::jsonb;

create unique index if not exists workspace_tap_sessions_public_token_key
  on public.workspace_tap_sessions (public_token)
  where public_token is not null;

create index if not exists idx_workspace_tap_sessions_access_mode
  on public.workspace_tap_sessions (workspace_id, access_mode, created_at desc);

-- ── ILE links ────────────────────────────────────────────────────────────────
alter table public.workspace_ile_links
  add column if not exists access_mode text not null default 'private';

alter table public.workspace_ile_links
  drop constraint if exists workspace_ile_links_access_mode_check;

alter table public.workspace_ile_links
  add constraint workspace_ile_links_access_mode_check
  check (access_mode in ('private', 'public'));

alter table public.workspace_ile_links
  add column if not exists public_token text;

alter table public.workspace_ile_links
  add column if not exists entry_query_params jsonb not null default '[]'::jsonb;

create unique index if not exists workspace_ile_links_public_token_key
  on public.workspace_ile_links (public_token)
  where public_token is not null;

create index if not exists idx_workspace_ile_links_access_mode
  on public.workspace_ile_links (workspace_id, access_mode, created_at desc);

-- PoW metadata source-link lookups (jsonb containment / expression indexes)
create index if not exists idx_workspace_pow_source_link_id
  on public.workspace_proof_of_work ((metadata ->> 'source_link_id'))
  where (metadata ? 'source_link_id');

create index if not exists idx_workspace_pow_source_link_kind
  on public.workspace_proof_of_work ((metadata ->> 'source_link_kind'))
  where (metadata ? 'source_link_kind');
