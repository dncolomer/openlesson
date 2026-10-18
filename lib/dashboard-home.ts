/**
 * Home dashboard summaries: product counts and recent flows.
 */

import {
  workspaceMatchesDashboardTypeFilter,
  type DashboardWorkspaceTypeFilter,
} from "@/lib/dashboard-workspace-filters";
import { workspaceProductShell } from "@/lib/workspace-kind";
import { calibrationFlowPublicPath } from "@/lib/calibration-flow";
import { verificationFlowPublicPath } from "@/lib/verification-flow";
import {
  flowDisplayName,
  productFlowKindFromDashboardKind,
  productFlowPagePath,
} from "@/lib/product-flow";

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

export type DashboardRecentFlowKind = "verify" | "calibrate";

export type DashboardRecentFlow = {
  id: string;
  kind: DashboardRecentFlowKind;
  name: string;
  title: string;
  workspaceId: string;
  workspaceTitle: string;
  createdAt: string;
  publicPath: string;
  workspacePath: string;
  flowPath: string;
  questionCount: number;
};

export function dashboardFlowWorkspacePath(kind: DashboardRecentFlowKind, flowId: string): string {
  return productFlowPagePath(productFlowKindFromDashboardKind(kind), flowId);
}

export function presentDashboardRecentFlow(input: {
  id: unknown;
  kind: DashboardRecentFlowKind;
  name?: unknown;
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
  const name = flowDisplayName({
    name: input.name,
    title: input.title,
  });
  const flowPath = dashboardFlowWorkspacePath(input.kind, id);
  return {
    id,
    kind: input.kind,
    name,
    title: name,
    workspaceId,
    workspaceTitle: String(input.workspaceTitle || "").trim() || "Workspace",
    createdAt: String(input.createdAt || ""),
    publicPath: token ? publicPath : flowPath,
    workspacePath: flowPath,
    flowPath,
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

export const DASHBOARD_FLOWS_PAGE_SIZE = 10;

export type DashboardFlowPage<T> = {
  page: number;
  totalPages: number;
  start: number;
  end: number;
  total: number;
  rows: T[];
};

export function paginateDashboardFlows<T>(
  rows: readonly T[],
  page: number,
  pageSize = DASHBOARD_FLOWS_PAGE_SIZE,
): DashboardFlowPage<T> {
  const size = Math.max(1, Math.round(pageSize) || DASHBOARD_FLOWS_PAGE_SIZE);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, Math.round(page) || 1), totalPages);
  const startIndex = (safePage - 1) * size;
  const slice = rows.slice(startIndex, startIndex + size);
  return {
    page: safePage,
    totalPages,
    start: total === 0 ? 0 : startIndex + 1,
    end: startIndex + slice.length,
    total,
    rows: slice,
  };
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
