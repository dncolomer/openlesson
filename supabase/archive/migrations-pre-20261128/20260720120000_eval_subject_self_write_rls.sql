-- Allow registered learners to write their own subject-scoped eval/LWM/knowledge rows
-- on workspaces they may access (owner OR group). Fixes group-member self-eval saves
-- under cookie JWT (previously only owners had FOR ALL; subjects had SELECT only).
-- Guest-subject rows remain owner-managed (or service-role after server authz).

-- ---------------------------------------------------------------------------
-- eval_run_history: subjects INSERT own rows (append-only archive)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Subjects write own eval run history" ON public.eval_run_history;
CREATE POLICY "Subjects write own eval run history"
  ON public.eval_run_history
  FOR INSERT
  WITH CHECK (
    subject_user_id = auth.uid()
    AND subject_guest_user_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.id = eval_run_history.workspace_id
        AND (w.user_id = auth.uid() OR w.is_group = true)
    )
  );

-- ---------------------------------------------------------------------------
-- learning_world_models: subjects upsert own latest model
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Subjects write own learning world models" ON public.learning_world_models;
CREATE POLICY "Subjects write own learning world models"
  ON public.learning_world_models
  FOR ALL
  USING (
    subject_user_id = auth.uid()
    AND subject_guest_user_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.id = learning_world_models.workspace_id
        AND (w.user_id = auth.uid() OR w.is_group = true)
    )
  )
  WITH CHECK (
    subject_user_id = auth.uid()
    AND subject_guest_user_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.id = learning_world_models.workspace_id
        AND (w.user_id = auth.uid() OR w.is_group = true)
    )
  );

-- ---------------------------------------------------------------------------
-- knowledge_config_snapshots: subjects INSERT own trajectory points
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Subjects write own knowledge config snapshots" ON public.knowledge_config_snapshots;
CREATE POLICY "Subjects write own knowledge config snapshots"
  ON public.knowledge_config_snapshots
  FOR INSERT
  WITH CHECK (
    subject_user_id = auth.uid()
    AND subject_guest_user_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.id = knowledge_config_snapshots.workspace_id
        AND (w.user_id = auth.uid() OR w.is_group = true)
    )
  );
