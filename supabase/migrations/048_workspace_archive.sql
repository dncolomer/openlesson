-- Workspace archive support: hide test/demo workspaces without deleting data.

ALTER TABLE learning_plans
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_learning_plans_status_active
ON learning_plans (user_id, created_at DESC)
WHERE status IS DISTINCT FROM 'archived';

COMMENT ON COLUMN learning_plans.archived_at IS 'When the workspace was archived; status should be archived.';