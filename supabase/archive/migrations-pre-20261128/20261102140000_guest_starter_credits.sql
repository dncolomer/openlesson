-- Minted guest accounts (AYCL fork guests) grant 100 credits once (reason guest_starter).

drop index if exists public.credit_ledger_user_reason_unique;

create unique index if not exists credit_ledger_user_reason_unique
  on public.credit_ledger (user_id, reason)
  where reason in ('signup_starter', 'guest_starter') or reason like 'credit_pack:%';
