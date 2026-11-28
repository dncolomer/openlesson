-- Add archived and focused columns to probes table for probe management features
-- archived: marks probes as resolved/archived (filtered from active view)
-- focused: marks probes user is actively working on (sent to analysis for priority checking)

ALTER TABLE probes ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE probes ADD COLUMN IF NOT EXISTS focused BOOLEAN DEFAULT FALSE;

-- Create index for efficient filtering of active (non-archived) probes
CREATE INDEX IF NOT EXISTS idx_probes_archived ON probes(archived);
CREATE INDEX IF NOT EXISTS idx_probes_focused ON probes(focused);

-- Composite index for common query pattern: session's active probes
CREATE INDEX IF NOT EXISTS idx_probes_session_archived ON probes(session_id, archived);
