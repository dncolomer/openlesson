-- Add planning_prompt column to plan_nodes table
-- This allows users to set custom instructions for plan generation before starting a session
ALTER TABLE plan_nodes ADD COLUMN IF NOT EXISTS planning_prompt TEXT;

-- Add planning_prompt column to sessions table
-- This stores the planning prompt copied from plan_node when session is created
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS planning_prompt TEXT;

-- Add description column to session_plans table
-- This is a cosmetic field for displaying a summary of the plan
ALTER TABLE session_plans ADD COLUMN IF NOT EXISTS description TEXT;

-- Comments for documentation
COMMENT ON COLUMN plan_nodes.planning_prompt IS 'Custom instructions for AI plan generation, set before starting the session';
COMMENT ON COLUMN sessions.planning_prompt IS 'Custom instructions used when generating the session plan';
COMMENT ON COLUMN session_plans.description IS 'Brief summary of the session plan for display purposes';
