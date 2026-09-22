-- Scout is a third TAP interaction kind (mind-map rabbit-hole, no think-aloud).

alter table public.workspace_tap_sessions
  drop constraint if exists workspace_tap_sessions_interaction_kind_check;

alter table public.workspace_tap_sessions
  add constraint workspace_tap_sessions_interaction_kind_check
  check (interaction_kind in ('conversational', 'exercise', 'scout'));

comment on column public.workspace_tap_sessions.interaction_kind is
  'conversational = Helios dialogue TAP; exercise = single exercise prompt + submitted thoughts; scout = rabbit-hole mind map (no speaking)';
