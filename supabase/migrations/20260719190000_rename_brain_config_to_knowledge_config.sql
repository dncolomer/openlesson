-- Rename product concept: brain configuration → knowledge configuration.
-- Table, policies, indexes, defaults, and embedding_model_id values for the v1 model.

-- Snapshot table
ALTER TABLE IF EXISTS public.brain_config_snapshots
  RENAME TO knowledge_config_snapshots;

-- Constraints (PostgreSQL renames table-owned constraints with the table in some versions;
-- rename explicitly for clarity / older PG).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brain_config_snapshots_dim_check'
  ) THEN
    ALTER TABLE public.knowledge_config_snapshots
      RENAME CONSTRAINT brain_config_snapshots_dim_check TO knowledge_config_snapshots_dim_check;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brain_config_snapshots_confidence_check'
  ) THEN
    ALTER TABLE public.knowledge_config_snapshots
      RENAME CONSTRAINT brain_config_snapshots_confidence_check TO knowledge_config_snapshots_confidence_check;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brain_config_snapshots_trigger_check'
  ) THEN
    ALTER TABLE public.knowledge_config_snapshots
      RENAME CONSTRAINT brain_config_snapshots_trigger_check TO knowledge_config_snapshots_trigger_check;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brain_config_snapshots_one_subject'
  ) THEN
    ALTER TABLE public.knowledge_config_snapshots
      RENAME CONSTRAINT brain_config_snapshots_one_subject TO knowledge_config_snapshots_one_subject;
  END IF;
END $$;

ALTER INDEX IF EXISTS brain_config_snapshots_trajectory_idx
  RENAME TO knowledge_config_snapshots_trajectory_idx;
ALTER INDEX IF EXISTS brain_config_snapshots_model_idx
  RENAME TO knowledge_config_snapshots_model_idx;

COMMENT ON TABLE public.knowledge_config_snapshots IS
  'Time series of knowledge configuration embeddings (fixed dim per embedding_model_id).';

-- Policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'knowledge_config_snapshots'
      AND policyname = 'Workspace owners manage brain config snapshots'
  ) THEN
    ALTER POLICY "Workspace owners manage brain config snapshots"
      ON public.knowledge_config_snapshots
      RENAME TO "Workspace owners manage knowledge config snapshots";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'knowledge_config_snapshots'
      AND policyname = 'Subjects read own brain config snapshots'
  ) THEN
    ALTER POLICY "Subjects read own brain config snapshots"
      ON public.knowledge_config_snapshots
      RENAME TO "Subjects read own knowledge config snapshots";
  END IF;
END $$;

-- Default embedding model id on snapshots + custom verification models
ALTER TABLE public.knowledge_config_snapshots
  ALTER COLUMN embedding_model_id SET DEFAULT 'knowledgecfg-v1-d64';

UPDATE public.knowledge_config_snapshots
  SET embedding_model_id = 'knowledgecfg-v1-d64'
  WHERE embedding_model_id = 'braincfg-v1-d64';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'custom_verification_models'
  ) THEN
    ALTER TABLE public.custom_verification_models
      ALTER COLUMN embedding_model_id SET DEFAULT 'knowledgecfg-v1-d64';
    UPDATE public.custom_verification_models
      SET embedding_model_id = 'knowledgecfg-v1-d64'
      WHERE embedding_model_id = 'braincfg-v1-d64';
  END IF;
END $$;

-- LWM JSON may store brain_config pointer key; rewrite to knowledge_config for new readers.
UPDATE public.learning_world_models
SET model = (model - 'brain_config') || jsonb_build_object('knowledge_config', model->'brain_config')
WHERE model ? 'brain_config' AND NOT (model ? 'knowledge_config');

COMMENT ON TABLE public.custom_verification_models IS
  'Custom verification models: high-validation knowledge-config regions distilled from a cohort of workspace subjects.';
