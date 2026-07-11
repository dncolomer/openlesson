-- ============================================
-- 036: Group Plans
--
-- Adds "group plan" mode: any registered user can work
-- directly on a plan (create sessions on its nodes)
-- without forking.  Categorically different from the
-- existing Share / Fork / Remix flow.
-- ============================================

-- 1. New flag on learning_plans
ALTER TABLE learning_plans
ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;

-- 2. Join table: tracks every session started on every node,
--    supporting multiple users per node.
CREATE TABLE IF NOT EXISTS plan_node_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_node_id  UUID NOT NULL REFERENCES plan_nodes(id)  ON DELETE CASCADE,
  session_id    UUID NOT NULL REFERENCES sessions(id)    ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  plan_id       UUID NOT NULL,  -- denormalised for fast queries
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_node_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_pns_plan_id       ON plan_node_sessions(plan_id);
CREATE INDEX IF NOT EXISTS idx_pns_user_id       ON plan_node_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pns_plan_node_id  ON plan_node_sessions(plan_node_id);

-- 3. RLS for plan_node_sessions
ALTER TABLE plan_node_sessions ENABLE ROW LEVEL SECURITY;

-- SELECT: own rows always; all rows if you are the plan owner OR plan is_group
CREATE POLICY "Users can view plan_node_sessions"
  ON plan_node_sessions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM learning_plans lp
      WHERE lp.id = plan_node_sessions.plan_id
      AND (lp.user_id = auth.uid() OR lp.is_group = true)
    )
  );

-- INSERT: only your own rows, and only when the plan is_group OR you own it
CREATE POLICY "Users can create plan_node_sessions"
  ON plan_node_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM learning_plans lp
      WHERE lp.id = plan_node_sessions.plan_id
      AND (lp.user_id = auth.uid() OR lp.is_group = true)
    )
  );

-- 4. Widen the plan_nodes SELECT policy so group-plan participants
--    can read nodes (existing policy only allows owner + is_public).
DROP POLICY IF EXISTS "Users can view own plan nodes" ON plan_nodes;
CREATE POLICY "Users can view own plan nodes"
  ON plan_nodes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_plans lp
      WHERE lp.id = plan_nodes.plan_id
      AND (lp.user_id = auth.uid() OR lp.is_public = true OR lp.is_group = true)
    )
  );

-- 5. Widen learning_plans SELECT so authenticated users can read group plans
DROP POLICY IF EXISTS "Anyone can view group learning plans" ON learning_plans;
CREATE POLICY "Anyone can view group learning plans"
  ON learning_plans FOR SELECT
  TO authenticated
  USING (is_group = true);

-- 6. SECURITY DEFINER function: lets the plan owner fetch ALL
--    participants' session data (bypasses session RLS).
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
BEGIN
  -- Only the plan owner may call this
  IF NOT EXISTS (
    SELECT 1 FROM learning_plans
    WHERE id = p_plan_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  SELECT s.id        AS session_id,
         s.user_id   AS user_id,
         p.username   AS username,
         s.problem    AS problem,
         s.status     AS status,
         s.duration_ms AS duration_ms,
         s.report     AS report,
         s.created_at AS created_at,
         s.ended_at   AS ended_at,
         pns.plan_node_id AS node_id,
         pn.title     AS node_title
  FROM plan_node_sessions pns
  JOIN sessions  s  ON s.id  = pns.session_id
  JOIN profiles  p  ON p.id  = s.user_id
  JOIN plan_nodes pn ON pn.id = pns.plan_node_id
  WHERE pns.plan_id = p_plan_id
  ORDER BY s.created_at DESC;
END;
$$;
