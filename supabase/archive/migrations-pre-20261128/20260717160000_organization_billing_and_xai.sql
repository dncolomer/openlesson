-- Organization-level product billing + xAI resources (API key + Collection).
-- Product entitlements and PoW pools live on organizations; per-org xAI keys
-- attribute inference cost in the xAI console; collections group PoW files.

-- ============================================
-- ORGANIZATION BILLING + KIND
-- ============================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'team',
  ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS extra_lessons integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_kind_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_kind_check
  CHECK (kind = ANY (ARRAY['personal'::text, 'team'::text, 'partner'::text]));

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_billing_mode_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_billing_mode_check
  CHECK (billing_mode = ANY (ARRAY['subscription'::text, 'partner'::text]));

-- ============================================
-- PER-ORG xAI API KEY (encrypted secret server-side only)
-- ============================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS xai_api_key_id text,
  ADD COLUMN IF NOT EXISTS xai_api_key_name text,
  ADD COLUMN IF NOT EXISTS xai_api_key_ciphertext text,
  ADD COLUMN IF NOT EXISTS xai_api_key_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS xai_api_key_error text,
  ADD COLUMN IF NOT EXISTS xai_api_key_created_at timestamptz;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_xai_api_key_status_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_xai_api_key_status_check
  CHECK (xai_api_key_status = ANY (ARRAY[
    'pending'::text, 'ready'::text, 'error'::text, 'revoked'::text
  ]));

-- ============================================
-- PER-ORG xAI COLLECTION (group PoW files)
-- ============================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS xai_collection_id text,
  ADD COLUMN IF NOT EXISTS xai_collection_name text,
  ADD COLUMN IF NOT EXISTS xai_collection_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS xai_collection_error text;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_xai_collection_status_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_xai_collection_status_check
  CHECK (xai_collection_status = ANY (ARRAY[
    'pending'::text, 'ready'::text, 'error'::text
  ]));

ALTER TABLE public.workspace_proof_of_work
  ADD COLUMN IF NOT EXISTS xai_collection_id text;

CREATE INDEX IF NOT EXISTS idx_organizations_archived_at
  ON public.organizations (archived_at)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_plan
  ON public.organizations (plan, subscription_status);

-- ============================================
-- INVITE ACCEPT: transfer membership (leave personal → join team)
-- ============================================
CREATE OR REPLACE FUNCTION public.accept_organization_invite(invite_token text, accepting_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invite_record RECORD;
  user_record RECORD;
  old_org_id uuid;
  remaining_members integer;
BEGIN
  SELECT oi.*, o.name AS org_name, o.slug AS org_slug
  INTO invite_record
  FROM organization_invites oi
  JOIN organizations o ON o.id = oi.organization_id
  WHERE oi.token = invite_token;

  IF invite_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invite token');
  END IF;

  IF invite_record.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite has already been used');
  END IF;

  SELECT * INTO user_record FROM profiles WHERE id = accepting_user_id;
  IF user_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Already in target org
  IF user_record.organization_id IS NOT NULL
     AND user_record.organization_id = invite_record.organization_id THEN
    UPDATE organization_invites
    SET used_by = accepting_user_id, used_at = NOW()
    WHERE id = invite_record.id AND used_by IS NULL;

    RETURN jsonb_build_object(
      'success', true,
      'organization_id', invite_record.organization_id,
      'organization_name', invite_record.org_name,
      'organization_slug', invite_record.org_slug,
      'already_member', true
    );
  END IF;

  -- Leave current org (transfer); soft-archive empty personal orgs
  old_org_id := user_record.organization_id;
  IF old_org_id IS NOT NULL THEN
    UPDATE profiles
    SET organization_id = NULL, is_org_admin = false
    WHERE id = accepting_user_id;

    SELECT count(*)::integer INTO remaining_members
    FROM profiles
    WHERE organization_id = old_org_id;

    IF remaining_members = 0 THEN
      UPDATE organizations
      SET archived_at = COALESCE(archived_at, NOW()),
          updated_at = NOW()
      WHERE id = old_org_id
        AND kind = 'personal';
    END IF;
  END IF;

  UPDATE organization_invites
  SET used_by = accepting_user_id, used_at = NOW()
  WHERE id = invite_record.id;

  UPDATE profiles
  SET organization_id = invite_record.organization_id, is_org_admin = false
  WHERE id = accepting_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', invite_record.organization_id,
    'organization_name', invite_record.org_name,
    'organization_slug', invite_record.org_slug,
    'left_organization_id', old_org_id
  );
END;
$$;
