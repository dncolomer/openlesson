-- Learning world model (durable) + brain config trajectory snapshots.
-- Brain config vectors live in a fixed global space (braincfg-v1-d64); model id is versioned.
-- NOTE: Product rename (knowledge configuration) is applied in a later forward migration.

CREATE TABLE public.learning_world_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_guest_user_id uuid REFERENCES public.organization_guest_users(id) ON DELETE CASCADE,
  model jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_world_models_one_subject CHECK (
    (subject_user_id IS NOT NULL AND subject_guest_user_id IS NULL)
    OR (subject_user_id IS NULL AND subject_guest_user_id IS NOT NULL)
    OR (subject_user_id IS NULL AND subject_guest_user_id IS NULL)
  )
);

-- Unique live model per (workspace, subject). NULLS NOT DISTINCT so one aggregate row allowed.
CREATE UNIQUE INDEX learning_world_models_workspace_subject_uidx
  ON public.learning_world_models (
    workspace_id,
    subject_user_id,
    subject_guest_user_id
  ) NULLS NOT DISTINCT;

CREATE INDEX learning_world_models_workspace_idx
  ON public.learning_world_models (workspace_id, updated_at DESC);

COMMENT ON TABLE public.learning_world_models IS
  'Durable learning world model (symbolic learner state) per workspace × subject.';

CREATE TABLE public.brain_config_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_guest_user_id uuid REFERENCES public.organization_guest_users(id) ON DELETE CASCADE,
  embedding_model_id text NOT NULL DEFAULT 'braincfg-v1-d64',
  dim integer NOT NULL DEFAULT 64,
  vector jsonb NOT NULL,
  as_of_ms bigint NOT NULL,
  pow_event_count integer NOT NULL DEFAULT 0,
  confidence double precision NOT NULL DEFAULT 0,
  trigger text NOT NULL DEFAULT 'score',
  lwm_id uuid REFERENCES public.learning_world_models(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brain_config_snapshots_dim_check CHECK (dim > 0 AND dim <= 1024),
  CONSTRAINT brain_config_snapshots_confidence_check CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT brain_config_snapshots_trigger_check CHECK (
    trigger = ANY (ARRAY['pow_upload'::text, 'score'::text, 'recompute'::text, 'scheduled'::text])
  ),
  CONSTRAINT brain_config_snapshots_one_subject CHECK (
    (subject_user_id IS NOT NULL AND subject_guest_user_id IS NULL)
    OR (subject_user_id IS NULL AND subject_guest_user_id IS NOT NULL)
    OR (subject_user_id IS NULL AND subject_guest_user_id IS NULL)
  )
);

CREATE INDEX brain_config_snapshots_trajectory_idx
  ON public.brain_config_snapshots (workspace_id, subject_user_id, subject_guest_user_id, as_of_ms DESC);

CREATE INDEX brain_config_snapshots_model_idx
  ON public.brain_config_snapshots (embedding_model_id, as_of_ms DESC);

COMMENT ON TABLE public.brain_config_snapshots IS
  'Time series of brain configuration embeddings (fixed dim per embedding_model_id).';

ALTER TABLE public.learning_world_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_config_snapshots ENABLE ROW LEVEL SECURITY;

-- Workspace owners can read/write their models and snapshots.
CREATE POLICY "Workspace owners manage learning world models"
  ON public.learning_world_models
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = learning_world_models.workspace_id AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = learning_world_models.workspace_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owners manage brain config snapshots"
  ON public.brain_config_snapshots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = brain_config_snapshots.workspace_id AND w.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = brain_config_snapshots.workspace_id AND w.user_id = auth.uid()
    )
  );

-- Subjects can read their own rows.
CREATE POLICY "Subjects read own learning world models"
  ON public.learning_world_models
  FOR SELECT
  USING (subject_user_id = auth.uid());

CREATE POLICY "Subjects read own brain config snapshots"
  ON public.brain_config_snapshots
  FOR SELECT
  USING (subject_user_id = auth.uid());
