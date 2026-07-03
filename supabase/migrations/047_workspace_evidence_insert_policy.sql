-- Allow workspace owners to insert evidence rows (UI session + authenticated uploads).

drop policy if exists "Workspace owners can insert evidence" on public.workspace_evidence;

create policy "Workspace owners can insert evidence"
  on public.workspace_evidence for insert
  with check (
    exists (
      select 1 from public.learning_plans lp
      where lp.id = workspace_evidence.plan_id
        and lp.user_id = auth.uid()
    )
  );