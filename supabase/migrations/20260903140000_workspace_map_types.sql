-- Workspace-scoped chapter-map types for Creator Map Types tab.
-- JSON object: { disabledBuiltinIds: string[], customTypes: [{ id, label, description, cells, dagHintIds, layoutInstruction, band, enabled }] }.
-- Built-in catalog ids stay frozen in lib/initial-chapters.ts; this column stores enable/disable + customs.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS workspace_map_types jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.workspaces.workspace_map_types IS
  'Chapter map types for Creator Map Types tab: { "disabledBuiltinIds": [], "customTypes": [{ "id", "label", "description", "cells", "dagHintIds", "layoutInstruction", "band", "enabled" }] }.';
