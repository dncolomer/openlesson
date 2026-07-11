-- ============================================
-- Cleanup: RAG + YouTube features removed
-- Everything now flows through xAI (chat, files, STT, image-gen).
--
-- Safe to run multiple times (idempotent via IF EXISTS guards).
-- Destructive ops are at the end — comment them out if you want to keep
-- historical RAG / YouTube data.
-- ============================================

-- ──────────────────────────────────────────────
-- 1. Drop RAG / embedding RPCs (no longer called)
-- ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS match_transcript_rag_chunks(vector, uuid, uuid, integer);
DROP FUNCTION IF EXISTS match_transcript_rag_chunks(vector, uuid, uuid, integer, float);
DROP FUNCTION IF EXISTS match_transcript_chunks(vector, uuid, integer);
DROP FUNCTION IF EXISTS match_transcript_chunks(vector, uuid, integer, float);

-- ──────────────────────────────────────────────
-- 2. Drop RAG storage policies
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can upload own transcripts" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own transcripts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own transcripts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own transcripts" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own transcripts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own transcripts" ON storage.objects;

-- ──────────────────────────────────────────────
-- 3. Drop RAG tables (DESTRUCTIVE)
-- Comment these out if you want to keep historical chunks/transcripts.
-- ──────────────────────────────────────────────
DROP TABLE IF EXISTS transcript_rag_chunks CASCADE;
DROP TABLE IF EXISTS transcript_chunks CASCADE;
DROP TABLE IF EXISTS user_transcripts CASCADE;

-- ──────────────────────────────────────────────
-- 4. user-transcripts storage bucket
-- Supabase locks direct deletion from storage.objects / storage.buckets to
-- prevent orphaned rows. Delete the bucket manually via the Supabase
-- dashboard:
--   Storage → plan-files column → select "user-transcripts" → ⋮ → Delete
-- (Empty the bucket first if it contains objects.)
-- ──────────────────────────────────────────────

-- ──────────────────────────────────────────────
-- 5. YouTube source columns on learning_plans
-- These columns still exist but are no longer written to. Keep them for
-- now so old plans still render correctly (source_url, source_summary).
-- Uncomment the block below to drop them entirely:
-- ──────────────────────────────────────────────
-- ALTER TABLE learning_plans DROP COLUMN IF EXISTS source_type;
-- ALTER TABLE learning_plans DROP COLUMN IF EXISTS source_url;
-- ALTER TABLE learning_plans DROP COLUMN IF EXISTS source_summary;

-- ──────────────────────────────────────────────
-- 6. Verification
-- ──────────────────────────────────────────────
SELECT
  'transcript_rag_chunks'  AS check,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transcript_rag_chunks')::text AS still_exists
UNION ALL
SELECT 'transcript_chunks',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transcript_chunks')::text
UNION ALL
SELECT 'user_transcripts',
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_transcripts')::text
UNION ALL
SELECT 'user-transcripts bucket (delete manually in Supabase Storage UI)',
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'user-transcripts')::text;
