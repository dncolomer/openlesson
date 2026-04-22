-- ============================================
-- Cleanup: legacy plan_files rows from before xAI Files migration
--
-- Rows where xai_file_id IS NULL were uploaded against the old Supabase
-- Storage path. The current code expects xai_file_id and will reject these,
-- so they're effectively orphaned. This drops the DB rows.
--
-- Also deletes the now-unused `plan-files` Supabase Storage bucket policies
-- (file blobs live on xAI now). The bucket itself must be emptied + deleted
-- via the Supabase Storage UI (storage tables don't allow direct deletion).
-- ============================================

-- 1. Show what's about to be deleted (preview)
SELECT
  id,
  plan_id,
  file_name,
  storage_path,
  created_at
FROM plan_files
WHERE xai_file_id IS NULL
ORDER BY created_at DESC;

-- 2. Delete legacy rows
DELETE FROM plan_files
WHERE xai_file_id IS NULL;

-- 3. xai_file_id should now be required for all rows. Make it NOT NULL.
ALTER TABLE plan_files
  ALTER COLUMN xai_file_id SET NOT NULL;

-- 4. storage_path is no longer used; drop the column.
ALTER TABLE plan_files
  DROP COLUMN IF EXISTS storage_path;

-- 5. Drop any lingering plan-files storage bucket policies
DROP POLICY IF EXISTS "Users can upload own plan files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own plan files"   ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own plan files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update plan files"     ON storage.objects;

-- 6. Verify
SELECT
  'plan_files rows total'           AS check,
  COUNT(*)::text                    AS value
FROM plan_files
UNION ALL
SELECT
  'plan_files rows with null xai_file_id (should be 0)',
  COUNT(*)::text
FROM plan_files
WHERE xai_file_id IS NULL
UNION ALL
SELECT
  'storage_path column dropped',
  (NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plan_files' AND column_name = 'storage_path'
  ))::text
UNION ALL
SELECT
  'xai_file_id NOT NULL',
  (SELECT (is_nullable = 'NO')::text FROM information_schema.columns
    WHERE table_name = 'plan_files' AND column_name = 'xai_file_id')
UNION ALL
SELECT
  'plan-files storage policies remaining (should be 0)',
  (SELECT COUNT(*)::text FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%plan-files%' OR with_check LIKE '%plan-files%'));
