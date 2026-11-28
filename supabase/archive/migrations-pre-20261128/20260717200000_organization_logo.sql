-- Organization logos for invite / branding surfaces.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Public bucket so invite pages (unauthenticated GET) can render logos.
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload org logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload org logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-logos');

DROP POLICY IF EXISTS "Authenticated users can update org logos" ON storage.objects;
CREATE POLICY "Authenticated users can update org logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'org-logos');

DROP POLICY IF EXISTS "Anyone can view org logos" ON storage.objects;
CREATE POLICY "Anyone can view org logos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'org-logos');

DROP POLICY IF EXISTS "Authenticated users can delete org logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete org logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'org-logos');
