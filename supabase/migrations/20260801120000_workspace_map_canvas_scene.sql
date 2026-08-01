-- Persistent Excalidraw scene for the workspace map right-pane canvas
-- (empty selection surface). JSON: { elements, appState, files }.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS map_canvas_scene jsonb;

COMMENT ON COLUMN public.workspaces.map_canvas_scene IS
  'Excalidraw scene for map right-pane infinite canvas: { "elements": [], "appState": {}, "files": {} }.';
