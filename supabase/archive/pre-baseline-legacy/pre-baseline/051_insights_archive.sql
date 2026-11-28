ALTER TABLE insights
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS insights_active_user_idx
ON insights (user_id, created_at DESC)
WHERE archived_at IS NULL;

DROP POLICY IF EXISTS insights_public_read ON insights;

CREATE POLICY insights_public_read ON insights
  FOR SELECT
  USING (is_public = true AND archived_at IS NULL);

COMMENT ON COLUMN insights.archived_at IS 'When set, the insight is hidden and share links stop working.';