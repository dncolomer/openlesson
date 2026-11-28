-- ============================================================================
-- Uncertain Systems — Forward Migration: Verification-Only Schema Cleanup
-- ============================================================================
-- Run this migration on EXISTING environments (staging first, then production)
-- AFTER taking a pg_dump backup and BEFORE marking the squashed baseline
-- (supabase/migrations/20261128120000_baseline.sql) as applied.
--
-- Drops all unused legacy non-verification schema objects:
--   - Tables:    public.blocks, public.workspaces
--   - Columns:   workspace_id (verify_flows, knowledge_regions,
--                session_embeddings, sessions, proof_of_work,
--                organization_guest_users),
--                block_id (sessions, proof_of_work),
--                chapter_map, probes, planning_prompt (sessions)
--   - Functions: match_transcript_chunks, get_group_workspace_sessions,
--                get_org_workspace_analytics, get_personal_workspace_analytics,
--                prevent_privilege_escalation, generate_invite_token,
--                get_organization_by_invite_token, remove_organization_member
--   - Extension: vector (pgvector — only referenced by match_transcript_chunks)
--   - RLS:       Replaces workspace-based policies on proof_of_work and
--                session_embeddings with owner/session/protocol-scoped policies.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Replace RLS policies on kept tables that referenced public.workspaces
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Workspace owners can read evidence" ON public.proof_of_work;
DROP POLICY IF EXISTS "Workspace owners can insert evidence" ON public.proof_of_work;
DROP POLICY IF EXISTS "Workspace owners can update evidence" ON public.proof_of_work;

DROP POLICY IF EXISTS "Users can read own proof of work" ON public.proof_of_work;
CREATE POLICY "Users can read own proof of work"
  ON public.proof_of_work
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.sessions s
        WHERE s.id = proof_of_work.session_id
          AND s.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.verify_flows vf
        WHERE vf.id = proof_of_work.verify_flow_id
          AND vf.owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own proof of work" ON public.proof_of_work;
CREATE POLICY "Users can insert own proof of work"
  ON public.proof_of_work
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.sessions s
        WHERE s.id = proof_of_work.session_id
          AND s.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.verify_flows vf
        WHERE vf.id = proof_of_work.verify_flow_id
          AND vf.owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own proof of work" ON public.proof_of_work;
CREATE POLICY "Users can update own proof of work"
  ON public.proof_of_work
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.sessions s
        WHERE s.id = proof_of_work.session_id
          AND s.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.verify_flows vf
        WHERE vf.id = proof_of_work.verify_flow_id
          AND vf.owner_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.sessions s
        WHERE s.id = proof_of_work.session_id
          AND s.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.verify_flows vf
        WHERE vf.id = proof_of_work.verify_flow_id
          AND vf.owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Owners can view flow embeddings" ON public.session_embeddings;
CREATE POLICY "Owners can view flow embeddings"
  ON public.session_embeddings
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND owner_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. Drop legacy workspace_id / block_id FKs, indexes, and unused columns
-- ----------------------------------------------------------------------------

-- verify_flows
DROP INDEX IF EXISTS public.verify_flows_workspace_id_idx;
ALTER TABLE public.verify_flows
  DROP CONSTRAINT IF EXISTS verify_flows_workspace_id_fkey,
  DROP COLUMN IF EXISTS workspace_id;

-- knowledge_regions
DROP INDEX IF EXISTS public.custom_verification_models_workspace_idx;
DROP INDEX IF EXISTS public.custom_verification_models_workspace_name_uidx;
ALTER TABLE public.knowledge_regions
  DROP CONSTRAINT IF EXISTS custom_verification_models_workspace_id_fkey,
  DROP COLUMN IF EXISTS workspace_id,
  ALTER COLUMN embedding_model_id SET DEFAULT 'flowcfg-v1-d96'::text,
  ALTER COLUMN dim SET DEFAULT 96;

-- session_embeddings
DELETE FROM public.session_embeddings WHERE flow_kind <> 'verify';
DROP INDEX IF EXISTS public.idx_workspace_flow_embeddings_flow;
DROP INDEX IF EXISTS public.idx_workspace_flow_embeddings_workspace;
ALTER TABLE public.session_embeddings
  DROP CONSTRAINT IF EXISTS workspace_flow_embeddings_workspace_id_fkey,
  DROP CONSTRAINT IF EXISTS session_embeddings_flow_kind_check,
  DROP COLUMN IF EXISTS workspace_id;
ALTER TABLE public.session_embeddings
  ADD CONSTRAINT session_embeddings_flow_kind_check CHECK (flow_kind = 'verify'::text);
CREATE INDEX IF NOT EXISTS idx_session_embeddings_owner_flow
  ON public.session_embeddings USING btree (owner_user_id, flow_kind, flow_id);

-- sessions
DELETE FROM public.sessions WHERE kind <> 'verify';
DROP INDEX IF EXISTS public.sessions_block_id_idx;
DROP INDEX IF EXISTS public.sessions_kind_workspace_idx;
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_block_id_fkey,
  DROP CONSTRAINT IF EXISTS sessions_workspace_id_fkey,
  DROP CONSTRAINT IF EXISTS sessions_kind_check,
  DROP COLUMN IF EXISTS block_id,
  DROP COLUMN IF EXISTS workspace_id,
  DROP COLUMN IF EXISTS chapter_map,
  DROP COLUMN IF EXISTS probes,
  DROP COLUMN IF EXISTS planning_prompt,
  ALTER COLUMN kind SET DEFAULT 'verify'::text,
  ALTER COLUMN status SET DEFAULT 'active'::text;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_kind_check CHECK (kind = 'verify'::text);

-- proof_of_work
DROP INDEX IF EXISTS public.idx_workspace_proof_of_work_block;
DROP INDEX IF EXISTS public.idx_workspace_proof_of_work_workspace;
ALTER TABLE public.proof_of_work
  DROP CONSTRAINT IF EXISTS workspace_evidence_plan_node_id_fkey,
  DROP CONSTRAINT IF EXISTS workspace_evidence_plan_id_fkey,
  DROP COLUMN IF EXISTS block_id,
  DROP COLUMN IF EXISTS workspace_id;

-- organization_guest_users
DROP INDEX IF EXISTS public.idx_org_guest_users_workspace;
DROP INDEX IF EXISTS public.org_guest_users_workspace_email_unique;
ALTER TABLE public.organization_guest_users
  DROP CONSTRAINT IF EXISTS organization_guest_users_workspace_id_fkey,
  DROP COLUMN IF EXISTS workspace_id;

-- ----------------------------------------------------------------------------
-- 3. Drop legacy tables (blocks, workspaces)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.blocks CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;

-- ----------------------------------------------------------------------------
-- 4. Drop unused legacy functions and pgvector extension
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_group_workspace_sessions(uuid);
DROP FUNCTION IF EXISTS public.get_org_workspace_analytics(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_personal_workspace_analytics(uuid, uuid);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'vector'
  ) THEN
    EXECUTE 'DROP FUNCTION IF EXISTS public.match_transcript_chunks(public.vector, uuid, uuid, integer)';
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.prevent_privilege_escalation();
DROP FUNCTION IF EXISTS public.generate_invite_token();
DROP FUNCTION IF EXISTS public.get_organization_by_invite_token(text);
DROP FUNCTION IF EXISTS public.remove_organization_member(uuid, uuid);

DROP EXTENSION IF EXISTS vector;

COMMIT;
