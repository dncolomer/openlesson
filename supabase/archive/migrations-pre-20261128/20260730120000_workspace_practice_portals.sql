-- Practice Portal: workspace-scoped guest mint desks.
-- Owners create a shareable portal URL; visitors mint one-shot TAP/ILE links
-- limited to the portal's configured product intents and timings.

create table if not exists public.workspace_practice_portals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  private_token_hash text not null,
  config jsonb not null default '{}'::jsonb,
  label text,
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists workspace_practice_portals_private_token_hash_key
  on public.workspace_practice_portals (private_token_hash);

create index if not exists idx_workspace_practice_portals_workspace
  on public.workspace_practice_portals (workspace_id, created_at desc);

create index if not exists idx_workspace_practice_portals_status
  on public.workspace_practice_portals (workspace_id, status, created_at desc)
  where status = 'active';

alter table public.workspace_practice_portals enable row level security;

-- Service-role / admin client is used by API routes (same pattern as ILE/TAP guest links).
-- Optional owner read for direct client access when authenticated as workspace owner.
create policy "Owners can view own workspace practice portals"
  on public.workspace_practice_portals
  for select
  using (
    auth.uid() is not null
    and (
      user_id = auth.uid()
      or workspace_id in (
        select id from public.workspaces where user_id = auth.uid()
      )
    )
  );
