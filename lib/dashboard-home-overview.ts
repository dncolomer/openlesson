/**
 * Compact Home overview: framed action CTAs, recent maps, recent practice.
 */

import { dashboardHrefForTab, type DashboardTab } from "@/lib/dashboard-nav";
import type { PracticeHistoryRow } from "@/lib/practice-problems";

export const DASHBOARD_HOME_RECENT_LIMIT = 4;

export type DashboardHomeRecentMap = {
  id: string;
  title: string;
  href: string;
  kind: "play_copy" | "authored";
  updatedAt: string;
};

export type DashboardHomeCta = {
  id: DashboardTab;
  label: string;
  href: string;
};

export function presentDashboardHomeRecentMap(input: {
  id?: unknown;
  title?: unknown;
  root_topic?: unknown;
  is_play_copy?: unknown;
  updated_at?: unknown;
  created_at?: unknown;
}): DashboardHomeRecentMap | null {
  const id = String(input.id || "").trim();
  if (!id) return null;
  const title =
    String(input.title || "").trim() ||
    String(input.root_topic || "").trim() ||
    "Untitled map";
  const playCopy = input.is_play_copy === true;
  const updatedAt =
    String(input.updated_at || "").trim() ||
    String(input.created_at || "").trim();
  return {
    id,
    title,
    href: `/workspace/${id}`,
    kind: playCopy ? "play_copy" : "authored",
    updatedAt,
  };
}

export function sortDashboardHomeRecentMaps(
  rows: readonly DashboardHomeRecentMap[],
  limit = DASHBOARD_HOME_RECENT_LIMIT,
): DashboardHomeRecentMap[] {
  return [...rows]
    .sort((a, b) => {
      const tb = Date.parse(b.updatedAt) || 0;
      const ta = Date.parse(a.updatedAt) || 0;
      if (tb !== ta) return tb - ta;
      return b.id.localeCompare(a.id);
    })
    .slice(0, limit);
}

export function dashboardHomeCtas(): DashboardHomeCta[] {
  return [
    { id: "browse_maps", label: "Browse maps", href: dashboardHrefForTab("browse_maps") },
    { id: "practice", label: "Browse exercises", href: dashboardHrefForTab("practice") },
    { id: "my_maps", label: "My Maps", href: dashboardHrefForTab("my_maps") },
    { id: "solve_studio", label: "Data Studio", href: dashboardHrefForTab("solve_studio") },
  ];
}

export function recentPracticeForHome(
  rows: readonly PracticeHistoryRow[],
  limit = DASHBOARD_HOME_RECENT_LIMIT,
): PracticeHistoryRow[] {
  return [...rows]
    .sort((a, b) => {
      const tb = Date.parse(b.startedAt) || 0;
      const ta = Date.parse(a.startedAt) || 0;
      if (tb !== ta) return tb - ta;
      return b.sessionId.localeCompare(a.sessionId);
    })
    .slice(0, limit);
}
