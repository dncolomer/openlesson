-- Users may belong to multiple organizations. profiles.organization_id is the
-- active org; organization_members is the membership set.

CREATE TABLE IF NOT EXISTS public.organization_members (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_org_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS organization_members_organization_id_idx
  ON public.organization_members (organization_id);

INSERT INTO public.organization_members (user_id, organization_id, is_org_admin)
SELECT id, organization_id, COALESCE(is_org_admin, false)
FROM public.profiles
WHERE organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own memberships" ON public.organization_members;
CREATE POLICY "Users can view own memberships"
  ON public.organization_members
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Platform admins can view all memberships" ON public.organization_members;
CREATE POLICY "Platform admins can view all memberships"
  ON public.organization_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Members can view organizations they belong to" ON public.organizations;
CREATE POLICY "Members can view organizations they belong to"
  ON public.organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.user_id = auth.uid()
        AND organization_members.organization_id = organizations.id
    )
  );

GRANT SELECT ON public.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO service_role;

-- Accepting an invite adds a membership and switches the active org.
-- Prior memberships stay; personal orgs are not archived.
CREATE OR REPLACE FUNCTION public.accept_organization_invite(invite_token text, accepting_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  invite_record RECORD;
  user_record RECORD;
  already boolean;
  member_admin boolean;
  token_digest text;
BEGIN
  token_digest := encode(digest(convert_to(invite_token, 'UTF8'), 'sha256'), 'hex');

  SELECT oi.*, o.name AS org_name, o.slug AS org_slug
  INTO invite_record
  FROM organization_invites oi
  JOIN organizations o ON o.id = oi.organization_id
  WHERE oi.token_hash = token_digest
     OR oi.token = invite_token
  LIMIT 1;

  IF invite_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invite token');
  END IF;

  IF invite_record.used_by IS NOT NULL AND invite_record.used_by <> accepting_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite has already been used');
  END IF;

  SELECT * INTO user_record FROM profiles WHERE id = accepting_user_id;
  IF user_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = accepting_user_id
      AND organization_id = invite_record.organization_id
  ) INTO already;

  IF NOT already AND user_record.organization_id IS NOT NULL
     AND user_record.organization_id = invite_record.organization_id THEN
    already := true;
  END IF;

  INSERT INTO organization_members (user_id, organization_id, is_org_admin)
  VALUES (accepting_user_id, invite_record.organization_id, false)
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  SELECT COALESCE(is_org_admin, false) INTO member_admin
  FROM organization_members
  WHERE user_id = accepting_user_id
    AND organization_id = invite_record.organization_id;

  IF invite_record.used_by IS NULL THEN
    UPDATE organization_invites
    SET used_by = accepting_user_id, used_at = NOW()
    WHERE id = invite_record.id AND used_by IS NULL;
  END IF;

  UPDATE profiles
  SET organization_id = invite_record.organization_id,
      is_org_admin = COALESCE(member_admin, false)
  WHERE id = accepting_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', invite_record.organization_id,
    'organization_name', invite_record.org_name,
    'organization_slug', invite_record.org_slug,
    'already_member', already
  );
END;
$$;

COMMENT ON TABLE public.organization_members IS
  'Many-to-many org membership. profiles.organization_id is the active organization.';
