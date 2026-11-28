-- TAPBench public benchmark: Task-scoped keys and 64D region-score runs.

CREATE TABLE public.tapbench_task_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz
);

CREATE UNIQUE INDEX tapbench_task_keys_key_hash_key
  ON public.tapbench_task_keys (key_hash);

CREATE INDEX tapbench_task_keys_workspace_idx
  ON public.tapbench_task_keys (workspace_id, created_at DESC);

COMMENT ON TABLE public.tapbench_task_keys IS
  'Task-scoped TAPBench keys. Each key may only be used for PoW wrap on the workspace it was issued for.';

ALTER TABLE public.tapbench_task_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tapbench_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key_id uuid REFERENCES public.tapbench_task_keys(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tooling jsonb NOT NULL DEFAULT '{}'::jsonb,
  proof_of_work_id uuid,
  embedding_model_id text NOT NULL DEFAULT 'knowledgecfg-v1-d64',
  dim integer NOT NULL DEFAULT 64,
  in_region boolean NOT NULL,
  distance_to_center double precision NOT NULL,
  distance_to_closest_border double precision,
  cosine_similarity double precision,
  region_cosine_threshold double precision,
  target_as_of_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tapbench_runs_dim_check CHECK (dim = 64)
);

CREATE INDEX tapbench_runs_workspace_idx
  ON public.tapbench_runs (workspace_id, created_at DESC);

CREATE INDEX tapbench_runs_key_idx
  ON public.tapbench_runs (key_id, created_at DESC);

COMMENT ON TABLE public.tapbench_runs IS
  'TAPBench wrap runs: tooling description plus 64D in-region / border / center-distance scores against the tapbench@ latest embedding.';

ALTER TABLE public.tapbench_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read TAPBench runs"
  ON public.tapbench_runs
  FOR SELECT
  USING (true);
