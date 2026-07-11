-- Add plan_step_id column to link probes to session plan steps
ALTER TABLE probes ADD COLUMN IF NOT EXISTS plan_step_id TEXT;

-- Create index for efficient lookups by plan_step_id
CREATE INDEX IF NOT EXISTS idx_probes_plan_step_id ON probes(plan_step_id);
