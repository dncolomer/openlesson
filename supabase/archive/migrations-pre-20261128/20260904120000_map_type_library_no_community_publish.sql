-- Official map types live in code. Remove published custom maps and
-- stop authenticated inserts into the global library table.

DELETE FROM public.map_type_library;

DROP POLICY IF EXISTS "Authenticated users can publish map types" ON public.map_type_library;

COMMENT ON TABLE public.map_type_library IS
  'Reserved. Official map types are code-seeded in lib/map-type-library.ts; custom types stay on the workspace.';
