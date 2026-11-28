-- Org-wide custom aesthetic stills. A non-empty set replaces public/aesthetics
-- for that organization's members. Empty keeps the system default pool.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS custom_aesthetic_urls text[] NOT NULL DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public)
VALUES ('org-aesthetics', 'org-aesthetics', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload org aesthetics" ON storage.objects;
CREATE POLICY "Authenticated users can upload org aesthetics" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-aesthetics');

DROP POLICY IF EXISTS "Authenticated users can update org aesthetics" ON storage.objects;
CREATE POLICY "Authenticated users can update org aesthetics" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'org-aesthetics');

DROP POLICY IF EXISTS "Anyone can view org aesthetics" ON storage.objects;
CREATE POLICY "Anyone can view org aesthetics" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'org-aesthetics');

DROP POLICY IF EXISTS "Authenticated users can delete org aesthetics" ON storage.objects;
CREATE POLICY "Authenticated users can delete org aesthetics" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'org-aesthetics');
