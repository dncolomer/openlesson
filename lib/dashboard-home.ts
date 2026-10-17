/**
 * Home dashboard summaries: product counts, recent workspaces, recent flows.
 */

import {
  workspaceMatchesDashboardTypeFilter,
  type DashboardWorkspaceTypeFilter,
} from "@/lib/dashboard-workspace-filters";
import { workspaceProductShell } from "@/lib/workspace-kind";
import { calibrationFlowPublicPath } from "@/lib/calibration-flow";
import { verificationFlowPublicPath } from "@/lib/verification-flow";

export type DashboardWorkspaceCountKey = DashboardWorkspaceTypeFilter;

export type DashboardWorkspaceCounts = {
  learning: number;
  verification: number;
  calibration: number;
  total: number;
};

export function dashboardWorkspaceCounts(
  workspaces: readonly { workspace_kind?: string | null }[],
): DashboardWorkspaceCounts {
  const learning = workspaces.filter((row) =>
    workspaceMatchesDashboardTypeFilter(row, "learning"),
  ).length;
  const verification = workspaces.filter((row) =>
    workspaceMatchesDashboardTypeFilter(row, "verification"),
  ).length;
  const calibration = workspaces.filter((row) =>
    workspaceMatchesDashboardTypeFilter(row, "calibration"),
  ).length;
  return {
    learning,
    verification,
    calibration,
    total: workspaces.length,
  };
}

export function dashboardRecentWorkspaces<T extends { created_at?: string }>(
  workspaces: readonly T[],
  limit = 6,
): T[] {
  return [...workspaces]
    .sort((a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || ""))
    .slice(0, Math.max(0, limit));
}

export type DashboardRecentFlowKind = "verify" | "calibrate";

export type DashboardRecentFlow = {
  id: string;
  kind: DashboardRecentFlowKind;
  title: string;
  workspaceId: string;
  workspaceTitle: string;
  createdAt: string;
  publicPath: string;
  workspacePath: string;
  questionCount: number;
};

export function dashboardFlowWorkspacePath(kind: DashboardRecentFlowKind, workspaceId: string): string {
  const section = kind === "calibrate" ? "calibration_flows" : "verification_flows";
  return `/workspace/${workspaceId}?section=${section}`;
}

export function presentDashboardRecentFlow(input: {
  id: unknown;
  kind: DashboardRecentFlowKind;
  title?: unknown;
  workspaceId: unknown;
  workspaceTitle?: unknown;
  createdAt?: unknown;
  publicToken?: unknown;
  questionCount?: unknown;
}): DashboardRecentFlow | null {
  const id = String(input.id || "").trim();
  const workspaceId = String(input.workspaceId || "").trim();
  if (!id || !workspaceId) return null;
  const token = String(input.publicToken || "").trim();
  const publicPath =
    input.kind === "calibrate"
      ? calibrationFlowPublicPath(token)
      : verificationFlowPublicPath(token);
  return {
    id,
    kind: input.kind,
    title: String(input.title || "").trim() || "Untitled flow",
    workspaceId,
    workspaceTitle: String(input.workspaceTitle || "").trim() || "Workspace",
    createdAt: String(input.createdAt || ""),
    publicPath: token ? publicPath : dashboardFlowWorkspacePath(input.kind, workspaceId),
    workspacePath: dashboardFlowWorkspacePath(input.kind, workspaceId),
    questionCount: questionCountFromUnknown(input.questionCount),
  };
}

export function sortDashboardRecentFlows(
  rows: readonly DashboardRecentFlow[],
  limit = 8,
): DashboardRecentFlow[] {
  return [...rows]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, Math.max(0, limit));
}

export function dashboardWorkspaceKindLabel(kind: unknown): string {
  const shell = workspaceProductShell(kind);
  if (shell === "verification") return "Verification";
  if (shell === "calibration") return "Calibration";
  return "Learning";
}

export function questionCountFromUnknown(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}
