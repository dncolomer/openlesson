-- Drop retired All-You-Can-Learn shop and Stripe Connect payout schema.
-- Learning Maps as a product and the money shop are gone. Keep workspaces,
-- blocks, sessions, flows, knowledge_regions, practice_problems, proof_of_work,
-- embeddings, and credit_ledger for Solve, Verification, Calibration, and the
-- session canvas.

-- Purchases reference complimentary links; drop purchases first.
drop table if exists public.aycl_purchases cascade;
drop table if exists public.aycl_complimentary_links cascade;

drop index if exists public.idx_workspaces_aycl;
drop index if exists public.idx_workspaces_aycl_category;

alter table public.workspaces
  drop constraint if exists workspaces_aycl_learner_price_cents_check;

alter table public.workspaces
  drop constraint if exists workspaces_aycl_full_price_cents_check;

alter table public.workspaces
  drop column if exists is_all_you_can_learn;

alter table public.workspaces
  drop column if exists aycl_category;

alter table public.workspaces
  drop column if exists aycl_summary;

alter table public.workspaces
  drop column if exists aycl_author_name;

alter table public.workspaces
  drop column if exists aycl_author_avatar_url;

alter table public.workspaces
  drop column if exists aycl_learner_price_cents;

alter table public.workspaces
  drop column if exists aycl_full_price_cents;

alter table public.profiles
  drop column if exists stripe_connect_account_id;

alter table public.profiles
  drop column if exists stripe_connect_charges_enabled;
