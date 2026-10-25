-- PR 8: copy leftover TAP/ILE/headless/identity/proof rows onto sessions,
-- then drop satellite tables. Guest URLs keep working via
-- sessions.private_token_hash / public_token.

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions
  add constraint sessions_status_check check (
    status = any (array[
      'active'::text,
      'paused'::text,
      'completed'::text,
      'pending'::text,
      'in_progress'::text,
      'revoked'::text,
      'archived'::text,
      'ended'::text,
      'expired'::text
    ])
  );

insert into public.sessions (
  id, user_id, problem, status, kind, workspace_id, block_id, guest_user_id,
  assigned_user_id, organization_id, private_token_hash, public_token, access_mode,
  guest_link, created_at
)
select
  c.id,
  coalesce(c.user_id, w.user_id),
  'Calibrate',
  coalesce(c.status, 'pending'),
  'calibrate',
  c.workspace_id,
  c.block_id,
  c.guest_user_id,
  c.assigned_user_id,
  c.organization_id,
  c.private_token_hash,
  c.public_token,
  c.access_mode,
  to_jsonb(c) - 'id',
  c.created_at
from public.workspace_calibrate_sessions c
left join public.workspaces w on w.id = c.workspace_id
where coalesce(c.user_id, w.user_id) is not null
on conflict (id) do nothing;

insert into public.sessions (
  id, user_id, problem, status, kind, workspace_id, block_id, guest_user_id,
  assigned_user_id, organization_id, private_token_hash, public_token, access_mode,
  guest_link, created_at
)
select
  v.id,
  coalesce(v.user_id, w.user_id),
  'Verify',
  coalesce(v.status, 'pending'),
  'verify',
  v.workspace_id,
  v.block_id,
  v.guest_user_id,
  v.assigned_user_id,
  v.organization_id,
  v.private_token_hash,
  v.public_token,
  v.access_mode,
  to_jsonb(v) - 'id',
  v.created_at
from public.workspace_verify_sessions v
left join public.workspaces w on w.id = v.workspace_id
where coalesce(v.user_id, w.user_id) is not null
on conflict (id) do nothing;

insert into public.sessions (
  id, user_id, problem, status, kind, workspace_id, block_id, guest_user_id,
  assigned_user_id, organization_id, private_token_hash, public_token, access_mode,
  guest_link, created_at
)
select
  l.id,
  coalesce(l.user_id, w.user_id),
  'Learn',
  coalesce(l.status, 'pending'),
  'learn',
  l.workspace_id,
  l.block_id,
  l.guest_user_id,
  l.assigned_user_id,
  l.organization_id,
  l.private_token_hash,
  l.public_token,
  l.access_mode,
  to_jsonb(l) - 'id',
  l.created_at
from public.workspace_learn_links l
left join public.workspaces w on w.id = l.workspace_id
where l.session_id is null
  and coalesce(l.user_id, w.user_id) is not null
on conflict (id) do nothing;

update public.sessions s
set
  private_token_hash = coalesce(s.private_token_hash, l.private_token_hash),
  public_token = coalesce(s.public_token, l.public_token),
  access_mode = coalesce(s.access_mode, l.access_mode),
  guest_user_id = coalesce(s.guest_user_id, l.guest_user_id),
  assigned_user_id = coalesce(s.assigned_user_id, l.assigned_user_id),
  workspace_id = coalesce(s.workspace_id, l.workspace_id),
  block_id = coalesce(s.block_id, l.block_id),
  guest_link = case
    when s.guest_link = '{}'::jsonb then to_jsonb(l) - 'id'
    else s.guest_link
  end
from public.workspace_learn_links l
where l.session_id = s.id;

-- Calibrate proofs become completed calibrate sessions (same proof id).
insert into public.sessions (
  id, user_id, problem, status, kind, workspace_id, calibrate_flow_id, identity,
  result, guest_link, created_at
)
select
  p.id,
  coalesce(f.owner_user_id, w.user_id),
  'Calibrate',
  'completed',
  'calibrate',
  p.workspace_id,
  p.flow_id,
  p.identity,
  jsonb_build_object('kind', 'calibrate', 'legacyEvents', p.events),
  jsonb_build_object('events', p.events, 'source', 'workspace_calibration_proofs'),
  p.created_at
from public.workspace_calibration_proofs p
left join public.workspace_calibration_flows f on f.id = p.flow_id
left join public.workspaces w on w.id = p.workspace_id
where coalesce(f.owner_user_id, w.user_id) is not null
on conflict (id) do nothing;

insert into public.sessions (
  id, user_id, problem, status, kind, workspace_id, guest_link
)
select
  h.id,
  w.user_id,
  'Headless',
  coalesce(h.status, 'completed'),
  case
    when h.flow_kind in ('calibrate', 'verify', 'learn') then h.flow_kind
    else 'learn'
  end,
  h.workspace_id,
  coalesce(h.record, '{}'::jsonb) || jsonb_build_object('headless', true)
from public.workspace_headless_sessions h
join public.workspaces w on w.id = h.workspace_id
where w.user_id is not null
on conflict (id) do nothing;

update public.sessions s
set
  block_id = coalesce(s.block_id, b.block_id),
  workspace_id = coalesce(s.workspace_id, b.workspace_id)
from public.block_sessions b
where b.session_id = s.id;

drop table if exists public.workspace_calibrate_sessions cascade;
drop table if exists public.workspace_verify_sessions cascade;
drop table if exists public.workspace_learn_links cascade;
drop table if exists public.workspace_calibration_identities cascade;
drop table if exists public.workspace_verification_identities cascade;
drop table if exists public.workspace_calibration_proofs cascade;
drop table if exists public.workspace_headless_sessions cascade;
drop table if exists public.block_sessions cascade;
