-- Customer BYOK for org LLM chat and document storage.
-- Platform-provisioned xAI Management keys stay on xai_api_key_*; these columns
-- are the org-admin Organization-tab backends (sealed customer secrets).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS llm_backend text NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS llm_provider text,
  ADD COLUMN IF NOT EXISTS llm_base_url text,
  ADD COLUMN IF NOT EXISTS llm_api_key_ciphertext text,
  ADD COLUMN IF NOT EXISTS llm_api_key_last_four text,
  ADD COLUMN IF NOT EXISTS llm_model text,
  ADD COLUMN IF NOT EXISTS blob_backend text NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS blob_provider text,
  ADD COLUMN IF NOT EXISTS blob_base_url text,
  ADD COLUMN IF NOT EXISTS blob_api_key_ciphertext text,
  ADD COLUMN IF NOT EXISTS blob_api_key_last_four text;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_llm_backend_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_llm_backend_check
  CHECK (llm_backend = ANY (ARRAY['platform'::text, 'custom'::text]));

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_blob_backend_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_blob_backend_check
  CHECK (blob_backend = ANY (ARRAY['platform'::text, 'custom'::text]));

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_llm_provider_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_llm_provider_check
  CHECK (llm_provider IS NULL OR llm_provider = ANY (ARRAY['xai'::text, 'openai-compatible'::text]));

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_blob_provider_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_blob_provider_check
  CHECK (blob_provider IS NULL OR blob_provider = ANY (ARRAY['xai'::text, 'openai-compatible'::text]));
