-- Shareable ILE practice links for guest / anonymous participants (mirror TAP links).

create table if not exists public.workspace_ile_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  block_id uuid not null references public.blocks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  guest_user_id uuid references public.organization_guest_users(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  created_by_api_key_id uuid references public.agent_api_keys(id) on delete set null,
  private_token_hash text not null,
  session_id uuid references public.sessions(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'revoked')),
  participant_type text
    check (participant_type is null or participant_type in ('anonymous', 'guest', 'user')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create unique index if not exists workspace_ile_links_private_token_hash_key
  on public.workspace_ile_links (private_token_hash);

create index if not exists idx_workspace_ile_links_workspace
  on public.workspace_ile_links (workspace_id, created_at desc);

create index if not exists idx_workspace_ile_links_guest
  on public.workspace_ile_links (guest_user_id, created_at desc)
  where guest_user_id is not null;

create index if not exists idx_workspace_ile_links_assigned
  on public.workspace_ile_links (assigned_user_id, created_at desc)
  where assigned_user_id is not null;

alter table public.workspace_ile_links enable row level security;
