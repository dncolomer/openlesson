-- Extra public tokens for product flows. The flow's own public_token stays
-- the unlabeled default (Test). Extra links carry an optional label that
-- tags sessions and embeddings from that URL.

create table if not exists public.flow_links (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  flow_kind text not null check (flow_kind in ('verification', 'calibration', 'solve')),
  flow_id uuid not null,
  public_token text not null,
  label text,
  created_at timestamptz not null default now()
);

create unique index if not exists flow_links_public_token_uidx
  on public.flow_links (public_token);

create index if not exists flow_links_flow_idx
  on public.flow_links (owner_user_id, flow_kind, flow_id);

alter table public.flow_links enable row level security;

drop policy if exists "Owners can manage flow links" on public.flow_links;
create policy "Owners can manage flow links"
  on public.flow_links
  for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

comment on table public.flow_links is
  'Extra public flow URLs. Optional label tags run data. Null label is Test.';

alter table public.session_embeddings
  add column if not exists link_label text;

comment on column public.session_embeddings.link_label is
  'Label of the public flow link used for this run. Null is the default Test link.';
