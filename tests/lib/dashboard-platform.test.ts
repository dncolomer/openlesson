import { describe, expect, it } from "vitest";
import { readDashboardSurface, readRepo } from "../helpers/surface-source";
import {
  DASHBOARD_NAV_GROUPS,
  dashboardCreateHref,
  dashboardCreateLabel,
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
  DASHBOARD_FLOWS_PAGE_SIZE,
  dashboardWorkspaceCounts,
  paginateDashboardFlows,
  presentDashboardRecentFlow,
  questionCountFromUnknown,
  sortDashboardRecentFlows,
} from "@/lib/dashboard-home";
import { workspaceCreateModeFromQuery } from "@/lib/workspace-create-modes";
import {
  acceptProductFlowPublish,
  emptyProductFlowDraft,
  flowDisplayName,
  absoluteFlowPublicUrl,
  productFlowDashboardPath,
  productFlowNewPath,
  productFlowPagePath,
} from "@/lib/product-flow";

describe("dashboard nav", () => {
  it("parses sidebar tabs and aliases the old Workspaces tab to Learning", () => {
    expect(parseDashboardTab("home")).toBe("home");
    expect(parseDashboardTab("learning")).toBe("learning");
    expect(parseDashboardTab("insights")).toBe("home");
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
    expect(dashboardCreateHref("verification")).toBe("/verification/flows/new");
    expect(dashboardCreateHref("calibration")).toBe("/calibration/flows/new");
    expect(dashboardCreateHref("verification")).toBe(productFlowNewPath("verification"));
    expect(dashboardCreateHref("calibration")).toBe(productFlowNewPath("calibration"));
    expect(dashboardProductLabel("verification")).toBe("Verification");
    expect(dashboardCreateLabel("learning")).toBe("Create a Learning Map →");
    expect(dashboardCreateLabel("verification")).toBe("Create Verification workspace →");
    expect(dashboardFrameLabel("help")).toBe("How it works");
    expect(dashboardFrameLabel("calibration")).toBe("Calibration");
    expect(dashboardFrameLabel("home")).toBe("Home");
  });

  it("subdivides the sidebar into Learning, Verification, and Calibration", () => {
    const learning = DASHBOARD_NAV_GROUPS.find((group) => group.id === "learning");
    const verification = DASHBOARD_NAV_GROUPS.find((group) => group.id === "verification");
    const calibration = DASHBOARD_NAV_GROUPS.find((group) => group.id === "calibration");
    expect(learning?.items.map((item) => item.id)).toEqual(["my_maps", "learning", "shop"]);
    expect(learning?.items.map((item) => item.label)).toEqual(["My Maps", "Build", "Your Shop"]);
    expect(verification?.items.map((item) => item.label)).toEqual(["Flows", "Knowledge regions"]);
    expect(calibration?.items.map((item) => item.label)).toEqual(["Flows", "Knowledge regions"]);
    expect(verification?.items.map((item) => item.label)).not.toContain("Workspaces");
    expect(calibration?.items.map((item) => item.label)).not.toContain("Workspaces");
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

  it("puts Usage on the sidebar and folds Upgrade into that page", () => {
    const account = DASHBOARD_NAV_GROUPS.find((group) => group.id === "account");
    expect(account?.items.map((item) => item.id)).toEqual([
      "usage",
      "organization",
      "integrations",
    ]);
    expect(account?.items.some((item) => item.id === "upgrade")).toBe(false);
    expect(parseDashboardTab("upgrade")).toBe("usage");
    expect(parseDashboardTab("usage")).toBe("usage");
    expect(dashboardFrameLabel("usage")).toBe("Usage");
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
      name: "Linear maps",
      title: "Linear maps",
      publicPath: "/v/tok",
      workspacePath: "/verification/flows/vf1",
      flowPath: "/verification/flows/vf1",
      questionCount: 4,
    });
    expect(verify?.flowPath).toBe(productFlowPagePath("verification", "vf1"));

    const calibrate = presentDashboardRecentFlow({
      id: "cf1",
      kind: "calibrate",
      title: "Priors",
      workspaceId: "ws2",
      publicToken: "ctok",
      questionCount: ["a", "b"],
    });
    expect(calibrate?.publicPath).toBe("/c/ctok");
    expect(calibrate?.name).toBe("Priors");
    expect(calibrate?.workspacePath).toBe("/calibration/flows/cf1");
    expect(calibrate?.flowPath).toBe(productFlowPagePath("calibration", "cf1"));
    expect(presentDashboardRecentFlow({ id: "", kind: "verify", workspaceId: "ws" })).toBeNull();
  });

  it("sorts flows by recency and counts questions from arrays or JSON", () => {
    const sorted = sortDashboardRecentFlows(
      [
        {
          id: "a",
          kind: "verify",
          name: "A",
          title: "A",
          workspaceId: "w",
          workspaceTitle: "W",
          createdAt: "2026-01-01T00:00:00.000Z",
          publicPath: "/v/a",
          workspacePath: "/verification/flows/a",
          flowPath: "/verification/flows/a",
          questionCount: 1,
        },
        {
          id: "b",
          kind: "calibrate",
          name: "B",
          title: "B",
          workspaceId: "w",
          workspaceTitle: "W",
          createdAt: "2026-05-01T00:00:00.000Z",
          publicPath: "/c/b",
          workspacePath: "/calibration/flows/b",
          flowPath: "/calibration/flows/b",
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
    expect(dashSrc).not.toContain("data-dashboard-recent-workspace");
    expect(dashSrc).not.toContain("data-dashboard-home-recent-workspaces");
    expect(dashSrc).not.toContain("Recent workspaces");
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
    expect(dashSrc).toContain("DashboardFlowsTab");
    expect(dashSrc).not.toContain("DashboardInsightsTab");
    expect(dashSrc).not.toContain("data-dashboard-insights");
    expect(dashSrc).toContain("data-dashboard-flows");
    expect(dashSrc).toContain("data-dashboard-flow-table");
    expect(dashSrc).not.toContain("data-dashboard-flow-grid");
    expect(dashSrc).toContain("data-dashboard-workspace-table");
    expect(dashSrc).not.toContain("data-workspace-cards-grid");
    expect(dashSrc).toContain("paginateDashboardFlows");
    expect(dashSrc).toContain("data-dashboard-flow-pagination");
    expect(DASHBOARD_FLOWS_PAGE_SIZE).toBe(10);
    expect(
      paginateDashboardFlows(
        Array.from({ length: 23 }, (_, index) => ({ id: String(index + 1) })),
        2,
      ),
    ).toMatchObject({ page: 2, totalPages: 3, start: 11, end: 20, total: 23 });
    expect(paginateDashboardFlows([{ id: "a" }], 9).page).toBe(1);
    expect(dashSrc).toContain("data-dashboard-product-create");
    expect(dashSrc).toContain("data-flow-name");
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).toContain("data-flow-name");
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).toContain("Publish");
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).toContain("data-flow-publish");
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).toContain(
      "productFlowDashboardPath(kind)",
    );
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).not.toContain(
      "payload.flowPath",
    );
    expect(productFlowDashboardPath("verification")).toBe("/dashboard?tab=verification");
    expect(productFlowDashboardPath("calibration")).toBe("/dashboard?tab=calibration");
    expect(absoluteFlowPublicUrl("/v/tok", "https://app.example")).toBe("https://app.example/v/tok");
    expect(absoluteFlowPublicUrl("https://app.example/c/tok", "https://other")).toBe(
      "https://app.example/c/tok",
    );
    expect(dashSrc).toContain("CopyFlowUrlButton");
    expect(readRepo("components/product-flow/copy-flow-url-button.tsx")).toContain("data-flow-copy-url");
    expect(readRepo("components/product-flow/copy-flow-url-button.tsx")).toContain("absoluteFlowPublicUrl");
    expect(readRepo("components/product-flow/product-flow-page.tsx")).toContain("CopyFlowUrlButton");
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).toContain("data-verification-flow-pool");
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).toContain(
      "data-verification-generate-from-topic",
    );
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).toContain(
      "Generate questions from this topic",
    );
    expect(readRepo("components/product-flow/product-flow-page.tsx")).toContain("data-verification-flow-skill");
    expect(readRepo("components/product-flow/product-flow-page.tsx")).toContain("Generate skill");
    expect(readRepo("components/product-flow/product-flow-page.tsx")).toContain(
      "data-calibration-flow-add-question",
    );
    expect(dashSrc).toContain("learningWorkspaces");
    expect(dashSrc).toContain('workspaceMatchesDashboardTypeFilter(row, "learning")');
    expect(dashSrc).toContain("workspaces={learningWorkspaces}");
    expect(readRepo("app/verification/flows/new/page.tsx")).toContain('kind="verification"');
    expect(readRepo("app/calibration/flows/new/page.tsx")).toContain('kind="calibration"');
    expect(readRepo("app/verification/flows/[id]/page.tsx")).toContain("ProductFlowPage");
    expect(readRepo("app/calibration/flows/[id]/page.tsx")).toContain("ProductFlowPage");
    expect(readRepo("app/workspace/new/page.tsx")).not.toContain("Verification workspace");
    expect(readRepo("app/workspace/new/page.tsx")).not.toContain("Calibration workspace");
    expect(readRepo("app/workspace/new/page.tsx")).not.toContain("mode=knowledge_region");
    expect(readRepo("app/workspace/new/page.tsx")).not.toContain('data-create-mode="knowledge_region"');
    expect(readRepo("app/workspace/new/page.tsx")).not.toContain('data-create-mode="calibration"');
    expect(flowDisplayName({ name: "Named", topic: "Topic" })).toBe("Named");
    expect(
      acceptProductFlowPublish({
        ...emptyProductFlowDraft("verification"),
        name: "Limits flow",
        topic: "Limits",
        questions: ["What is a limit?"],
      }).ok,
    ).toBe(true);
    expect(acceptProductFlowPublish(emptyProductFlowDraft("verification")).ok).toBe(false);
    expect(dashSrc).toContain("data-dashboard-help-coming-soon");
    expect(dashSrc).not.toContain('activeTab === "plans"');
    expect(dashSrc).not.toContain("DASHBOARD_BACKGROUND");
    expect(dashSrc).not.toContain("/aesthetics/Greco-futurism/");
    expect(dashSrc).toContain("data-dashboard-atmosphere");
    expect(dashSrc).toContain("/aesthetics/piotr-binkowski/");
    expect(dashSrc).toContain("bg-black/82");
    expect(dashSrc).toContain("<Navbar productLinks={false} />");
    expect(dashSrc).toContain("DashboardUpgradeTab");
    expect(dashSrc).toContain('activeTab === "usage"');
    expect(dashSrc).not.toContain('activeTab === "upgrade"');
    expect(readRepo("components/dashboard/dashboard-upgrade-tab.tsx")).toContain("data-dashboard-upgrade");
    expect(readRepo("components/dashboard/dashboard-upgrade-tab.tsx")).toContain("data-dashboard-module");
    expect(readRepo("components/dashboard/dashboard-usage-tab.tsx")).toContain("DashboardUpgradeTab");
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
    expect(workspaceCreateModeFromQuery("knowledge_region")).toBeNull();
    expect(workspaceCreateModeFromQuery("calibration")).toBeNull();
    expect(workspaceCreateModeFromQuery("blank")).toBe("blank");
    expect(workspaceCreateModeFromQuery("files_goal")).toBeNull();
    expect(workspaceCreateModeFromQuery("nope")).toBeNull();
    const page = readRepo("app/workspace/new/page.tsx");
    expect(page).toContain("workspaceCreateModeFromQuery");
    expect(page).toContain('searchParams.get("mode")');
  });
});
