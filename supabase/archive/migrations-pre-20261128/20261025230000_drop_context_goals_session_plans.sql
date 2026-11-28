-- PR 6: Context files, Dantes resources, goals, and session_plans.
-- Chapter maps copy onto sessions.chapter_map. Notes stay on workspaces.notes.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'session_plans'
  ) then
    update public.sessions s
    set chapter_map = to_jsonb(sp)
    from public.session_plans sp
    where s.id = sp.session_id
      and s.chapter_map is null;
  end if;
end $$;

drop table if exists public.session_plans cascade;
drop table if exists public.workspace_files cascade;
drop table if exists public.workspace_external_resources cascade;
drop table if exists public.block_goals cascade;
drop table if exists public.workspace_goals cascade;
