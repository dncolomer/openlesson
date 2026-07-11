-- ============================================
-- session_analysis: one row per analysis heartbeat call.
--
-- Each row points to an xAI file containing the full analysis output text
-- (plan update JSON + reasoning). Key numeric/categorical fields are denormalized
-- onto the row itself for fast querying.
-- ============================================

CREATE TABLE IF NOT EXISTS session_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp_ms BIGINT NOT NULL,
  xai_file_id  TEXT NOT NULL,
  gap_score    FLOAT,
  plan_changed BOOLEAN DEFAULT false,
  can_auto_advance BOOLEAN DEFAULT false,
  signals      TEXT[] DEFAULT '{}',
  reasoning    TEXT,
  source       TEXT,   -- e.g. "heartbeat", "v2_analyze", "advance_eval"
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_analysis_session_id  ON session_analysis(session_id);
CREATE INDEX IF NOT EXISTS idx_session_analysis_xai_file_id ON session_analysis(xai_file_id);
CREATE INDEX IF NOT EXISTS idx_session_analysis_timestamp   ON session_analysis(session_id, timestamp_ms DESC);

ALTER TABLE session_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own analysis"   ON session_analysis;
CREATE POLICY "Users can read own analysis"   ON session_analysis
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own analysis" ON session_analysis;
CREATE POLICY "Users can insert own analysis" ON session_analysis
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own analysis" ON session_analysis;
CREATE POLICY "Users can delete own analysis" ON session_analysis
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Verify
SELECT 'session_analysis table exists' AS check,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'session_analysis')::text AS value
UNION ALL
SELECT 'session_analysis.xai_file_id NOT NULL',
  (SELECT (is_nullable = 'NO')::text FROM information_schema.columns
    WHERE table_name = 'session_analysis' AND column_name = 'xai_file_id');
