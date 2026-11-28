-- Durable curated Simulation collection per workspace (questions + exercises).
-- Authors generate probes from block / multi-block / workspace simulation runs,
-- then edit/delete before using them as Suggest from Simulation context.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS simulation_collection jsonb DEFAULT '{"items":[]}'::jsonb;

COMMENT ON COLUMN public.workspaces.simulation_collection IS
  'Curated Simulation tab items: { items: [{ id, kind, text, coach_cue?, origin, modifier_prompt?, removed?, created_at, updated_at }], updated_at }. Used by Suggest from Simulation on generative map surfaces.';
