-- Immutable history of vertical eval runs for retroactive inspection.
-- Separate from learning_world_models (latest symbolic state) and brain_config_snapshots (geometry).

CREATE TABLE public.eval_run_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_guest_user_id uuid REFERENCES public.organization_guest_users(id) ON DELETE CASCADE,
  vertical text NOT NULL,
  score integer NOT NULL,
  ghc_score integer,
  ghc_confidence text,
  report jsonb NOT NULL,
  workspace_goal text,
  block_id uuid,
  source text NOT NULL DEFAULT 'score',
  ran_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eval_run_history_vertical_check CHECK (
    vertical = ANY (ARRAY['verification'::text, 'augmentation'::text, 'optimization'::text])
  ),
  CONSTRAINT eval_run_history_score_check CHECK (score >= 0 AND score <= 100),
  CONSTRAINT eval_run_history_one_subject CHECK (
    (subject_user_id IS NOT NULL AND subject_guest_user_id IS NULL)
    OR (subject_user_id IS NULL AND subject_guest_user_id IS NOT NULL)
    OR (subject_user_id IS NULL AND subject_guest_user_id IS NULL)
  )
);

CREATE INDEX eval_run_history_workspace_ran_idx
  ON public.eval_run_history (workspace_id, ran_at DESC);

CREATE INDEX eval_run_history_workspace_subject_ran_idx
  ON public.eval_run_history (workspace_id, subject_user_id, subject_guest_user_id, ran_at DESC);

CREATE INDEX eval_run_history_workspace_vertical_ran_idx
  ON public.eval_run_history (workspace_id, vertical, ran_at DESC);

CREATE INDEX eval_run_history_subject_user_ran_idx
  ON public.eval_run_history (subject_user_id, ran_at DESC)
  WHERE subject_user_id IS NOT NULL;

COMMENT ON TABLE public.eval_run_history IS
  'Append-only archive of vertical eval scorecards (verification/augmentation/optimization) per workspace × subject.';

ALTER TABLE public.eval_run_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners manage eval run history"
  ON public.eval_run_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = eval_run_history.workspace_id AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = eval_run_history.workspace_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Subjects read own eval run history"
  ON public.eval_run_history
  FOR SELECT
  USING (subject_user_id = auth.uid());
