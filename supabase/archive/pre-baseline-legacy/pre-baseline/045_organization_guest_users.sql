-- Organization-owned Agentic API workspaces and guest users.

alter table public.learning_plans
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index if not exists idx_learning_plans_organization_id
  on public.learning_plans(organization_id);

create table if not exists public.organization_guest_users (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  status text not null default 'active' check (status in ('active', 'claimed', 'revoked')),
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_api_key_id uuid references public.agent_api_keys(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create index if not exists idx_org_guest_users_org
  on public.organization_guest_users(organization_id, created_at desc);

create index if not exists idx_org_guest_users_email
  on public.organization_guest_users(lower(email));

alter table public.learning_plans
  add column if not exists guest_user_id uuid references public.organization_guest_users(id) on delete set null;

create index if not exists idx_learning_plans_guest_user_id
  on public.learning_plans(guest_user_id);

alter table public.agent_api_keys
  alter column user_id drop not null,
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists guest_user_id uuid references public.organization_guest_users(id) on delete cascade;

create index if not exists idx_agent_api_keys_org
  on public.agent_api_keys(organization_id);

create index if not exists idx_agent_api_keys_guest
  on public.agent_api_keys(guest_user_id);

alter table public.workspace_ghc_sessions
  alter column user_id drop not null,
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists guest_user_id uuid references public.organization_guest_users(id) on delete set null;

create index if not exists idx_workspace_ghc_sessions_org
  on public.workspace_ghc_sessions(organization_id, created_at desc);

create index if not exists idx_workspace_ghc_sessions_guest
  on public.workspace_ghc_sessions(guest_user_id, created_at desc);

alter table public.organization_guest_users enable row level security;

drop policy if exists "Org admins can view guest users" on public.organization_guest_users;
create policy "Org admins can view guest users"
  on public.organization_guest_users for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = organization_guest_users.organization_id
        and profiles.is_org_admin = true
    )
  );

drop policy if exists "Org admins can create guest users" on public.organization_guest_users;
create policy "Org admins can create guest users"
  on public.organization_guest_users for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = organization_guest_users.organization_id
        and profiles.is_org_admin = true
    )
  );

drop policy if exists "Org admins can update guest users" on public.organization_guest_users;
create policy "Org admins can update guest users"
  on public.organization_guest_users for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.organization_id = organization_guest_users.organization_id
        and profiles.is_org_admin = true
    )
  );
