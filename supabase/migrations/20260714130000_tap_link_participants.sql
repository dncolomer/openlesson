-- TAP link participant identity, post-session behavior, and workspace-scoped anonymous guests.

alter table public.organization_guest_users
  alter column organization_id drop not null;

alter table public.organization_guest_users
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.organization_guest_users
  drop constraint if exists organization_guest_users_organization_id_email_key;

create unique index if not exists org_guest_users_org_email_unique
  on public.organization_guest_users (organization_id, email)
  where organization_id is not null;

create unique index if not exists org_guest_users_workspace_email_unique
  on public.organization_guest_users (workspace_id, email)
  where workspace_id is not null;

create index if not exists idx_org_guest_users_workspace
  on public.organization_guest_users (workspace_id, created_at desc)
  where workspace_id is not null;

alter table public.workspace_tap_sessions
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null,
  add column if not exists participant_type text
    check (participant_type is null or participant_type in ('anonymous', 'guest', 'user')),
  add column if not exists post_session text not null default 'redirect_workspace'
    check (post_session in ('redirect_workspace', 'show_results', 'redirect_url')),
  add column if not exists redirect_url text,
  add column if not exists completion_webhook_url text;

create index if not exists idx_workspace_tap_sessions_assigned_user
  on public.workspace_tap_sessions (assigned_user_id, created_at desc)
  where assigned_user_id is not null;