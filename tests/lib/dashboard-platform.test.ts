import { describe, expect, it } from "vitest";
import { readDashboardSurface, readRepo } from "../helpers/surface-source";
import {
  DASHBOARD_NAV_GROUPS,
  DASHBOARD_PERFORMANCE_NAV_ITEM,
  DASHBOARD_PRACTICE_NAV_ITEM,
  DASHBOARD_TOP_NAV_ITEMS,
  dashboardCreateHref,
  dashboardCreateLabel,
  dashboardFrameLabel,
  clusterDashboardNavItems,
  dashboardNavGroupIdForTab,
  dashboardHrefForTab,
  dashboardTabForProductSurface,
  dashboardListFilterForTab,
  dashboardProductLabel,
  dashboardRegionsProduct,
  dashboardStudioProduct,
  dashboardTypeFilterForTab,
  isDashboardNavTabItem,
  isDashboardProductTab,
  isDashboardRegionsTab,
  isDashboardShopTab,
  isDashboardStudioTab,
  parseDashboardTab,
} from "@/lib/dashboard-nav";
import {
  DASHBOARD_HOME_CTA_USE_CASE_IDS,
  dashboardHomeCtas,
  dashboardHomeIntegrationsCta,
} from "@/lib/dashboard-home-overview";
import { USE_CASES } from "@/lib/marketing/use-cases";
import {
  DASHBOARD_FLOWS_PAGE_SIZE,
  dashboardWorkspaceCounts,
  paginateDashboardFlows,
  dashboardFlowListShowsTopic,
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
  it("parses sidebar tabs and aliases retired map/shop/help tabs to Home", () => {
    expect(parseDashboardTab("home")).toBe("home");
    expect(parseDashboardTab("learning")).toBe("home");
    expect(parseDashboardTab("insights")).toBe("home");
    expect(parseDashboardTab("verification")).toBe("verification");
    expect(parseDashboardTab("calibration")).toBe("calibration");
    expect(parseDashboardTab("solve")).toBe("solve");
    expect(parseDashboardTab("solve_regions")).toBe("solve_regions");
    expect(parseDashboardTab("solve_studio")).toBe("solve_studio");
    expect(parseDashboardTab("shop")).toBe("home");
    expect(parseDashboardTab("verification_regions")).toBe("verification_regions");
    expect(parseDashboardTab("calibration_regions")).toBe("calibration_regions");
    expect(parseDashboardTab("browse_maps")).toBe("home");
    expect(parseDashboardTab("practice")).toBe("practice");
    expect(parseDashboardTab("practice_studio")).toBe("solve_studio");
    expect(parseDashboardTab("practice_performance")).toBe("practice_performance");
    expect(parseDashboardTab("learning_studio")).toBe("home");
    expect(parseDashboardTab("verification_studio")).toBe("verification_studio");
    expect(parseDashboardTab("calibration_studio")).toBe("calibration_studio");
    expect(parseDashboardTab("help")).toBe("home");
    expect(parseDashboardTab("plans")).toBe("home");
    expect(parseDashboardTab("unknown")).toBe("home");
    expect(parseDashboardTab(null)).toBe("home");
  });

  it("maps product tabs to type filters and create deep-links", () => {
    expect(isDashboardProductTab(parseDashboardTab("learning"))).toBe(false);
    expect(isDashboardProductTab("home")).toBe(false);
    expect(dashboardTypeFilterForTab("home")).toBeNull();
    expect(dashboardTypeFilterForTab("verification")).toBe("verification");
    expect(dashboardTypeFilterForTab("calibration")).toBe("calibration");
    expect(isDashboardProductTab("solve")).toBe(true);
    expect(dashboardTypeFilterForTab("solve")).toBe("solve");
    expect(dashboardTypeFilterForTab("solve_regions")).toBe("solve");
    expect(dashboardTypeFilterForTab("solve_studio")).toBe("solve");
    expect(dashboardTypeFilterForTab(parseDashboardTab("shop"))).toBeNull();
    expect(dashboardTypeFilterForTab("verification_regions")).toBe("verification");
    expect(dashboardTypeFilterForTab("calibration_regions")).toBe("calibration");
    expect(dashboardListFilterForTab(parseDashboardTab("shop"))).toBeNull();
    expect(dashboardListFilterForTab(parseDashboardTab("learning"))).toBeNull();
    expect(isDashboardShopTab(parseDashboardTab("shop"))).toBe(false);
    expect(isDashboardRegionsTab("verification_regions")).toBe(true);
    expect(dashboardRegionsProduct("calibration_regions")).toBe("calibration");
    expect(dashboardFrameLabel("verification_regions")).toBe("Knowledge regions");
    expect(isDashboardStudioTab("learning_studio")).toBe(false);
    expect(isDashboardStudioTab("practice_studio")).toBe(false);
    expect(dashboardStudioProduct("verification_studio")).toBe("verification");
    expect(dashboardTypeFilterForTab("practice")).toBe("solve");
    expect(dashboardFrameLabel("calibration_studio")).toBe("Data Studio");
    expect(dashboardCreateHref("verification")).toBe("/verification/flows/new");
    expect(dashboardCreateHref("calibration")).toBe("/calibration/flows/new");
    expect(dashboardCreateHref("solve")).toBe("/solve/flows/new");
    expect(dashboardCreateHref("solve")).toBe(productFlowNewPath("solve"));
    expect(dashboardCreateHref("verification")).toBe(productFlowNewPath("verification"));
    expect(dashboardCreateHref("calibration")).toBe(productFlowNewPath("calibration"));
    expect(dashboardProductLabel("verification")).toBe("Verification");
    expect(dashboardCreateLabel("verification")).toBe("Create Verification flow →");
    expect(dashboardCreateLabel("calibration")).toBe("Create Calibration flow →");
    expect(dashboardProductLabel("solve")).toBe("Solve");
    expect(dashboardCreateLabel("solve")).toBe("Create Solve flow →");
    expect(dashboardFrameLabel("solve")).toBe("Solve");
    expect(dashboardFrameLabel("solve_regions")).toBe("Knowledge regions");
    expect(dashboardStudioProduct("solve_studio")).toBe("solve");
    expect(dashboardRegionsProduct("solve_regions")).toBe("solve");
    expect(dashboardTabForProductSurface("solve")).toBe("solve");
    expect(dashboardTabForProductSurface("solve", "region")).toBe("solve_regions");
    expect(dashboardFrameLabel("calibration")).toBe("Calibration");
    expect(dashboardFrameLabel("home")).toBe("Home");
    expect(dashboardHrefForTab("home")).toBe("/dashboard");
    expect(dashboardHrefForTab("verification")).toBe("/dashboard?tab=verification");
    expect(dashboardTabForProductSurface("verification")).toBe("verification");
    expect(dashboardTabForProductSurface("calibration", "region")).toBe("calibration_regions");
  });

  it("subdivides the sidebar into Home, Solve, Verification, Calibration, and Account", () => {
    const learning = DASHBOARD_NAV_GROUPS.find((group) => (group.id as string) === "learning");
    const teaching = DASHBOARD_NAV_GROUPS.find((group) => (group.id as string) === "teaching");
    const verification = DASHBOARD_NAV_GROUPS.find((group) => group.id === "verification");
    const calibration = DASHBOARD_NAV_GROUPS.find((group) => group.id === "calibration");
    const solve = DASHBOARD_NAV_GROUPS.find((group) => group.id === "solve");
    expect(DASHBOARD_NAV_GROUPS.map((group) => group.id)).toEqual([
      "solve",
      "verification",
      "calibration",
      "account",
    ]);
    expect(learning).toBeUndefined();
    expect(teaching).toBeUndefined();
    expect(DASHBOARD_NAV_GROUPS.map((group) => group.id)).not.toContain("support");
    expect(DASHBOARD_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.id))).not.toContain(
      "browse_maps",
    );
    expect(DASHBOARD_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.id))).not.toContain(
      "my_maps",
    );
    expect(DASHBOARD_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.id))).not.toContain(
      "help",
    );
    expect(DASHBOARD_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label))).not.toContain(
      "My Shop",
    );
    expect(dashboardNavGroupIdForTab("home")).toBeNull();
    expect(dashboardNavGroupIdForTab("practice")).toBeNull();
    expect(dashboardNavGroupIdForTab("practice_performance")).toBeNull();
    expect(solve?.label).toBe("Solve");
    expect(solve?.items.map((item) => item.id)).toEqual([
      "solve",
      "solve_regions",
      "solve_studio",
    ]);
    expect(
      clusterDashboardNavItems(solve?.items ?? []).map((cluster) =>
        cluster.map((item) => item.id),
      ),
    ).toEqual([["solve", "solve_regions", "solve_studio"]]);
    expect(verification?.items.map((item) => item.label)).toEqual([
      "Flows",
      "Knowledge regions",
      "Data Studio",
    ]);
    expect(calibration?.items.map((item) => item.label)).toEqual([
      "Flows",
      "Knowledge regions",
      "Data Studio",
    ]);
    expect(verification?.items.map((item) => item.label)).not.toContain("Workspaces");
    expect(calibration?.items.map((item) => item.label)).not.toContain("Workspaces");
    expect(verification?.items.map((item) => item.id)).toEqual([
      "verification",
      "verification_regions",
      "verification_studio",
    ]);
    expect(calibration?.items.map((item) => item.id)).toEqual([
      "calibration",
      "calibration_regions",
      "calibration_studio",
    ]);
    expect(solve?.items.map((item) => item.label)).toEqual([
      "Flows",
      "Knowledge regions",
      "Data Studio",
    ]);
    expect(DASHBOARD_NAV_GROUPS.map((group) => group.id)).toContain("solve");
    expect(DASHBOARD_NAV_GROUPS.map((group) => group.id)).not.toContain("products");
    expect(dashboardHomeCtas().map((cta) => cta.id)).toEqual([
      "practice",
      "verification",
      "calibration",
    ]);
    expect(dashboardHomeCtas().map((cta) => cta.label)).toEqual([
      "Solve / Practice",
      "Verification",
      "Calibration",
    ]);
    expect(dashboardHomeCtas().map((cta) => cta.href)).toEqual([
      dashboardHrefForTab("solve"),
      dashboardHrefForTab("verification"),
      dashboardHrefForTab("calibration"),
    ]);
    expect(dashboardHomeCtas().map((cta) => cta.links.map((link) => link.label))).toEqual([
      ["Flows", "Knowledge regions", "Data Studio"],
      ["Flows", "Knowledge regions", "Data Studio"],
      ["Flows", "Knowledge regions", "Data Studio"],
    ]);
    expect(dashboardHomeCtas().map((cta) => cta.links.map((link) => link.id))).toEqual([
      ["solve", "solve_regions", "solve_studio"],
      ["verification", "verification_regions", "verification_studio"],
      ["calibration", "calibration_regions", "calibration_studio"],
    ]);
    expect(DASHBOARD_HOME_CTA_USE_CASE_IDS).toEqual({
      practice: "research-ai",
      verification: "team-insight",
      calibration: "technical-hiring",
    });
    const byId = Object.fromEntries(USE_CASES.map((row) => [row.id, row]));
    const homeCtas = dashboardHomeCtas();
    expect(homeCtas[0]?.imageSrc).toBe(byId["research-ai"]?.imageSrc);
    expect(homeCtas[1]?.imageSrc).toBe(byId["team-insight"]?.imageSrc);
    expect(homeCtas[2]?.imageSrc).toBe(byId["technical-hiring"]?.imageSrc);
    expect(dashboardHomeIntegrationsCta()).toEqual({
      id: "integrations",
      label: "Integrations",
      href: dashboardHrefForTab("integrations"),
      eyebrow: "Quick access",
      body: "Connect agents with skill.md, MCP, and API keys.",
      action: "Open integrations →",
    });
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
      learning: 4,
      verification: 0,
      calibration: 0,
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
    const solve = presentDashboardRecentFlow({
      id: "sf1",
      kind: "solve",
      name: "Limits",
      title: "epsilon-delta",
      topic: "epsilon-delta",
      publicToken: "stok",
    });
    expect(solve?.publicPath).toBe("/s/stok");
    expect(solve?.flowPath).toBe(productFlowPagePath("solve", "sf1"));
    expect(solve?.workspacePath).toBe("/solve/flows/sf1");
    expect(solve?.topic).toBe("epsilon-delta");
    expect(solve?.questionCount).toBe(0);
    expect(dashboardFlowListShowsTopic("solve")).toBe(true);
    expect(dashboardFlowListShowsTopic("verification")).toBe(false);
    expect(dashboardFlowListShowsTopic("calibration")).toBe(false);
    expect(presentDashboardRecentFlow({ id: "", kind: "verify", workspaceId: "ws" })).toBeNull();
    const ownerScoped = presentDashboardRecentFlow({
      id: "vf-owner",
      kind: "verify",
      title: "Owned",
      publicToken: "otok",
    });
    expect(ownerScoped?.id).toBe("vf-owner");
    expect(ownerScoped?.publicPath).toBe("/v/otok");
    expect(ownerScoped?.workspaceId).toBe("");
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
          topic: "",
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
          topic: "",
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
    expect(dashSrc).toContain("md:grid-cols-[16rem_minmax(0,1fr)]");
    expect(dashSrc).not.toContain("md:grid-cols-[14rem_minmax(0,1fr)]");
    expect(dashSrc).toContain("md:h-dvh");
    expect(dashSrc).toContain("md:overflow-hidden");
    expect(dashSrc).toContain("md:overflow-y-auto");
    expect(dashSrc).toContain("DashboardDataStudioTab");
    expect(dashSrc).toContain("DashboardPracticePerformanceTab");
    expect(dashboardStudioProduct("solve_studio")).toBe("solve");
    expect(dashboardFrameLabel("solve_studio")).toBe("Data Studio");
    expect(dashboardFrameLabel("practice_performance")).toBe("Performance");
    expect(dashSrc).toContain("isDashboardStudioTab");
    expect(dashSrc).toContain('data-dashboard-data-studio');
    expect(dashSrc).not.toContain("md:row-span-2");
    expect(platform).toContain("DashboardSidebar");
    expect(platform).not.toContain("data-console-frame-label");
    expect(platform).not.toContain("dashboardFrameLabel");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("data-dashboard-sidebar-brand");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("BrandLogo");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("size={28}");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("px-3.5 py-4");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain("LanguageSwitcher");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      "data-dashboard-nav-cluster",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      "clusterDashboardNavItems",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("data-dashboard-sign-out");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      'group.id === "account"',
    );
    expect(DASHBOARD_TOP_NAV_ITEMS.map((item) => item.id)).toEqual([
      "home",
      "practice",
      "practice_performance",
    ]);
    expect(DASHBOARD_PRACTICE_NAV_ITEM.label).toBe("Browse exercises");
    expect(DASHBOARD_PERFORMANCE_NAV_ITEM.label).toBe("Performance");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("data-dashboard-nav-home");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      "data-dashboard-nav-practice",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      "data-dashboard-nav-performance",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      "DASHBOARD_TOP_NAV_ITEMS",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      "data-dashboard-nav={item.id}",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("homeIdleClass");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain("Platform");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain(
      "data-dashboard-nav-group-toggle",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain("aria-expanded");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain("toggleGroup");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain("openGroups");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("py-1");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("md:sticky");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("md:h-full");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("md:max-h-full");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      'className="shrink-0 border-b border-white/20 px-2 py-2 last:border-b-0"',
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain(
      "open ? \"flex min-h-0 flex-1 flex-col\"",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain(
      "dashboardNavGroupIdForTab(activeTab)",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain(
      "openGroup === group.id",
    );
    expect(dashSrc).toContain('data-dashboard-nav={item.id}');
    expect(dashSrc).toContain("DashboardHomeTab");
    expect(dashSrc).not.toContain("DashboardHelpTab");
    expect(dashSrc).toContain("data-dashboard-home");
    expect(dashSrc).not.toContain("data-dashboard-recent-workspace");
    expect(dashSrc).not.toContain("data-dashboard-home-recent-workspaces");
    expect(dashSrc).not.toContain("Recent workspaces");
    expect(dashSrc).not.toContain("WorkspaceCardHero");
    expect(dashSrc).toContain("data-dashboard-home-overview");
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain(
      "data-dashboard-home-cta",
    );
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain("{cta.label}");
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain("{cta.body}");
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain("{cta.imageSrc}");
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain("{link.href}");
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain("{link.label}");
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain(
      "data-dashboard-home-cta-visual",
    );
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain(
      "min-h-[calc(100dvh-4rem)]",
    );
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain("mt-auto");
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain(
      'className="object-cover"',
    );
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).not.toContain(
      "object-contain",
    );
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain(
      "absolute inset-x-0 bottom-0",
    );
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain(
      "bg-gradient-to-t from-black",
    );
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain(
      "data-dashboard-home-integrations",
    );
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain(
      "data-dashboard-home-integrations-link",
    );
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain(
      "dashboardHomeIntegrationsCta",
    );
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain(
      "sticky top-0 z-10",
    );
    expect(readRepo("lib/dashboard-home-overview.ts")).toContain("Solve / Practice");
    expect(readRepo("lib/dashboard-home-overview.ts")).toContain("Verification");
    expect(readRepo("lib/dashboard-home-overview.ts")).toContain("Calibration");
    expect(dashSrc).not.toContain("data-dashboard-home-announcements");
    expect(dashSrc).not.toContain("DASHBOARD_ANNOUNCEMENTS");
    expect(dashSrc).toContain("data-dashboard-practice");
    expect(dashSrc).not.toContain("data-dashboard-browse-maps-search");
    expect(dashSrc).not.toContain("Quick Work Session");
    expect(dashSrc).not.toContain("data-dashboard-home-stats");
    expect(dashSrc).not.toContain("data-dashboard-recent-flow");
    expect(dashSrc).toContain("data-dashboard-product={productTab}");
    expect(dashSrc).not.toContain("data-dashboard-product-stats");
    expect(dashSrc).not.toContain("data-dashboard-shop");
    expect(dashSrc).toContain("data-dashboard-knowledge-regions");
    expect(dashSrc).toContain("DashboardKnowledgeRegionsTab");
    expect(dashSrc).toContain("DashboardFlowsTab");
    expect(dashSrc).not.toContain("DashboardInsightsTab");
    expect(dashSrc).not.toContain("data-dashboard-insights");
    expect(dashSrc).toContain("data-dashboard-flows");
    expect(dashSrc).toContain("data-dashboard-flow-table");
    expect(dashSrc).toContain("dashboardFlowListShowsTopic");
    expect(dashSrc).toContain("data-dashboard-flow-topic");
    expect(dashSrc).toContain("{showTopic ? \"Topic\" : \"Questions\"}");
    expect(dashSrc).not.toContain("data-dashboard-flow-grid");
    expect(dashSrc).not.toContain("data-dashboard-workspace-table");
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
    expect(readRepo("components/product-flow/product-surface.tsx")).toContain("DashboardSidebar");
    expect(readRepo("components/product-flow/product-surface.tsx")).toContain("data-dashboard-platform");
    expect(readRepo("components/product-flow/product-surface.tsx")).not.toContain("Navbar");
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).toContain(
      "dashboardTabForProductSurface(kind)",
    );
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
    expect(productFlowDashboardPath("solve")).toBe("/dashboard?tab=solve");
    expect(absoluteFlowPublicUrl("/s/tok", "https://app.example")).toBe("https://app.example/s/tok");
    expect(absoluteFlowPublicUrl("/v/tok", "https://app.example")).toBe("https://app.example/v/tok");
    expect(absoluteFlowPublicUrl("https://app.example/c/tok", "https://other")).toBe(
      "https://app.example/c/tok",
    );
    expect(dashSrc).toContain("CopyFlowUrlButton");
    expect(readRepo("components/product-flow/copy-flow-url-button.tsx")).toContain("data-flow-copy-url");
    expect(readRepo("components/product-flow/copy-flow-url-button.tsx")).toContain("absoluteFlowPublicUrl");
    expect(readRepo("components/product-flow/product-flow-page.tsx")).toContain("CopyFlowUrlButton");
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).toContain("data-flow-problem");
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).not.toContain(
      "data-verification-generate-from-topic",
    );
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).not.toContain(
      "Generate questions from this topic",
    );
    expect(readRepo("components/product-flow/product-flow-page.tsx")).not.toContain("data-verification-flow-skill");
    expect(readRepo("components/product-flow/product-flow-page.tsx")).not.toContain("Generate skill");
    expect(readRepo("components/product-flow/product-flow-page.tsx")).toContain("data-flow-problem");
    expect(readRepo("components/product-flow/product-flow-page.tsx")).not.toContain(
      "data-calibration-flow-add-question",
    );
    expect(dashSrc).not.toContain("learningWorkspaces");
    expect(readRepo("app/verification/flows/new/page.tsx")).toContain('kind="verification"');
    expect(readRepo("app/calibration/flows/new/page.tsx")).toContain('kind="calibration"');
    expect(readRepo("app/solve/flows/new/page.tsx")).toContain('kind="solve"');
    expect(readRepo("app/solve/flows/[id]/page.tsx")).toContain("ProductFlowPage");
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).toContain(
      "data-solve-flow-editor",
    );
    expect(readRepo("components/product-flow/product-flow-page.tsx")).toContain(
      "data-solve-flow-editor",
    );
    const flowForm = readRepo("components/product-flow/product-flow-form.tsx");
    expect(flowForm).toContain("console-copy");
    expect(flowForm).toContain("border-white/40 bg-black");
    expect(flowForm).not.toContain("bg-neutral-900");
    for (const rel of [
      "components/product-flow/product-flow-wizard.tsx",
      "components/product-flow/product-flow-page.tsx",
      "components/product-flow/region-simulation-setup.tsx",
    ]) {
      const src = readRepo(rel);
      expect(src, rel).toContain("product-flow-form");
      expect(src, rel).toContain("FlowFormHeader");
      expect(src, rel).toContain("FlowFormCard");
      expect(src, rel).not.toContain("bg-neutral-900");
      expect(src, rel).not.toContain("border-neutral-700");
    }
    expect(readRepo("components/product-flow/product-surface.tsx")).not.toContain(
      "data-console-frame-label",
    );
    expect(readRepo("app/verification/flows/[id]/page.tsx")).toContain("ProductFlowPage");
    expect(readRepo("app/calibration/flows/[id]/page.tsx")).toContain("ProductFlowPage");
    expect(readRepo("app/workspace/[[...slug]]/page.tsx")).toContain("RetiredProductPage");
    expect(readRepo("components/dashboard/dashboard-flows-tab.tsx")).toContain(
      "dashboardCreateLabel(productTab)",
    );
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
    expect(dashSrc).not.toContain("data-dashboard-help-coming-soon");
    expect(dashSrc).not.toContain('activeTab === "plans"');
    expect(dashSrc).not.toContain("DASHBOARD_BACKGROUND");
    expect(dashSrc).toContain("data-dashboard-atmosphere");
    expect(dashSrc).not.toContain("data-dashboard-atmosphere-grid");
    expect(dashSrc).not.toContain("/aesthetics/piotr-binkowski/");
    expect(dashSrc).not.toContain("bg-black/82");
    expect(readRepo("components/dashboard/dashboard-atmosphere.tsx")).toContain("#0e1c2c");
    expect(readRepo("components/dashboard/dashboard-atmosphere.tsx")).toContain("PUBLIC_FIELD_STILLS");
    expect(readRepo("components/dashboard/dashboard-atmosphere.tsx")).toContain("bg-[#0e1c2c]/78");
    expect(readRepo("components/dashboard/dashboard-atmosphere.tsx")).not.toContain("PublicConsoleWash");
    expect(readRepo("components/dashboard/dashboard-atmosphere.tsx")).not.toContain("PUBLIC_MAGI_GRID_CLASS");
    expect(readRepo("components/ui/console-frame.tsx")).not.toContain("PUBLIC_MAGI_GRID_CLASS");
    expect(readRepo("components/ui/console-frame.tsx")).not.toContain("CONSOLE_GRID_STYLE");
    expect(readRepo("components/ui/console-frame.tsx")).not.toContain("72px_72px");
    expect(readRepo("app/page.tsx")).not.toContain("PUBLIC_MAGI_GRID_CLASS");
    expect(readRepo("components/marketing/landing-heroes.tsx")).not.toContain("PUBLIC_MAGI_GRID_CLASS");
    expect(readRepo("components/dashboard/dashboard-atmosphere.tsx")).not.toContain("rgba(255,255,255,0.06)");
    const panelCss = readRepo("app/globals.css");
    expect(panelCss).toContain("--console-panel-bg: #000");
    expect(panelCss).toContain(".console-panel-fill");
    expect(panelCss).toContain(".console-panel-fill,\n.console-copy {");
    expect(panelCss).toContain("background-color: var(--console-panel-bg)");
    const copyBlock = panelCss.slice(
      panelCss.indexOf(".console-panel-fill,"),
      panelCss.indexOf(".console-copy:has"),
    );
    expect(copyBlock).toContain("background-color: var(--console-panel-bg)");
    expect(copyBlock).not.toContain("rgba(0, 0, 0, 0.55)");
    expect(copyBlock).not.toContain("#1a1a1a");
    expect(copyBlock).not.toContain("backdrop-filter");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("console-panel-fill");
    expect(readRepo("components/marketing/landing-heroes.tsx")).toContain("console-copy");
    expect(dashSrc).not.toContain("<Navbar");
    expect(readRepo("app/dashboard/page.tsx")).not.toContain("Navbar");
    expect(dashSrc).toContain("DashboardUpgradeTab");
    expect(dashSrc).toContain('activeTab === "usage"');
    expect(dashSrc).not.toContain('activeTab === "upgrade"');
    expect(readRepo("components/dashboard/dashboard-upgrade-tab.tsx")).toContain("data-dashboard-upgrade");
    expect(readRepo("components/dashboard/dashboard-upgrade-tab.tsx")).toContain("data-dashboard-buy-credits");
    expect(readRepo("components/dashboard/dashboard-usage-tab.tsx")).toContain("DashboardUpgradeTab");
    expect(readRepo("components/dashboard/dashboard-usage-tab.tsx")).toContain("data-dashboard-credits");
    expect(readRepo("components/dashboard/dashboard-usage-tab.tsx")).toContain("creditBalance");
    expect(readRepo("components/dashboard/dashboard-usage-tab.tsx")).toContain("Unlimited");
    expect(readRepo("components/dashboard/dashboard-usage-tab.tsx")).toContain(
      "Platform admin accounts have no credit limit.",
    );
    expect(readRepo("components/dashboard/dashboard-usage-tab.tsx")).not.toContain("StripeConnectPanel");
    expect(readRepo("app/dashboard/page.tsx")).not.toContain("StripeConnectPanel");
    expect(readRepo("app/dashboard/page.tsx")).not.toContain("data-aycl-stripe-connect");
    expect(readRepo("components/dashboard/dashboard-usage-tab.tsx")).not.toContain(
      "data-aycl-stripe-connect",
    );
    expect(readRepo("components/dashboard/dashboard-integrations-tab.tsx")).toContain(
      "/docs/proof-of-work-api",
    );
    expect(readRepo("components/dashboard/dashboard-integrations-tab.tsx")).not.toContain(
      "/docs/learning-map-api",
    );
    expect(readRepo("components/dashboard/dashboard-integrations-tab.tsx")).not.toContain(
      "showWorkspaceLevelNote",
    );
    expect(readRepo("messages/en.json")).toContain("list_flows");
    expect(readRepo("messages/en.json")).not.toContain("create_workspace or list_workspaces");
    expect(readRepo("messages/en.json")).not.toContain("list_map_tools");
    const enMessages = JSON.parse(readRepo("messages/en.json")) as {
      dashboard: Record<string, string>;
      integrationAccess: Record<string, string>;
    };
    expect(enMessages.dashboard.mcpWorkflowSteps).toContain("list_flows");
    expect(enMessages.dashboard.mcpWorkflowSteps).toContain("create_flow");
    expect(enMessages.dashboard.mcpWorkflowSteps).not.toContain("create_workspace");
    expect(enMessages.integrationAccess.skillDescription.toLowerCase()).toContain("flow");
    expect(enMessages.integrationAccess.skillDescription.toLowerCase()).not.toContain(
      "learning map",
    );
    expect(enMessages.integrationAccess.workspaceLevelNote.toLowerCase()).not.toContain(
      "workspace",
    );
    expect(enMessages.integrationAccess.workspaceLevelNote.toLowerCase()).not.toContain(
      "learning map",
    );
    expect(enMessages.integrationAccess.mcpWorkspaceHint.toLowerCase()).not.toContain(
      "workspace-scoped",
    );
    const skill = readRepo("public/skill.md");
    expect(skill).toContain("list_flows");
    expect(skill).toContain("create_flow");
    expect(skill).toContain("get_flow");
    expect(skill).toContain("update_flow");
    expect(skill).toContain("delete_flow");
    expect(skill).toContain("/api/v3/flows");
    expect(skill).toContain("/docs/proof-of-work-api");
    expect(skill).not.toContain("create_workspace");
    expect(skill).not.toContain("list_map_tools");
    expect(skill).not.toContain("apply_map_tool");
    expect(skill).not.toContain("link_flow");
    expect(skill).not.toContain("/api/v3/workspaces");
    expect(skill).not.toContain("/docs/learning-map-api");
    expect(skill.toLowerCase()).not.toContain("learning map");
  });

  it("loads owner-wide recent flows from verification and calibration tables", () => {
    const route = readRepo("app/api/dashboard/recent-flows/route.ts");
    expect(route).toContain("requireAuthenticatedUser");
    expect(route).toContain("verify_flows");
    expect(route).toContain("calibrate_flows");
    expect(route).toContain("presentDashboardRecentFlow");
  });
});

describe("workspace create query mode", () => {
  it("retired workspace create routes render the contact screen", () => {
    expect(workspaceCreateModeFromQuery("knowledge_region")).toBeNull();
    expect(workspaceCreateModeFromQuery("calibration")).toBeNull();
    expect(workspaceCreateModeFromQuery("blank")).toBe("blank");
    const page = readRepo("app/workspace/[[...slug]]/page.tsx");
    expect(page).toContain("RetiredProductPage");
    expect(page).not.toContain("createBlankMap");
  });
});
