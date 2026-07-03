-- Workspace-level conversion goal (user-overridable; inferred at creation when absent)
ALTER TABLE learning_plans
  ADD COLUMN IF NOT EXISTS conversion_goal TEXT;

COMMENT ON COLUMN learning_plans.conversion_goal IS
  'What conversion/success means for this workspace. Set at creation (inferred) and editable by the owner.';