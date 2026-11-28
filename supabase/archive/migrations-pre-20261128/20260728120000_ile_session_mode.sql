-- ILE session mode: learning (default Helios dialogue) vs project (exercise per chapter, dual-stack Thoughts).
-- Separate from TAP interaction_kind; do not overload facilitator mode.

alter table public.workspace_ile_links
  add column if not exists session_mode text not null default 'learning';

alter table public.workspace_ile_links
  drop constraint if exists workspace_ile_links_session_mode_check;

alter table public.workspace_ile_links
  add constraint workspace_ile_links_session_mode_check
  check (session_mode in ('learning', 'project'));

comment on column public.workspace_ile_links.session_mode is
  'learning = Learning Mode (Helios dialogue); project = Project Mode (per-chapter exercises, dual-stack Thoughts, no conversation bubbles)';
