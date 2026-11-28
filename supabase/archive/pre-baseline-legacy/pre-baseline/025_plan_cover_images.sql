-- Add cover_image_url to learning_plans
ALTER TABLE learning_plans ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Create plan-covers storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('plan-covers', 'plan-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload plan covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'plan-covers');

-- Allow authenticated users to update/overwrite their covers
CREATE POLICY "Users can update plan covers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'plan-covers');

-- Anyone can view plan covers (public bucket)
CREATE POLICY "Anyone can view plan covers" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'plan-covers');

-- Allow users to delete their own covers
CREATE POLICY "Users can delete plan covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'plan-covers');
