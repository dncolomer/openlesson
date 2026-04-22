-- ============================================
-- Migrate plan_files from Supabase Storage to xAI Files API
-- xAI now hosts file blobs and provides native PDF/doc text extraction.
-- We only keep metadata + the xai_file_id reference in our DB.
-- ============================================

-- Add xai_file_id column
ALTER TABLE plan_files ADD COLUMN IF NOT EXISTS xai_file_id TEXT;

-- Make storage_path nullable (transitional) and remove not-null constraint
ALTER TABLE plan_files ALTER COLUMN storage_path DROP NOT NULL;

-- Index on xai_file_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_plan_files_xai_file_id ON plan_files(xai_file_id);

-- Optional cleanup: drop the storage bucket and its policies.
-- We keep storage_path column nullable for backward compat / migration of any
-- legacy rows. New uploads will only set xai_file_id.

-- Remove storage policies for the plan-files bucket
DROP POLICY IF EXISTS "Users can upload own plan files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own plan files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own plan files" ON storage.objects;

-- Empty and remove the bucket itself (uncomment if you want a hard cleanup;
-- safer to leave the bucket in place in case there are legacy rows you want
-- to migrate):
-- DELETE FROM storage.objects WHERE bucket_id = 'plan-files';
-- DELETE FROM storage.buckets WHERE id = 'plan-files';
