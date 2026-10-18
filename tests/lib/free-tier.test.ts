import { describe, expect, it } from "vitest";
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

  it("caps Free accounts at 3 sessions per week", () => {
    expect(FREE_WEEKLY_SESSION_LIMIT).toBe(3);
    expect(canStartFreeSession(0)).toBe(true);
    expect(canStartFreeSession(2)).toBe(true);
    expect(canStartFreeSession(3)).toBe(false);
    expect(canStartFreeSession(4)).toBe(false);
    const quota = presentFreeWeeklySessionQuota(3, new Date("2026-10-18T12:00:00.000Z"));
    expect(quota).toMatchObject({
      used: 3,
      limit: 3,
      allowed: false,
      resetAt: "2026-10-19T00:00:00.000Z",
    });
    expect(freeWeeklySessionLimitMessage(quota.resetAt)).toContain("3 sessions a week");
    expect(freeWeeklySessionLimitMessage(quota.resetAt)).toContain(
      formatFreeWeekReset(quota.resetAt),
    );
  });
});

describe("free tier dashboard and paths", () => {
  it("keeps Home and My Maps and hides Build, Shop, Verification, and Calibration", () => {
    const groups = dashboardNavGroupsForAccess(false);
    expect(groups.flatMap((group) => group.items.map((item) => item.id))).toEqual([
      ...FREE_DASHBOARD_TAB_IDS,
    ]);
    expect(groups.some((group) => group.id === "verification")).toBe(false);
    expect(groups.some((group) => group.id === "calibration")).toBe(false);
    expect(groups.find((group) => group.id === "learning")?.items.map((item) => item.id)).toEqual([
      "my_maps",
    ]);
    expect(clampDashboardTabForAccess("learning", false)).toBe("home");
    expect(clampDashboardTabForAccess("shop", false)).toBe("home");
    expect(clampDashboardTabForAccess("verification", false)).toBe("home");
    expect(clampDashboardTabForAccess("calibration", false)).toBe("home");
    expect(clampDashboardTabForAccess("my_maps", false)).toBe("my_maps");
    expect(clampDashboardTabForAccess("learning", true)).toBe("learning");
    expect(dashboardPlayKindsForAccess(false)).toEqual(["learn", "verify", "calibrate"]);
    expect(dashboardPlayKindsForAccess(true)).toEqual(["learn", "verify", "calibrate"]);
  });

  it("allows dashboard, My Maps play, and sessions; denies Build and product prefixes", () => {
    expect(isFreeTierAllowedPath("/dashboard")).toBe(true);
    expect(isFreeTierAllowedPath("/dashboard/")).toBe(true);
    expect(isFreeTierAllowedPath("/session")).toBe(true);
    expect(isFreeTierAllowedPath("/play")).toBe(true);
    expect(isFreeTierAllowedPath("/play/verify")).toBe(true);
    expect(isFreeTierAllowedPath("/play/calibrate")).toBe(true);
    expect(isFreeTierAllowedPath("/workspace/abc")).toBe(true);
    expect(isFreeTierAllowedPath("/results")).toBe(true);
    expect(isFreeTierAllowedPath("/workspace/new")).toBe(false);
    expect(isFreeTierAllowedPath("/verification")).toBe(false);
    expect(isFreeTierAllowedPath("/verification/flows/new")).toBe(false);
    expect(isFreeTierAllowedPath("/calibration/flows/x")).toBe(false);
    expect(isPaidOnlyWorkspaceKind("knowledge_region")).toBe(true);
    expect(isPaidOnlyWorkspaceKind("calibration")).toBe(true);
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
    expect(playStart).toContain("rejectIfFreeWeeklySessionLimit");
    expect(playStart).toContain("parseDashboardPlayKind");
    expect(readRepo("app/api/play/curious/route.ts")).toContain("rejectIfFreeWeeklySessionLimit");

    const launch = readRepo("app/api/workspace/learner-launch/route.ts");
    expect(launch).toContain("requireProductAccess: false");
    expect(launch).toContain("rejectIfFreeWeeklySessionLimit");

    const checkUsage = readRepo("app/api/check-usage/route.ts");
    expect(checkUsage).toContain("weeklySessionsAllowed");
    expect(checkUsage).toContain("freeTier");

    const dash = readDashboardSurface();
    expect(dash).toContain("dashboardNavGroupsForAccess");
    expect(dash).toContain("clampDashboardTabForAccess");
    expect(dash).toContain("dashboardPlayKindsForAccess");
    expect(dash).toContain("data-dashboard-free-quota");
    expect(dash).toContain("weeklySessionsAllowed");

    expect(readRepo("lib/api/require-auth.ts")).toContain(
      "const requireProduct = options?.requireProductAccess === true",
    );
    expect(readRepo("lib/pricing/modules.ts")).toContain('if (plan === "inactive") return "Free"');
  });
});
