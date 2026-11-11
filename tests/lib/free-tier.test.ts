import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readDashboardSurface, readRepo } from "../helpers/surface-source";
import {
  FREE_DASHBOARD_TAB_IDS,
  FREE_WEEKLY_SESSION_LIMIT,
  canStartFreeSession,
  clampDashboardTabForAccess,
  dashboardNavGroupsForAccess,
  dashboardPlayKindsForAccess,
  formatFreeWeekReset,
  freeWeeklySessionLimitMessage,
  isFreeTierAllowedPath,
  isPaidOnlyWorkspaceKind,
  presentFreeWeeklySessionQuota,
  utcMondayWeekWindow,
} from "@/lib/free-tier";

describe("free tier week window and quota", () => {
  it("uses a UTC Monday 00:00 week and resets the following Monday", () => {
    const sunday = utcMondayWeekWindow(new Date("2026-10-18T23:59:59.000Z"));
    expect(sunday.start.toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(sunday.resetAt.toISOString()).toBe("2026-10-19T00:00:00.000Z");

    const mondayOpen = utcMondayWeekWindow(new Date("2026-10-19T00:00:00.000Z"));
    expect(mondayOpen.start.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(mondayOpen.resetAt.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("keeps the UTC week helper even though sessions are billed in credits", () => {
    expect(FREE_WEEKLY_SESSION_LIMIT).toBeGreaterThan(0);
    const quota = presentFreeWeeklySessionQuota(0, new Date("2026-10-18T12:00:00.000Z"));
    expect(quota.resetAt).toBe("2026-10-19T00:00:00.000Z");
  });
});

describe("free tier dashboard and paths", () => {
  it("opens Learning Map create and product tabs without a subscription", () => {
    const groups = dashboardNavGroupsForAccess(false);
    expect(groups.some((group) => group.id === "verification")).toBe(true);
    expect(groups.some((group) => group.id === "calibration")).toBe(true);
    expect(clampDashboardTabForAccess("learning" as never, false)).toBe("home");
    expect(clampDashboardTabForAccess("shop" as never, false)).toBe("home");
    expect(clampDashboardTabForAccess("verification", false)).toBe("verification");
    expect(clampDashboardTabForAccess("solve", false)).toBe("solve");
    expect(dashboardPlayKindsForAccess(false)).toEqual(["learn", "verify", "calibrate"]);
    expect(dashboardPlayKindsForAccess(true)).toEqual(["learn", "verify", "calibrate"]);
  });

  it("allows dashboard, map create, sessions, and product prefixes", () => {
    expect(isFreeTierAllowedPath("/dashboard")).toBe(true);
    expect(isFreeTierAllowedPath("/dashboard/")).toBe(true);
    expect(isFreeTierAllowedPath("/session")).toBe(true);
    expect(isFreeTierAllowedPath("/play")).toBe(true);
    expect(isFreeTierAllowedPath("/play/verify")).toBe(true);
    expect(isFreeTierAllowedPath("/play/calibrate")).toBe(true);
    expect(isFreeTierAllowedPath("/workspace/abc")).toBe(false);
    expect(isFreeTierAllowedPath("/results")).toBe(true);
    expect(isFreeTierAllowedPath("/workspace/new")).toBe(false);
    expect(isFreeTierAllowedPath("/verification")).toBe(true);
    expect(isFreeTierAllowedPath("/verification/flows/new")).toBe(true);
    expect(isFreeTierAllowedPath("/calibration/flows/x")).toBe(true);
    expect(isPaidOnlyWorkspaceKind("knowledge_region")).toBe(false);
    expect(isPaidOnlyWorkspaceKind("calibration")).toBe(false);
    expect(isPaidOnlyWorkspaceKind("standard")).toBe(false);
  });
});

describe("free tier surfaces", () => {
  it("opens Free signup, dashboard, and weekly session gates", () => {
    const middleware = readRepo("middleware.ts");
    expect(middleware).toContain("isFreeTierAllowedPath");
    expect(middleware).not.toContain("Paid checkout (session_id) or organization invite signup only.");
    expect(middleware).toContain('new URL("/dashboard", request.url)');

    const registerPage = readRepo("app/register/page.tsx");
    expect(registerPage).toContain("handleFreeRegister");
    expect(registerPage).not.toContain('router.replace("/pricing")');

    const registerApi = readRepo("app/api/auth/register/route.ts");
    expect(registerApi).toContain("registerFromFree");

    const login = readRepo("app/login/page.tsx");
    expect(login).toContain('href="/register"');

    const playStart = readRepo("app/api/play/start/route.ts");
    expect(playStart).toContain("rejectIfInsufficientSessionCredits");
    expect(playStart).toContain("parseDashboardPlayKind");
    expect(readRepo("app/api/play/curious/route.ts")).toContain("rejectIfInsufficientSessionCredits");

    expect(existsSync(join(__dirname, "../../app/api/workspace/learner-launch/route.ts"))).toBe(
      false,
    );
    const checkUsage = readRepo("app/api/check-usage/route.ts");
    expect(checkUsage).toContain("creditBalance");
    expect(checkUsage).toContain("loadCreditSummary");

    const dash = readDashboardSurface();
    expect(dash).toContain("dashboardNavGroupsForAccess");
    expect(dash).toContain("clampDashboardTabForAccess");
    expect(readRepo("lib/free-tier.ts")).toContain("dashboardPlayKindsForAccess");
    expect(readRepo("components/dashboard/dashboard-usage-tab.tsx")).toContain("data-dashboard-credits");
    expect(existsSync(join(__dirname, "../../app/api/workspace/generate/route.ts"))).toBe(false);
    expect(readRepo("app/api/dashboard/knowledge-regions/route.ts")).not.toContain("rejectIfInsufficientSessionCredits");

    expect(readRepo("lib/api/require-auth.ts")).toContain(
      "const requireProduct = options?.requireProductAccess === true",
    );
    expect(readRepo("lib/pricing/modules.ts")).toContain('if (plan === "inactive") return "Free"');
  });
});
