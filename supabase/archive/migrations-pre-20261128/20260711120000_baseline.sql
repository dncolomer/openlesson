-- OpenLesson schema baseline (squashed from production public schema)
-- Generated: 2026-07-11T12:14:08.999Z
-- Do not edit by hand. Create a new forward migration instead.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--


--
-- Name: accept_organization_invite(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_organization_invite(invite_token text, accepting_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  invite_record RECORD;
  user_record RECORD;
  result JSONB;
BEGIN
  -- Get the invite
  SELECT oi.*, o.name as org_name, o.slug as org_slug
  INTO invite_record
  FROM organization_invites oi
  JOIN organizations o ON o.id = oi.organization_id
  WHERE oi.token = invite_token;
  
  -- Check if invite exists
  IF invite_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invite token');
  END IF;
  
  -- Check if invite is already used
  IF invite_record.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite has already been used');
  END IF;
  
  -- Get the user
  SELECT * INTO user_record FROM profiles WHERE id = accepting_user_id;
  
  IF user_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Check if user already belongs to an organization
  IF user_record.organization_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'You already belong to an organization. Please leave your current organization first.'
    );
  END IF;
  
  -- Mark the invite as used
  UPDATE organization_invites 
  SET used_by = accepting_user_id, used_at = NOW()
  WHERE id = invite_record.id;
  
  -- Update user's organization
  UPDATE profiles 
  SET organization_id = invite_record.organization_id, is_org_admin = false
  WHERE id = accepting_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'organization_id', invite_record.organization_id,
    'organization_name', invite_record.org_name,
    'organization_slug', invite_record.org_slug
  );
END;
$$;


--
-- Name: generate_invite_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invite_token() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..24 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;


--
-- Name: get_group_workspace_sessions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_group_workspace_sessions(p_workspace_id uuid) RETURNS TABLE(session_id uuid, user_id uuid, username text, problem text, status text, duration_ms integer, report text, created_at timestamp with time zone, ended_at timestamp with time zone, block_id uuid, block_title text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  requester profiles%ROWTYPE;
  is_workspace_owner BOOLEAN;
BEGIN
  SELECT * INTO requester
  FROM profiles
  WHERE id = auth.uid();

  SELECT EXISTS (
    SELECT 1
    FROM workspaces
    WHERE id = p_workspace_id AND user_id = auth.uid()
  ) INTO is_workspace_owner;

  IF requester.id IS NULL OR NOT (
    is_workspace_owner
    OR requester.is_admin = true
    OR (requester.is_org_admin = true AND requester.organization_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH linked_sessions AS (
    SELECT
      bs.session_id,
      bs.user_id,
      bs.block_id
    FROM block_sessions bs
    WHERE bs.workspace_id = p_workspace_id

    UNION

    SELECT
      b.session_id,
      s.user_id,
      b.id AS block_id
    FROM blocks b
    JOIN sessions s ON s.id = b.session_id
    WHERE b.workspace_id = p_workspace_id
      AND b.session_id IS NOT NULL
  )
  SELECT
    s.id AS session_id,
    s.user_id AS user_id,
    p.username AS username,
    s.problem AS problem,
    s.status AS status,
    s.duration_ms AS duration_ms,
    s.report AS report,
    s.created_at AS created_at,
    s.ended_at AS ended_at,
    ls.block_id AS block_id,
    b.title AS block_title
  FROM linked_sessions ls
  JOIN sessions s ON s.id = ls.session_id
  JOIN profiles p ON p.id = s.user_id
  JOIN blocks b ON b.id = ls.block_id
  WHERE is_workspace_owner
    OR requester.is_admin = true
    OR p.organization_id = requester.organization_id
  ORDER BY s.created_at DESC;
END;
$$;


--
-- Name: get_org_workspace_analytics(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_org_workspace_analytics(target_workspace_id uuid, requesting_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  requester RECORD;
  result JSONB;
BEGIN
  SELECT * INTO requester FROM profiles WHERE id = requesting_user_id;

  IF requester IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  IF NOT (requester.is_admin = true OR (requester.is_org_admin = true AND requester.organization_id IS NOT NULL)) THEN
    RETURN jsonb_build_object('error', 'Permission denied');
  END IF;

  SELECT jsonb_build_object(
    'total_sessions', COALESCE(COUNT(DISTINCT s.id), 0),
    'completed_sessions', COALESCE(COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('completed', 'ended_by_tutor')), 0),
    'unique_users', COALESCE(COUNT(DISTINCT s.user_id), 0),
    'avg_duration_minutes', COALESCE(ROUND(AVG(s.duration_ms) / 60000.0, 1), 0),
    'avg_gap_score', COALESCE(ROUND(AVG(
      (SELECT AVG(p2.gap_score)
       FROM probes p2
       WHERE p2.session_id = s.id AND p2.gap_score IS NOT NULL)
    ), 2), 0),
    'completion_rate', CASE
      WHEN COUNT(DISTINCT s.id) > 0
      THEN ROUND(COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('completed', 'ended_by_tutor'))::numeric / COUNT(DISTINCT s.id) * 100, 1)
      ELSE 0
    END,
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'username', p.username,
        'sessions_count', member_stats.session_count,
        'completed_count', member_stats.completed_count,
        'avg_duration_minutes', member_stats.avg_duration
      ) ORDER BY member_stats.session_count DESC)
      FROM (
        SELECT
          s3.user_id,
          COUNT(*) as session_count,
          COUNT(*) FILTER (WHERE s3.status IN ('completed', 'ended_by_tutor')) as completed_count,
          ROUND(AVG(s3.duration_ms) / 60000.0, 1) as avg_duration
        FROM sessions s3
        JOIN blocks b3 ON b3.session_id = s3.id AND b3.workspace_id = target_workspace_id
        JOIN profiles p3 ON p3.id = s3.user_id
          AND p3.organization_id = requester.organization_id
        GROUP BY s3.user_id
      ) member_stats
      JOIN profiles p ON p.id = member_stats.user_id
    ), '[]'::jsonb)
  ) INTO result
  FROM blocks b
  JOIN sessions s ON s.id = b.session_id
  JOIN profiles p ON p.id = s.user_id
    AND (requester.is_admin = true OR p.organization_id = requester.organization_id)
  WHERE b.workspace_id = target_workspace_id;

  RETURN result;
END;
$$;


--
-- Name: get_organization_by_invite_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_organization_by_invite_token(invite_token text) RETURNS TABLE(organization_id uuid, organization_name text, organization_slug text, invite_id uuid, is_used boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id as organization_id,
    o.name as organization_name,
    o.slug as organization_slug,
    oi.id as invite_id,
    (oi.used_by IS NOT NULL) as is_used
  FROM organization_invites oi
  JOIN organizations o ON o.id = oi.organization_id
  WHERE oi.token = invite_token
  LIMIT 1;
END;
$$;


--
-- Name: get_personal_workspace_analytics(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_personal_workspace_analytics(target_workspace_id uuid, requesting_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_sessions', COALESCE(COUNT(DISTINCT s.id), 0),
    'completed_sessions', COALESCE(COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('completed', 'ended_by_tutor')), 0),
    'total_blocks', (SELECT COUNT(*) FROM blocks WHERE workspace_id = target_workspace_id),
    'completed_blocks', (SELECT COUNT(*) FROM blocks WHERE workspace_id = target_workspace_id AND status = 'completed'),
    'avg_duration_minutes', COALESCE(ROUND(AVG(s.duration_ms) / 60000.0, 1), 0),
    'total_duration_minutes', COALESCE(ROUND(SUM(s.duration_ms) / 60000.0, 1), 0),
    'avg_gap_score', COALESCE(ROUND(AVG(
      (SELECT AVG(p2.gap_score)
       FROM probes p2
       WHERE p2.session_id = s.id AND p2.gap_score IS NOT NULL)
    ), 2), 0),
    'sessions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s2.id,
        'problem', s2.problem,
        'status', s2.status,
        'started_at', s2.started_at,
        'duration_minutes', ROUND(s2.duration_ms / 60000.0, 1),
        'block_title', b2.title
      ) ORDER BY s2.started_at DESC)
      FROM sessions s2
      JOIN blocks b2 ON b2.session_id = s2.id AND b2.workspace_id = target_workspace_id
      WHERE s2.user_id = requesting_user_id
    ), '[]'::jsonb)
  ) INTO result
  FROM blocks b
  JOIN sessions s ON s.id = b.session_id AND s.user_id = requesting_user_id
  WHERE b.workspace_id = target_workspace_id;

  RETURN result;
END;
$$;


--
-- Name: get_public_profile_session_summary(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_profile_session_summary(profile_username text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  target_profile profiles%ROWTYPE;
  completed_count INTEGER := 0;
  learning_minutes INTEGER := 0;
  recent_activity JSONB := '[]'::jsonb;
  daily_minutes JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO target_profile
  FROM profiles
  WHERE lower(username) = lower(profile_username)
    AND profile_visibility = 'public'
  LIMIT 1;

  IF target_profile.id IS NULL THEN
    RETURN jsonb_build_object(
      'completed_sessions', NULL,
      'learning_minutes', NULL,
      'activity', '[]'::jsonb,
      'daily_minutes', '[]'::jsonb
    );
  END IF;

  IF target_profile.public_stats_enabled THEN
    SELECT COUNT(*), COALESCE(ROUND(SUM(COALESCE(duration_ms, 0)) / 60000.0), 0)::INTEGER
    INTO completed_count, learning_minutes
    FROM sessions
    WHERE user_id = target_profile.id
      AND status IN ('completed', 'ended_by_tutor');
  END IF;

  IF target_profile.public_activity_enabled THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'type', 'session_completed',
      'title', CASE
        WHEN target_profile.public_session_titles_enabled THEN problem
        ELSE 'Completed a learning session'
      END,
      'occurred_at', COALESCE(ended_at, created_at)
    ) ORDER BY COALESCE(ended_at, created_at) DESC), '[]'::jsonb)
    INTO recent_activity
    FROM (
      SELECT id, problem, ended_at, created_at
      FROM sessions
      WHERE user_id = target_profile.id
        AND status IN ('completed', 'ended_by_tutor')
      ORDER BY COALESCE(ended_at, created_at) DESC
      LIMIT 6
    ) recent_sessions;
  END IF;

  IF target_profile.public_stats_enabled THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'date', activity_date,
      'minutes', minutes
    ) ORDER BY activity_date), '[]'::jsonb)
    INTO daily_minutes
    FROM (
      SELECT
        COALESCE(ended_at, created_at)::date AS activity_date,
        COALESCE(ROUND(SUM(COALESCE(duration_ms, 0)) / 60000.0), 0)::INTEGER AS minutes
      FROM sessions
      WHERE user_id = target_profile.id
        AND status IN ('completed', 'ended_by_tutor')
        AND COALESCE(ended_at, created_at) >= CURRENT_DATE - INTERVAL '364 days'
      GROUP BY COALESCE(ended_at, created_at)::date
    ) daily_sessions;
  END IF;

  RETURN jsonb_build_object(
    'completed_sessions', CASE WHEN target_profile.public_stats_enabled THEN completed_count ELSE NULL END,
    'learning_minutes', CASE WHEN target_profile.public_stats_enabled THEN learning_minutes ELSE NULL END,
    'activity', recent_activity,
    'daily_minutes', daily_minutes
  );
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$;


--
-- Name: is_admin_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin_user() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (
      select is_admin
      from public.profiles
      where id = auth.uid()
    ),
    false
  );
$$;


--
-- Name: match_transcript_chunks(public.vector, uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_transcript_chunks(query_embedding public.vector, match_user_id uuid, match_session_id uuid DEFAULT NULL::uuid, match_limit integer DEFAULT 5) RETURNS TABLE(id uuid, session_id uuid, transcript_id uuid, user_id uuid, chunk_index integer, content text, metadata jsonb, created_at timestamp with time zone, similarity double precision)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.id,
    tc.session_id,
    tc.transcript_id,
    tc.user_id,
    tc.chunk_index,
    tc.content,
    tc.metadata,
    tc.created_at,
    1 - (tc.embedding <=> query_embedding) AS similarity
  FROM transcript_chunks tc
  WHERE 
    tc.user_id = match_user_id
    AND tc.embedding IS NOT NULL
    AND (match_session_id IS NULL OR tc.session_id != match_session_id)
  ORDER BY tc.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;


--
-- Name: remove_organization_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_organization_member(target_user_id uuid, requesting_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  requester RECORD;
  target RECORD;
BEGIN
  -- Get requester info
  SELECT * INTO requester FROM profiles WHERE id = requesting_user_id;
  
  IF requester IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Requester not found');
  END IF;
  
  -- Get target user info
  SELECT * INTO target FROM profiles WHERE id = target_user_id;
  
  IF target IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user not found');
  END IF;
  
  -- Check if requester is platform admin or org admin of the same org
  IF NOT (requester.is_admin = true OR (requester.is_org_admin = true AND requester.organization_id = target.organization_id)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;
  
  -- Check if target belongs to an organization
  IF target.organization_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User does not belong to any organization');
  END IF;
  
  -- Prevent self-removal if you're the last org admin
  IF target_user_id = requesting_user_id AND target.is_org_admin = true THEN
    -- Check if there are other org admins
    IF NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE organization_id = target.organization_id 
        AND is_org_admin = true 
        AND id != target_user_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot remove yourself as the last org admin');
    END IF;
  END IF;
  
  -- Remove user from organization
  UPDATE profiles 
  SET organization_id = NULL, is_org_admin = false
  WHERE id = target_user_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_api_keys (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    key_hash text NOT NULL,
    key_prefix text NOT NULL,
    label text,
    rate_limit integer DEFAULT 100,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone,
    scopes text[] DEFAULT ARRAY['*'::text],
    expires_at timestamp with time zone,
    organization_id uuid,
    guest_user_id uuid
);


--
-- Name: agent_assistant_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_assistant_conversations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    messages jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_proof_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_proof_batches (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    merkle_root text NOT NULL,
    proof_ids uuid[] NOT NULL,
    proof_count integer NOT NULL,
    anchored boolean DEFAULT false,
    anchor_tx_signature text,
    anchor_slot bigint,
    anchor_timestamp timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_proofs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_proofs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    fingerprint text NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    session_id uuid,
    workspace_id uuid,
    previous_proof_id uuid,
    input_hash text,
    output_hash text,
    data_hash text NOT NULL,
    data jsonb,
    anchored boolean DEFAULT false,
    anchor_tx_signature text,
    anchor_slot bigint,
    anchor_timestamp timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT agent_proofs_type_check CHECK ((type = ANY (ARRAY['plan_created'::text, 'plan_adapted'::text, 'session_started'::text, 'session_paused'::text, 'session_resumed'::text, 'session_ended'::text, 'analysis_heartbeat'::text, 'assistant_query'::text, 'session_batch'::text])))
);


--
-- Name: block_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.block_sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    block_id uuid NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocks (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'available'::text,
    session_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    is_start boolean DEFAULT false,
    next_block_ids uuid[] DEFAULT '{}'::uuid[],
    planning_prompt text,
    CONSTRAINT plan_nodes_status_check CHECK ((status = ANY (ARRAY['available'::text, 'in_progress'::text, 'completed'::text, 'locked'::text])))
);


--
-- Name: COLUMN blocks.planning_prompt; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.blocks.planning_prompt IS 'Custom instructions for AI plan generation, set before starting the session';


--
-- Name: insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    workspace_id uuid,
    block_id uuid,
    session_id uuid,
    title text NOT NULL,
    summary text NOT NULL,
    thought_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    source_thoughts jsonb DEFAULT '[]'::jsonb NOT NULL,
    share_token text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text),
    is_public boolean DEFAULT true NOT NULL,
    aesthetic_image text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone
);


--
-- Name: COLUMN insights.archived_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.insights.archived_at IS 'When set, the insight is hidden and share links stop working.';


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    email text NOT NULL,
    organization text NOT NULL,
    role text,
    size text,
    audience text NOT NULL,
    message text,
    status text DEFAULT 'new'::text
);


--
-- Name: mcp_oauth_authorization_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_oauth_authorization_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code_hash text NOT NULL,
    client_id text NOT NULL,
    user_id uuid NOT NULL,
    scopes text[] NOT NULL,
    resource text NOT NULL,
    redirect_uri text NOT NULL,
    code_challenge text NOT NULL,
    code_challenge_method text DEFAULT 'S256'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mcp_oauth_clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_oauth_clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id text NOT NULL,
    client_name text,
    redirect_uris text[] NOT NULL,
    grant_types text[] DEFAULT ARRAY['authorization_code'::text] NOT NULL,
    token_endpoint_auth_method text DEFAULT 'none'::text NOT NULL,
    client_secret_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mcp_oauth_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_oauth_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    access_token_hash text NOT NULL,
    access_token_prefix text NOT NULL,
    refresh_token_hash text,
    client_id text NOT NULL,
    user_id uuid NOT NULL,
    scopes text[] NOT NULL,
    resource text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    refresh_expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    rate_limit integer DEFAULT 120 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: organization_guest_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_guest_users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    email text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    claimed_by_user_id uuid,
    claimed_at timestamp with time zone,
    created_by_user_id uuid,
    created_by_api_key_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_guest_users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'claimed'::text, 'revoked'::text])))
);


--
-- Name: organization_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_invites (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    token text NOT NULL,
    created_by uuid,
    used_by uuid,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: partner_referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_referrals (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    partner_id uuid NOT NULL,
    referred_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: partner_revenue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_revenue (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    partner_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    source_user_id uuid,
    source_subscription_id text,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partners (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    tier text NOT NULL,
    stake_amount integer NOT NULL,
    referral_code text NOT NULL,
    stripe_account_id text,
    stripe_account_status text DEFAULT 'not_connected'::text,
    total_revenue_claimed numeric(12,2) DEFAULT 0,
    last_payout_at timestamp with time zone,
    unstake_requested_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT partners_stripe_account_status_check CHECK ((stripe_account_status = ANY (ARRAY['not_connected'::text, 'pending'::text, 'connected'::text]))),
    CONSTRAINT partners_tier_check CHECK ((tier = ANY (ARRAY['bronze'::text, 'silver'::text, 'gold'::text])))
);


--
-- Name: probes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.probes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    timestamp_ms integer DEFAULT 0 NOT NULL,
    gap_score real DEFAULT 0,
    signals text[] DEFAULT '{}'::text[],
    text text NOT NULL,
    expanded_text text,
    created_at timestamp with time zone DEFAULT now(),
    starred boolean DEFAULT false,
    is_revealed boolean DEFAULT false,
    request_type text DEFAULT 'question'::text,
    plan_step_id text,
    archived boolean DEFAULT false,
    focused boolean DEFAULT false
);


--
-- Name: COLUMN probes.request_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.probes.request_type IS 'Type of request: question, task, suggestion, or checkpoint';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    plan text DEFAULT 'free'::text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text DEFAULT 'inactive'::text,
    current_period_end timestamp with time zone,
    extra_lessons integer DEFAULT 0,
    is_admin boolean DEFAULT false,
    wallet_address text,
    token_tier text,
    token_validated_at timestamp with time zone,
    token_validity_expires_at timestamp with time zone,
    organization_id uuid,
    is_org_admin boolean DEFAULT false,
    display_name text,
    bio text,
    avatar_url text,
    profile_visibility text DEFAULT 'private'::text,
    public_activity_enabled boolean DEFAULT false,
    public_stats_enabled boolean DEFAULT false,
    public_session_titles_enabled boolean DEFAULT false,
    rabbit_hole_bonus_plays integer DEFAULT 0 NOT NULL,
    rabbit_hole_bonus_points integer DEFAULT 0 NOT NULL,
    extra_workspaces integer DEFAULT 0 NOT NULL,
    CONSTRAINT profiles_profile_visibility_check CHECK ((profile_visibility = ANY (ARRAY['public'::text, 'private'::text])))
);


--
-- Name: rabbit_hole_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rabbit_hole_nodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    top_question_id uuid NOT NULL,
    parent_id uuid,
    question text NOT NULL,
    depth integer DEFAULT 0 NOT NULL,
    branch_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rabbit_hole_plays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rabbit_hole_plays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    top_question_id uuid,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    local_day text NOT NULL,
    used_bonus_play boolean DEFAULT false NOT NULL,
    path jsonb DEFAULT '[]'::jsonb NOT NULL,
    interview jsonb,
    score integer,
    depth integer DEFAULT 0 NOT NULL,
    questions_explored integer DEFAULT 0 NOT NULL,
    shared_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rabbit_hole_top_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rabbit_hole_top_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question text NOT NULL,
    discipline text,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: session_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_analysis (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    timestamp_ms bigint NOT NULL,
    xai_file_id text NOT NULL,
    gap_score double precision,
    plan_changed boolean DEFAULT false,
    can_auto_advance boolean DEFAULT false,
    signals text[] DEFAULT '{}'::text[],
    reasoning text,
    source text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: session_audio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_audio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    timestamp_ms bigint NOT NULL,
    storage_path text NOT NULL,
    chunk_index integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: session_eeg; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_eeg (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    timestamp_ms bigint NOT NULL,
    chunk_index integer DEFAULT 0,
    xai_file_id text NOT NULL,
    device_name text,
    sample_count integer,
    band_powers jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: session_facial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_facial (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    timestamp_ms bigint NOT NULL,
    chunk_index integer DEFAULT 0,
    xai_file_id text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: session_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_plans (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    goal text NOT NULL,
    strategy text,
    steps jsonb DEFAULT '[]'::jsonb,
    current_step_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text
);


--
-- Name: TABLE session_plans; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.session_plans IS 'Stores AI-generated learning plans for each session, updated in real-time during learning';


--
-- Name: COLUMN session_plans.goal; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_plans.goal IS 'The overall learning goal for the session';


--
-- Name: COLUMN session_plans.strategy; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_plans.strategy IS 'The AI strategy for guiding the student';


--
-- Name: COLUMN session_plans.steps; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_plans.steps IS 'JSON array of SessionPlanStep objects with status, type, description, order';


--
-- Name: COLUMN session_plans.current_step_index; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_plans.current_step_index IS 'Index of the currently active step';


--
-- Name: COLUMN session_plans.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_plans.description IS 'Brief summary of the session plan for display purposes';


--
-- Name: session_screenshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_screenshots (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    timestamp_ms bigint NOT NULL,
    xai_file_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: session_tool; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_tool (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    timestamp_ms bigint NOT NULL,
    xai_file_id text NOT NULL,
    tool_name text,
    tool_action text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: session_transcript; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_transcript (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    timestamp_ms bigint NOT NULL,
    chunk_index integer,
    word_count integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    xai_file_id text NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    problem text NOT NULL,
    status text DEFAULT 'planning'::text NOT NULL,
    duration_ms integer DEFAULT 0,
    audio_path text,
    report text,
    report_generated_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    transcript text,
    has_transcript boolean DEFAULT false,
    is_agent_session boolean DEFAULT false,
    agent_api_key_id uuid,
    session_started_at timestamp with time zone,
    planning_prompt text,
    CONSTRAINT sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text])))
);


--
-- Name: COLUMN sessions.planning_prompt; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.planning_prompt IS 'Custom instructions used when generating the session plan';


--
-- Name: user_solana_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_solana_wallets (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    pubkey text NOT NULL,
    encrypted_private_key text NOT NULL,
    key_version integer DEFAULT 1,
    total_anchored_proofs integer DEFAULT 0,
    total_anchored_batches integer DEFAULT 0,
    last_anchor_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: workspace_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_files (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    file_name text NOT NULL,
    file_size integer NOT NULL,
    mime_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    xai_file_id text NOT NULL
);


--
-- Name: workspace_ghc_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_ghc_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid,
    created_by_api_key_id uuid,
    private_token_hash text,
    duration_seconds integer DEFAULT 0 NOT NULL,
    requested_duration_seconds integer DEFAULT 0 NOT NULL,
    mode text DEFAULT 'curious'::text NOT NULL,
    focus_node_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    voice_id text DEFAULT 'ara'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    transcript jsonb DEFAULT '[]'::jsonb NOT NULL,
    summary text,
    analysis jsonb DEFAULT '{}'::jsonb NOT NULL,
    overall_score integer,
    marker_scores jsonb DEFAULT '[]'::jsonb NOT NULL,
    xai_conversation_id text,
    xai_response_id text,
    xai_file_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    block_id uuid,
    session_id uuid,
    organization_id uuid,
    guest_user_id uuid,
    CONSTRAINT workspace_ghc_sessions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text])))
);


--
-- Name: workspace_proof_of_work; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_proof_of_work (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    block_id uuid,
    session_id uuid,
    proof_of_work_type text NOT NULL,
    file_name text NOT NULL,
    mime_type text NOT NULL,
    file_size integer,
    xai_file_id text NOT NULL,
    timestamp_ms bigint DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint NOT NULL,
    chunk_index integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    tool_name text,
    tool_action text,
    band_powers jsonb,
    device_name text,
    sample_count integer,
    user_id uuid,
    guest_user_id uuid,
    organization_id uuid,
    created_by_api_key_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_evidence_evidence_type_check CHECK ((proof_of_work_type = ANY (ARRAY['tool'::text, 'screen'::text, 'video'::text, 'eeg'::text])))
);


--
-- Name: workspace_teach_backs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_teach_backs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    duration_seconds integer DEFAULT 0 NOT NULL,
    requested_duration_seconds integer DEFAULT 0 NOT NULL,
    mode text DEFAULT 'curious'::text NOT NULL,
    focus_node_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    voice_id text DEFAULT 'ara'::text NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    transcript jsonb DEFAULT '[]'::jsonb NOT NULL,
    summary text,
    analysis jsonb DEFAULT '{}'::jsonb NOT NULL,
    xai_conversation_id text,
    xai_response_id text,
    xai_file_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    root_topic text NOT NULL,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_agent_workspace boolean DEFAULT false,
    payment_status text DEFAULT 'pending'::text,
    is_public boolean DEFAULT false,
    author_id uuid,
    remix_count integer DEFAULT 0,
    original_workspace_id uuid,
    source_type text DEFAULT 'topic'::text,
    source_url text,
    source_summary text,
    description text,
    notes text,
    cover_image_url text,
    is_group boolean DEFAULT false,
    organization_id uuid,
    guest_user_id uuid,
    conversion_goal text,
    archived_at timestamp with time zone,
    CONSTRAINT learning_plans_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text]))),
    CONSTRAINT learning_plans_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'archived'::text])))
);


--
-- Name: COLUMN workspaces.source_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.source_type IS 'How the plan was created: topic (text input) or youtube (video URL)';


--
-- Name: COLUMN workspaces.source_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.source_url IS 'Source URL for youtube-based plans';


--
-- Name: COLUMN workspaces.source_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.source_summary IS 'AI-generated summary of source content for chat context during tutoring sessions';


--
-- Name: COLUMN workspaces.conversion_goal; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.conversion_goal IS 'What conversion/success means for this workspace. Set at creation (inferred) and editable by the owner.';


--
-- Name: COLUMN workspaces.archived_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.workspaces.archived_at IS 'When the workspace was archived; status should be archived.';


--
-- Name: agent_api_keys agent_api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_api_keys
    ADD CONSTRAINT agent_api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: agent_api_keys agent_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_api_keys
    ADD CONSTRAINT agent_api_keys_pkey PRIMARY KEY (id);


--
-- Name: agent_assistant_conversations agent_assistant_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_assistant_conversations
    ADD CONSTRAINT agent_assistant_conversations_pkey PRIMARY KEY (id);


--
-- Name: agent_proof_batches agent_proof_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_proof_batches
    ADD CONSTRAINT agent_proof_batches_pkey PRIMARY KEY (id);


--
-- Name: agent_proofs agent_proofs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_proofs
    ADD CONSTRAINT agent_proofs_pkey PRIMARY KEY (id);


--
-- Name: insights insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insights
    ADD CONSTRAINT insights_pkey PRIMARY KEY (id);


--
-- Name: insights insights_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insights
    ADD CONSTRAINT insights_share_token_key UNIQUE (share_token);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: workspaces learning_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT learning_plans_pkey PRIMARY KEY (id);


--
-- Name: mcp_oauth_authorization_codes mcp_oauth_authorization_codes_code_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_oauth_authorization_codes
    ADD CONSTRAINT mcp_oauth_authorization_codes_code_hash_key UNIQUE (code_hash);


--
-- Name: mcp_oauth_authorization_codes mcp_oauth_authorization_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_oauth_authorization_codes
    ADD CONSTRAINT mcp_oauth_authorization_codes_pkey PRIMARY KEY (id);


--
-- Name: mcp_oauth_clients mcp_oauth_clients_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_oauth_clients
    ADD CONSTRAINT mcp_oauth_clients_client_id_key UNIQUE (client_id);


--
-- Name: mcp_oauth_clients mcp_oauth_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_oauth_clients
    ADD CONSTRAINT mcp_oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: mcp_oauth_tokens mcp_oauth_tokens_access_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_oauth_tokens
    ADD CONSTRAINT mcp_oauth_tokens_access_token_hash_key UNIQUE (access_token_hash);


--
-- Name: mcp_oauth_tokens mcp_oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_oauth_tokens
    ADD CONSTRAINT mcp_oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: mcp_oauth_tokens mcp_oauth_tokens_refresh_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_oauth_tokens
    ADD CONSTRAINT mcp_oauth_tokens_refresh_token_hash_key UNIQUE (refresh_token_hash);


--
-- Name: organization_guest_users organization_guest_users_organization_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_guest_users
    ADD CONSTRAINT organization_guest_users_organization_id_email_key UNIQUE (organization_id, email);


--
-- Name: organization_guest_users organization_guest_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_guest_users
    ADD CONSTRAINT organization_guest_users_pkey PRIMARY KEY (id);


--
-- Name: organization_invites organization_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invites
    ADD CONSTRAINT organization_invites_pkey PRIMARY KEY (id);


--
-- Name: organization_invites organization_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invites
    ADD CONSTRAINT organization_invites_token_key UNIQUE (token);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: partner_referrals partner_referrals_partner_id_referred_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_referrals
    ADD CONSTRAINT partner_referrals_partner_id_referred_user_id_key UNIQUE (partner_id, referred_user_id);


--
-- Name: partner_referrals partner_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_referrals
    ADD CONSTRAINT partner_referrals_pkey PRIMARY KEY (id);


--
-- Name: partner_revenue partner_revenue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_revenue
    ADD CONSTRAINT partner_revenue_pkey PRIMARY KEY (id);


--
-- Name: partners partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_pkey PRIMARY KEY (id);


--
-- Name: partners partners_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_referral_code_key UNIQUE (referral_code);


--
-- Name: workspace_files plan_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_files
    ADD CONSTRAINT plan_files_pkey PRIMARY KEY (id);


--
-- Name: block_sessions plan_node_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_sessions
    ADD CONSTRAINT plan_node_sessions_pkey PRIMARY KEY (id);


--
-- Name: block_sessions plan_node_sessions_plan_node_id_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_sessions
    ADD CONSTRAINT plan_node_sessions_plan_node_id_session_id_key UNIQUE (block_id, session_id);


--
-- Name: blocks plan_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT plan_nodes_pkey PRIMARY KEY (id);


--
-- Name: probes probes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.probes
    ADD CONSTRAINT probes_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: rabbit_hole_nodes rabbit_hole_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rabbit_hole_nodes
    ADD CONSTRAINT rabbit_hole_nodes_pkey PRIMARY KEY (id);


--
-- Name: rabbit_hole_plays rabbit_hole_plays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rabbit_hole_plays
    ADD CONSTRAINT rabbit_hole_plays_pkey PRIMARY KEY (id);


--
-- Name: rabbit_hole_top_questions rabbit_hole_top_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rabbit_hole_top_questions
    ADD CONSTRAINT rabbit_hole_top_questions_pkey PRIMARY KEY (id);


--
-- Name: session_analysis session_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_analysis
    ADD CONSTRAINT session_analysis_pkey PRIMARY KEY (id);


--
-- Name: session_audio session_audio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_audio
    ADD CONSTRAINT session_audio_pkey PRIMARY KEY (id);


--
-- Name: session_eeg session_eeg_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_eeg
    ADD CONSTRAINT session_eeg_pkey PRIMARY KEY (id);


--
-- Name: session_facial session_facial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_facial
    ADD CONSTRAINT session_facial_pkey PRIMARY KEY (id);


--
-- Name: session_plans session_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_plans
    ADD CONSTRAINT session_plans_pkey PRIMARY KEY (id);


--
-- Name: session_plans session_plans_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_plans
    ADD CONSTRAINT session_plans_session_id_key UNIQUE (session_id);


--
-- Name: session_screenshots session_screenshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_screenshots
    ADD CONSTRAINT session_screenshots_pkey PRIMARY KEY (id);


--
-- Name: session_tool session_tool_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_tool
    ADD CONSTRAINT session_tool_pkey PRIMARY KEY (id);


--
-- Name: session_transcript session_transcript_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_transcript
    ADD CONSTRAINT session_transcript_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: user_solana_wallets user_solana_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_solana_wallets
    ADD CONSTRAINT user_solana_wallets_pkey PRIMARY KEY (id);


--
-- Name: user_solana_wallets user_solana_wallets_pubkey_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_solana_wallets
    ADD CONSTRAINT user_solana_wallets_pubkey_key UNIQUE (pubkey);


--
-- Name: user_solana_wallets user_solana_wallets_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_solana_wallets
    ADD CONSTRAINT user_solana_wallets_user_id_key UNIQUE (user_id);


--
-- Name: workspace_proof_of_work workspace_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_proof_of_work
    ADD CONSTRAINT workspace_evidence_pkey PRIMARY KEY (id);


--
-- Name: workspace_ghc_sessions workspace_ghc_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_ghc_sessions
    ADD CONSTRAINT workspace_ghc_sessions_pkey PRIMARY KEY (id);


--
-- Name: workspace_ghc_sessions workspace_ghc_sessions_private_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_ghc_sessions
    ADD CONSTRAINT workspace_ghc_sessions_private_token_hash_key UNIQUE (private_token_hash);


--
-- Name: workspace_teach_backs workspace_teach_backs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_teach_backs
    ADD CONSTRAINT workspace_teach_backs_pkey PRIMARY KEY (id);


--
-- Name: idx_agent_api_keys_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_api_keys_expires ON public.agent_api_keys USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_agent_api_keys_guest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_api_keys_guest ON public.agent_api_keys USING btree (guest_user_id);


--
-- Name: idx_agent_api_keys_key_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_api_keys_key_hash ON public.agent_api_keys USING btree (key_hash);


--
-- Name: idx_agent_api_keys_key_prefix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_api_keys_key_prefix ON public.agent_api_keys USING btree (key_prefix);


--
-- Name: idx_agent_api_keys_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_api_keys_org ON public.agent_api_keys USING btree (organization_id);


--
-- Name: idx_agent_api_keys_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_api_keys_user_id ON public.agent_api_keys USING btree (user_id);


--
-- Name: idx_agent_assistant_conversations_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_assistant_conversations_session ON public.agent_assistant_conversations USING btree (session_id);


--
-- Name: idx_agent_proof_batches_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_proof_batches_session ON public.agent_proof_batches USING btree (session_id);


--
-- Name: idx_agent_proof_batches_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_proof_batches_user ON public.agent_proof_batches USING btree (user_id);


--
-- Name: idx_agent_proofs_anchored; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_proofs_anchored ON public.agent_proofs USING btree (anchored) WHERE (NOT anchored);


--
-- Name: idx_agent_proofs_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_proofs_fingerprint ON public.agent_proofs USING btree (fingerprint);


--
-- Name: idx_agent_proofs_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_proofs_plan ON public.agent_proofs USING btree (workspace_id);


--
-- Name: idx_agent_proofs_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_proofs_session ON public.agent_proofs USING btree (session_id);


--
-- Name: idx_agent_proofs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_proofs_type ON public.agent_proofs USING btree (type);


--
-- Name: idx_agent_proofs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_proofs_user ON public.agent_proofs USING btree (user_id);


--
-- Name: idx_block_sessions_block_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_block_sessions_block_id ON public.block_sessions USING btree (block_id);


--
-- Name: idx_block_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_block_sessions_user_id ON public.block_sessions USING btree (user_id);


--
-- Name: idx_block_sessions_workspace_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_block_sessions_workspace_id ON public.block_sessions USING btree (workspace_id);


--
-- Name: idx_leads_audience; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_audience ON public.leads USING btree (audience);


--
-- Name: idx_leads_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at DESC);


--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_status ON public.leads USING btree (status);


--
-- Name: idx_learning_plans_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_plans_user ON public.workspaces USING btree (user_id);


--
-- Name: idx_mcp_oauth_authorization_codes_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_oauth_authorization_codes_expires_at ON public.mcp_oauth_authorization_codes USING btree (expires_at);


--
-- Name: idx_mcp_oauth_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_oauth_tokens_expires_at ON public.mcp_oauth_tokens USING btree (expires_at);


--
-- Name: idx_mcp_oauth_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mcp_oauth_tokens_user_id ON public.mcp_oauth_tokens USING btree (user_id);


--
-- Name: idx_org_guest_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_guest_users_email ON public.organization_guest_users USING btree (lower(email));


--
-- Name: idx_org_guest_users_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_guest_users_org ON public.organization_guest_users USING btree (organization_id, created_at DESC);


--
-- Name: idx_organization_invites_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organization_invites_org_id ON public.organization_invites USING btree (organization_id);


--
-- Name: idx_organization_invites_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organization_invites_token ON public.organization_invites USING btree (token);


--
-- Name: idx_organization_invites_unused; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organization_invites_unused ON public.organization_invites USING btree (organization_id) WHERE (used_by IS NULL);


--
-- Name: idx_organizations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_created_at ON public.organizations USING btree (created_at DESC);


--
-- Name: idx_organizations_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_slug ON public.organizations USING btree (slug);


--
-- Name: idx_partner_referrals_partner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_referrals_partner_id ON public.partner_referrals USING btree (partner_id);


--
-- Name: idx_partner_referrals_referred_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_referrals_referred_user_id ON public.partner_referrals USING btree (referred_user_id);


--
-- Name: idx_partner_revenue_partner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_revenue_partner_id ON public.partner_revenue USING btree (partner_id);


--
-- Name: idx_partners_referral_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partners_referral_code ON public.partners USING btree (referral_code);


--
-- Name: idx_partners_unstake_requested; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partners_unstake_requested ON public.partners USING btree (unstake_requested_at) WHERE (unstake_requested_at IS NOT NULL);


--
-- Name: idx_partners_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partners_user_id ON public.partners USING btree (user_id);


--
-- Name: idx_plan_nodes_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_nodes_plan_id ON public.blocks USING btree (workspace_id);


--
-- Name: idx_probes_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_probes_archived ON public.probes USING btree (archived);


--
-- Name: idx_probes_focused; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_probes_focused ON public.probes USING btree (focused);


--
-- Name: idx_probes_plan_step_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_probes_plan_step_id ON public.probes USING btree (plan_step_id);


--
-- Name: idx_probes_session_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_probes_session_archived ON public.probes USING btree (session_id, archived);


--
-- Name: idx_probes_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_probes_session_id ON public.probes USING btree (session_id);


--
-- Name: idx_profiles_org_admins; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_org_admins ON public.profiles USING btree (organization_id) WHERE (is_org_admin = true);


--
-- Name: idx_profiles_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_organization_id ON public.profiles USING btree (organization_id);


--
-- Name: idx_profiles_public_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_public_username ON public.profiles USING btree (lower(username)) WHERE (profile_visibility = 'public'::text);


--
-- Name: idx_profiles_public_username_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_profiles_public_username_unique ON public.profiles USING btree (lower(username)) WHERE ((username IS NOT NULL) AND (username <> ''::text) AND (profile_visibility = 'public'::text));


--
-- Name: idx_profiles_token_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_token_expiry ON public.profiles USING btree (token_validity_expires_at);


--
-- Name: idx_profiles_token_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_token_tier ON public.profiles USING btree (token_tier);


--
-- Name: idx_session_analysis_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_analysis_session_id ON public.session_analysis USING btree (session_id);


--
-- Name: idx_session_analysis_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_analysis_timestamp ON public.session_analysis USING btree (session_id, timestamp_ms DESC);


--
-- Name: idx_session_analysis_xai_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_analysis_xai_file_id ON public.session_analysis USING btree (xai_file_id);


--
-- Name: idx_session_audio_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_audio_session_id ON public.session_audio USING btree (session_id);


--
-- Name: idx_session_audio_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_audio_timestamp ON public.session_audio USING btree (timestamp_ms);


--
-- Name: idx_session_audio_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_audio_user_id ON public.session_audio USING btree (user_id);


--
-- Name: idx_session_eeg_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_eeg_session_id ON public.session_eeg USING btree (session_id);


--
-- Name: idx_session_eeg_xai_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_eeg_xai_file_id ON public.session_eeg USING btree (xai_file_id);


--
-- Name: idx_session_facial_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_facial_session_id ON public.session_facial USING btree (session_id);


--
-- Name: idx_session_facial_xai_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_facial_xai_file_id ON public.session_facial USING btree (xai_file_id);


--
-- Name: idx_session_plans_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_plans_session_id ON public.session_plans USING btree (session_id);


--
-- Name: idx_session_plans_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_plans_user_id ON public.session_plans USING btree (user_id);


--
-- Name: idx_session_screenshots_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_screenshots_session_id ON public.session_screenshots USING btree (session_id);


--
-- Name: idx_session_screenshots_xai_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_screenshots_xai_file_id ON public.session_screenshots USING btree (xai_file_id);


--
-- Name: idx_session_tool_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_tool_session_id ON public.session_tool USING btree (session_id);


--
-- Name: idx_session_tool_xai_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_tool_xai_file_id ON public.session_tool USING btree (xai_file_id);


--
-- Name: idx_session_transcript_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_transcript_session_id ON public.session_transcript USING btree (session_id);


--
-- Name: idx_session_transcript_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_transcript_timestamp ON public.session_transcript USING btree (timestamp_ms);


--
-- Name: idx_session_transcript_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_transcript_user_id ON public.session_transcript USING btree (user_id);


--
-- Name: idx_session_transcript_xai_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_transcript_xai_file_id ON public.session_transcript USING btree (xai_file_id);


--
-- Name: idx_sessions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_created_at ON public.sessions USING btree (created_at DESC);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: idx_user_solana_wallets_pubkey; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_solana_wallets_pubkey ON public.user_solana_wallets USING btree (pubkey);


--
-- Name: idx_user_solana_wallets_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_solana_wallets_user ON public.user_solana_wallets USING btree (user_id);


--
-- Name: idx_workspace_files_xai_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_files_xai_file_id ON public.workspace_files USING btree (xai_file_id);


--
-- Name: idx_workspace_ghc_sessions_guest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_ghc_sessions_guest ON public.workspace_ghc_sessions USING btree (guest_user_id, created_at DESC);


--
-- Name: idx_workspace_ghc_sessions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_ghc_sessions_org ON public.workspace_ghc_sessions USING btree (organization_id, created_at DESC);


--
-- Name: idx_workspace_proof_of_work_block; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_proof_of_work_block ON public.workspace_proof_of_work USING btree (block_id, created_at DESC) WHERE (block_id IS NOT NULL);


--
-- Name: idx_workspace_proof_of_work_guest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_proof_of_work_guest ON public.workspace_proof_of_work USING btree (guest_user_id, created_at DESC) WHERE (guest_user_id IS NOT NULL);


--
-- Name: idx_workspace_proof_of_work_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_proof_of_work_session ON public.workspace_proof_of_work USING btree (session_id, created_at DESC) WHERE (session_id IS NOT NULL);


--
-- Name: idx_workspace_proof_of_work_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_proof_of_work_workspace ON public.workspace_proof_of_work USING btree (workspace_id, created_at DESC);


--
-- Name: idx_workspaces_guest_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_guest_user_id ON public.workspaces USING btree (guest_user_id);


--
-- Name: idx_workspaces_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_organization_id ON public.workspaces USING btree (organization_id);


--
-- Name: idx_workspaces_status_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_status_active ON public.workspaces USING btree (user_id, created_at DESC) WHERE (status IS DISTINCT FROM 'archived'::text);


--
-- Name: insights_active_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insights_active_user_idx ON public.insights USING btree (user_id, created_at DESC) WHERE (archived_at IS NULL);


--
-- Name: insights_share_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insights_share_token_idx ON public.insights USING btree (share_token);


--
-- Name: insights_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insights_user_id_idx ON public.insights USING btree (user_id);


--
-- Name: insights_workspace_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insights_workspace_id_idx ON public.insights USING btree (workspace_id);


--
-- Name: rabbit_hole_nodes_top_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rabbit_hole_nodes_top_parent_idx ON public.rabbit_hole_nodes USING btree (top_question_id, parent_id, branch_order);


--
-- Name: rabbit_hole_plays_user_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rabbit_hole_plays_user_day_idx ON public.rabbit_hole_plays USING btree (user_id, local_day);


--
-- Name: workspace_ghc_sessions_api_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_ghc_sessions_api_key_idx ON public.workspace_ghc_sessions USING btree (created_by_api_key_id, created_at DESC) WHERE (created_by_api_key_id IS NOT NULL);


--
-- Name: workspace_ghc_sessions_block_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_ghc_sessions_block_idx ON public.workspace_ghc_sessions USING btree (block_id, created_at DESC) WHERE (block_id IS NOT NULL);


--
-- Name: workspace_ghc_sessions_plan_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_ghc_sessions_plan_user_idx ON public.workspace_ghc_sessions USING btree (workspace_id, user_id, created_at DESC);


--
-- Name: workspace_ghc_sessions_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_ghc_sessions_session_idx ON public.workspace_ghc_sessions USING btree (session_id, created_at DESC) WHERE (session_id IS NOT NULL);


--
-- Name: workspace_ghc_sessions_token_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_ghc_sessions_token_hash_idx ON public.workspace_ghc_sessions USING btree (private_token_hash) WHERE (private_token_hash IS NOT NULL);


--
-- Name: workspace_teach_backs_plan_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_teach_backs_plan_user_idx ON public.workspace_teach_backs USING btree (workspace_id, user_id, created_at DESC);


--
-- Name: agent_api_keys agent_api_keys_guest_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_api_keys
    ADD CONSTRAINT agent_api_keys_guest_user_id_fkey FOREIGN KEY (guest_user_id) REFERENCES public.organization_guest_users(id) ON DELETE CASCADE;


--
-- Name: agent_api_keys agent_api_keys_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_api_keys
    ADD CONSTRAINT agent_api_keys_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: agent_api_keys agent_api_keys_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_api_keys
    ADD CONSTRAINT agent_api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_assistant_conversations agent_assistant_conversations_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_assistant_conversations
    ADD CONSTRAINT agent_assistant_conversations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: agent_assistant_conversations agent_assistant_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_assistant_conversations
    ADD CONSTRAINT agent_assistant_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_proof_batches agent_proof_batches_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_proof_batches
    ADD CONSTRAINT agent_proof_batches_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: agent_proof_batches agent_proof_batches_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_proof_batches
    ADD CONSTRAINT agent_proof_batches_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_proofs agent_proofs_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_proofs
    ADD CONSTRAINT agent_proofs_plan_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;


--
-- Name: agent_proofs agent_proofs_previous_proof_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_proofs
    ADD CONSTRAINT agent_proofs_previous_proof_id_fkey FOREIGN KEY (previous_proof_id) REFERENCES public.agent_proofs(id);


--
-- Name: agent_proofs agent_proofs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_proofs
    ADD CONSTRAINT agent_proofs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- Name: agent_proofs agent_proofs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_proofs
    ADD CONSTRAINT agent_proofs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: insights insights_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insights
    ADD CONSTRAINT insights_plan_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;


--
-- Name: insights insights_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insights
    ADD CONSTRAINT insights_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspaces learning_plans_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT learning_plans_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id);


--
-- Name: workspaces learning_plans_guest_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT learning_plans_guest_user_id_fkey FOREIGN KEY (guest_user_id) REFERENCES public.organization_guest_users(id) ON DELETE SET NULL;


--
-- Name: workspaces learning_plans_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT learning_plans_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: workspaces learning_plans_original_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT learning_plans_original_plan_id_fkey FOREIGN KEY (original_workspace_id) REFERENCES public.workspaces(id);


--
-- Name: workspaces learning_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT learning_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mcp_oauth_authorization_codes mcp_oauth_authorization_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_oauth_authorization_codes
    ADD CONSTRAINT mcp_oauth_authorization_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mcp_oauth_tokens mcp_oauth_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_oauth_tokens
    ADD CONSTRAINT mcp_oauth_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organization_guest_users organization_guest_users_claimed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_guest_users
    ADD CONSTRAINT organization_guest_users_claimed_by_user_id_fkey FOREIGN KEY (claimed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: organization_guest_users organization_guest_users_created_by_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_guest_users
    ADD CONSTRAINT organization_guest_users_created_by_api_key_id_fkey FOREIGN KEY (created_by_api_key_id) REFERENCES public.agent_api_keys(id) ON DELETE SET NULL;


--
-- Name: organization_guest_users organization_guest_users_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_guest_users
    ADD CONSTRAINT organization_guest_users_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: organization_guest_users organization_guest_users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_guest_users
    ADD CONSTRAINT organization_guest_users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_invites organization_invites_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invites
    ADD CONSTRAINT organization_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: organization_invites organization_invites_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invites
    ADD CONSTRAINT organization_invites_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_invites organization_invites_used_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invites
    ADD CONSTRAINT organization_invites_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: partner_referrals partner_referrals_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_referrals
    ADD CONSTRAINT partner_referrals_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE;


--
-- Name: partner_referrals partner_referrals_referred_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_referrals
    ADD CONSTRAINT partner_referrals_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: partner_revenue partner_revenue_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_revenue
    ADD CONSTRAINT partner_revenue_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE;


--
-- Name: partner_revenue partner_revenue_source_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_revenue
    ADD CONSTRAINT partner_revenue_source_user_id_fkey FOREIGN KEY (source_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: partners partners_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: workspace_files plan_files_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_files
    ADD CONSTRAINT plan_files_plan_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_files plan_files_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_files
    ADD CONSTRAINT plan_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: block_sessions plan_node_sessions_plan_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_sessions
    ADD CONSTRAINT plan_node_sessions_plan_node_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id) ON DELETE CASCADE;


--
-- Name: block_sessions plan_node_sessions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_sessions
    ADD CONSTRAINT plan_node_sessions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: block_sessions plan_node_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.block_sessions
    ADD CONSTRAINT plan_node_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: blocks plan_nodes_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT plan_nodes_plan_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: blocks plan_nodes_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT plan_nodes_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- Name: probes probes_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.probes
    ADD CONSTRAINT probes_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: rabbit_hole_nodes rabbit_hole_nodes_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rabbit_hole_nodes
    ADD CONSTRAINT rabbit_hole_nodes_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.rabbit_hole_nodes(id) ON DELETE CASCADE;


--
-- Name: rabbit_hole_nodes rabbit_hole_nodes_top_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rabbit_hole_nodes
    ADD CONSTRAINT rabbit_hole_nodes_top_question_id_fkey FOREIGN KEY (top_question_id) REFERENCES public.rabbit_hole_top_questions(id) ON DELETE CASCADE;


--
-- Name: rabbit_hole_plays rabbit_hole_plays_top_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rabbit_hole_plays
    ADD CONSTRAINT rabbit_hole_plays_top_question_id_fkey FOREIGN KEY (top_question_id) REFERENCES public.rabbit_hole_top_questions(id);


--
-- Name: rabbit_hole_plays rabbit_hole_plays_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rabbit_hole_plays
    ADD CONSTRAINT rabbit_hole_plays_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session_analysis session_analysis_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_analysis
    ADD CONSTRAINT session_analysis_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: session_analysis session_analysis_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_analysis
    ADD CONSTRAINT session_analysis_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session_audio session_audio_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_audio
    ADD CONSTRAINT session_audio_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: session_audio session_audio_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_audio
    ADD CONSTRAINT session_audio_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session_eeg session_eeg_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_eeg
    ADD CONSTRAINT session_eeg_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: session_eeg session_eeg_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_eeg
    ADD CONSTRAINT session_eeg_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session_facial session_facial_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_facial
    ADD CONSTRAINT session_facial_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: session_facial session_facial_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_facial
    ADD CONSTRAINT session_facial_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session_plans session_plans_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_plans
    ADD CONSTRAINT session_plans_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: session_plans session_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_plans
    ADD CONSTRAINT session_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session_screenshots session_screenshots_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_screenshots
    ADD CONSTRAINT session_screenshots_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: session_screenshots session_screenshots_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_screenshots
    ADD CONSTRAINT session_screenshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session_tool session_tool_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_tool
    ADD CONSTRAINT session_tool_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: session_tool session_tool_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_tool
    ADD CONSTRAINT session_tool_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session_transcript session_transcript_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_transcript
    ADD CONSTRAINT session_transcript_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: session_transcript session_transcript_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_transcript
    ADD CONSTRAINT session_transcript_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_agent_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_agent_api_key_id_fkey FOREIGN KEY (agent_api_key_id) REFERENCES public.agent_api_keys(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_solana_wallets user_solana_wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_solana_wallets
    ADD CONSTRAINT user_solana_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_proof_of_work workspace_evidence_created_by_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_proof_of_work
    ADD CONSTRAINT workspace_evidence_created_by_api_key_id_fkey FOREIGN KEY (created_by_api_key_id) REFERENCES public.agent_api_keys(id) ON DELETE SET NULL;


--
-- Name: workspace_proof_of_work workspace_evidence_guest_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_proof_of_work
    ADD CONSTRAINT workspace_evidence_guest_user_id_fkey FOREIGN KEY (guest_user_id) REFERENCES public.organization_guest_users(id) ON DELETE SET NULL;


--
-- Name: workspace_proof_of_work workspace_evidence_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_proof_of_work
    ADD CONSTRAINT workspace_evidence_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: workspace_proof_of_work workspace_evidence_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_proof_of_work
    ADD CONSTRAINT workspace_evidence_plan_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_proof_of_work workspace_evidence_plan_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_proof_of_work
    ADD CONSTRAINT workspace_evidence_plan_node_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id) ON DELETE SET NULL;


--
-- Name: workspace_proof_of_work workspace_evidence_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_proof_of_work
    ADD CONSTRAINT workspace_evidence_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- Name: workspace_proof_of_work workspace_evidence_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_proof_of_work
    ADD CONSTRAINT workspace_evidence_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: workspace_ghc_sessions workspace_ghc_sessions_created_by_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_ghc_sessions
    ADD CONSTRAINT workspace_ghc_sessions_created_by_api_key_id_fkey FOREIGN KEY (created_by_api_key_id) REFERENCES public.agent_api_keys(id) ON DELETE SET NULL;


--
-- Name: workspace_ghc_sessions workspace_ghc_sessions_guest_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_ghc_sessions
    ADD CONSTRAINT workspace_ghc_sessions_guest_user_id_fkey FOREIGN KEY (guest_user_id) REFERENCES public.organization_guest_users(id) ON DELETE SET NULL;


--
-- Name: workspace_ghc_sessions workspace_ghc_sessions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_ghc_sessions
    ADD CONSTRAINT workspace_ghc_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: workspace_ghc_sessions workspace_ghc_sessions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_ghc_sessions
    ADD CONSTRAINT workspace_ghc_sessions_plan_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_ghc_sessions workspace_ghc_sessions_plan_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_ghc_sessions
    ADD CONSTRAINT workspace_ghc_sessions_plan_node_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id) ON DELETE SET NULL;


--
-- Name: workspace_ghc_sessions workspace_ghc_sessions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_ghc_sessions
    ADD CONSTRAINT workspace_ghc_sessions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- Name: workspace_ghc_sessions workspace_ghc_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_ghc_sessions
    ADD CONSTRAINT workspace_ghc_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: workspace_teach_backs workspace_teach_backs_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_teach_backs
    ADD CONSTRAINT workspace_teach_backs_plan_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_teach_backs workspace_teach_backs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_teach_backs
    ADD CONSTRAINT workspace_teach_backs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: partners Admins can update all partners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all partners" ON public.partners FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: partner_referrals Admins can view all partner referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all partner referrals" ON public.partner_referrals FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: partner_revenue Admins can view all partner revenue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all partner revenue" ON public.partner_revenue FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: partners Admins can view all partners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all partners" ON public.partners FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.is_admin = true)))));


--
-- Name: workspaces Agent endpoints can create learning plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agent endpoints can create learning plans" ON public.workspaces FOR INSERT WITH CHECK (true);


--
-- Name: blocks Agent endpoints can create plan nodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agent endpoints can create plan nodes" ON public.blocks FOR INSERT WITH CHECK (true);


--
-- Name: agent_api_keys Agent endpoints can read agent api keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agent endpoints can read agent api keys" ON public.agent_api_keys FOR SELECT USING (true);


--
-- Name: workspaces Agent endpoints can read learning plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agent endpoints can read learning plans" ON public.workspaces FOR SELECT USING (true);


--
-- Name: blocks Agent endpoints can read plan nodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agent endpoints can read plan nodes" ON public.blocks FOR SELECT USING (true);


--
-- Name: blocks Agent endpoints can update plan nodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agent endpoints can update plan nodes" ON public.blocks FOR UPDATE USING (true);


--
-- Name: leads Allow public lead submission; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public lead submission" ON public.leads FOR INSERT WITH CHECK (true);


--
-- Name: partner_referrals Anyone can insert referrals via API; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert referrals via API" ON public.partner_referrals FOR INSERT WITH CHECK (true);


--
-- Name: workspace_files Anyone can read public workspace files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read public workspace files" ON public.workspace_files FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = workspace_files.workspace_id) AND (w.is_public = true)))));


--
-- Name: workspaces Anyone can view group workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view group workspaces" ON public.workspaces FOR SELECT USING ((is_group = true));


--
-- Name: organization_invites Anyone can view invite by token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view invite by token" ON public.organization_invites FOR SELECT USING (true);


--
-- Name: profiles Anyone can view public profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view public profiles" ON public.profiles FOR SELECT USING ((profile_visibility = 'public'::text));


--
-- Name: workspaces Anyone can view public workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view public workspaces" ON public.workspaces FOR SELECT USING ((is_public = true));


--
-- Name: profiles Authenticated users can view all usernames; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all usernames" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: organizations Members can view own organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view own organization" ON public.organizations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.organization_id = organizations.id)))));


--
-- Name: organization_guest_users Org admins can create guest users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can create guest users" ON public.organization_guest_users FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.organization_id = organization_guest_users.organization_id) AND (profiles.is_org_admin = true)))));


--
-- Name: organization_invites Org admins can create invites for their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can create invites for their org" ON public.organization_invites FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.organization_id = organization_invites.organization_id) AND (profiles.is_org_admin = true)))));


--
-- Name: organization_invites Org admins can delete invites for their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can delete invites for their org" ON public.organization_invites FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.organization_id = organization_invites.organization_id) AND (profiles.is_org_admin = true)))));


--
-- Name: organization_guest_users Org admins can update guest users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can update guest users" ON public.organization_guest_users FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.organization_id = organization_guest_users.organization_id) AND (profiles.is_org_admin = true)))));


--
-- Name: organization_guest_users Org admins can view guest users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can view guest users" ON public.organization_guest_users FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.organization_id = organization_guest_users.organization_id) AND (profiles.is_org_admin = true)))));


--
-- Name: organization_invites Org admins can view invites for their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can view invites for their org" ON public.organization_invites FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.organization_id = organization_invites.organization_id) AND (profiles.is_org_admin = true)))));


--
-- Name: partner_revenue Partners can insert own revenue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Partners can insert own revenue" ON public.partner_revenue FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.partners
  WHERE ((partners.id = partner_revenue.partner_id) AND (partners.user_id = auth.uid())))));


--
-- Name: partner_referrals Partners can view own referrals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Partners can view own referrals" ON public.partner_referrals FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.partners
  WHERE ((partners.id = partner_referrals.partner_id) AND (partners.user_id = auth.uid())))));


--
-- Name: partner_revenue Partners can view own revenue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Partners can view own revenue" ON public.partner_revenue FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.partners
  WHERE ((partners.id = partner_revenue.partner_id) AND (partners.user_id = auth.uid())))));


--
-- Name: organization_invites Platform admins can create all invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can create all invites" ON public.organization_invites FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: organizations Platform admins can create organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can create organizations" ON public.organizations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: organization_invites Platform admins can delete all invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can delete all invites" ON public.organization_invites FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: organizations Platform admins can delete organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can delete organizations" ON public.organizations FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: organization_invites Platform admins can update all invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can update all invites" ON public.organization_invites FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: organizations Platform admins can update organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can update organizations" ON public.organizations FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: organization_invites Platform admins can view all invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all invites" ON public.organization_invites FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: organizations Platform admins can view all organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all organizations" ON public.organizations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: rabbit_hole_nodes Rabbit hole nodes are readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Rabbit hole nodes are readable" ON public.rabbit_hole_nodes FOR SELECT USING (true);


--
-- Name: rabbit_hole_top_questions Rabbit hole questions are readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Rabbit hole questions are readable" ON public.rabbit_hole_top_questions FOR SELECT USING (((active = true) OR public.is_admin_user()));


--
-- Name: agent_proof_batches Service can insert batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can insert batches" ON public.agent_proof_batches FOR INSERT WITH CHECK (true);


--
-- Name: agent_assistant_conversations Service can insert conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can insert conversations" ON public.agent_assistant_conversations FOR INSERT WITH CHECK (true);


--
-- Name: agent_proofs Service can insert proofs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can insert proofs" ON public.agent_proofs FOR INSERT WITH CHECK (true);


--
-- Name: agent_proof_batches Service can update batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can update batches" ON public.agent_proof_batches FOR UPDATE USING (true);


--
-- Name: agent_assistant_conversations Service can update conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can update conversations" ON public.agent_assistant_conversations FOR UPDATE USING (true);


--
-- Name: agent_proofs Service can update proofs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can update proofs" ON public.agent_proofs FOR UPDATE USING (true);


--
-- Name: block_sessions Users can create block_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create block_sessions" ON public.block_sessions FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = block_sessions.workspace_id) AND ((w.user_id = auth.uid()) OR (w.is_group = true)))))));


--
-- Name: workspaces Users can create learning plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create learning plans" ON public.workspaces FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: agent_api_keys Users can create own agent api keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own agent api keys" ON public.agent_api_keys FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: workspaces Users can create own learning plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own learning plans" ON public.workspaces FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: blocks Users can create own plan nodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own plan nodes" ON public.blocks FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = blocks.workspace_id) AND (workspaces.user_id = auth.uid())))));


--
-- Name: probes Users can create own probes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own probes" ON public.probes FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sessions
  WHERE ((sessions.id = probes.session_id) AND (sessions.user_id = auth.uid())))));


--
-- Name: sessions Users can create own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own sessions" ON public.sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: blocks Users can create plan nodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create plan nodes" ON public.blocks FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces lp
  WHERE ((lp.id = blocks.workspace_id) AND (lp.user_id = auth.uid())))));


--
-- Name: blocks Users can delete blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete blocks" ON public.blocks FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = blocks.workspace_id) AND (w.user_id = auth.uid())))));


--
-- Name: agent_api_keys Users can delete own agent api keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own agent api keys" ON public.agent_api_keys FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: session_analysis Users can delete own analysis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own analysis" ON public.session_analysis FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: session_eeg Users can delete own eeg; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own eeg" ON public.session_eeg FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: session_facial Users can delete own facial data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own facial data" ON public.session_facial FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: workspaces Users can delete own learning plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own learning plans" ON public.workspaces FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: blocks Users can delete own plan nodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own plan nodes" ON public.blocks FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workspaces lp
  WHERE ((lp.id = blocks.workspace_id) AND (lp.user_id = auth.uid())))));


--
-- Name: session_plans Users can delete own plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own plans" ON public.session_plans FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: probes Users can delete own probes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own probes" ON public.probes FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.sessions
  WHERE ((sessions.id = probes.session_id) AND (sessions.user_id = auth.uid())))));


--
-- Name: session_screenshots Users can delete own screenshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own screenshots" ON public.session_screenshots FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: sessions Users can delete own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own sessions" ON public.sessions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: session_tool Users can delete own tool events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own tool events" ON public.session_tool FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: workspace_files Users can delete own workspace files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own workspace files" ON public.workspace_files FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: blocks Users can insert blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert blocks" ON public.blocks FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = blocks.workspace_id) AND (w.user_id = auth.uid())))));


--
-- Name: session_analysis Users can insert own analysis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own analysis" ON public.session_analysis FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: session_eeg Users can insert own eeg; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own eeg" ON public.session_eeg FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: session_facial Users can insert own facial data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own facial data" ON public.session_facial FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: partners Users can insert own partner record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own partner record" ON public.partners FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: session_plans Users can insert own plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own plans" ON public.session_plans FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: rabbit_hole_plays Users can insert own rabbit hole plays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own rabbit hole plays" ON public.rabbit_hole_plays FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: session_screenshots Users can insert own screenshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own screenshots" ON public.session_screenshots FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: session_tool Users can insert own tool events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own tool events" ON public.session_tool FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: workspace_ghc_sessions Users can insert own workspace GHC sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own workspace GHC sessions" ON public.workspace_ghc_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: workspace_files Users can insert own workspace files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own workspace files" ON public.workspace_files FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: workspace_teach_backs Users can insert own workspace teach backs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own workspace teach backs" ON public.workspace_teach_backs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: session_analysis Users can read own analysis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own analysis" ON public.session_analysis FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: session_eeg Users can read own eeg; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own eeg" ON public.session_eeg FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: session_facial Users can read own facial data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own facial data" ON public.session_facial FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: rabbit_hole_plays Users can read own rabbit hole plays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own rabbit hole plays" ON public.rabbit_hole_plays FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin_user()));


--
-- Name: session_screenshots Users can read own screenshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own screenshots" ON public.session_screenshots FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: profiles Users can read own token tier; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own token tier" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: session_tool Users can read own tool events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own tool events" ON public.session_tool FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: workspace_ghc_sessions Users can read own workspace GHC sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own workspace GHC sessions" ON public.workspace_ghc_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: workspace_files Users can read own workspace files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own workspace files" ON public.workspace_files FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: workspace_teach_backs Users can read own workspace teach backs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own workspace teach backs" ON public.workspace_teach_backs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: blocks Users can update blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update blocks" ON public.blocks FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = blocks.workspace_id) AND (w.user_id = auth.uid())))));


--
-- Name: agent_api_keys Users can update own agent api keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own agent api keys" ON public.agent_api_keys FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: workspaces Users can update own learning plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own learning plans" ON public.workspaces FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: partners Users can update own partner record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own partner record" ON public.partners FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: blocks Users can update own plan nodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own plan nodes" ON public.blocks FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.workspaces
  WHERE ((workspaces.id = blocks.workspace_id) AND (workspaces.user_id = auth.uid())))));


--
-- Name: workspaces Users can update own plan visibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own plan visibility" ON public.workspaces FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: session_plans Users can update own plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own plans" ON public.session_plans FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: probes Users can update own probes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own probes" ON public.probes FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.sessions
  WHERE ((sessions.id = probes.session_id) AND (sessions.user_id = auth.uid())))));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: rabbit_hole_plays Users can update own rabbit hole plays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own rabbit hole plays" ON public.rabbit_hole_plays FOR UPDATE USING (((auth.uid() = user_id) OR public.is_admin_user())) WITH CHECK (((auth.uid() = user_id) OR public.is_admin_user()));


--
-- Name: sessions Users can update own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own sessions" ON public.sessions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own token tier; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own token tier" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: workspace_ghc_sessions Users can update own workspace GHC sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own workspace GHC sessions" ON public.workspace_ghc_sessions FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: workspaces Users can update own workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own workspaces" ON public.workspaces FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: block_sessions Users can view block_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view block_sessions" ON public.block_sessions FOR SELECT USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = block_sessions.workspace_id) AND ((w.user_id = auth.uid()) OR (w.is_group = true)))))));


--
-- Name: blocks Users can view blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view blocks" ON public.blocks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = blocks.workspace_id) AND ((w.user_id = auth.uid()) OR (w.is_public = true) OR (w.is_group = true))))));


--
-- Name: agent_api_keys Users can view own agent api keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own agent api keys" ON public.agent_api_keys FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: agent_proof_batches Users can view own batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own batches" ON public.agent_proof_batches FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: agent_assistant_conversations Users can view own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own conversations" ON public.agent_assistant_conversations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: workspaces Users can view own learning plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own learning plans" ON public.workspaces FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: partners Users can view own partner record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own partner record" ON public.partners FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: session_plans Users can view own plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own plans" ON public.session_plans FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: probes Users can view own probes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own probes" ON public.probes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sessions
  WHERE ((sessions.id = probes.session_id) AND (sessions.user_id = auth.uid())))));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: agent_proofs Users can view own proofs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own proofs" ON public.agent_proofs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: sessions Users can view own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own sessions" ON public.sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_solana_wallets Users can view own wallet; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own wallet" ON public.user_solana_wallets FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: workspaces Users can view own workspaces; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own workspaces" ON public.workspaces FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: partner_referrals Users can view their own referral info; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own referral info" ON public.partner_referrals FOR SELECT USING ((auth.uid() = referred_user_id));


--
-- Name: workspace_proof_of_work Workspace owners can insert evidence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace owners can insert evidence" ON public.workspace_proof_of_work FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = workspace_proof_of_work.workspace_id) AND (w.user_id = auth.uid())))));


--
-- Name: workspace_proof_of_work Workspace owners can read evidence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace owners can read evidence" ON public.workspace_proof_of_work FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = workspace_proof_of_work.workspace_id) AND (w.user_id = auth.uid())))));


--
-- Name: agent_api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_assistant_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_assistant_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_proof_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_proof_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_proofs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_proofs ENABLE ROW LEVEL SECURITY;

--
-- Name: block_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.block_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: insights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

--
-- Name: insights insights_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insights_owner_all ON public.insights USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: insights insights_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insights_public_read ON public.insights FOR SELECT USING (((is_public = true) AND (archived_at IS NULL)));


--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: mcp_oauth_authorization_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mcp_oauth_authorization_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: mcp_oauth_clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mcp_oauth_clients ENABLE ROW LEVEL SECURITY;

--
-- Name: mcp_oauth_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_guest_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_guest_users ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_revenue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_revenue ENABLE ROW LEVEL SECURITY;

--
-- Name: partners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

--
-- Name: probes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.probes ENABLE ROW LEVEL SECURITY;

--
-- Name: rabbit_hole_nodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rabbit_hole_nodes ENABLE ROW LEVEL SECURITY;

--
-- Name: rabbit_hole_plays; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rabbit_hole_plays ENABLE ROW LEVEL SECURITY;

--
-- Name: rabbit_hole_top_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rabbit_hole_top_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: session_analysis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_analysis ENABLE ROW LEVEL SECURITY;

--
-- Name: session_eeg; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_eeg ENABLE ROW LEVEL SECURITY;

--
-- Name: session_facial; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_facial ENABLE ROW LEVEL SECURITY;

--
-- Name: session_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: session_screenshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_screenshots ENABLE ROW LEVEL SECURITY;

--
-- Name: session_tool; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_tool ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_solana_wallets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_solana_wallets ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_files ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_ghc_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_ghc_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_proof_of_work; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_proof_of_work ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_teach_backs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_teach_backs ENABLE ROW LEVEL SECURITY;

--
-- Name: workspaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



-- Migration tracking (empty on fresh databases)
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  inserted_at timestamptz NOT NULL DEFAULT now()
);
