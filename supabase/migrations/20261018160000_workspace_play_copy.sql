-- Permanent play-only copies acquired from Dashboard Home.
alter table public.workspaces
  add column if not exists is_play_copy boolean not null default false;
