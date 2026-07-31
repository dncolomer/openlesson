-- TAPBench timed agent evaluation links (listable share URLs + session tokens).
-- public_token is always stored so owners can rebuild/copy the share URL any time.

create table if not exists public.workspace_tapbench_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  block_id uuid null references public.blocks (id) on delete set null,
  public_token text not null,
  private_token_hash text not null,
  exercise_text text not null,
  duration_seconds integer not null
    check (duration_seconds >= 60 and duration_seconds <= 10800),
  expires_at timestamptz not null,
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked')),
  created_by uuid null,
  created_at timestamptz not null default now()
);

create unique index if not exists workspace_tapbench_links_public_token_key
  on public.workspace_tapbench_links (public_token);

create unique index if not exists workspace_tapbench_links_private_token_hash_key
  on public.workspace_tapbench_links (private_token_hash);

create index if not exists idx_workspace_tapbench_links_workspace
  on public.workspace_tapbench_links (workspace_id, created_at desc);

create index if not exists idx_workspace_tapbench_links_block
  on public.workspace_tapbench_links (block_id)
  where block_id is not null;

comment on table public.workspace_tapbench_links is
  'TAPBench links: timed exercises for agents via Stash/Submit; share URLs always listable via public_token.';

-- PoW metadata tapbench flag lookups
create index if not exists idx_workspace_pow_tapbench
  on public.workspace_proof_of_work ((metadata ->> 'tapbench'))
  where (metadata ? 'tapbench');

create index if not exists idx_workspace_pow_pow_source
  on public.workspace_proof_of_work ((metadata ->> 'pow_source'))
  where (metadata ? 'pow_source');
