-- Milliseconds from session start to the moment an insight is crafted.
-- Null on rows crafted before this column, or when session start is unknown.

alter table public.insights
  add column if not exists session_elapsed_ms integer;

comment on column public.insights.session_elapsed_ms is
  'Milliseconds from session start (session_started_at, else sessions.created_at) to insight crafting. Null when that start is unknown.';
