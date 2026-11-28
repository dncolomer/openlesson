create extension if not exists pgcrypto;

-- Every Learning Map tile except content has an underlying flow.
-- Legacy Learn tiles (map_block IS NULL) become owner Solve flows.
-- Restore 3×3 occupancy on tiles that stored a kind name as map_icon.

alter table public.solve_flows
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

create index if not exists solve_flows_workspace_id_idx
  on public.solve_flows (workspace_id)
  where workspace_id is not null;

-- Kind names were briefly written as map_icon; occupancy is a 3×3 again.
update public.blocks
set map_icon = 'g' || ((((('x' || substr(md5(id::text), 1, 6))::bit(24)::int) % 511) + 1)::text)
where map_icon in ('solve', 'calibration', 'verification', 'content');

do $$
declare
  rec record;
  flow_id uuid;
  token text;
  flow_name text;
  flow_topic text;
begin
  for rec in
    select
      b.id as block_id,
      b.title,
      b.description,
      b.workspace_id,
      w.user_id as owner_user_id
    from public.blocks b
    join public.workspaces w on w.id = b.workspace_id
    where b.map_block is null
      and w.user_id is not null
  loop
    flow_id := gen_random_uuid();
    token := encode(gen_random_bytes(16), 'hex');
    flow_name := left(coalesce(nullif(btrim(rec.title), ''), 'Untitled'), 160);
    flow_topic := coalesce(
      nullif(btrim(rec.description), ''),
      flow_name
    );

    insert into public.solve_flows (
      id,
      owner_user_id,
      workspace_id,
      name,
      topic,
      duration_minutes,
      action_catalog,
      public_token
    )
    values (
      flow_id,
      rec.owner_user_id,
      rec.workspace_id,
      flow_name,
      flow_topic,
      15,
      4,
      token
    );

    update public.blocks
    set map_block = jsonb_build_object(
      'kind', 'solve',
      'flow_id', flow_id,
      'flow_public_token', token,
      'flow_href', '/s/' || token
    )
    where id = rec.block_id;
  end loop;
end $$;

comment on column public.blocks.map_block is
  'Typed Learning Map tile. Solve, verification, calibration, or content. Legacy Learn rows are backfilled to Solve.';
