-- Org-admin OpenRouter key for AI-use knowledge-region simulation.
-- Dedicated to simulation (never getChat() / platform LLM backends).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS openrouter_api_key_ciphertext text,
  ADD COLUMN IF NOT EXISTS openrouter_api_key_last_four text;
