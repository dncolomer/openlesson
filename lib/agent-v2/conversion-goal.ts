/**
 * Re-exports workspace goal helpers. The conversion_goal column and branding
 * were migrated to workspace_goal / inferred workspace goal.
 */
export {
  WORKSPACE_GOAL_MAX_LENGTH,
  WORKSPACE_GENERATION_GOAL_RULE,
  WORKSPACE_GENERATION_CONVERSION_GOAL_RULE,
  CONVERSION_GOAL_MAX_LENGTH,
  normalizeWorkspaceGoal,
  normalizeConversionGoal,
  fallbackWorkspaceGoal,
  fallbackConversionGoal,
  finalizeVerticalScoreReport,
  finalizePerformanceReport,
  type WorkspaceGoalSource,
  type WorkspaceGoalContext,
  type ConversionGoalSource,
  type ConversionGoalContext,
} from "./workspace-goal";
