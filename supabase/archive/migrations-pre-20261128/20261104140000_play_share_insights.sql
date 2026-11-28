-- Author may grant read access to insights crafted on play copies. Default off.

alter table public.workspaces
  add column if not exists play_share_insights boolean not null default false;

comment on column public.workspaces.play_share_insights is
  'When true, the map author can read insights crafted on play copies of this map.';
