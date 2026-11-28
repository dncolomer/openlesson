-- Durable knowledge-region simulation jobs (one family per job, 55s lease).

create table if not exists public.region_simulation_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  region_id uuid,
  product text not null default 'verification',
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed')),
  family text not null default 'exploration'
    check (family in ('exploration', 'ai_use')),
  follow_up_job_id uuid,
  plan jsonb not null default '{}'::jsonb,
  plan_cursor integer not null default 0,
  checkpoint jsonb,
  lease_owner text,
  lease_until timestamptz,
  progress jsonb not null default '[]'::jsonb,
  result jsonb,
  cost_usd numeric not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists region_simulation_jobs_owner_status_idx
  on public.region_simulation_jobs (owner_user_id, status, created_at desc);

create index if not exists region_simulation_jobs_lease_idx
  on public.region_simulation_jobs (lease_until);

alter table public.region_simulation_jobs enable row level security;

drop policy if exists "Owners can manage region simulation jobs" on public.region_simulation_jobs;
create policy "Owners can manage region simulation jobs"
  on public.region_simulation_jobs
  for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

comment on table public.region_simulation_jobs is
  'Queued knowledge-region simulation. One family per job. Lease TTL is 55 seconds.';
