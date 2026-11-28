-- ============================================================================
-- Uncertain Systems — Clean-Start Verification-Only Schema Baseline
-- ============================================================================
-- Squashed from 122 historical migrations (20260711..20261127) plus the
-- verification-only cleanup migration (supabase/upgrade/20261128120000_drop_legacy_non_verification_schema.sql).
--
-- For FRESH environments: apply this single migration directly.
-- For EXISTING environments (staging/prod): run
--   supabase/upgrade/20261128120000_drop_legacy_non_verification_schema.sql
-- first, then mark 20261128120000_baseline as applied via supabase migration repair.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, username, plan, subscription_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'inactive',
    'inactive'
  )
  ON CONFLICT (id) DO NOTHING;
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
-- Name: prevent_privileged_profile_escalation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_privileged_profile_escalation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    auth.jwt() ->> 'role',
    ''
  );

  if jwt_role = 'service_role'
     or current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin') then
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin then
    raise exception 'Cannot modify is_admin';
  end if;
  if new.is_org_admin is distinct from old.is_org_admin then
    raise exception 'Cannot modify is_org_admin';
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Cannot modify organization_id';
  end if;
  if new.plan is distinct from old.plan then
    raise exception 'Cannot modify plan';
  end if;
  if new.subscription_status is distinct from old.subscription_status then
    raise exception 'Cannot modify subscription_status';
  end if;
  if new.current_period_end is distinct from old.current_period_end then
    raise exception 'Cannot modify current_period_end';
  end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'Cannot modify stripe_customer_id';
  end if;
  if new.stripe_subscription_id is distinct from old.stripe_subscription_id then
    raise exception 'Cannot modify stripe_subscription_id';
  end if;
  if new.extra_lessons is distinct from old.extra_lessons then
    raise exception 'Cannot modify extra_lessons';
  end if;
  if new.extra_workspaces is distinct from old.extra_workspaces then
    raise exception 'Cannot modify extra_workspaces';
  end if;
  if new.token_tier is distinct from old.token_tier then
    raise exception 'Cannot modify token_tier';
  end if;
  if new.token_validated_at is distinct from old.token_validated_at then
    raise exception 'Cannot modify token_validated_at';
  end if;
  if new.token_validity_expires_at is distinct from old.token_validity_expires_at then
    raise exception 'Cannot modify token_validity_expires_at';
  end if;
  return new;
end;
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
-- Name: credit_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    entry_kind text NOT NULL,
    amount integer NOT NULL,
    balance_after integer NOT NULL,
    reason text NOT NULL,
    flow_kind text,
    stripe_checkout_session_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT credit_ledger_entry_kind_check CHECK ((entry_kind = ANY (ARRAY['grant'::text, 'pack'::text, 'debit'::text, 'refund'::text])))
);


--
-- Name: TABLE credit_ledger; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.credit_ledger IS 'Append-only usage-credit ledger. Session starts debit; signup and packs grant.';


--
-- Name: embedding_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.embedding_models (
    id text NOT NULL,
    family text NOT NULL,
    version text NOT NULL,
    algorithm_id text NOT NULL,
    dim integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT embedding_models_dim_check CHECK (((dim > 0) AND (dim <= 1024))),
    CONSTRAINT embedding_models_family_check CHECK ((family = ANY (ARRAY['learn'::text, 'calibrate'::text, 'verify'::text, 'solve'::text])))
);


--
-- Name: TABLE embedding_models; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.embedding_models IS 'Versioned embedding families. Vectors are derived from proof of work + field_model and can be rebuilt.';


--
-- Name: flow_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flow_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id uuid NOT NULL,
    flow_kind text NOT NULL,
    flow_id uuid NOT NULL,
    public_token text NOT NULL,
    label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT flow_links_flow_kind_check CHECK ((flow_kind = ANY (ARRAY['verification'::text, 'verify'::text])))
);


--
-- Name: TABLE flow_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.flow_links IS 'Extra public flow URLs. Optional label tags run data. Null label is Test.';


--
-- Name: knowledge_regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_regions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    embedding_model_id text DEFAULT 'flowcfg-v1-d96'::text NOT NULL,
    dim integer DEFAULT 96 NOT NULL,
    centroid jsonb NOT NULL,
    cohort_cohesion double precision DEFAULT 0 NOT NULL,
    mean_radius double precision DEFAULT 0 NOT NULL,
    cosine_threshold double precision DEFAULT 0.5 NOT NULL,
    subject_count integer DEFAULT 0 NOT NULL,
    subjects jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_user_id uuid NOT NULL,
    family_embedding_model_id text,
    verify_flow_id uuid,
    organization_id uuid,
    CONSTRAINT custom_verification_models_dim_check CHECK (((dim > 0) AND (dim <= 1024))),
    CONSTRAINT custom_verification_models_name_len CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(name) <= 120))),
    CONSTRAINT custom_verification_models_subject_count_check CHECK ((subject_count >= 1)),
    CONSTRAINT custom_verification_models_threshold_check CHECK (((cosine_threshold >= ('-1'::integer)::double precision) AND (cosine_threshold <= (1)::double precision)))
);


--
-- Name: TABLE knowledge_regions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.knowledge_regions IS 'Knowledge regions. UI name stays Knowledge Region. Live Path regions use flowcfg-v1-d96.';


--
-- Name: COLUMN knowledge_regions.owner_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.knowledge_regions.owner_user_id IS 'Owning user. Dashboard regions list by this column.';


--
-- Name: COLUMN knowledge_regions.family_embedding_model_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.knowledge_regions.family_embedding_model_id IS 'Registry family (learn/calibrate/verify). Null means retired 64-d knowledgecfg — not a live Path point.';


--
-- Name: COLUMN knowledge_regions.organization_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.knowledge_regions.organization_id IS 'Organization the knowledge region was authored in. Dashboard lists by this, not owner_user_id.';


--
-- Name: lti_context_regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lti_context_regions (
    platform_id uuid NOT NULL,
    deployment_id text NOT NULL,
    context_id text NOT NULL,
    knowledge_region_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lti_launches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lti_launches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform_id uuid NOT NULL,
    deployment_id text DEFAULT ''::text NOT NULL,
    issuer text NOT NULL,
    sub text NOT NULL,
    context_id text DEFAULT ''::text NOT NULL,
    flow_token text,
    flow_kind text,
    region_id uuid,
    resource_link_id text DEFAULT ''::text NOT NULL,
    ags_endpoint jsonb,
    nrps_endpoint jsonb,
    identity text NOT NULL,
    instructor boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lti_oidc_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lti_oidc_state (
    state text NOT NULL,
    nonce text NOT NULL,
    platform_id uuid NOT NULL,
    iss text DEFAULT ''::text NOT NULL,
    client_id text DEFAULT ''::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lti_platforms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lti_platforms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    issuer text NOT NULL,
    client_id text NOT NULL,
    auth_login_url text NOT NULL,
    auth_token_url text DEFAULT ''::text NOT NULL,
    keyset_url text NOT NULL,
    deployment_ids text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE lti_platforms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.lti_platforms IS 'LMS LTI 1.3 platform registrations (Brightspace issuer + client_id).';


--
-- Name: lti_tool_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lti_tool_keys (
    kid text NOT NULL,
    public_jwk jsonb NOT NULL,
    private_jwk jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE lti_tool_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.lti_tool_keys IS 'Tool RS256 keys for JWKS, Deep Linking responses, and AGS client assertions.';


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
    organization_id uuid,
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
    created_at timestamp with time zone DEFAULT now(),
    token_hash text
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    is_org_admin boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE organization_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.organization_members IS 'Many-to-many org membership. profiles.organization_id is the active organization.';


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    kind text DEFAULT 'team'::text NOT NULL,
    billing_mode text DEFAULT 'subscription'::text NOT NULL,
    plan text DEFAULT 'inactive'::text NOT NULL,
    subscription_status text DEFAULT 'inactive'::text NOT NULL,
    current_period_end timestamp with time zone,
    extra_lessons integer DEFAULT 0 NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    billing_email text,
    archived_at timestamp with time zone,
    xai_api_key_id text,
    xai_api_key_name text,
    xai_api_key_ciphertext text,
    xai_api_key_status text DEFAULT 'pending'::text NOT NULL,
    xai_api_key_error text,
    xai_api_key_created_at timestamp with time zone,
    xai_collection_id text,
    xai_collection_name text,
    xai_collection_status text DEFAULT 'pending'::text NOT NULL,
    xai_collection_error text,
    logo_url text,
    custom_aesthetic_urls text[] DEFAULT '{}'::text[] NOT NULL,
    llm_backend text DEFAULT 'platform'::text NOT NULL,
    llm_provider text,
    llm_base_url text,
    llm_api_key_ciphertext text,
    llm_api_key_last_four text,
    llm_model text,
    blob_backend text DEFAULT 'platform'::text NOT NULL,
    blob_provider text,
    blob_base_url text,
    blob_api_key_ciphertext text,
    blob_api_key_last_four text,
    workos_organization_id text,
    openrouter_api_key_ciphertext text,
    openrouter_api_key_last_four text,
    sidebar_style jsonb,
    CONSTRAINT organizations_billing_mode_check CHECK ((billing_mode = ANY (ARRAY['subscription'::text, 'partner'::text]))),
    CONSTRAINT organizations_blob_backend_check CHECK ((blob_backend = ANY (ARRAY['platform'::text, 'custom'::text]))),
    CONSTRAINT organizations_blob_provider_check CHECK (((blob_provider IS NULL) OR (blob_provider = ANY (ARRAY['xai'::text, 'openai-compatible'::text])))),
    CONSTRAINT organizations_kind_check CHECK ((kind = ANY (ARRAY['personal'::text, 'team'::text, 'partner'::text]))),
    CONSTRAINT organizations_llm_backend_check CHECK ((llm_backend = ANY (ARRAY['platform'::text, 'custom'::text]))),
    CONSTRAINT organizations_llm_provider_check CHECK (((llm_provider IS NULL) OR (llm_provider = ANY (ARRAY['xai'::text, 'openai-compatible'::text])))),
    CONSTRAINT organizations_xai_api_key_status_check CHECK ((xai_api_key_status = ANY (ARRAY['pending'::text, 'ready'::text, 'error'::text, 'revoked'::text]))),
    CONSTRAINT organizations_xai_collection_status_check CHECK ((xai_collection_status = ANY (ARRAY['pending'::text, 'ready'::text, 'error'::text])))
);


--
-- Name: COLUMN organizations.sidebar_style; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.organizations.sidebar_style IS 'Prompt-built tokens and still for the 16rem session canvas sidebar.';


--
-- Name: pending_checkouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_checkouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stripe_session_id text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    email text NOT NULL,
    price_type text NOT NULL,
    plan text NOT NULL,
    monthly_volume integer,
    current_period_end timestamp with time zone,
    claimed_at timestamp with time zone,
    claimed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    plan text DEFAULT 'inactive'::text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text DEFAULT 'inactive'::text,
    current_period_end timestamp with time zone,
    extra_lessons integer DEFAULT 0,
    is_admin boolean DEFAULT false,
    token_tier text,
    token_validated_at timestamp with time zone,
    token_validity_expires_at timestamp with time zone,
    organization_id uuid,
    is_org_admin boolean DEFAULT false,
    extra_workspaces integer DEFAULT 0 NOT NULL,
    credit_balance integer DEFAULT 0 NOT NULL,
    workos_user_id text
);


--
-- Name: COLUMN profiles.credit_balance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.credit_balance IS 'Current usage-credit balance. Flow sessions debit this; packs and the free signup grant credit it.';


--
-- Name: proof_of_work; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proof_of_work (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
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
    xai_collection_id text,
    pow_model_version text DEFAULT 'pow-model-v1'::text NOT NULL,
    verify_flow_id uuid,
    CONSTRAINT workspace_evidence_evidence_type_check CHECK ((proof_of_work_type = ANY (ARRAY['tool'::text, 'screen'::text, 'video'::text, 'eeg'::text]))),
    CONSTRAINT workspace_proof_of_work_pow_model_version_check CHECK ((pow_model_version = 'pow-model-v1'::text))
);


--
-- Name: TABLE proof_of_work; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.proof_of_work IS 'Raw evidence corpus. Each row points at an xAI file. Product code must not delete rows or files. Embeddings are derived from this table.';


--
-- Name: COLUMN proof_of_work.pow_model_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.proof_of_work.pow_model_version IS 'Persisted Proof-of-Work model id. Current value is pow-model-v1 (types tool|screen|video|eeg).';


--
-- Name: protocol_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.protocol_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    style jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE protocol_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.protocol_settings IS 'Named session rail and work-canvas styles. Protocols pick one or use the org default.';


--
-- Name: region_simulation_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.region_simulation_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id uuid NOT NULL,
    region_id uuid,
    product text DEFAULT 'verification'::text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    family text DEFAULT 'exploration'::text NOT NULL,
    follow_up_job_id uuid,
    plan jsonb DEFAULT '{}'::jsonb NOT NULL,
    plan_cursor integer DEFAULT 0 NOT NULL,
    checkpoint jsonb,
    lease_owner text,
    lease_until timestamp with time zone,
    progress jsonb DEFAULT '[]'::jsonb NOT NULL,
    result jsonb,
    cost_usd numeric DEFAULT 0 NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT region_simulation_jobs_family_check CHECK ((family = ANY (ARRAY['exploration'::text, 'ai_use'::text]))),
    CONSTRAINT region_simulation_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text])))
);


--
-- Name: TABLE region_simulation_jobs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.region_simulation_jobs IS 'Queued knowledge-region simulation. One family per job. Lease TTL is 55 seconds.';


--
-- Name: acquire_region_simulation_job_lease(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acquire_region_simulation_job_lease(p_job_id uuid, p_lease_owner text, p_lease_ms integer DEFAULT 65000) RETURNS SETOF public.region_simulation_jobs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  UPDATE public.region_simulation_jobs
  SET
    status = 'running',
    lease_owner = p_lease_owner,
    lease_until = now() + make_interval(secs => GREATEST(1, COALESCE(p_lease_ms, 65000)) / 1000.0),
    updated_at = now()
  WHERE id = p_job_id
    AND status IN ('queued', 'running')
    AND (lease_until IS NULL OR lease_until < now() OR lease_owner = p_lease_owner)
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_region_simulation_job_lease(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acquire_region_simulation_job_lease(uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.acquire_region_simulation_job_lease(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_region_simulation_job_lease(uuid, text, integer) TO service_role;


--
-- Name: session_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_embeddings (
    id uuid NOT NULL,
    flow_kind text NOT NULL,
    flow_id text,
    run_id text,
    identity text,
    source text,
    embedding_model_id text NOT NULL,
    dim integer NOT NULL,
    vector jsonb NOT NULL,
    raw jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_user_id uuid,
    session_id uuid,
    channel_vectors jsonb DEFAULT '{}'::jsonb NOT NULL,
    link_label text,
    CONSTRAINT session_embeddings_flow_kind_check CHECK ((flow_kind = 'verify'::text))
);


--
-- Name: TABLE session_embeddings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.session_embeddings IS 'Derived Path vectors. Rebuild from proof of work + field_model / raw.genModel. Do not treat as the corpus.';


--
-- Name: COLUMN session_embeddings.owner_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_embeddings.owner_user_id IS 'Owning user when known. Learning rows may stay workspace-scoped.';


--
-- Name: COLUMN session_embeddings.channel_vectors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_embeddings.channel_vectors IS 'Unit 96-d basis vectors keyed by channel (path, audio, eeg, video, screen). Mix into named spaces at read time.';


--
-- Name: COLUMN session_embeddings.link_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_embeddings.link_label IS 'Label of the public flow link used for this run. Null is the default Test link.';


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    problem text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    duration_ms integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    agent_api_key_id uuid,
    session_started_at timestamp with time zone,
    kind text DEFAULT 'verify'::text NOT NULL,
    result jsonb,
    field_model jsonb,
    verify_flow_id uuid,
    identity text,
    private_token_hash text,
    guest_user_id uuid,
    assigned_user_id uuid,
    organization_id uuid,
    public_token text,
    access_mode text,
    guest_link jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT sessions_kind_check CHECK ((kind = 'verify'::text)),
    CONSTRAINT sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'pending'::text, 'in_progress'::text, 'revoked'::text, 'archived'::text, 'ended'::text, 'expired'::text])))
);


--
-- Name: COLUMN sessions.kind; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.kind IS 'learn | calibrate | verify. One session table for Learning Maps and product flows.';


--
-- Name: COLUMN sessions.result; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.result IS 'Typed session result (Distance, sounding classification). Not a substitute for proof of work.';


--
-- Name: COLUMN sessions.field_model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.field_model IS 'Hidden-state tree used for this run. Required to retrain Path embeddings.';


--
-- Name: COLUMN sessions.guest_link; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.guest_link IS 'TAP/ILE link fields dual-written onto the unified session (duration, shell, tokens).';


--
-- Name: verify_flows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verify_flows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic text NOT NULL,
    questions jsonb DEFAULT '[]'::jsonb NOT NULL,
    public_token text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    duration_minutes integer DEFAULT 15 NOT NULL,
    action_catalog integer DEFAULT 4 NOT NULL,
    name text,
    owner_user_id uuid NOT NULL,
    archived_at timestamp with time zone,
    artifacts jsonb DEFAULT '[]'::jsonb NOT NULL,
    exact_problem_on_canvas boolean DEFAULT false NOT NULL,
    answers_model_seed jsonb,
    enforced_channels jsonb,
    opening_canvas_scene jsonb,
    generate_problem_on_open boolean DEFAULT false NOT NULL,
    canvas_capture jsonb,
    organization_id uuid,
    protocol_setting_id uuid
);


--
-- Name: COLUMN verify_flows.owner_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verify_flows.owner_user_id IS 'Owning user. New rows do not require a workspace.';


--
-- Name: COLUMN verify_flows.archived_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verify_flows.archived_at IS 'Set when the owner archives the flow. Row, token, and body remain so play copies still start.';


--
-- Name: COLUMN verify_flows.artifacts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verify_flows.artifacts IS 'xAI Files pointers linked to this flow: [{ name, mimeType, xaiFileId }].';


--
-- Name: COLUMN verify_flows.exact_problem_on_canvas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verify_flows.exact_problem_on_canvas IS 'When true, the session Work canvas opens with the flow Problem as written.';


--
-- Name: COLUMN verify_flows.answers_model_seed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verify_flows.answers_model_seed IS 'Author unsys hidden-state seed used for this Verification flow. Null generates on the fly.';


--
-- Name: COLUMN verify_flows.enforced_channels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verify_flows.enforced_channels IS 'Channels this Verification run requires: audio, muse, video, screenshots. Null means Audio on.';


--
-- Name: COLUMN verify_flows.opening_canvas_scene; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verify_flows.opening_canvas_scene IS 'Serialized Work canvas scene used as the learner opening board.';


--
-- Name: COLUMN verify_flows.generate_problem_on_open; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verify_flows.generate_problem_on_open IS 'When true, a learner open writes the Problem from attached artifacts.';


--
-- Name: COLUMN verify_flows.canvas_capture; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verify_flows.canvas_capture IS 'Optional { enabled, everyActions }. When enabled, store a mermaid document of the Work canvas every N actions. Default off. Never embedded.';


--
-- Name: COLUMN verify_flows.organization_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verify_flows.organization_id IS 'Organization the protocol was authored in. Dashboard lists by this, not owner_user_id.';


--
-- Name: COLUMN verify_flows.protocol_setting_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.verify_flows.protocol_setting_id IS 'Named protocol setting for this protocol. Null uses the organization default.';


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
-- Name: credit_ledger credit_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_ledger
    ADD CONSTRAINT credit_ledger_pkey PRIMARY KEY (id);


--
-- Name: knowledge_regions custom_verification_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_regions
    ADD CONSTRAINT custom_verification_models_pkey PRIMARY KEY (id);


--
-- Name: embedding_models embedding_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embedding_models
    ADD CONSTRAINT embedding_models_pkey PRIMARY KEY (id);


--
-- Name: flow_links flow_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flow_links
    ADD CONSTRAINT flow_links_pkey PRIMARY KEY (id);


--
-- Name: lti_context_regions lti_context_regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lti_context_regions
    ADD CONSTRAINT lti_context_regions_pkey PRIMARY KEY (platform_id, deployment_id, context_id);


--
-- Name: lti_launches lti_launches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lti_launches
    ADD CONSTRAINT lti_launches_pkey PRIMARY KEY (id);


--
-- Name: lti_oidc_state lti_oidc_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lti_oidc_state
    ADD CONSTRAINT lti_oidc_state_pkey PRIMARY KEY (state);


--
-- Name: lti_platforms lti_platforms_issuer_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lti_platforms
    ADD CONSTRAINT lti_platforms_issuer_client_id_key UNIQUE (issuer, client_id);


--
-- Name: lti_platforms lti_platforms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lti_platforms
    ADD CONSTRAINT lti_platforms_pkey PRIMARY KEY (id);


--
-- Name: lti_tool_keys lti_tool_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lti_tool_keys
    ADD CONSTRAINT lti_tool_keys_pkey PRIMARY KEY (kid);


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
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (user_id, organization_id);


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
-- Name: pending_checkouts pending_checkouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_checkouts
    ADD CONSTRAINT pending_checkouts_pkey PRIMARY KEY (id);


--
-- Name: pending_checkouts pending_checkouts_stripe_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_checkouts
    ADD CONSTRAINT pending_checkouts_stripe_session_id_key UNIQUE (stripe_session_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: protocol_settings protocol_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_settings
    ADD CONSTRAINT protocol_settings_pkey PRIMARY KEY (id);


--
-- Name: region_simulation_jobs region_simulation_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.region_simulation_jobs
    ADD CONSTRAINT region_simulation_jobs_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: proof_of_work workspace_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proof_of_work
    ADD CONSTRAINT workspace_evidence_pkey PRIMARY KEY (id);


--
-- Name: session_embeddings workspace_flow_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_embeddings
    ADD CONSTRAINT workspace_flow_embeddings_pkey PRIMARY KEY (id);


--
-- Name: verify_flows workspace_verification_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verify_flows
    ADD CONSTRAINT workspace_verification_flows_pkey PRIMARY KEY (id);


--
-- Name: verify_flows workspace_verification_flows_public_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verify_flows
    ADD CONSTRAINT workspace_verification_flows_public_token_key UNIQUE (public_token);


--
-- Name: credit_ledger_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX credit_ledger_user_id_created_at_idx ON public.credit_ledger USING btree (user_id, created_at DESC);


--
-- Name: credit_ledger_user_reason_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX credit_ledger_user_reason_unique ON public.credit_ledger USING btree (user_id, reason) WHERE ((reason = ANY (ARRAY['signup_starter'::text, 'guest_starter'::text])) OR (reason ~~ 'credit_pack:%'::text));


--
-- Name: flow_links_flow_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flow_links_flow_idx ON public.flow_links USING btree (owner_user_id, flow_kind, flow_id);


--
-- Name: flow_links_public_token_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX flow_links_public_token_uidx ON public.flow_links USING btree (public_token);


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
-- Name: idx_custom_verification_models_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_verification_models_owner ON public.knowledge_regions USING btree (owner_user_id, created_at DESC);


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
-- Name: idx_organizations_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_archived_at ON public.organizations USING btree (archived_at) WHERE (archived_at IS NULL);


--
-- Name: idx_organizations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_created_at ON public.organizations USING btree (created_at DESC);


--
-- Name: idx_organizations_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_plan ON public.organizations USING btree (plan, subscription_status);


--
-- Name: idx_organizations_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_slug ON public.organizations USING btree (slug);


--
-- Name: idx_pending_checkouts_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_checkouts_customer ON public.pending_checkouts USING btree (stripe_customer_id) WHERE (claimed_at IS NULL);


--
-- Name: idx_pending_checkouts_email_unclaimed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_checkouts_email_unclaimed ON public.pending_checkouts USING btree (lower(email)) WHERE (claimed_at IS NULL);


--
-- Name: idx_profiles_org_admins; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_org_admins ON public.profiles USING btree (organization_id) WHERE (is_org_admin = true);


--
-- Name: idx_profiles_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_organization_id ON public.profiles USING btree (organization_id);


--
-- Name: idx_profiles_token_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_token_expiry ON public.profiles USING btree (token_validity_expires_at);


--
-- Name: idx_profiles_token_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_token_tier ON public.profiles USING btree (token_tier);


--
-- Name: idx_session_embeddings_owner_flow; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_embeddings_owner_flow ON public.session_embeddings USING btree (owner_user_id, flow_kind, flow_id);


--
-- Name: idx_session_embeddings_owner_run_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_session_embeddings_owner_run_uidx ON public.session_embeddings USING btree (owner_user_id, run_id) WHERE ((owner_user_id IS NOT NULL) AND (run_id IS NOT NULL) AND (run_id <> ''::text));


--
-- Name: idx_sessions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_created_at ON public.sessions USING btree (created_at DESC);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: idx_workspace_flow_embeddings_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_flow_embeddings_owner ON public.session_embeddings USING btree (owner_user_id, created_at DESC);


--
-- Name: idx_workspace_pow_pow_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_pow_pow_source ON public.proof_of_work USING btree (((metadata ->> 'pow_source'::text))) WHERE (metadata ? 'pow_source'::text);


--
-- Name: idx_workspace_pow_source_link_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_pow_source_link_id ON public.proof_of_work USING btree (((metadata ->> 'source_link_id'::text))) WHERE (metadata ? 'source_link_id'::text);


--
-- Name: idx_workspace_pow_source_link_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_pow_source_link_kind ON public.proof_of_work USING btree (((metadata ->> 'source_link_kind'::text))) WHERE (metadata ? 'source_link_kind'::text);


--
-- Name: idx_workspace_pow_tapbench; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_pow_tapbench ON public.proof_of_work USING btree (((metadata ->> 'tapbench'::text))) WHERE (metadata ? 'tapbench'::text);


--
-- Name: idx_workspace_proof_of_work_guest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_proof_of_work_guest ON public.proof_of_work USING btree (guest_user_id, created_at DESC) WHERE (guest_user_id IS NOT NULL);


--
-- Name: idx_workspace_proof_of_work_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_proof_of_work_session ON public.proof_of_work USING btree (session_id, created_at DESC) WHERE (session_id IS NOT NULL);


--
-- Name: idx_workspace_verification_flows_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_verification_flows_owner ON public.verify_flows USING btree (owner_user_id, created_at DESC);


--
-- Name: knowledge_regions_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_regions_organization_id_idx ON public.knowledge_regions USING btree (organization_id);


--
-- Name: lti_launches_platform_sub_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lti_launches_platform_sub_idx ON public.lti_launches USING btree (platform_id, sub, created_at DESC);


--
-- Name: lti_oidc_state_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lti_oidc_state_expires_at_idx ON public.lti_oidc_state USING btree (expires_at);


--
-- Name: lti_platforms_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lti_platforms_organization_id_idx ON public.lti_platforms USING btree (organization_id);


--
-- Name: org_guest_users_org_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX org_guest_users_org_email_unique ON public.organization_guest_users USING btree (organization_id, email) WHERE (organization_id IS NOT NULL);


--
-- Name: organization_invites_token_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organization_invites_token_hash_key ON public.organization_invites USING btree (token_hash) WHERE (token_hash IS NOT NULL);


--
-- Name: organization_members_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organization_members_organization_id_idx ON public.organization_members USING btree (organization_id);


--
-- Name: organizations_workos_organization_id_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organizations_workos_organization_id_uidx ON public.organizations USING btree (workos_organization_id) WHERE (workos_organization_id IS NOT NULL);


--
-- Name: profiles_workos_user_id_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_workos_user_id_uidx ON public.profiles USING btree (workos_user_id) WHERE (workos_user_id IS NOT NULL);


--
-- Name: protocol_settings_org_default_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX protocol_settings_org_default_uidx ON public.protocol_settings USING btree (organization_id) WHERE is_default;


--
-- Name: protocol_settings_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX protocol_settings_org_idx ON public.protocol_settings USING btree (organization_id, created_at DESC);


--
-- Name: protocol_settings_org_name_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX protocol_settings_org_name_uidx ON public.protocol_settings USING btree (organization_id, lower(name));


--
-- Name: region_simulation_jobs_lease_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX region_simulation_jobs_lease_idx ON public.region_simulation_jobs USING btree (lease_until);


--
-- Name: region_simulation_jobs_owner_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX region_simulation_jobs_owner_status_idx ON public.region_simulation_jobs USING btree (owner_user_id, status, created_at DESC);


--
-- Name: sessions_private_token_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sessions_private_token_hash_key ON public.sessions USING btree (private_token_hash) WHERE (private_token_hash IS NOT NULL);


--
-- Name: sessions_public_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sessions_public_token_key ON public.sessions USING btree (public_token) WHERE (public_token IS NOT NULL);


--
-- Name: verify_flows_organization_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verify_flows_organization_id_idx ON public.verify_flows USING btree (organization_id);


--
-- Name: verify_flows_owner_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verify_flows_owner_active_idx ON public.verify_flows USING btree (owner_user_id, created_at DESC) WHERE (archived_at IS NULL);


--
-- Name: verify_flows_protocol_setting_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verify_flows_protocol_setting_id_idx ON public.verify_flows USING btree (protocol_setting_id);


--
-- Name: profiles trg_prevent_privileged_profile_escalation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_privileged_profile_escalation BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_privileged_profile_escalation();


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
-- Name: credit_ledger credit_ledger_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_ledger
    ADD CONSTRAINT credit_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_regions custom_verification_models_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_regions
    ADD CONSTRAINT custom_verification_models_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_regions custom_verification_models_family_embedding_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_regions
    ADD CONSTRAINT custom_verification_models_family_embedding_model_id_fkey FOREIGN KEY (family_embedding_model_id) REFERENCES public.embedding_models(id);


--
-- Name: knowledge_regions custom_verification_models_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_regions
    ADD CONSTRAINT custom_verification_models_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_regions custom_verification_models_verify_flow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_regions
    ADD CONSTRAINT custom_verification_models_verify_flow_id_fkey FOREIGN KEY (verify_flow_id) REFERENCES public.verify_flows(id) ON DELETE SET NULL;


--
-- Name: flow_links flow_links_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flow_links
    ADD CONSTRAINT flow_links_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_regions knowledge_regions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_regions
    ADD CONSTRAINT knowledge_regions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: lti_context_regions lti_context_regions_platform_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lti_context_regions
    ADD CONSTRAINT lti_context_regions_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.lti_platforms(id) ON DELETE CASCADE;


--
-- Name: lti_launches lti_launches_platform_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lti_launches
    ADD CONSTRAINT lti_launches_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.lti_platforms(id) ON DELETE CASCADE;


--
-- Name: lti_oidc_state lti_oidc_state_platform_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lti_oidc_state
    ADD CONSTRAINT lti_oidc_state_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.lti_platforms(id) ON DELETE CASCADE;


--
-- Name: lti_platforms lti_platforms_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lti_platforms
    ADD CONSTRAINT lti_platforms_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


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
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: pending_checkouts pending_checkouts_claimed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_checkouts
    ADD CONSTRAINT pending_checkouts_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


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
-- Name: protocol_settings protocol_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protocol_settings
    ADD CONSTRAINT protocol_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: region_simulation_jobs region_simulation_jobs_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.region_simulation_jobs
    ADD CONSTRAINT region_simulation_jobs_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


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
-- Name: sessions sessions_verify_flow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_verify_flow_id_fkey FOREIGN KEY (verify_flow_id) REFERENCES public.verify_flows(id) ON DELETE SET NULL;


--
-- Name: verify_flows verify_flows_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verify_flows
    ADD CONSTRAINT verify_flows_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: verify_flows verify_flows_protocol_setting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verify_flows
    ADD CONSTRAINT verify_flows_protocol_setting_id_fkey FOREIGN KEY (protocol_setting_id) REFERENCES public.protocol_settings(id) ON DELETE SET NULL;


--
-- Name: proof_of_work workspace_evidence_created_by_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proof_of_work
    ADD CONSTRAINT workspace_evidence_created_by_api_key_id_fkey FOREIGN KEY (created_by_api_key_id) REFERENCES public.agent_api_keys(id) ON DELETE SET NULL;


--
-- Name: proof_of_work workspace_evidence_guest_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proof_of_work
    ADD CONSTRAINT workspace_evidence_guest_user_id_fkey FOREIGN KEY (guest_user_id) REFERENCES public.organization_guest_users(id) ON DELETE SET NULL;


--
-- Name: proof_of_work workspace_evidence_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proof_of_work
    ADD CONSTRAINT workspace_evidence_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: proof_of_work workspace_evidence_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proof_of_work
    ADD CONSTRAINT workspace_evidence_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- Name: proof_of_work workspace_evidence_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proof_of_work
    ADD CONSTRAINT workspace_evidence_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: session_embeddings workspace_flow_embeddings_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_embeddings
    ADD CONSTRAINT workspace_flow_embeddings_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session_embeddings workspace_flow_embeddings_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_embeddings
    ADD CONSTRAINT workspace_flow_embeddings_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- Name: proof_of_work workspace_proof_of_work_verify_flow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proof_of_work
    ADD CONSTRAINT workspace_proof_of_work_verify_flow_id_fkey FOREIGN KEY (verify_flow_id) REFERENCES public.verify_flows(id) ON DELETE SET NULL;


--
-- Name: verify_flows workspace_verification_flows_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verify_flows
    ADD CONSTRAINT workspace_verification_flows_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin_user());


--
-- Name: organizations Members can view organizations they belong to; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view organizations they belong to" ON public.organizations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.organization_id = organizations.id)))));


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
-- Name: lti_platforms Org admins write LTI platforms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins write LTI platforms" ON public.lti_platforms USING ((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_org_admin = true))))) WITH CHECK ((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_org_admin = true)))));


--
-- Name: protocol_settings Org members can read protocol settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can read protocol settings" ON public.protocol_settings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.organization_members m
  WHERE ((m.organization_id = protocol_settings.organization_id) AND (m.user_id = auth.uid())))));


--
-- Name: lti_context_regions Org members read LTI context regions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members read LTI context regions" ON public.lti_context_regions FOR SELECT USING ((platform_id IN ( SELECT lti_platforms.id
   FROM public.lti_platforms
  WHERE (lti_platforms.organization_id IN ( SELECT profiles.organization_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))));


--
-- Name: lti_platforms Org members read LTI platforms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members read LTI platforms" ON public.lti_platforms FOR SELECT USING ((organization_id IN ( SELECT profiles.organization_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: flow_links Owners can manage flow links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage flow links" ON public.flow_links USING ((auth.uid() = owner_user_id)) WITH CHECK ((auth.uid() = owner_user_id));


--
-- Name: region_simulation_jobs Owners can manage region simulation jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage region simulation jobs" ON public.region_simulation_jobs USING ((auth.uid() = owner_user_id)) WITH CHECK ((auth.uid() = owner_user_id));


--
-- Name: session_embeddings Owners can view flow embeddings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view flow embeddings" ON public.session_embeddings FOR SELECT USING (((auth.uid() IS NOT NULL) AND (owner_user_id = auth.uid())));


--
-- Name: verify_flows Owners can view verification flows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view verification flows" ON public.verify_flows FOR SELECT USING (((auth.uid() IS NOT NULL) AND (owner_user_id = auth.uid())));


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
-- Name: organization_members Platform admins can view all memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all memberships" ON public.organization_members FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: organizations Platform admins can view all organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Platform admins can view all organizations" ON public.organizations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: sessions Users can create own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own sessions" ON public.sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: agent_api_keys Users can delete own agent api keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own agent api keys" ON public.agent_api_keys FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: sessions Users can delete own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own sessions" ON public.sessions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: proof_of_work Users can insert own proof of work; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own proof of work" ON public.proof_of_work FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = proof_of_work.session_id) AND (s.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.verify_flows vf
  WHERE ((vf.id = proof_of_work.verify_flow_id) AND (vf.owner_user_id = auth.uid())))))));


--
-- Name: credit_ledger Users can read own credit ledger; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own credit ledger" ON public.credit_ledger FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: proof_of_work Users can read own proof of work; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own proof of work" ON public.proof_of_work FOR SELECT USING (((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = proof_of_work.session_id) AND (s.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.verify_flows vf
  WHERE ((vf.id = proof_of_work.verify_flow_id) AND (vf.owner_user_id = auth.uid())))))));


--
-- Name: profiles Users can read own token tier; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own token tier" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: proof_of_work Users can update own proof of work; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own proof of work" ON public.proof_of_work FOR UPDATE USING (((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = proof_of_work.session_id) AND (s.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.verify_flows vf
  WHERE ((vf.id = proof_of_work.verify_flow_id) AND (vf.owner_user_id = auth.uid()))))))) WITH CHECK (((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = proof_of_work.session_id) AND (s.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.verify_flows vf
  WHERE ((vf.id = proof_of_work.verify_flow_id) AND (vf.owner_user_id = auth.uid())))))));


--
-- Name: sessions Users can update own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own sessions" ON public.sessions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: agent_api_keys Users can view own agent api keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own agent api keys" ON public.agent_api_keys FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: organization_members Users can view own memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own memberships" ON public.organization_members FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: sessions Users can view own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own sessions" ON public.sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: knowledge_regions Workspace owners manage custom verification models; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Workspace owners manage custom verification models" ON public.knowledge_regions USING (((auth.uid() IS NOT NULL) AND (owner_user_id = auth.uid()))) WITH CHECK (((auth.uid() IS NOT NULL) AND (owner_user_id = auth.uid())));


--
-- Name: agent_api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.flow_links ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_regions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_regions ENABLE ROW LEVEL SECURITY;

--
-- Name: lti_context_regions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lti_context_regions ENABLE ROW LEVEL SECURITY;

--
-- Name: lti_launches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lti_launches ENABLE ROW LEVEL SECURITY;

--
-- Name: lti_oidc_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lti_oidc_state ENABLE ROW LEVEL SECURITY;

--
-- Name: lti_platforms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lti_platforms ENABLE ROW LEVEL SECURITY;

--
-- Name: lti_tool_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lti_tool_keys ENABLE ROW LEVEL SECURITY;

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
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: pending_checkouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pending_checkouts ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: proof_of_work; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proof_of_work ENABLE ROW LEVEL SECURITY;

--
-- Name: protocol_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.protocol_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: region_simulation_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.region_simulation_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: session_embeddings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_embeddings ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: verify_flows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verify_flows ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



-- ----------------------------------------------------------------------------
-- Auth signup trigger (creates public.profiles row on new auth.users signup)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Seed required embedding model registry row
-- ----------------------------------------------------------------------------
INSERT INTO public.embedding_models (id, family, version, algorithm_id, dim)
VALUES ('verify-flowcfg-v1-d96', 'verify', 'v1', 'flowcfg-v1-d96', 96)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Supabase Storage buckets & RLS policies (org-logos, org-aesthetics)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('org-logos', 'org-logos', true),
  ('org-aesthetics', 'org-aesthetics', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view org logos" ON storage.objects;
CREATE POLICY "Anyone can view org logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-logos');

DROP POLICY IF EXISTS "Authenticated users can upload org logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload org logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-logos');

DROP POLICY IF EXISTS "Authenticated users can update org logos" ON storage.objects;
CREATE POLICY "Authenticated users can update org logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'org-logos');

DROP POLICY IF EXISTS "Authenticated users can delete org logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete org logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'org-logos');

DROP POLICY IF EXISTS "Anyone can view org aesthetics" ON storage.objects;
CREATE POLICY "Anyone can view org aesthetics"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-aesthetics');

DROP POLICY IF EXISTS "Authenticated users can upload org aesthetics" ON storage.objects;
CREATE POLICY "Authenticated users can upload org aesthetics"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-aesthetics');

DROP POLICY IF EXISTS "Authenticated users can update org aesthetics" ON storage.objects;
CREATE POLICY "Authenticated users can update org aesthetics"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'org-aesthetics');

DROP POLICY IF EXISTS "Authenticated users can delete org aesthetics" ON storage.objects;
CREATE POLICY "Authenticated users can delete org aesthetics"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'org-aesthetics');

-- Restore standard search_path for callers sharing this session
SET search_path TO public, extensions;

-- ----------------------------------------------------------------------------
-- Migration tracking table (used by scripts/apply-migrations.mjs)
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  inserted_at timestamptz NOT NULL DEFAULT now()
);
