-- WorkOS User Management / SSO: stable WorkOS user id on profiles and
-- org-scoped IdP connection on organizations.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS workos_user_id text;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS workos_organization_id text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_workos_user_id_uidx
  ON public.profiles (workos_user_id)
  WHERE workos_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_workos_organization_id_uidx
  ON public.organizations (workos_organization_id)
  WHERE workos_organization_id IS NOT NULL;
