import {
  normalizeVerticalScoreReport,
  type ScoreVertical,
  type VerticalScoreReport,
} from "./performance-report";

export const WORKSPACE_GOAL_MAX_LENGTH = 240;

export type WorkspaceGoalSource = "workspace" | "inferred" | "opaque_ref";

export interface WorkspaceGoalContext {
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  root_topic?: string | null;
}

export function normalizeWorkspaceGoal(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, WORKSPACE_GOAL_MAX_LENGTH);
}

export function fallbackWorkspaceGoal(context: WorkspaceGoalContext): string {
  const description = normalizeWorkspaceGoal(context.description);
  if (description) return description;

  const notes = normalizeWorkspaceGoal(context.notes);
  if (notes && notes.length <= WORKSPACE_GOAL_MAX_LENGTH) return notes;

  const title = normalizeWorkspaceGoal(context.title || context.root_topic);
  if (title) return `Demonstrate readiness: ${title}`;

  return "Achieve the workspace outcome defined by proof of work and block completion";
}

export function finalizeVerticalScoreReport(
  report: VerticalScoreReport,
  storedWorkspaceGoal: string | null | undefined,
  context: WorkspaceGoalContext = {},
  vertical?: ScoreVertical
): {
  report: VerticalScoreReport;
  workspace_goal: string;
  workspace_goal_source: WorkspaceGoalSource;
} {
  const resolvedVertical = vertical ?? report.vertical ?? "verification";
  const normalized = normalizeVerticalScoreReport(report, resolvedVertical);
  const stored = normalizeWorkspaceGoal(storedWorkspaceGoal);
  if (stored) {
    return {
      report: { ...normalized, workspace_goal: stored },
      workspace_goal: stored,
      workspace_goal_source: "workspace",
    };
  }

  const inferred =
    normalizeWorkspaceGoal(normalized.workspace_goal) || fallbackWorkspaceGoal(context);

  return {
    report: { ...normalized, workspace_goal: inferred },
    workspace_goal: inferred,
    workspace_goal_source: "inferred",
  };
}

export const WORKSPACE_GENERATION_GOAL_RULE = `
- workspace_goal: one concise phrase (max ~12 words) defining success for this workspace (e.g. "Trial-to-paid activation", "Month-end close certification"). Infer from the prompt and blocks.`;

// --- Compatibility aliases (old conversion_* names removed from live contracts) ---
/** @deprecated Use WORKSPACE_GOAL_MAX_LENGTH */
export const CONVERSION_GOAL_MAX_LENGTH = WORKSPACE_GOAL_MAX_LENGTH;
/** @deprecated Use WorkspaceGoalSource */
export type ConversionGoalSource = WorkspaceGoalSource;
/** @deprecated Use WorkspaceGoalContext */
export type ConversionGoalContext = WorkspaceGoalContext;
/** @deprecated Use normalizeWorkspaceGoal */
export const normalizeConversionGoal = normalizeWorkspaceGoal;
/** @deprecated Use fallbackWorkspaceGoal */
export const fallbackConversionGoal = fallbackWorkspaceGoal;
/** @deprecated Use finalizeVerticalScoreReport */
export function finalizePerformanceReport(
  report: VerticalScoreReport,
  storedWorkspaceGoal: string | null | undefined,
  context: WorkspaceGoalContext = {}
) {
  const result = finalizeVerticalScoreReport(report, storedWorkspaceGoal, context);
  return {
    report: result.report,
    workspace_goal: result.workspace_goal,
    workspace_goal_source: result.workspace_goal_source,
    /** @deprecated */
    workspace_conversion_goal: result.workspace_goal,
    /** @deprecated */
    conversion_goal_source: result.workspace_goal_source,
  };
}
/** @deprecated Use WORKSPACE_GENERATION_GOAL_RULE */
export const WORKSPACE_GENERATION_CONVERSION_GOAL_RULE = WORKSPACE_GENERATION_GOAL_RULE;
