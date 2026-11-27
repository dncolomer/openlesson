-- Protocols and knowledge regions belong to the organization they were
-- created in. profiles.organization_id is the author's active org.

ALTER TABLE public.verify_flows
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.knowledge_regions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS verify_flows_organization_id_idx
  ON public.verify_flows (organization_id);

CREATE INDEX IF NOT EXISTS knowledge_regions_organization_id_idx
  ON public.knowledge_regions (organization_id);

UPDATE public.verify_flows vf
SET organization_id = p.organization_id
FROM public.profiles p
WHERE vf.owner_user_id = p.id
  AND vf.organization_id IS NULL
  AND p.organization_id IS NOT NULL;

UPDATE public.knowledge_regions kr
SET organization_id = p.organization_id
FROM public.profiles p
WHERE kr.owner_user_id = p.id
  AND kr.organization_id IS NULL
  AND p.organization_id IS NOT NULL;

COMMENT ON COLUMN public.verify_flows.organization_id IS
  'Organization the protocol was authored in. Dashboard lists by this, not owner_user_id.';
COMMENT ON COLUMN public.knowledge_regions.organization_id IS
  'Organization the knowledge region was authored in. Dashboard lists by this, not owner_user_id.';
