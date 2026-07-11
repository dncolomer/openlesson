-- ============================================
-- Migrate session artifacts (screen / facial / tool / eeg) to xAI Files.
-- Audio stays in Supabase Storage.
--
-- We are not preserving existing data. The cleanest approach is to drop the
-- per-chunk tables entirely and recreate them with the new schema.
-- session_audio is left untouched.
-- ============================================

-- ──────────────────────────────────────────────
-- Drop existing tables (data is disposable)
-- ──────────────────────────────────────────────
DROP TABLE IF EXISTS session_screenshots CASCADE;
DROP TABLE IF EXISTS session_eeg          CASCADE;
DROP TABLE IF EXISTS session_tool         CASCADE;
DROP TABLE IF EXISTS session_facial       CASCADE;

-- ──────────────────────────────────────────────
-- session_screenshots
-- ──────────────────────────────────────────────
CREATE TABLE session_screenshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp_ms BIGINT NOT NULL,
  xai_file_id  TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_session_screenshots_session_id  ON session_screenshots(session_id);
CREATE INDEX idx_session_screenshots_xai_file_id ON session_screenshots(xai_file_id);

ALTER TABLE session_screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own screenshots"   ON session_screenshots FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own screenshots" ON session_screenshots FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own screenshots" ON session_screenshots FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ──────────────────────────────────────────────
-- session_eeg
-- ──────────────────────────────────────────────
CREATE TABLE session_eeg (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp_ms BIGINT NOT NULL,
  chunk_index  INTEGER DEFAULT 0,
  xai_file_id  TEXT NOT NULL,
  device_name  TEXT,
  sample_count INTEGER,
  band_powers  JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_session_eeg_session_id  ON session_eeg(session_id);
CREATE INDEX idx_session_eeg_xai_file_id ON session_eeg(xai_file_id);

ALTER TABLE session_eeg ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own eeg"   ON session_eeg FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own eeg" ON session_eeg FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own eeg" ON session_eeg FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ──────────────────────────────────────────────
-- session_tool
-- ──────────────────────────────────────────────
CREATE TABLE session_tool (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp_ms BIGINT NOT NULL,
  xai_file_id  TEXT NOT NULL,
  tool_name    TEXT,
  tool_action  TEXT,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_session_tool_session_id  ON session_tool(session_id);
CREATE INDEX idx_session_tool_xai_file_id ON session_tool(xai_file_id);

ALTER TABLE session_tool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own tool events"   ON session_tool FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own tool events" ON session_tool FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own tool events" ON session_tool FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ──────────────────────────────────────────────
-- session_facial (new — wasn't a table before, only Storage)
-- ──────────────────────────────────────────────
CREATE TABLE session_facial (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp_ms BIGINT NOT NULL,
  chunk_index  INTEGER DEFAULT 0,
  xai_file_id  TEXT NOT NULL,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_session_facial_session_id  ON session_facial(session_id);
CREATE INDEX idx_session_facial_xai_file_id ON session_facial(xai_file_id);

ALTER TABLE session_facial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own facial data"   ON session_facial FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own facial data" ON session_facial FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own facial data" ON session_facial FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ──────────────────────────────────────────────
-- Drop ALL storage RLS policies for now-unused buckets.
-- The buckets themselves must be deleted via the Supabase dashboard.
-- ──────────────────────────────────────────────
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%session-screens%'    OR with_check LIKE '%session-screens%'
        OR qual LIKE '%session-facial%'     OR with_check LIKE '%session-facial%'
        OR qual LIKE '%session-tool%'       OR with_check LIKE '%session-tool%'
        OR qual LIKE '%session-eeg%'        OR with_check LIKE '%session-eeg%'
        OR qual LIKE '%session-transcript%' OR with_check LIKE '%session-transcript%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- ──────────────────────────────────────────────
-- Verify
-- ──────────────────────────────────────────────
SELECT 'session_screenshots exists with xai_file_id NOT NULL' AS check,
  COALESCE((SELECT (is_nullable = 'NO')::text FROM information_schema.columns
    WHERE table_name = 'session_screenshots' AND column_name = 'xai_file_id'), 'missing') AS value
UNION ALL
SELECT 'session_eeg exists with xai_file_id NOT NULL',
  COALESCE((SELECT (is_nullable = 'NO')::text FROM information_schema.columns
    WHERE table_name = 'session_eeg' AND column_name = 'xai_file_id'), 'missing')
UNION ALL
SELECT 'session_tool exists with xai_file_id NOT NULL',
  COALESCE((SELECT (is_nullable = 'NO')::text FROM information_schema.columns
    WHERE table_name = 'session_tool' AND column_name = 'xai_file_id'), 'missing')
UNION ALL
SELECT 'session_facial exists with xai_file_id NOT NULL',
  COALESCE((SELECT (is_nullable = 'NO')::text FROM information_schema.columns
    WHERE table_name = 'session_facial' AND column_name = 'xai_file_id'), 'missing')
UNION ALL
SELECT 'leftover session-* storage policies (should be 0)',
  (SELECT COUNT(*)::text FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%session-screens%'    OR with_check LIKE '%session-screens%'
        OR qual LIKE '%session-facial%'     OR with_check LIKE '%session-facial%'
        OR qual LIKE '%session-tool%'       OR with_check LIKE '%session-tool%'
        OR qual LIKE '%session-eeg%'        OR with_check LIKE '%session-eeg%'
        OR qual LIKE '%session-transcript%' OR with_check LIKE '%session-transcript%'));
