-- Security hardening (P0):
-- 1. Drop over-permissive agent/service RLS policies
-- 2. Freeze privileged profile columns for non-service-role clients
-- 3. Restrict agent_api_keys client insert/update (server/service role only)
-- 4. Invite tokens: hash-at-rest + drop world-readable select

-- ═══════════════════════════════════════════════════════════════════
-- 1. Drop open agent/service policies
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Agent endpoints can create learning plans" ON public.workspaces;
DROP POLICY IF EXISTS "Agent endpoints can read learning plans" ON public.workspaces;
DROP POLICY IF EXISTS "Agent endpoints can create plan nodes" ON public.blocks;
DROP POLICY IF EXISTS "Agent endpoints can read plan nodes" ON public.blocks;
DROP POLICY IF EXISTS "Agent endpoints can update plan nodes" ON public.blocks;
DROP POLICY IF EXISTS "Agent endpoints can read agent api keys" ON public.agent_api_keys;

DROP POLICY IF EXISTS "Service can insert batches" ON public.agent_proof_batches;
DROP POLICY IF EXISTS "Service can update batches" ON public.agent_proof_batches;
DROP POLICY IF EXISTS "Service can insert conversations" ON public.agent_assistant_conversations;
DROP POLICY IF EXISTS "Service can update conversations" ON public.agent_assistant_conversations;
DROP POLICY IF EXISTS "Service can insert proofs" ON public.agent_proofs;
DROP POLICY IF EXISTS "Service can update proofs" ON public.agent_proofs;

-- ═══════════════════════════════════════════════════════════════════
-- 2. agent_api_keys: no client insert/update (create/revoke via service role)
-- Keep own SELECT so list API can use user-scoped client; mutations use admin.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can create own agent api keys" ON public.agent_api_keys;
DROP POLICY IF EXISTS "Users can update own agent api keys" ON public.agent_api_keys;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Profile privileged-column freeze (client self-update cannot escalate)
-- Service-role and SECURITY DEFINER (postgres owner) may still update.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := coalesce(
    current_setting('request.jwt.claim.role', true),
    auth.jwt() ->> 'role',
    ''
  );

  -- Service role and superuser/definer paths may change privileged fields.
  IF jwt_role = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin')
     OR session_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'Cannot modify is_admin';
  END IF;
  IF NEW.is_org_admin IS DISTINCT FROM OLD.is_org_admin THEN
    RAISE EXCEPTION 'Cannot modify is_org_admin';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Cannot modify organization_id';
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'Cannot modify plan';
  END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Cannot modify subscription_status';
  END IF;
  IF NEW.current_period_end IS DISTINCT FROM OLD.current_period_end THEN
    RAISE EXCEPTION 'Cannot modify current_period_end';
  END IF;
  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    RAISE EXCEPTION 'Cannot modify stripe_customer_id';
  END IF;
  IF NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
    RAISE EXCEPTION 'Cannot modify stripe_subscription_id';
  END IF;
  IF NEW.extra_lessons IS DISTINCT FROM OLD.extra_lessons THEN
    RAISE EXCEPTION 'Cannot modify extra_lessons';
  END IF;
  IF NEW.extra_workspaces IS DISTINCT FROM OLD.extra_workspaces THEN
    RAISE EXCEPTION 'Cannot modify extra_workspaces';
  END IF;
  IF NEW.token_tier IS DISTINCT FROM OLD.token_tier THEN
    RAISE EXCEPTION 'Cannot modify token_tier';
  END IF;
  IF NEW.token_validated_at IS DISTINCT FROM OLD.token_validated_at THEN
    RAISE EXCEPTION 'Cannot modify token_validated_at';
  END IF;
  IF NEW.token_validity_expires_at IS DISTINCT FROM OLD.token_validity_expires_at THEN
    RAISE EXCEPTION 'Cannot modify token_validity_expires_at';
  END IF;
  IF NEW.rabbit_hole_bonus_plays IS DISTINCT FROM OLD.rabbit_hole_bonus_plays THEN
    RAISE EXCEPTION 'Cannot modify rabbit_hole_bonus_plays';
  END IF;
  IF NEW.rabbit_hole_bonus_points IS DISTINCT FROM OLD.rabbit_hole_bonus_points THEN
    RAISE EXCEPTION 'Cannot modify rabbit_hole_bonus_points';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_privileged_profile_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_privileged_profile_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privileged_profile_escalation();

-- Drop redundant unrestricted token-tier update policy (same USING as own profile).
DROP POLICY IF EXISTS "Users can update own token tier" ON public.profiles;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Organization invites: hash-at-rest + no full-table client select
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS token_hash text;

-- Backfill hashes for existing plaintext tokens
UPDATE public.organization_invites
SET token_hash = encode(extensions.digest(convert_to(token, 'UTF8'), 'sha256'), 'hex')
WHERE token_hash IS NULL
  AND token IS NOT NULL
  AND token <> ''
  AND token NOT LIKE 'h\_%' ESCAPE '\';

-- Placeholder rows already hashed (token starts with h_): leave token_hash as-is if set

CREATE UNIQUE INDEX IF NOT EXISTS organization_invites_token_hash_key
  ON public.organization_invites (token_hash)
  WHERE token_hash IS NOT NULL;

DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.organization_invites;

-- Dual-read accept: match token_hash (new) OR legacy plaintext token column
CREATE OR REPLACE FUNCTION public.accept_organization_invite(invite_token text, accepting_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  invite_record RECORD;
  user_record RECORD;
  old_org_id uuid;
  remaining_members integer;
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

  IF invite_record.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite has already been used');
  END IF;

  SELECT * INTO user_record FROM profiles WHERE id = accepting_user_id;
  IF user_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

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

CREATE OR REPLACE FUNCTION public.get_organization_by_invite_token(invite_token text)
RETURNS TABLE(organization_id uuid, organization_name text, organization_slug text, invite_id uuid, is_used boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  token_digest text;
BEGIN
  token_digest := encode(digest(convert_to(invite_token, 'UTF8'), 'sha256'), 'hex');
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    oi.id,
    (oi.used_by IS NOT NULL)
  FROM organization_invites oi
  JOIN organizations o ON o.id = oi.organization_id
  WHERE oi.token_hash = token_digest
     OR oi.token = invite_token
  LIMIT 1;
END;
$$;

-- Prefer CSPRNG for DB-side token generation (if still used)
CREATE OR REPLACE FUNCTION public.generate_invite_token() RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$;
