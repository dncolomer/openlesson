-- Add planning status to sessions
-- Migrate existing active sessions without ended_at to 'planning'

UPDATE sessions SET status = 'planning' WHERE status = 'active' AND ended_at IS NULL;

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check 
  CHECK (status IN ('planning', 'active', 'completed', 'ended_by_tutor', 'ready', 'paused'));

-- Add session_started_at for tracking when session transitioned to active
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ;
