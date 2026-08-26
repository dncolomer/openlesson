-- Stamp every proof-of-work row with the current model version.
-- Existing rows inherit the default; unknown versions are rejected by CHECK.

ALTER TABLE public.workspace_proof_of_work
  ADD COLUMN IF NOT EXISTS pow_model_version text NOT NULL DEFAULT 'pow-model-v1';

ALTER TABLE public.workspace_proof_of_work
  DROP CONSTRAINT IF EXISTS workspace_proof_of_work_pow_model_version_check;

ALTER TABLE public.workspace_proof_of_work
  ADD CONSTRAINT workspace_proof_of_work_pow_model_version_check
  CHECK (pow_model_version = 'pow-model-v1');

COMMENT ON COLUMN public.workspace_proof_of_work.pow_model_version IS
  'Persisted Proof-of-Work model id. Current value is pow-model-v1 (types tool|screen|video|eeg).';
