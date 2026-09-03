-- Global published map-type library (community marketplace).
-- Official extras live in lib/map-type-library.ts; this table is user-published types.

CREATE TABLE IF NOT EXISTS public.map_type_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'community',
  strength text NOT NULL DEFAULT 'custom',
  play_rule text NOT NULL DEFAULT '',
  literature text NOT NULL DEFAULT '',
  use_when text NOT NULL DEFAULT '',
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_username text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_map_type_library_category
  ON public.map_type_library (category, created_at DESC);

ALTER TABLE public.map_type_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published map types" ON public.map_type_library;
CREATE POLICY "Anyone can read published map types"
  ON public.map_type_library FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can publish map types" ON public.map_type_library;
CREATE POLICY "Authenticated users can publish map types"
  ON public.map_type_library FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_user_id);

DROP POLICY IF EXISTS "Authors can update own map types" ON public.map_type_library;
CREATE POLICY "Authors can update own map types"
  ON public.map_type_library FOR UPDATE TO authenticated
  USING (auth.uid() = author_user_id)
  WITH CHECK (auth.uid() = author_user_id);

DROP POLICY IF EXISTS "Authors can delete own map types" ON public.map_type_library;
CREATE POLICY "Authors can delete own map types"
  ON public.map_type_library FOR DELETE TO authenticated
  USING (auth.uid() = author_user_id);

COMMENT ON TABLE public.map_type_library IS
  'Community-published chapter map types. Official extras are code-seeded in lib/map-type-library.ts.';
