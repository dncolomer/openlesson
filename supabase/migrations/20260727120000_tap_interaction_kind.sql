-- TAP interaction kind: conversational (default dialogue) vs exercise (solo prompt + submitted thoughts).
-- Separate from facilitator `mode` (still "curious"); do not overload that column.

alter table public.workspace_tap_sessions
  add column if not exists interaction_kind text not null default 'conversational';

alter table public.workspace_tap_sessions
  drop constraint if exists workspace_tap_sessions_interaction_kind_check;

alter table public.workspace_tap_sessions
  add constraint workspace_tap_sessions_interaction_kind_check
  check (interaction_kind in ('conversational', 'exercise'));

comment on column public.workspace_tap_sessions.interaction_kind is
  'conversational = Helios dialogue TAP; exercise = single exercise prompt + submitted thoughts (no dialogue bubbles)';
