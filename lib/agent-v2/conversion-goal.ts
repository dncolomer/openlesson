import type { PerformanceReport } from "./performance-report";

export const CONVERSION_GOAL_MAX_LENGTH = 240;

export type ConversionGoalSource = "workspace" | "inferred";

export interface ConversionGoalContext {
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  root_topic?: string | null;
}

export function normalizeConversionGoal(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, CONVERSION_GOAL_MAX_LENGTH);
}

export function fallbackConversionGoal(context: ConversionGoalContext): string {
  const description = normalizeConversionGoal(context.description);
  if (description) return description;

  const notes = normalizeConversionGoal(context.notes);
  if (notes && notes.length <= CONVERSION_GOAL_MAX_LENGTH) return notes;

  const title = normalizeConversionGoal(context.title || context.root_topic);
  if (title) return `Demonstrate readiness: ${title}`;

  return "Achieve the workspace outcome defined by evidence and block completion";
}

export function finalizePerformanceReport(
  report: PerformanceReport,
  storedWorkspaceGoal: string | null | undefined,
  context: ConversionGoalContext = {}
): {
  report: PerformanceReport;
  workspace_conversion_goal: string;
  conversion_goal_source: ConversionGoalSource;
} {
  const stored = normalizeConversionGoal(storedWorkspaceGoal);
  if (stored) {
    return {
      report: { ...report, conversion_goal: stored },
      workspace_conversion_goal: stored,
      conversion_goal_source: "workspace",
    };
  }

  const inferred =
    normalizeConversionGoal(report.conversion_goal) || fallbackConversionGoal(context);

  return {
    report: { ...report, conversion_goal: inferred },
    workspace_conversion_goal: inferred,
    conversion_goal_source: "inferred",
  };
}

export const WORKSPACE_GENERATION_CONVERSION_GOAL_RULE = `
- conversion_goal: one concise phrase (max ~12 words) defining what "conversion" or success means for this workspace (e.g. "Trial-to-paid activation", "Month-end close certification"). Infer from the prompt and blocks.`;