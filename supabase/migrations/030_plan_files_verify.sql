-- ============================================
-- Verify plan_files (xAI Files API) DB state
-- Read-only checks. Safe to run anytime.
-- ============================================

-- 1. Table schema check
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'plan_files'
ORDER BY ordinal_position;

-- 2. RLS status + policies on plan_files
SELECT
  'plan_files RLS enabled' AS check,
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'plan_files')::text AS value;

SELECT
  policyname,
  cmd AS operation,
  roles
FROM pg_policies
WHERE tablename = 'plan_files'
ORDER BY policyname;

-- 3. xai_file_id column must exist (added in migration 028)
SELECT
  'xai_file_id column exists' AS check,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plan_files' AND column_name = 'xai_file_id'
  )::text AS value
UNION ALL
SELECT
  'storage_path column nullable',
  (
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'plan_files' AND column_name = 'storage_path'
  );

-- 4. plan-files Supabase storage bucket should NOT have RLS policies anymore
-- (we moved file blobs to xAI; the bucket can be deleted manually if you want)
SELECT
  'plan-files bucket exists (can be deleted manually)' AS check,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'plan-files')::text AS value
UNION ALL
SELECT
  'plan-files storage policies still attached',
  (
    SELECT COUNT(*)::text FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%plan-files%' OR with_check LIKE '%plan-files%')
  );

-- 5. Recent plans + file counts (last 24h)
SELECT
  lp.id AS plan_id,
  lp.title,
  lp.created_at,
  COUNT(pf.id) AS file_count,
  COUNT(pf.xai_file_id) AS files_with_xai_id,
  COUNT(pf.storage_path) AS files_with_legacy_storage_path
FROM learning_plans lp
LEFT JOIN plan_files pf ON pf.plan_id = lp.id
WHERE lp.created_at > NOW() - INTERVAL '24 hours'
GROUP BY lp.id, lp.title, lp.created_at
ORDER BY lp.created_at DESC
LIMIT 10;

-- 6. Per-file inspection (most recent 10)
SELECT
  pf.id,
  pf.plan_id,
  pf.file_name,
  pf.mime_type,
  pf.file_size,
  pf.xai_file_id,
  pf.storage_path,
  pf.created_at
FROM plan_files pf
ORDER BY pf.created_at DESC
LIMIT 10;
