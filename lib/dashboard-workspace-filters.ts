/**
 * Dashboard workspace list filters (visibility + AYCL listing).
 * Pure so the dashboard page can stay thin and tests don't scrape JSX.
 */

export type DashboardWorkspaceListFilter = "all" | "public" | "private" | "aycl";

export const DASHBOARD_WORKSPACE_LIST_FILTERS: DashboardWorkspaceListFilter[] = [
  "all",
  "public",
  "private",
  "aycl",
];

export function isDashboardWorkspaceListFilter(
  value: string,
): value is DashboardWorkspaceListFilter {
  return (DASHBOARD_WORKSPACE_LIST_FILTERS as string[]).includes(value);
}

export function workspaceMatchesDashboardListFilter(
  workspace: {
    is_public?: boolean | null;
    is_all_you_can_learn?: boolean | null;
  },
  filter: DashboardWorkspaceListFilter,
): boolean {
  if (filter === "public") return Boolean(workspace.is_public);
  if (filter === "private") return !workspace.is_public;
  if (filter === "aycl") return Boolean(workspace.is_all_you_can_learn);
  return true;
}

/** True when the dashboard has no workspaces at all (not a search/filter miss). */
export function dashboardHasNoWorkspaces(
  workspaces: readonly unknown[] | null | undefined,
): boolean {
  return !workspaces || workspaces.length === 0;
}
