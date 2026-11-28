-- Server-persisted Learning Map overlay (creator notes + drawing layers).
-- In-app Helios and Manual still use browser localStorage; public agents
-- read/write this column via list_map_tools / apply_map_tool.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS map_overlay jsonb;

COMMENT ON COLUMN public.workspaces.map_overlay IS
  'Helios / agent map overlay: { "notes": LearnerMapNote[], "annotationLayers": AnnotationLayer[] }.';
