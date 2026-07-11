-- Upgrade path: rename legacy workspace_evidence table/column to proof-of-work domain names.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'workspace_evidence'
  ) then
    alter table public.workspace_evidence rename to workspace_proof_of_work;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workspace_proof_of_work'
      and column_name = 'evidence_type'
  ) then
    alter table public.workspace_proof_of_work
      rename column evidence_type to proof_of_work_type;
  end if;
end $$;

-- Rename indexes when present (ignore if already renamed).
do $$
declare
  r record;
begin
  for r in
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'workspace_proof_of_work'
      and indexname like 'idx_workspace_evidence%'
  loop
    execute format(
      'alter index public.%I rename to %I',
      r.indexname,
      replace(r.indexname, 'workspace_evidence', 'workspace_proof_of_work')
    );
  end loop;
end $$;