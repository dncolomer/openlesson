-- Drop retired LWM Snapshot / knowledgecfg-v1-d64 tables.
-- Live embeddings live in workspace_flow_embeddings (flowcfg-v1-d96).
-- Overlay regions stay in custom_verification_models.

DROP TABLE IF EXISTS public.eval_run_snapshot_shares CASCADE;
DROP TABLE IF EXISTS public.eval_run_history CASCADE;
DROP TABLE IF EXISTS public.knowledge_config_snapshots CASCADE;
DROP TABLE IF EXISTS public.learning_world_models CASCADE;
DROP TABLE IF EXISTS public.brain_config_snapshots CASCADE;
