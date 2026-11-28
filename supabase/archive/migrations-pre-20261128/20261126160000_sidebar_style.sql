-- Prompt-built session sidebar style for an organization.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS sidebar_style jsonb;

COMMENT ON COLUMN public.organizations.sidebar_style IS
  'Prompt-built tokens and still for the 16rem session canvas sidebar.';
