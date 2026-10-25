-- Complete the core data model: fold Verify results into sessions.result,
-- rename keep tables to contract names, drop leftover columns and retired
-- 64-d knowledge-region rows, drop flow workspace_id.

-- 1. Fold workspace_verification_results onto verify sessions.

insert into public.sessions (
  user_id,
  problem,
  status,
  kind,
  verify_flow_id,
  identity,
  workspace_id,
  result,
  guest_link,
  probes
)
select
  f.owner_user_id,
  'Verify',
  'completed',
  'verify',
  r.flow_id,
  r.identity,
  null,
  jsonb_build_object(
    'kind', 'verify',
    'projectedPolicy', null,
    'knowledgeRegionId', null,
    'answers', '[]'::jsonb
  ),
  '{}'::jsonb,
  '[]'::jsonb
from (
  select distinct flow_id, identity
  from public.workspace_verification_results
  where identity is not null and btrim(identity) <> ''
) r
join public.workspace_verification_flows f on f.id = r.flow_id
where f.owner_user_id is not null
  and not exists (
    select 1
    from public.sessions s
    where s.kind = 'verify'
      and s.verify_flow_id = r.flow_id
      and s.identity = r.identity
  );

update public.sessions s
set result = jsonb_build_object(
  'kind', 'verify',
  'projectedPolicy', s.result -> 'projectedPolicy',
  'knowledgeRegionId', s.result -> 'knowledgeRegionId',
  'answers', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'identity', r.identity,
        'source', coalesce(r.source, 'runner'),
        'questionId', r.question_id,
        'prompt', coalesce(r.prompt, ''),
        'createdAt', r.created_at
      )
      order by r.created_at
    )
    from public.workspace_verification_results r
    where r.flow_id = s.verify_flow_id
      and r.identity = s.identity
  ), '[]'::jsonb)
)
where s.kind = 'verify'
  and exists (
    select 1
    from public.workspace_verification_results r
    where r.flow_id = s.verify_flow_id
      and r.identity = s.identity
  );

insert into public.workspace_flow_embeddings (
  id,
  workspace_id,
  flow_kind,
  flow_id,
  run_id,
  identity,
  source,
  embedding_model_id,
  dim,
  vector,
  raw,
  owner_user_id,
  session_id
)
select
  gen_random_uuid(),
  s.workspace_id,
  'verify',
  r.flow_id::text,
  s.id::text,
  r.identity,
  coalesce(r.source, 'runner'),
  'flowcfg-v1-d96',
  greatest(coalesce(jsonb_array_length(r.embedding), 0), 1),
  r.embedding,
  jsonb_build_object(
    'legacyVerificationResult', true,
    'prompt', r.prompt,
    'questionId', r.question_id
  ),
  s.user_id,
  s.id
from public.workspace_verification_results r
join public.sessions s
  on s.kind = 'verify'
 and s.verify_flow_id = r.flow_id
 and s.identity = r.identity
where r.embedding is not null
  and jsonb_typeof(r.embedding) = 'array';

drop table if exists public.workspace_verification_results cascade;

-- 2. Rename keep tables to the contract names.

alter table public.workspace_calibration_flows rename to calibrate_flows;
alter table public.workspace_verification_flows rename to verify_flows;
alter table public.workspace_flow_embeddings rename to session_embeddings;
alter table public.custom_verification_models rename to knowledge_regions;
alter table public.workspace_proof_of_work rename to proof_of_work;

-- 3. Flows have no parent workspace.

alter table public.calibrate_flows drop constraint if exists workspace_calibration_flows_workspace_id_fkey;
alter table public.verify_flows drop constraint if exists workspace_verification_flows_workspace_id_fkey;
alter table public.calibrate_flows drop column if exists workspace_id;
alter table public.verify_flows drop column if exists workspace_id;

-- 4. Drop leftover ILE/TAP/product columns on keep tables.

alter table public.sessions
  drop column if exists audio_path,
  drop column if exists report,
  drop column if exists report_generated_at,
  drop column if exists transcript,
  drop column if exists has_transcript,
  drop column if exists is_agent_session;

drop policy if exists "Anyone can view group workspaces" on public.workspaces;
drop policy if exists "Users can view blocks" on public.blocks;
create policy "Users can view blocks"
  on public.blocks
  for select
  using (
    exists (
      select 1
      from public.workspaces w
      where w.id = blocks.workspace_id
        and (w.user_id = auth.uid() or w.is_public = true)
    )
  );
alter table public.workspaces drop constraint if exists learning_plans_payment_status_check;

alter table public.workspaces
  drop column if exists workspace_goal,
  drop column if exists source_type,
  drop column if exists source_url,
  drop column if exists source_summary,
  drop column if exists payment_status,
  drop column if exists is_group;

alter table public.profiles
  drop column if exists wallet_address;

-- 5. Retired 64-d knowledge regions are not live Path.

delete from public.knowledge_regions
where dim = 64
   or embedding_model_id = 'knowledgecfg-v1-d64'
   or family_embedding_model_id is null;

-- 6. Privilege trigger still referenced dropped Rabbit Hole columns
--    (210000 replaced a different function name).

create or replace function public.prevent_privileged_profile_escalation()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    auth.jwt() ->> 'role',
    ''
  );

  if jwt_role = 'service_role'
     or current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin') then
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin then
    raise exception 'Cannot modify is_admin';
  end if;
  if new.is_org_admin is distinct from old.is_org_admin then
    raise exception 'Cannot modify is_org_admin';
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Cannot modify organization_id';
  end if;
  if new.plan is distinct from old.plan then
    raise exception 'Cannot modify plan';
  end if;
  if new.subscription_status is distinct from old.subscription_status then
    raise exception 'Cannot modify subscription_status';
  end if;
  if new.current_period_end is distinct from old.current_period_end then
    raise exception 'Cannot modify current_period_end';
  end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'Cannot modify stripe_customer_id';
  end if;
  if new.stripe_subscription_id is distinct from old.stripe_subscription_id then
    raise exception 'Cannot modify stripe_subscription_id';
  end if;
  if new.extra_lessons is distinct from old.extra_lessons then
    raise exception 'Cannot modify extra_lessons';
  end if;
  if new.extra_workspaces is distinct from old.extra_workspaces then
    raise exception 'Cannot modify extra_workspaces';
  end if;
  if new.token_tier is distinct from old.token_tier then
    raise exception 'Cannot modify token_tier';
  end if;
  if new.token_validated_at is distinct from old.token_validated_at then
    raise exception 'Cannot modify token_validated_at';
  end if;
  if new.token_validity_expires_at is distinct from old.token_validity_expires_at then
    raise exception 'Cannot modify token_validity_expires_at';
  end if;
  return new;
end;
$$;
