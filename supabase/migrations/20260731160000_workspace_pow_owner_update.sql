-- Allow workspace owners to UPDATE proof-of-work rows (metadata edit / invalidate).
-- Previously only SELECT + INSERT existed for owners; Data Studio PATCH requires UPDATE.

CREATE POLICY "Workspace owners can update evidence"
  ON public.workspace_proof_of_work
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.id = workspace_proof_of_work.workspace_id
        AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.id = workspace_proof_of_work.workspace_id
        AND w.user_id = auth.uid()
    )
  );
