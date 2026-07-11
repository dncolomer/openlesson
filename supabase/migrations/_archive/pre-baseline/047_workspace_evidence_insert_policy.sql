-- Allow workspace owners to insert proof-of-work rows (UI session + authenticated uploads).

drop policy if exists "Workspace owners can insert evidence" on public.workspace_proof_of_work;

create policy "Workspace owners can insert evidence"
  on public.workspace_proof_of_work for insert
  with check (
    exists (
      select 1 from public.learning_plans lp
      where lp.id = workspace_proof_of_work.plan_id
        and lp.user_id = auth.uid()
    )
  );