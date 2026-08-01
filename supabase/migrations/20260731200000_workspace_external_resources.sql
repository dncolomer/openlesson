-- First-class external sources for workspace Context (Dantes picks, add-link, create flow).
-- Not workspace_files (binaries); title/url/metadata only.

CREATE TABLE IF NOT EXISTS public.workspace_external_resources (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  url text NOT NULL,
  resource_type text,
  description text,
  source text NOT NULL DEFAULT 'link'
    CHECK (source = ANY (ARRAY['link'::text, 'dantes'::text, 'create'::text])),
  dantes_topic_slug text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_external_resources_workspace
  ON public.workspace_external_resources (workspace_id, sort_order, created_at);

COMMENT ON TABLE public.workspace_external_resources IS
  'External Context materials (links/Dantes). Listed above notes in Context UI; not binary files.';

ALTER TABLE public.workspace_external_resources ENABLE ROW LEVEL SECURITY;

-- Owners manage their workspace resources
CREATE POLICY "Users manage own workspace external resources"
  ON public.workspace_external_resources
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_external_resources.workspace_id
        AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_external_resources.workspace_id
        AND w.user_id = auth.uid()
    )
  );

-- Public workspace: anyone can read external resources
CREATE POLICY "Anyone can read public workspace external resources"
  ON public.workspace_external_resources
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_external_resources.workspace_id
        AND w.is_public = true
    )
  );
