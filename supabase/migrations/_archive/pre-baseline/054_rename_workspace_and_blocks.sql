-- Rename learning_plans → workspaces, plan_nodes → blocks, and related tables/columns.
-- Sessions remain unchanged.

-- =============================================================================
-- 1. Table renames
-- =============================================================================
ALTER TABLE IF EXISTS public.learning_plans RENAME TO workspaces;
ALTER TABLE IF EXISTS public.plan_nodes RENAME TO blocks;
ALTER TABLE IF EXISTS public.plan_node_sessions RENAME TO block_sessions;
ALTER TABLE IF EXISTS public.plan_files RENAME TO workspace_files;

-- =============================================================================
-- 2. Column renames on core tables
-- =============================================================================
ALTER TABLE public.workspaces RENAME COLUMN original_plan_id TO original_workspace_id;
ALTER TABLE public.workspaces RENAME COLUMN is_agent_session TO is_agent_workspace;

ALTER TABLE public.blocks RENAME COLUMN plan_id TO workspace_id;
ALTER TABLE public.blocks RENAME COLUMN next_node_ids TO next_block_ids;

ALTER TABLE public.block_sessions RENAME COLUMN plan_node_id TO block_id;
ALTER TABLE public.block_sessions RENAME COLUMN plan_id TO workspace_id;

ALTER TABLE public.workspace_files RENAME COLUMN plan_id TO workspace_id;

-- =============================================================================
-- 3. Column renames on dependent tables
-- =============================================================================
ALTER TABLE public.workspace_ghc_sessions RENAME COLUMN plan_id TO workspace_id;
ALTER TABLE public.workspace_ghc_sessions RENAME COLUMN plan_node_id TO block_id;

ALTER TABLE public.workspace_proof_of_work RENAME COLUMN plan_id TO workspace_id;
ALTER TABLE public.workspace_proof_of_work RENAME COLUMN plan_node_id TO block_id;

ALTER TABLE public.workspace_teach_backs RENAME COLUMN plan_id TO workspace_id;

ALTER TABLE public.insights RENAME COLUMN plan_id TO workspace_id;
ALTER TABLE public.insights RENAME COLUMN plan_node_id TO block_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agent_proofs' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE public.agent_proofs RENAME COLUMN plan_id TO workspace_id;
  END IF;
END $$;

-- =============================================================================
-- 4. Index renames (cosmetic / clarity)
-- =============================================================================
ALTER INDEX IF EXISTS idx_learning_plans_organization_id RENAME TO idx_workspaces_organization_id;
ALTER INDEX IF EXISTS idx_learning_plans_guest_user_id RENAME TO idx_workspaces_guest_user_id;
ALTER INDEX IF EXISTS idx_learning_plans_status_active RENAME TO idx_workspaces_status_active;
ALTER INDEX IF EXISTS idx_plan_files_plan_id RENAME TO idx_workspace_files_workspace_id;
ALTER INDEX IF EXISTS idx_plan_files_user_id RENAME TO idx_workspace_files_user_id;
ALTER INDEX IF EXISTS idx_plan_files_xai_file_id RENAME TO idx_workspace_files_xai_file_id;
ALTER INDEX IF EXISTS idx_pns_plan_id RENAME TO idx_block_sessions_workspace_id;
ALTER INDEX IF EXISTS idx_pns_user_id RENAME TO idx_block_sessions_user_id;
ALTER INDEX IF EXISTS idx_pns_plan_node_id RENAME TO idx_block_sessions_block_id;
ALTER INDEX IF EXISTS idx_workspace_proof_of_work_plan RENAME TO idx_workspace_proof_of_work_workspace;
ALTER INDEX IF EXISTS insights_plan_id_idx RENAME TO insights_workspace_id_idx;
ALTER INDEX IF EXISTS workspace_ghc_sessions_plan_node_idx RENAME TO workspace_ghc_sessions_block_idx;

-- =============================================================================
-- 5. RLS policies — drop legacy-named policies and recreate on renamed tables
-- =============================================================================

-- workspaces (formerly learning_plans)
DROP POLICY IF EXISTS "Users can view own plans" ON public.workspaces;
DROP POLICY IF EXISTS "Users can update own plans" ON public.workspaces;
DROP POLICY IF EXISTS "Anyone can view public learning plans" ON public.workspaces;
DROP POLICY IF EXISTS "Anyone can view group learning plans" ON public.workspaces;

CREATE POLICY "Users can view own workspaces" ON public.workspaces
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own workspaces" ON public.workspaces
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Anyone can view public workspaces" ON public.workspaces
  FOR SELECT USING (is_public = true);

CREATE POLICY "Anyone can view group workspaces" ON public.workspaces
  FOR SELECT USING (is_group = true);

-- blocks (formerly plan_nodes)
DROP POLICY IF EXISTS "Users can view own plan nodes" ON public.blocks;
DROP POLICY IF EXISTS "Users can view plan nodes" ON public.blocks;
DROP POLICY IF EXISTS "Users can insert plan nodes" ON public.blocks;
DROP POLICY IF EXISTS "Users can update plan nodes" ON public.blocks;
DROP POLICY IF EXISTS "Users can delete plan nodes" ON public.blocks;

CREATE POLICY "Users can view blocks" ON public.blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = blocks.workspace_id
        AND (w.user_id = auth.uid() OR w.is_public = true OR w.is_group = true)
    )
  );

CREATE POLICY "Users can insert blocks" ON public.blocks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = blocks.workspace_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update blocks" ON public.blocks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = blocks.workspace_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete blocks" ON public.blocks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = blocks.workspace_id AND w.user_id = auth.uid()
    )
  );

-- block_sessions (formerly plan_node_sessions)
DROP POLICY IF EXISTS "Users can view plan_node_sessions" ON public.block_sessions;
DROP POLICY IF EXISTS "Users can create plan_node_sessions" ON public.block_sessions;

CREATE POLICY "Users can view block_sessions" ON public.block_sessions
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = block_sessions.workspace_id
        AND (w.user_id = auth.uid() OR w.is_group = true)
    )
  );

CREATE POLICY "Users can create block_sessions" ON public.block_sessions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = block_sessions.workspace_id
        AND (w.user_id = auth.uid() OR w.is_group = true)
    )
  );

-- workspace_files (formerly plan_files)
DROP POLICY IF EXISTS "Users can read own plan files" ON public.workspace_files;
DROP POLICY IF EXISTS "Anyone can read public plan files" ON public.workspace_files;
DROP POLICY IF EXISTS "Users can insert own plan files" ON public.workspace_files;
DROP POLICY IF EXISTS "Users can delete own plan files" ON public.workspace_files;

CREATE POLICY "Users can read own workspace files" ON public.workspace_files
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Anyone can read public workspace files" ON public.workspace_files
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_files.workspace_id AND w.is_public = true
    )
  );

CREATE POLICY "Users can insert own workspace files" ON public.workspace_files
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own workspace files" ON public.workspace_files
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- workspace_proof_of_work policies referencing learning_plans
DROP POLICY IF EXISTS "Workspace owners can read evidence" ON public.workspace_proof_of_work;
CREATE POLICY "Workspace owners can read evidence" ON public.workspace_proof_of_work
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_proof_of_work.workspace_id AND w.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workspace owners can insert evidence" ON public.workspace_proof_of_work;
CREATE POLICY "Workspace owners can insert evidence" ON public.workspace_proof_of_work
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_proof_of_work.workspace_id AND w.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 6. Analytics / group RPCs — new names, drop legacy
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_personal_plan_analytics(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_org_plan_analytics(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_group_plan_sessions(UUID);

CREATE OR REPLACE FUNCTION public.get_personal_workspace_analytics(target_workspace_id UUID, requesting_user_id UUID)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_org_workspace_analytics(target_workspace_id UUID, requesting_user_id UUID)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_group_workspace_sessions(p_workspace_id UUID)
RETURNS TABLE (
  session_id    UUID,
  user_id       UUID,
  username      TEXT,
  problem       TEXT,
  status        TEXT,
  duration_ms   INTEGER,
  report        TEXT,
  created_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  block_id      UUID,
  block_title   TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
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

GRANT EXECUTE ON FUNCTION public.get_personal_workspace_analytics(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_workspace_analytics(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_workspace_sessions(UUID) TO authenticated;