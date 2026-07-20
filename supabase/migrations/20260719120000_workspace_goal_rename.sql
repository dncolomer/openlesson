-- Migrate conversion_goal → workspace_goal (inferred workspace goal).
-- Idempotent: staging/prod may already have workspace_goal from a prior manual rename.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workspaces'
      AND column_name = 'conversion_goal'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workspaces'
      AND column_name = 'workspace_goal'
  ) THEN
    ALTER TABLE public.workspaces
      RENAME COLUMN conversion_goal TO workspace_goal;
  END IF;
END $$;

COMMENT ON COLUMN public.workspaces.workspace_goal IS
  'Inferred (or owner-set) workspace goal defining success for this workspace. Used by verification, augmentation, and optimization scores.';
