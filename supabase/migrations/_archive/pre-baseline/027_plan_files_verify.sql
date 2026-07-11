-- ============================================
-- Diagnostic / Idempotent re-apply for plan_files
-- Run this if files aren't showing up after upload to verify RLS policies
-- ============================================

-- 1. Verify table exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_files') THEN
    RAISE EXCEPTION 'plan_files table missing - run 027_plan_files.sql first';
  END IF;
END $$;

-- 2. Verify bucket exists, create if missing
INSERT INTO storage.buckets (id, name, public)
VALUES ('plan-files', 'plan-files', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Re-apply storage policies idempotently
DROP POLICY IF EXISTS "Users can upload own plan files" ON storage.objects;
CREATE POLICY "Users can upload own plan files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'plan-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read own plan files" ON storage.objects;
CREATE POLICY "Users can read own plan files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'plan-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own plan files" ON storage.objects;
CREATE POLICY "Users can delete own plan files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'plan-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Re-apply table policies idempotently
ALTER TABLE plan_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own plan files" ON plan_files;
CREATE POLICY "Users can read own plan files" ON plan_files
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can read public plan files" ON plan_files;
CREATE POLICY "Anyone can read public plan files" ON plan_files
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM learning_plans lp
      WHERE lp.id = plan_files.plan_id AND lp.is_public = true
    )
  );

DROP POLICY IF EXISTS "Users can insert own plan files" ON plan_files;
CREATE POLICY "Users can insert own plan files" ON plan_files
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own plan files" ON plan_files;
CREATE POLICY "Users can delete own plan files" ON plan_files
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 5. Verify output
SELECT 
  'plan_files table' as check, 
  COUNT(*)::text as value 
FROM plan_files
UNION ALL
SELECT 
  'plan-files bucket', 
  COUNT(*)::text 
FROM storage.buckets WHERE id = 'plan-files'
UNION ALL
SELECT 
  'storage.objects policies for plan-files', 
  COUNT(*)::text 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects' 
  AND qual LIKE '%plan-files%' OR with_check LIKE '%plan-files%';
