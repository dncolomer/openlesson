/**
 * Free product tier: signed-in users with no paid entitlement.
 * Stored plan stays `inactive`; this layer is presentation + access + weekly cap.
 */

import {
  DASHBOARD_NAV_GROUPS,
  isDashboardTab,
  type DashboardNavGroup,
  type DashboardTab,
} from "@/lib/dashboard-nav";
import {
  DASHBOARD_PLAY_KINDS,
  type DashboardPlayKind,
} from "@/lib/dashboard-play";

/** Max sessions a Free account may start in one UTC week. */
export const FREE_WEEKLY_SESSION_LIMIT = 3;

export const FREE_DASHBOARD_TAB_IDS = [
  "home",
  "my_maps",
  "usage",
  "help",
] as const satisfies readonly DashboardTab[];

const FREE_TAB_SET = new Set<string>(FREE_DASHBOARD_TAB_IDS);

/** Paid-only page prefixes. Checked before the Free allowlist. */
const FREE_TIER_DENIED_PREFIXES = [
  "/workspace/new",
  "/verification",
  "/calibration",
] as const;

const FREE_TIER_ALLOWED_PREFIXES = [
  "/dashboard",
  "/session",
  "/play",
  "/workspace",
  "/results",
] as const;

export type UtcMondayWeekWindow = {
  start: Date;
  resetAt: Date;
};

export type FreeWeeklySessionQuota = {
  used: number;
  limit: number;
  resetAt: string;
  allowed: boolean;
};

function pathHasPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** UTC week: Monday 00:00 through next Monday 00:00 (reset). */
export function utcMondayWeekWindow(now: Date = new Date()): UtcMondayWeekWindow {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const daysFromMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysFromMonday);
  const resetAt = new Date(start);
  resetAt.setUTCDate(resetAt.getUTCDate() + 7);
  return { start, resetAt };
}

export function canStartFreeSession(
  used: number,
  limit: number = FREE_WEEKLY_SESSION_LIMIT,
): boolean {
  return used < limit;
}

export function presentFreeWeeklySessionQuota(
  used: number,
  now: Date = new Date(),
): FreeWeeklySessionQuota {
  const { resetAt } = utcMondayWeekWindow(now);
  const safeUsed = Math.max(0, Math.floor(used));
  return {
    used: safeUsed,
    limit: FREE_WEEKLY_SESSION_LIMIT,
    resetAt: resetAt.toISOString(),
    allowed: canStartFreeSession(safeUsed),
  };
}

export function formatFreeWeekReset(resetAt: Date | string): string {
  const date = typeof resetAt === "string" ? new Date(resetAt) : resetAt;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function freeWeeklySessionLimitMessage(resetAt: Date | string): string {
  return `Free accounts can run ${FREE_WEEKLY_SESSION_LIMIT} sessions a week. Your next sessions unlock ${formatFreeWeekReset(resetAt)} (UTC).`;
}

export function isFreeDashboardTab(value: unknown): boolean {
  return typeof value === "string" && FREE_TAB_SET.has(value);
}

export function clampDashboardTabForAccess(
  tab: DashboardTab,
  hasPaidAccess: boolean,
): DashboardTab {
  if (hasPaidAccess) return tab;
  if (isDashboardTab(tab) && isFreeDashboardTab(tab)) return tab;
  return "home";
}

export function dashboardNavGroupsForAccess(
  hasPaidAccess: boolean,
): DashboardNavGroup[] {
  if (hasPaidAccess) {
    return DASHBOARD_NAV_GROUPS.map((group) => ({
      ...group,
      items: [...group.items],
    }));
  }
  return DASHBOARD_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isFreeDashboardTab(item.id)),
  })).filter((group) => group.items.length > 0);
}

/** Home Quick Work Session kinds. Free and paid both run Learn, Verify, and Calibrate. */
export function dashboardPlayKindsForAccess(
  _hasPaidAccess?: boolean,
): DashboardPlayKind[] {
  return [...DASHBOARD_PLAY_KINDS];
}

export function isFreeTierAllowedPath(pathname: string): boolean {
  const path = pathname.split("?")[0] || pathname;
  if (FREE_TIER_DENIED_PREFIXES.some((prefix) => pathHasPrefix(path, prefix))) {
    return false;
  }
  return FREE_TIER_ALLOWED_PREFIXES.some((prefix) => pathHasPrefix(path, prefix));
}

export function isPaidOnlyWorkspaceKind(
  kind: string | null | undefined,
): boolean {
  return kind === "knowledge_region" || kind === "calibration";
}
