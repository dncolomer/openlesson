-- Session Plans table for the Session Planner feature
-- Stores the learning plan created and updated during each session

CREATE TABLE session_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal TEXT NOT NULL,
  strategy TEXT,
  steps JSONB DEFAULT '[]',
  current_step_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for session lookup
CREATE INDEX idx_session_plans_session_id ON session_plans(session_id);
CREATE INDEX idx_session_plans_user_id ON session_plans(user_id);

-- RLS Policies
ALTER TABLE session_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plans" ON session_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plans" ON session_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans" ON session_plans
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plans" ON session_plans
  FOR DELETE USING (auth.uid() = user_id);

-- Add request_type column to probes table
ALTER TABLE probes ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'question';

-- Comment for documentation
COMMENT ON TABLE session_plans IS 'Stores AI-generated learning plans for each session, updated in real-time during learning';
COMMENT ON COLUMN session_plans.goal IS 'The overall learning goal for the session';
COMMENT ON COLUMN session_plans.strategy IS 'The AI strategy for guiding the student';
COMMENT ON COLUMN session_plans.steps IS 'JSON array of SessionPlanStep objects with status, type, description, order';
COMMENT ON COLUMN session_plans.current_step_index IS 'Index of the currently active step';
COMMENT ON COLUMN probes.request_type IS 'Type of request: question, task, suggestion, or checkpoint';
