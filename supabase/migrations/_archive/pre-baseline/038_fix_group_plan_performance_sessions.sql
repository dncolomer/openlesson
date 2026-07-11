-- Fix group-plan performance lookups to include all session link paths.
-- Existing data can be linked either through plan_node_sessions or directly on
-- plan_nodes.session_id, and org admins should not trip the owner-only RPC path.

CREATE OR REPLACE FUNCTION get_group_plan_sessions(p_plan_id UUID)
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
  node_id       UUID,
  node_title    TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  requester profiles%ROWTYPE;
  is_plan_owner BOOLEAN;
BEGIN
  SELECT * INTO requester
  FROM profiles
  WHERE id = auth.uid();

  SELECT EXISTS (
    SELECT 1
    FROM learning_plans
    WHERE id = p_plan_id AND user_id = auth.uid()
  ) INTO is_plan_owner;

  IF requester.id IS NULL OR NOT (
    is_plan_owner
    OR requester.is_admin = true
    OR (requester.is_org_admin = true AND requester.organization_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH linked_sessions AS (
    SELECT
      pns.session_id,
      pns.user_id,
      pns.plan_node_id AS node_id
    FROM plan_node_sessions pns
    WHERE pns.plan_id = p_plan_id

    UNION

    SELECT
      pn.session_id,
      s.user_id,
      pn.id AS node_id
    FROM plan_nodes pn
    JOIN sessions s ON s.id = pn.session_id
    WHERE pn.plan_id = p_plan_id
      AND pn.session_id IS NOT NULL
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
    ls.node_id AS node_id,
    pn.title AS node_title
  FROM linked_sessions ls
  JOIN sessions s ON s.id = ls.session_id
  JOIN profiles p ON p.id = s.user_id
  JOIN plan_nodes pn ON pn.id = ls.node_id
  WHERE is_plan_owner
    OR requester.is_admin = true
    OR p.organization_id = requester.organization_id
  ORDER BY s.created_at DESC;
END;
$$;
