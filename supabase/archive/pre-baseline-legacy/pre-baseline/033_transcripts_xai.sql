-- ============================================
-- Migrate session_transcript chunks from Supabase Storage to xAI Files API
--
-- New flow:
--   Audio chunks stay in Supabase (session-audio bucket)
--   Transcript chunks → xAI Files (no more session-transcript bucket)
--
-- We're not live yet so we DO NOT preserve existing data.
-- ============================================

-- 1. Wipe any existing chunk rows (legacy storage_path references)
DELETE FROM session_transcript;

-- 2. Schema: add xai_file_id, drop storage_path
ALTER TABLE session_transcript ADD COLUMN IF NOT EXISTS xai_file_id TEXT;
ALTER TABLE session_transcript DROP COLUMN IF EXISTS storage_path;

-- Require xai_file_id on new inserts
ALTER TABLE session_transcript ALTER COLUMN xai_file_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_transcript_xai_file_id
  ON session_transcript(xai_file_id);

-- 3. Drop any lingering session-transcript bucket RLS policies
DROP POLICY IF EXISTS "Users can upload own session transcripts" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own session transcripts"   ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own session transcripts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload session transcripts"     ON storage.objects;
DROP POLICY IF EXISTS "Users can read session transcripts"       ON storage.objects;
DROP POLICY IF EXISTS "Users can delete session transcripts"     ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload transcripts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read transcripts"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete transcripts" ON storage.objects;

-- NOTE: The `session-transcript` Supabase Storage bucket itself must be
-- deleted manually via the dashboard (Storage → session-transcript → ⋮ →
-- Delete). Supabase blocks DELETE from storage.buckets via SQL.

-- 4. Verify
SELECT
  'session_transcript rows'            AS check,
  COUNT(*)::text                       AS value
FROM session_transcript
UNION ALL
SELECT
  'xai_file_id column exists',
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_transcript' AND column_name = 'xai_file_id'
  )::text
UNION ALL
SELECT
  'xai_file_id NOT NULL',
  (SELECT (is_nullable = 'NO')::text FROM information_schema.columns
    WHERE table_name = 'session_transcript' AND column_name = 'xai_file_id')
UNION ALL
SELECT
  'storage_path column dropped',
  (NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_transcript' AND column_name = 'storage_path'
  ))::text
UNION ALL
SELECT
  'session-transcript storage policies remaining (should be 0)',
  (SELECT COUNT(*)::text FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%session-transcript%' OR with_check LIKE '%session-transcript%'));
