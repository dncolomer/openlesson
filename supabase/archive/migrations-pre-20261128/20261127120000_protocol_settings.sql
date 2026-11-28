-- Named protocol canvas settings per organization. A protocol may point at
-- one setting, or leave protocol_setting_id null to use the org default.

CREATE TABLE IF NOT EXISTS public.protocol_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS protocol_settings_org_name_uidx
  ON public.protocol_settings (organization_id, lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS protocol_settings_org_default_uidx
  ON public.protocol_settings (organization_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS protocol_settings_org_idx
  ON public.protocol_settings (organization_id, created_at DESC);

COMMENT ON TABLE public.protocol_settings IS
  'Named session rail and work-canvas styles. Protocols pick one or use the org default.';

ALTER TABLE public.protocol_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read protocol settings" ON public.protocol_settings;
CREATE POLICY "Org members can read protocol settings"
  ON public.protocol_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members m
      WHERE m.organization_id = protocol_settings.organization_id
        AND m.user_id = auth.uid()
    )
  );

INSERT INTO public.protocol_settings (organization_id, name, style, is_default, created_at, updated_at)
SELECT
  o.id,
  'Default',
  COALESCE(o.sidebar_style, '{}'::jsonb),
  true,
  now(),
  now()
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.protocol_settings ps
  WHERE ps.organization_id = o.id
);

ALTER TABLE public.verify_flows
  ADD COLUMN IF NOT EXISTS protocol_setting_id uuid REFERENCES public.protocol_settings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS verify_flows_protocol_setting_id_idx
  ON public.verify_flows (protocol_setting_id);

COMMENT ON COLUMN public.verify_flows.protocol_setting_id IS
  'Named protocol setting for this protocol. Null uses the organization default.';
