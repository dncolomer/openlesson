-- Reparent Verification/Calibration flows, knowledge regions, and flow
-- embeddings onto owner_user_id. Workspaces stay Learning (standard).
-- Do not rename flow tables. Public tokens are unchanged.

-- 1. Add owner_user_id (nullable until backfill).
alter table public.workspace_verification_flows
  add column if not exists owner_user_id uuid;

alter table public.workspace_calibration_flows
  add column if not exists owner_user_id uuid;

alter table public.custom_verification_models
  add column if not exists owner_user_id uuid;

alter table public.workspace_flow_embeddings
  add column if not exists owner_user_id uuid;

-- Dashboard product for owner-scoped regions after workspace_kind is dropped.
alter table public.custom_verification_models
  add column if not exists product text;

alter table public.custom_verification_models
  drop constraint if exists custom_verification_models_product_check;

alter table public.custom_verification_models
  add constraint custom_verification_models_product_check
  check (product is null or product = any (array['verification'::text, 'calibration'::text]));

-- 2. Backfill from workspaces.user_id.
update public.workspace_verification_flows f
set owner_user_id = w.user_id
from public.workspaces w
where w.id = f.workspace_id
  and f.owner_user_id is null;

update public.workspace_calibration_flows f
set owner_user_id = w.user_id
from public.workspaces w
where w.id = f.workspace_id
  and f.owner_user_id is null;

update public.custom_verification_models m
set owner_user_id = w.user_id
from public.workspaces w
where w.id = m.workspace_id
  and m.owner_user_id is null;

update public.workspace_flow_embeddings e
set owner_user_id = w.user_id
from public.workspaces w
where w.id = e.workspace_id
  and e.owner_user_id is null;

update public.custom_verification_models m
set product = case w.workspace_kind
  when 'calibration' then 'calibration'
  when 'knowledge_region' then 'verification'
  else m.product
end
from public.workspaces w
where w.id = m.workspace_id
  and m.product is null
  and w.workspace_kind in ('knowledge_region', 'calibration');

-- 3. Orphans with no workspace owner cannot satisfy NOT NULL; drop them.
-- Learning embeddings may remain workspace-scoped (owner_user_id nullable).
delete from public.workspace_verification_flows where owner_user_id is null;
delete from public.workspace_calibration_flows where owner_user_id is null;
delete from public.custom_verification_models where owner_user_id is null;

alter table public.workspace_verification_flows
  alter column owner_user_id set not null;

alter table public.workspace_calibration_flows
  alter column owner_user_id set not null;

alter table public.custom_verification_models
  alter column owner_user_id set not null;

alter table public.workspace_verification_flows
  drop constraint if exists workspace_verification_flows_owner_user_id_fkey;
alter table public.workspace_verification_flows
  add constraint workspace_verification_flows_owner_user_id_fkey
  foreign key (owner_user_id) references auth.users(id) on delete cascade;

alter table public.workspace_calibration_flows
  drop constraint if exists workspace_calibration_flows_owner_user_id_fkey;
alter table public.workspace_calibration_flows
  add constraint workspace_calibration_flows_owner_user_id_fkey
  foreign key (owner_user_id) references auth.users(id) on delete cascade;

alter table public.custom_verification_models
  drop constraint if exists custom_verification_models_owner_user_id_fkey;
alter table public.custom_verification_models
  add constraint custom_verification_models_owner_user_id_fkey
  foreign key (owner_user_id) references auth.users(id) on delete cascade;

alter table public.workspace_flow_embeddings
  drop constraint if exists workspace_flow_embeddings_owner_user_id_fkey;
alter table public.workspace_flow_embeddings
  add constraint workspace_flow_embeddings_owner_user_id_fkey
  foreign key (owner_user_id) references auth.users(id) on delete cascade;

create index if not exists idx_workspace_verification_flows_owner
  on public.workspace_verification_flows (owner_user_id, created_at desc);

create index if not exists idx_workspace_calibration_flows_owner
  on public.workspace_calibration_flows (owner_user_id, created_at desc);

create index if not exists idx_custom_verification_models_owner
  on public.custom_verification_models (owner_user_id, created_at desc);

create index if not exists idx_workspace_flow_embeddings_owner
  on public.workspace_flow_embeddings (owner_user_id, created_at desc);

comment on column public.workspace_verification_flows.owner_user_id is
  'Owning user. New rows do not require a workspace.';
comment on column public.workspace_calibration_flows.owner_user_id is
  'Owning user. New rows do not require a workspace.';
comment on column public.custom_verification_models.owner_user_id is
  'Owning user. Dashboard regions list by this column.';
comment on column public.custom_verification_models.product is
  'verification or calibration for owner-scoped dashboard regions; null on Learning workspace regions.';
comment on column public.workspace_flow_embeddings.owner_user_id is
  'Owning user when known. Learning rows may stay workspace-scoped.';

-- 4. Owner SELECT RLS uses owner_user_id. Service-role still bypasses RLS.
drop policy if exists "Owners can view verification flows"
  on public.workspace_verification_flows;
create policy "Owners can view verification flows"
  on public.workspace_verification_flows
  for select
  using (auth.uid() is not null and owner_user_id = auth.uid());

drop policy if exists "Owners can view verification identities"
  on public.workspace_verification_identities;
create policy "Owners can view verification identities"
  on public.workspace_verification_identities
  for select
  using (
    auth.uid() is not null
    and flow_id in (
      select id from public.workspace_verification_flows
      where owner_user_id = auth.uid()
    )
  );

drop policy if exists "Owners can view verification results"
  on public.workspace_verification_results;
create policy "Owners can view verification results"
  on public.workspace_verification_results
  for select
  using (
    auth.uid() is not null
    and flow_id in (
      select id from public.workspace_verification_flows
      where owner_user_id = auth.uid()
    )
  );

drop policy if exists "Owners can view calibration flows"
  on public.workspace_calibration_flows;
create policy "Owners can view calibration flows"
  on public.workspace_calibration_flows
  for select
  using (auth.uid() is not null and owner_user_id = auth.uid());

drop policy if exists "Owners can view calibration identities"
  on public.workspace_calibration_identities;
create policy "Owners can view calibration identities"
  on public.workspace_calibration_identities
  for select
  using (
    auth.uid() is not null
    and flow_id in (
      select id from public.workspace_calibration_flows
      where owner_user_id = auth.uid()
    )
  );

drop policy if exists "Owners can view calibration proofs"
  on public.workspace_calibration_proofs;
create policy "Owners can view calibration proofs"
  on public.workspace_calibration_proofs
  for select
  using (
    auth.uid() is not null
    and flow_id in (
      select id from public.workspace_calibration_flows
      where owner_user_id = auth.uid()
    )
  );

drop policy if exists "Owners can view flow embeddings"
  on public.workspace_flow_embeddings;
create policy "Owners can view flow embeddings"
  on public.workspace_flow_embeddings
  for select
  using (
    auth.uid() is not null
    and (
      owner_user_id = auth.uid()
      or workspace_id in (
        select id from public.workspaces where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Workspace owners manage custom verification models"
  on public.custom_verification_models;
create policy "Workspace owners manage custom verification models"
  on public.custom_verification_models
  for all
  using (auth.uid() is not null and owner_user_id = auth.uid())
  with check (auth.uid() is not null and owner_user_id = auth.uid());

-- 5. workspace_id is optional. Results/proofs follow the flow, not a workspace.
alter table public.workspace_verification_flows
  alter column workspace_id drop not null;

alter table public.workspace_calibration_flows
  alter column workspace_id drop not null;

alter table public.custom_verification_models
  alter column workspace_id drop not null;

alter table public.workspace_flow_embeddings
  alter column workspace_id drop not null;

alter table public.workspace_verification_results
  alter column workspace_id drop not null;

alter table public.workspace_calibration_proofs
  alter column workspace_id drop not null;

drop index if exists custom_verification_models_workspace_name_uidx;
drop index if exists custom_verification_models_owner_name_uidx;
create unique index if not exists custom_verification_models_workspace_name_uidx
  on public.custom_verification_models (workspace_id, lower(trim(name)))
  where workspace_id is not null;

-- 7. KR/calibration workspaces that still have map blocks become Learning.
update public.workspaces w
set workspace_kind = 'standard'
where w.workspace_kind in ('knowledge_region', 'calibration')
  and exists (select 1 from public.blocks b where b.workspace_id = w.id);

-- 8. Empty owner-container KR/calibration workspaces: rename colliding
-- owner-scoped region names, null FKs, then delete.
with doomed as (
  select w.id
  from public.workspaces w
  where w.workspace_kind in ('knowledge_region', 'calibration')
    and not exists (select 1 from public.blocks b where b.workspace_id = w.id)
),
candidates as (
  select
    m.id,
    m.owner_user_id,
    coalesce(m.product, '') as product_key,
    lower(trim(m.name)) as name_key,
    m.created_at
  from public.custom_verification_models m
  where m.workspace_id is null
     or m.workspace_id in (select id from doomed)
),
ranked as (
  select
    id,
    row_number() over (
      partition by owner_user_id, product_key, name_key
      order by created_at asc, id asc
    ) as rn
  from candidates
)
update public.custom_verification_models m
set name = left(trim(m.name), 140) || ' (' || substr(replace(m.id::text, '-', ''), 1, 8) || ')'
from ranked r
where m.id = r.id
  and r.rn > 1;

update public.workspace_verification_flows f
set workspace_id = null
where f.workspace_id in (
  select w.id from public.workspaces w
  where w.workspace_kind in ('knowledge_region', 'calibration')
    and not exists (select 1 from public.blocks b where b.workspace_id = w.id)
);

update public.workspace_calibration_flows f
set workspace_id = null
where f.workspace_id in (
  select w.id from public.workspaces w
  where w.workspace_kind in ('knowledge_region', 'calibration')
    and not exists (select 1 from public.blocks b where b.workspace_id = w.id)
);

update public.custom_verification_models m
set workspace_id = null
where m.workspace_id in (
  select w.id from public.workspaces w
  where w.workspace_kind in ('knowledge_region', 'calibration')
    and not exists (select 1 from public.blocks b where b.workspace_id = w.id)
);

update public.workspace_flow_embeddings e
set workspace_id = null
where e.workspace_id in (
  select w.id from public.workspaces w
  where w.workspace_kind in ('knowledge_region', 'calibration')
    and not exists (select 1 from public.blocks b where b.workspace_id = w.id)
);

update public.workspace_verification_results r
set workspace_id = null
where r.workspace_id in (
  select w.id from public.workspaces w
  where w.workspace_kind in ('knowledge_region', 'calibration')
    and not exists (select 1 from public.blocks b where b.workspace_id = w.id)
);

update public.workspace_calibration_proofs p
set workspace_id = null
where p.workspace_id in (
  select w.id from public.workspaces w
  where w.workspace_kind in ('knowledge_region', 'calibration')
    and not exists (select 1 from public.blocks b where b.workspace_id = w.id)
);

delete from public.workspaces w
where w.workspace_kind in ('knowledge_region', 'calibration')
  and not exists (select 1 from public.blocks b where b.workspace_id = w.id);

create unique index if not exists custom_verification_models_owner_name_uidx
  on public.custom_verification_models (
    owner_user_id,
    (coalesce(product, '')),
    (lower(trim(name)))
  )
  where workspace_id is null;

-- 9. Live workspace rows are Learning only. parseWorkspaceKind still maps aliases.
alter table public.workspaces
  drop constraint if exists workspaces_workspace_kind_check;

alter table public.workspaces
  add constraint workspaces_workspace_kind_check
  check (workspace_kind = 'standard'::text);

comment on column public.workspaces.workspace_kind is
  'standard (Learning map). knowledge_region and calibration were owner containers for flows.';
