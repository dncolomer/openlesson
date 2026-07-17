-- Fix privileged-profile freeze: do not trust session_user.
-- Direct SQL / pool connections often keep session_user = postgres while
-- SET ROLE authenticated only changes current_user. Allow privileged updates
-- only for service_role JWT or when current_user is a superuser/definer role
-- (SECURITY DEFINER RPCs run as their owner).

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
    nullif(current_setting('request.jwt.claim.role', true), ''),
    auth.jwt() ->> 'role',
    ''
  );

  -- Service-role API clients and SECURITY DEFINER / superuser writers.
  IF jwt_role = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin') THEN
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
