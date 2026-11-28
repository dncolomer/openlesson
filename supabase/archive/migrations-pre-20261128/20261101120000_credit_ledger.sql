-- Granular usage credits: balance on profiles, append-only ledger, Stripe Connect for AYCL authors.

alter table public.profiles
  add column if not exists credit_balance integer not null default 0;

alter table public.profiles
  add column if not exists stripe_connect_account_id text;

alter table public.profiles
  add column if not exists stripe_connect_charges_enabled boolean not null default false;

comment on column public.profiles.credit_balance is
  'Current usage-credit balance. Flow sessions debit this; packs and the free signup grant credit it.';

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_kind text not null,
  amount integer not null,
  balance_after integer not null,
  reason text not null,
  flow_kind text,
  stripe_checkout_session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint credit_ledger_entry_kind_check
    check (entry_kind in ('grant', 'pack', 'debit', 'refund'))
);

create index if not exists credit_ledger_user_id_created_at_idx
  on public.credit_ledger (user_id, created_at desc);

create unique index if not exists credit_ledger_user_reason_unique
  on public.credit_ledger (user_id, reason)
  where reason in ('signup_starter') or reason like 'credit_pack:%';

alter table public.credit_ledger enable row level security;

drop policy if exists "Users can read own credit ledger" on public.credit_ledger;
create policy "Users can read own credit ledger"
  on public.credit_ledger for select
  using (auth.uid() = user_id);

comment on table public.credit_ledger is
  'Append-only usage-credit ledger. Session starts debit; signup and packs grant.';
