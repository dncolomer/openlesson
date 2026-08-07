-- First-class multi-goals: workspace-scoped + block-scoped natural-language goals.
-- Snapshots store the evaluated goal set (ids + text at run time) on eval_run_history.

CREATE TABLE IF NOT EXISTS public.workspace_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_goals_text_nonempty CHECK (char_length(btrim(text)) > 0)
);

CREATE INDEX IF NOT EXISTS workspace_goals_workspace_sort_idx
  ON public.workspace_goals (workspace_id, sort_order ASC, created_at ASC);

COMMENT ON TABLE public.workspace_goals IS
  'Owner-managed natural-language goals for a workspace (Goals tab). Multiple per workspace.';

CREATE TABLE IF NOT EXISTS public.block_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT block_goals_text_nonempty CHECK (char_length(btrim(text)) > 0)
);

CREATE INDEX IF NOT EXISTS block_goals_workspace_sort_idx
  ON public.block_goals (workspace_id, sort_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS block_goals_block_sort_idx
  ON public.block_goals (block_id, sort_order ASC, created_at ASC);

COMMENT ON TABLE public.block_goals IS
  'Owner-managed natural-language goals for a block (block-detail Goals drawer). Multiple per block.';

-- Durable snapshot ↔ goals linkage (evaluated set frozen at run time).
ALTER TABLE public.eval_run_history
  ADD COLUMN IF NOT EXISTS evaluated_goals jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.eval_run_history
  ADD COLUMN IF NOT EXISTS goals_fingerprint text;

COMMENT ON COLUMN public.eval_run_history.evaluated_goals IS
  'Goals this snapshot was scored against: [{id, text, scope, block_id?}]. Frozen at ran_at.';

COMMENT ON COLUMN public.eval_run_history.goals_fingerprint IS
  'Stable fingerprint of evaluated_goals for re-run gate (same PoW+goals uniqueness).';

CREATE INDEX IF NOT EXISTS eval_run_history_workspace_goals_fp_ran_idx
  ON public.eval_run_history (workspace_id, goals_fingerprint, ran_at DESC)
  WHERE goals_fingerprint IS NOT NULL;

ALTER TABLE public.workspace_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners manage workspace goals"
  ON public.workspace_goals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_goals.workspace_id AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_goals.workspace_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owners manage block goals"
  ON public.block_goals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = block_goals.workspace_id AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = block_goals.workspace_id AND w.user_id = auth.uid()
    )
  );

-- Authenticated readers who can see the workspace can list goals (scoring subjects).
CREATE POLICY "Authenticated users read workspace goals"
  ON public.workspace_goals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_goals.workspace_id
        AND (w.user_id = auth.uid() OR w.is_public = true)
    )
  );

CREATE POLICY "Authenticated users read block goals"
  ON public.block_goals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = block_goals.workspace_id
        AND (w.user_id = auth.uid() OR w.is_public = true)
    )
  );
