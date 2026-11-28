-- TAPBench links: durable anonymous guest subject for PoW attribution
-- (parity with TAP guest links so knowledge-config subjects are guest-scoped).

alter table public.workspace_tapbench_links
  add column if not exists guest_user_id uuid null
    references public.organization_guest_users (id) on delete set null;

create index if not exists idx_workspace_tapbench_links_guest
  on public.workspace_tapbench_links (guest_user_id)
  where guest_user_id is not null;

comment on column public.workspace_tapbench_links.guest_user_id is
  'Anonymous guest identity for all PoW flushed under this TAPBench session.';
