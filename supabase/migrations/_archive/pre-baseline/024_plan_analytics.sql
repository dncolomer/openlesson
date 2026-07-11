-- Plan analytics: personal stats for any plan owner, org-wide stats for org admins
-- Uses SECURITY DEFINER to bypass RLS for cross-user aggregation within an org

-- Personal plan analytics (own sessions on plan nodes)
CREATE OR REPLACE FUNCTION get_personal_plan_analytics(target_plan_id UUID, requesting_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_sessions', COALESCE(COUNT(DISTINCT s.id), 0),
    'completed_sessions', COALESCE(COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('completed', 'ended_by_tutor')), 0),
    'total_nodes', (SELECT COUNT(*) FROM plan_nodes WHERE plan_id = target_plan_id),
    'completed_nodes', (SELECT COUNT(*) FROM plan_nodes WHERE plan_id = target_plan_id AND status = 'completed'),
    'avg_duration_minutes', COALESCE(ROUND(AVG(s.duration_ms) / 60000.0, 1), 0),
    'total_duration_minutes', COALESCE(ROUND(SUM(s.duration_ms) / 60000.0, 1), 0),
    'avg_gap_score', COALESCE(ROUND(AVG(
      (SELECT AVG((p2.metadata->>'gapScore')::numeric) 
       FROM probes p2 
       WHERE p2.session_id = s.id AND p2.metadata->>'gapScore' IS NOT NULL)
    ), 2), 0),
    'sessions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s2.id,
        'problem', s2.problem,
        'status', s2.status,
        'started_at', s2.started_at,
        'duration_minutes', ROUND(s2.duration_ms / 60000.0, 1),
        'node_title', pn2.title
      ) ORDER BY s2.started_at DESC)
      FROM sessions s2
      JOIN plan_nodes pn2 ON pn2.session_id = s2.id AND pn2.plan_id = target_plan_id
      WHERE s2.user_id = requesting_user_id
    ), '[]'::jsonb)
  ) INTO result
  FROM plan_nodes pn
  JOIN sessions s ON s.id = pn.session_id AND s.user_id = requesting_user_id
  WHERE pn.plan_id = target_plan_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Org-wide plan analytics (all org members' sessions on a plan)
-- Only callable by org admins
CREATE OR REPLACE FUNCTION get_org_plan_analytics(target_plan_id UUID, requesting_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  requester RECORD;
  result JSONB;
BEGIN
  -- Verify requester is org admin or platform admin
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
      (SELECT AVG((p2.metadata->>'gapScore')::numeric) 
       FROM probes p2 
       WHERE p2.session_id = s.id AND p2.metadata->>'gapScore' IS NOT NULL)
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
        JOIN plan_nodes pn3 ON pn3.session_id = s3.id AND pn3.plan_id = target_plan_id
        JOIN profiles p3 ON p3.id = s3.user_id 
          AND p3.organization_id = requester.organization_id
        GROUP BY s3.user_id
      ) member_stats
      JOIN profiles p ON p.id = member_stats.user_id
    ), '[]'::jsonb)
  ) INTO result
  FROM plan_nodes pn
  JOIN sessions s ON s.id = pn.session_id
  JOIN profiles p ON p.id = s.user_id 
    AND (requester.is_admin = true OR p.organization_id = requester.organization_id)
  WHERE pn.plan_id = target_plan_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
