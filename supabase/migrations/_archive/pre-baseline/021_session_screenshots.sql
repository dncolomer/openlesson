-- Session Screenshots table for the Pop-out Monitor feature
-- Stores metadata for screen captures taken during sessions

CREATE TABLE session_screenshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp_ms BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_session_screenshots_session_id ON session_screenshots(session_id);
CREATE INDEX idx_session_screenshots_user_id ON session_screenshots(user_id);
CREATE INDEX idx_session_screenshots_timestamp ON session_screenshots(timestamp_ms);

-- RLS Policies
ALTER TABLE session_screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own screenshots" ON session_screenshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own screenshots" ON session_screenshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own screenshots" ON session_screenshots
  FOR DELETE USING (auth.uid() = user_id);

-- Comment for documentation
COMMENT ON TABLE session_screenshots IS 'Stores metadata for screen captures taken during sessions via the pop-out monitor window';
COMMENT ON COLUMN session_screenshots.timestamp_ms IS 'Timestamp in milliseconds when the screenshot was captured';
COMMENT ON COLUMN session_screenshots.storage_path IS 'Path to the screenshot file in session-screens storage bucket';

-- Note: You also need to create the storage bucket 'session-screens' in Supabase dashboard
-- with the following RLS policy:
-- 
-- Storage bucket: session-screens
-- Public: No
-- 
-- Policy for authenticated users to manage their own files:
-- ((bucket_id = 'session-screens'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))
