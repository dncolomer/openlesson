-- Diagnostic: inspect plan_files table schema and recent rows
-- Run this in Supabase SQL editor to verify the table structure

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'plan_files'
ORDER BY ordinal_position;

-- Check recent plans (and whether any have files)
SELECT
  lp.id as plan_id,
  lp.title,
  lp.created_at,
  COUNT(pf.id) as file_count
FROM learning_plans lp
LEFT JOIN plan_files pf ON pf.plan_id = lp.id
WHERE lp.created_at > NOW() - INTERVAL '24 hours'
GROUP BY lp.id, lp.title, lp.created_at
ORDER BY lp.created_at DESC
LIMIT 10;

-- Check if there are any orphaned objects in the plan-files bucket
SELECT
  name,
  bucket_id,
  owner,
  created_at,
  metadata
FROM storage.objects
WHERE bucket_id = 'plan-files'
ORDER BY created_at DESC
LIMIT 10;
