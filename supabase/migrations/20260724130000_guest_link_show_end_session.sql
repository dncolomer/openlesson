-- Guest TAP / ILE links: optional End Session control (default shown).

alter table public.workspace_tap_sessions
  add column if not exists show_end_session boolean not null default true;

alter table public.workspace_ile_links
  add column if not exists show_end_session boolean not null default true;

comment on column public.workspace_tap_sessions.show_end_session is
  'When true (default), guest TAP UI shows End Session. When false, hide the control.';

comment on column public.workspace_ile_links.show_end_session is
  'When true (default), guest ILE UI shows End Session / stop-end controls. When false, hide them.';
