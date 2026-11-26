/**
 * Home dashboard summaries: product counts and recent flows.
 */

import {
  workspaceMatchesDashboardTypeFilter,
  type DashboardWorkspaceTypeFilter,
} from "@/lib/dashboard-workspace-filters";
import { verificationFlowPublicPath } from "@/lib/verification-flow";
import { flowDisplayName, productFlowPagePath } from "@/lib/product-flow";

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

export type DashboardRecentFlow = {
  id: string;
  name: string;
  title: string;
  workspaceId: string;
  workspaceTitle: string;
  createdAt: string;
  publicPath: string;
  workspacePath: string;
  protocolPath: string;
  challenge: string;
  questionCount: number;
};

/** One-line clips so the Flows table columns stay put. */
export const DASHBOARD_FLOW_NAME_MAX = 40;
export const DASHBOARD_FLOW_TOPIC_MAX = 48;

export function truncateDashboardFlowLabel(
  value: unknown,
  max: number,
): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "—";
  const limit = Number.isFinite(max) && max > 1 ? Math.floor(max) : DASHBOARD_FLOW_TOPIC_MAX;
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}

export function truncateDashboardFlowTopic(
  value: unknown,
  max = DASHBOARD_FLOW_TOPIC_MAX,
): string {
  return truncateDashboardFlowLabel(value, max);
}

export function truncateDashboardFlowName(
  value: unknown,
  max = DASHBOARD_FLOW_NAME_MAX,
): string {
  return truncateDashboardFlowLabel(value, max);
}

export function dashboardFlowWorkspacePath(_kindOrId: unknown, flowId?: string): string {
  return productFlowPagePath(_kindOrId, flowId);
}

export function presentDashboardRecentFlow(input: {
  id: unknown;
  name?: unknown;
  title?: unknown;
  workspaceId?: unknown;
  workspaceTitle?: unknown;
  createdAt?: unknown;
  publicToken?: unknown;
  challenge?: unknown;
  topic?: unknown;
  questionCount?: unknown;
}): DashboardRecentFlow | null {
  const id = String(input.id || "").trim();
  if (!id) return null;
  const workspaceId = String(input.workspaceId || "").trim();
  const token = String(input.publicToken || "").trim();
  const publicPath = verificationFlowPublicPath(token);
  const name = flowDisplayName({
    name: input.name,
    title: input.title,
  });
  const protocolPath = productFlowPagePath(id);
  const challenge = String(input.challenge ?? input.topic ?? "").trim();
  return {
    id,
    name,
    title: name,
    workspaceId,
    workspaceTitle: String(input.workspaceTitle || "").trim() || "Workspace",
    createdAt: String(input.createdAt || ""),
    publicPath: token ? publicPath : protocolPath,
    workspacePath: protocolPath,
    protocolPath,
    challenge,
    questionCount: questionCountFromUnknown(input.questionCount),
  };
}

export function sortDashboardFlowsByCreatedAt(
  rows: readonly DashboardRecentFlow[],
): DashboardRecentFlow[] {
  return [...rows].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function sortDashboardRecentFlows(
  rows: readonly DashboardRecentFlow[],
  limit = 8,
): DashboardRecentFlow[] {
  return sortDashboardFlowsByCreatedAt(rows).slice(0, Math.max(0, limit));
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

export function dashboardWorkspaceKindLabel(_kind: unknown): string {
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
