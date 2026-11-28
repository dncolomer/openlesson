-- ============================================
-- Plan Files: attachments for learning plans
-- ============================================

-- Table to track files attached to learning plans
CREATE TABLE IF NOT EXISTS plan_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES learning_plans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_files_plan_id ON plan_files(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_files_user_id ON plan_files(user_id);

ALTER TABLE plan_files ENABLE ROW LEVEL SECURITY;

-- Owner can read their own files; public plan files are readable by anyone
CREATE POLICY "Users can read own plan files" ON plan_files
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Anyone can read public plan files" ON plan_files
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM learning_plans lp
      WHERE lp.id = plan_files.plan_id AND lp.is_public = true
    )
  );

CREATE POLICY "Users can insert own plan files" ON plan_files
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own plan files" ON plan_files
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Private storage bucket for plan file attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('plan-files', 'plan-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: owner can upload/read/delete files under their own userId prefix
CREATE POLICY "Users can upload own plan files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'plan-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own plan files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'plan-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own plan files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'plan-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
