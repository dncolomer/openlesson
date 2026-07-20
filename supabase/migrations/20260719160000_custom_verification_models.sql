-- Workspace-scoped custom verification models (high-validation regions in brain config space).

CREATE TABLE public.custom_verification_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  embedding_model_id text NOT NULL DEFAULT 'braincfg-v1-d64',
  dim integer NOT NULL DEFAULT 64,
  centroid jsonb NOT NULL,
  cohort_cohesion double precision NOT NULL DEFAULT 0,
  mean_radius double precision NOT NULL DEFAULT 0,
  cosine_threshold double precision NOT NULL DEFAULT 0.5,
  subject_count integer NOT NULL DEFAULT 0,
  subjects jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_verification_models_dim_check CHECK (dim > 0 AND dim <= 1024),
  CONSTRAINT custom_verification_models_name_len CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 120),
  CONSTRAINT custom_verification_models_threshold_check CHECK (
    cosine_threshold >= -1 AND cosine_threshold <= 1
  ),
  CONSTRAINT custom_verification_models_subject_count_check CHECK (subject_count >= 1)
);

CREATE INDEX custom_verification_models_workspace_idx
  ON public.custom_verification_models (workspace_id, created_at DESC);

CREATE UNIQUE INDEX custom_verification_models_workspace_name_uidx
  ON public.custom_verification_models (workspace_id, lower(trim(name)));

COMMENT ON TABLE public.custom_verification_models IS
  'Custom verification models: high-validation brain-config regions distilled from a cohort of workspace subjects.';

ALTER TABLE public.custom_verification_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners manage custom verification models"
  ON public.custom_verification_models
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = custom_verification_models.workspace_id AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = custom_verification_models.workspace_id AND w.user_id = auth.uid()
    )
  );
