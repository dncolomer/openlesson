import { describe, expect, it } from "vitest";
import { readDashboardSurface, readRepo } from "../helpers/surface-source";
import {
  DASHBOARD_NAV_GROUPS,
  dashboardCreateHref,
  dashboardFrameLabel,
  dashboardListFilterForTab,
  dashboardProductLabel,
  dashboardRegionsProduct,
  dashboardTypeFilterForTab,
  isDashboardNavTabItem,
  isDashboardProductTab,
  isDashboardRegionsTab,
  isDashboardShopTab,
  parseDashboardTab,
} from "@/lib/dashboard-nav";
import {
  dashboardRecentWorkspaces,
  dashboardWorkspaceCounts,
  presentDashboardRecentFlow,
  questionCountFromUnknown,
  sortDashboardRecentFlows,
} from "@/lib/dashboard-home";
import { workspaceCreateModeFromQuery } from "@/lib/workspace-create-modes";
import { DASHBOARD_HOME_RECENT_LIMIT } from "@/lib/dashboard-play";

describe("dashboard nav", () => {
  it("parses sidebar tabs and aliases the old Workspaces tab to Learning", () => {
    expect(parseDashboardTab("home")).toBe("home");
    expect(parseDashboardTab("learning")).toBe("learning");
    expect(parseDashboardTab("verification")).toBe("verification");
    expect(parseDashboardTab("calibration")).toBe("calibration");
    expect(parseDashboardTab("shop")).toBe("shop");
    expect(parseDashboardTab("verification_regions")).toBe("verification_regions");
    expect(parseDashboardTab("calibration_regions")).toBe("calibration_regions");
    expect(parseDashboardTab("help")).toBe("help");
    expect(parseDashboardTab("plans")).toBe("learning");
    expect(parseDashboardTab("unknown")).toBe("home");
    expect(parseDashboardTab(null)).toBe("home");
  });

  it("maps product tabs to type filters and create deep-links", () => {
    expect(isDashboardProductTab("learning")).toBe(true);
    expect(isDashboardProductTab("home")).toBe(false);
    expect(dashboardTypeFilterForTab("learning")).toBe("learning");
    expect(dashboardTypeFilterForTab("verification")).toBe("verification");
    expect(dashboardTypeFilterForTab("calibration")).toBe("calibration");
    expect(dashboardTypeFilterForTab("shop")).toBe("learning");
    expect(dashboardTypeFilterForTab("verification_regions")).toBe("verification");
    expect(dashboardTypeFilterForTab("calibration_regions")).toBe("calibration");
    expect(dashboardListFilterForTab("shop")).toBe("aycl");
    expect(dashboardListFilterForTab("learning")).toBeNull();
    expect(dashboardTypeFilterForTab("home")).toBeNull();
    expect(isDashboardShopTab("shop")).toBe(true);
    expect(isDashboardRegionsTab("verification_regions")).toBe(true);
    expect(dashboardRegionsProduct("calibration_regions")).toBe("calibration");
    expect(dashboardFrameLabel("shop")).toBe("Your Shop");
    expect(dashboardFrameLabel("verification_regions")).toBe("Knowledge regions");
    expect(dashboardCreateHref("learning")).toBe("/workspace/new");
    expect(dashboardCreateHref("verification")).toBe("/workspace/new?mode=knowledge_region");
    expect(dashboardCreateHref("calibration")).toBe("/workspace/new?mode=calibration");
    expect(dashboardProductLabel("verification")).toBe("Verification");
    expect(dashboardFrameLabel("help")).toBe("How it works");
    expect(dashboardFrameLabel("calibration")).toBe("Calibration");
    expect(dashboardFrameLabel("home")).toBe("Home");
  });

  it("subdivides the sidebar into Learning, Verification, and Calibration", () => {
    const learning = DASHBOARD_NAV_GROUPS.find((group) => group.id === "learning");
    const verification = DASHBOARD_NAV_GROUPS.find((group) => group.id === "verification");
    const calibration = DASHBOARD_NAV_GROUPS.find((group) => group.id === "calibration");
    expect(learning?.items.map((item) => item.id)).toEqual(["learning", "shop"]);
    expect(learning?.items.map((item) => item.label)).toEqual(["Workspaces", "Your Shop"]);
    expect(verification?.items.map((item) => item.id)).toEqual([
      "verification",
      "verification_regions",
    ]);
    expect(calibration?.items.map((item) => item.id)).toEqual([
      "calibration",
      "calibration_regions",
    ]);
    expect(DASHBOARD_NAV_GROUPS.some((group) => group.id === "products")).toBe(false);
  });

  it("puts Upgrade on the sidebar as a dashboard tab for owned modules", () => {
    const account = DASHBOARD_NAV_GROUPS.find((group) => group.id === "account");
    const upgrade = account?.items.find((item) => item.id === "upgrade");
    expect(upgrade).toEqual({
      id: "upgrade",
      label: "Upgrade",
    });
    expect(isDashboardNavTabItem(upgrade!)).toBe(true);
    expect(parseDashboardTab("upgrade")).toBe("upgrade");
    expect(dashboardFrameLabel("upgrade")).toBe("Upgrade");
  });
});

describe("dashboard home summaries", () => {
  it("counts workspaces by product shell", () => {
    const counts = dashboardWorkspaceCounts([
      { workspace_kind: "standard" },
      {},
      { workspace_kind: "knowledge_region" },
      { workspace_kind: "calibration" },
    ]);
    expect(counts).toEqual({
      learning: 2,
      verification: 1,
      calibration: 1,
      total: 4,
    });
  });

  it("sorts recent workspaces by created_at", () => {
    const recent = dashboardRecentWorkspaces(
      [
        { id: "old", created_at: "2026-01-01T00:00:00.000Z" },
        { id: "new", created_at: "2026-06-01T00:00:00.000Z" },
        { id: "mid", created_at: "2026-03-01T00:00:00.000Z" },
      ],
      2,
    );
    expect(recent.map((row) => row.id)).toEqual(["new", "mid"]);
  });

  it("keeps Home recent workspaces at three", () => {
    expect(DASHBOARD_HOME_RECENT_LIMIT).toBe(3);
  });

  it("presents verification and calibration flow rows, not workspaces", () => {
    const verify = presentDashboardRecentFlow({
      id: "vf1",
      kind: "verify",
      title: "Linear maps",
      workspaceId: "ws1",
      workspaceTitle: "Algebra",
      createdAt: "2026-04-01T00:00:00.000Z",
      publicToken: "tok",
      questionCount: 4,
    });
    expect(verify).toMatchObject({
      id: "vf1",
      kind: "verify",
      title: "Linear maps",
      publicPath: "/v/tok",
      workspacePath: "/workspace/ws1?section=verification_flows",
      questionCount: 4,
    });

    const calibrate = presentDashboardRecentFlow({
      id: "cf1",
      kind: "calibrate",
      title: "Priors",
      workspaceId: "ws2",
      publicToken: "ctok",
      questionCount: ["a", "b"],
    });
    expect(calibrate?.publicPath).toBe("/c/ctok");
    expect(calibrate?.workspacePath).toBe("/workspace/ws2?section=calibration_flows");
    expect(presentDashboardRecentFlow({ id: "", kind: "verify", workspaceId: "ws" })).toBeNull();
  });

  it("sorts flows by recency and counts questions from arrays or JSON", () => {
    const sorted = sortDashboardRecentFlows(
      [
        {
          id: "a",
          kind: "verify",
          title: "A",
          workspaceId: "w",
          workspaceTitle: "W",
          createdAt: "2026-01-01T00:00:00.000Z",
          publicPath: "/v/a",
          workspacePath: "/workspace/w",
          questionCount: 1,
        },
        {
          id: "b",
          kind: "calibrate",
          title: "B",
          workspaceId: "w",
          workspaceTitle: "W",
          createdAt: "2026-05-01T00:00:00.000Z",
          publicPath: "/c/b",
          workspacePath: "/workspace/w",
          questionCount: 2,
        },
      ],
      1,
    );
    expect(sorted.map((row) => row.id)).toEqual(["b"]);
    expect(questionCountFromUnknown(["q1", "q2"])).toBe(2);
    expect(questionCountFromUnknown(4)).toBe(4);
    expect(questionCountFromUnknown(JSON.stringify(["q"]))).toBe(1);
    expect(questionCountFromUnknown("nope")).toBe(0);
  });
});

describe("dashboard platform surface", () => {
  it("uses a sidebar instead of top Workspaces tabs and a dim still instead of a Greco wash", () => {
    const dashSrc = readDashboardSurface();
    expect(dashSrc).toContain("data-dashboard-sidebar");
    expect(dashSrc).toContain("data-dashboard-platform");
    const platformAt = dashSrc.lastIndexOf("data-dashboard-platform");
    const platform = dashSrc.slice(platformAt);
    expect(dashSrc).toContain("md:grid-cols-[14rem_minmax(0,1fr)]");
    expect(dashSrc).toContain("md:h-dvh");
    expect(dashSrc).toContain("md:overflow-hidden");
    expect(dashSrc).toContain("md:overflow-y-auto");
    expect(dashSrc).toContain("md:row-span-2");
    expect(platform.indexOf("DashboardSidebar")).toBeLessThan(platform.indexOf("data-console-frame-label"));
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("md:row-span-2");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("md:sticky");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("md:h-full");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("md:max-h-full");
    expect(dashSrc).toContain('data-dashboard-nav={item.id}');
    expect(dashSrc).toContain("DashboardHomeTab");
    expect(dashSrc).toContain("DashboardHelpTab");
    expect(dashSrc).toContain("isDashboardProductTab(activeTab)");
    expect(dashSrc).toContain("data-dashboard-home");
    expect(dashSrc).toContain("data-dashboard-recent-workspace");
    expect(dashSrc).toContain("WorkspaceCardHero");
    expect(dashSrc).toContain('fallback="aesthetic"');
    expect(dashSrc).toContain("data-dashboard-play");
    expect(dashSrc).toContain("data-dashboard-play-kind");
    expect(dashSrc).toContain("data-dashboard-play-prompt");
    expect(dashSrc).toContain("DASHBOARD_PLAY_START_PATH");
    expect(dashSrc).not.toContain("data-dashboard-home-stats");
    expect(dashSrc).not.toContain("data-dashboard-recent-flow");
    expect(dashSrc).toContain("data-dashboard-product={productTab}");
    expect(dashSrc).not.toContain("data-dashboard-product-stats");
    expect(dashSrc).toContain("data-dashboard-shop");
    expect(dashSrc).toContain("data-dashboard-knowledge-regions");
    expect(dashSrc).toContain("DashboardKnowledgeRegionsTab");
    expect(dashSrc).toContain("data-dashboard-product-create");
    expect(dashSrc).toContain("data-dashboard-help-coming-soon");
    expect(dashSrc).toContain("DASHBOARD_HOME_RECENT_LIMIT");
    expect(dashSrc).not.toContain('activeTab === "plans"');
    expect(dashSrc).not.toContain("DASHBOARD_BACKGROUND");
    expect(dashSrc).not.toContain("/aesthetics/Greco-futurism/");
    expect(dashSrc).toContain("data-dashboard-atmosphere");
    expect(dashSrc).toContain("/aesthetics/piotr-binkowski/");
    expect(dashSrc).toContain("bg-black/82");
    expect(dashSrc).toContain("<Navbar productLinks={false} />");
    expect(dashSrc).toContain("DashboardUpgradeTab");
    expect(dashSrc).toContain('activeTab === "upgrade"');
    expect(readRepo("components/dashboard/dashboard-upgrade-tab.tsx")).toContain("data-dashboard-upgrade");
    expect(readRepo("components/dashboard/dashboard-upgrade-tab.tsx")).toContain("data-dashboard-module");
  });

  it("loads owner-wide recent flows from verification and calibration tables", () => {
    const route = readRepo("app/api/dashboard/recent-flows/route.ts");
    expect(route).toContain("requireAuthenticatedUser");
    expect(route).toContain("workspace_verification_flows");
    expect(route).toContain("workspace_calibration_flows");
    expect(route).toContain("presentDashboardRecentFlow");
  });
});

describe("workspace create query mode", () => {
  it("accepts dashboard product deep-links and ignores API-only files_goal", () => {
    expect(workspaceCreateModeFromQuery("knowledge_region")).toBe("knowledge_region");
    expect(workspaceCreateModeFromQuery("calibration")).toBe("calibration");
    expect(workspaceCreateModeFromQuery("blank")).toBe("blank");
    expect(workspaceCreateModeFromQuery("files_goal")).toBeNull();
    expect(workspaceCreateModeFromQuery("nope")).toBeNull();
    const page = readRepo("app/workspace/new/page.tsx");
    expect(page).toContain("workspaceCreateModeFromQuery");
    expect(page).toContain('searchParams.get("mode")');
  });
});
