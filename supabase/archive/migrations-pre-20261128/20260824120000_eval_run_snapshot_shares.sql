-- Public Snapshot landing shares. Token-keyed; unpublished eval_run_history
-- rows stay private. No anon/public RLS — public reads use the service-role
-- admin client after a share token lookup.

create table if not exists public.eval_run_snapshot_shares (
  id uuid primary key default gen_random_uuid(),
  eval_run_history_id uuid not null references public.eval_run_history(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  share_token text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint eval_run_snapshot_shares_eval_run_unique unique (eval_run_history_id),
  constraint eval_run_snapshot_shares_token_unique unique (share_token)
);

create index if not exists eval_run_snapshot_shares_token_idx
  on public.eval_run_snapshot_shares (share_token);

create index if not exists eval_run_snapshot_shares_workspace_idx
  on public.eval_run_snapshot_shares (workspace_id, created_at desc);

comment on table public.eval_run_snapshot_shares is
  'Operator-minted public share tokens for Learning Profiles snapshots. Lookup is token-keyed; eval_run_history RLS stays owner/subject-only.';

alter table public.eval_run_snapshot_shares enable row level security;

-- Service-role / admin client is used by public landing + generate APIs.
-- Optional owner manage for authenticated workspace owners.
create policy "Workspace owners manage snapshot shares"
  on public.eval_run_snapshot_shares
  for all
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = eval_run_snapshot_shares.workspace_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = eval_run_snapshot_shares.workspace_id
        and w.user_id = auth.uid()
    )
  );
