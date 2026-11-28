import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readDashboardSurface, readRepo } from "../helpers/surface-source";

const ROOT = join(__dirname, "../..");
import {
  DASHBOARD_NAV_GROUPS,
  DASHBOARD_TOP_NAV_ITEMS,
  dashboardCreateHref,
  dashboardCreateLabel,
  dashboardFrameLabel,
  clusterDashboardNavItems,
  dashboardNavGroupIdForTab,
  dashboardHrefForTab,
  dashboardTabForProductSurface,
  dashboardProductLabel,
  isDashboardNavTabItem,
  isDashboardProductTab,
  isDashboardRegionsTab,
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
  presentDashboardRecentFlow,
  truncateDashboardFlowName,
  truncateDashboardFlowTopic,
  DASHBOARD_FLOW_NAME_MAX,
  DASHBOARD_FLOW_TOPIC_MAX,
  questionCountFromUnknown,
  sortDashboardRecentFlows,
  sortDashboardFlowsByCreatedAt,
  type DashboardRecentFlow,
} from "@/lib/dashboard-home";
import { workspaceCreateModeFromQuery } from "@/lib/workspace-create-modes";
import {
  acceptProductFlowPublish,
  emptyProductFlowDraft,
  flowDisplayName,
  absoluteFlowPublicUrl,
  flowPublicHref,
  productFlowDashboardPath,
  productFlowNewPath,
  productFlowPagePath,
} from "@/lib/product-flow";

describe("dashboard nav", () => {
  it("parses canonical sidebar tabs and falls back to Home for unknown values", () => {
    expect(parseDashboardTab("home")).toBe("home");
    expect(parseDashboardTab("protocols")).toBe("protocols");
    expect(parseDashboardTab("regions")).toBe("regions");
    expect(parseDashboardTab("usage")).toBe("usage");
    expect(parseDashboardTab("organization")).toBe("organization");
    expect(parseDashboardTab("protocol_settings")).toBe("protocol_settings");
    expect(parseDashboardTab("integrations")).toBe("integrations");
    expect(parseDashboardTab("config")).toBe("config");
    // Legacy/retired aliases no longer redirect to another tab; they default to Home
    expect(parseDashboardTab("learning")).toBe("home");
    expect(parseDashboardTab("verification")).toBe("home");
    expect(parseDashboardTab("calibration")).toBe("home");
    expect(parseDashboardTab("solve")).toBe("home");
    expect(parseDashboardTab("browse_maps")).toBe("home");
    expect(parseDashboardTab("style")).toBe("home");
    expect(parseDashboardTab("upgrade")).toBe("home");
    expect(parseDashboardTab("unknown")).toBe("home");
    expect(parseDashboardTab(null)).toBe("home");
  });

  it("maps product tabs to type filters and create deep-links", () => {
    expect(isDashboardProductTab(parseDashboardTab("learning"))).toBe(false);
    expect(isDashboardProductTab("home")).toBe(false);
    expect(isDashboardProductTab("solve")).toBe(false);
    expect(isDashboardProductTab("protocol")).toBe(true);
    expect(isDashboardRegionsTab("regions")).toBe(true);
    expect(isDashboardRegionsTab("verification_regions")).toBe(false);
    expect(dashboardFrameLabel("regions")).toBe("Knowledge Regions");
    expect(dashboardFrameLabel(parseDashboardTab("regions"))).toBe("Knowledge Regions");
    expect(dashboardCreateHref()).toBe("/protocols/new");
    expect(dashboardCreateHref("protocol")).toBe("/protocols/new");
    expect(dashboardCreateHref("protocol")).toBe(productFlowNewPath());
    expect(dashboardProductLabel("protocol")).toBe("Protocol");
    expect(dashboardCreateLabel()).toBe("Create protocol →");
    expect(dashboardCreateLabel("protocol")).toBe("Create protocol →");
    expect(dashboardFrameLabel("protocols")).toBe("Protocols");
    expect(dashboardFrameLabel("regions")).toBe("Knowledge Regions");
    expect(dashboardTabForProductSurface("solve")).toBe("protocols");
    expect(dashboardTabForProductSurface("solve", "region")).toBe("regions");
    expect(dashboardFrameLabel("home")).toBe("Home");
    expect(dashboardHrefForTab("home")).toBe("/dashboard");
    expect(dashboardHrefForTab("protocols")).toBe("/dashboard?tab=protocols");
    expect(dashboardTabForProductSurface("verification")).toBe("protocols");
    expect(dashboardTabForProductSurface("calibration", "region")).toBe("regions");
  });

  it("subdivides the sidebar into Home, Flows, Knowledge Regions, and Account", () => {
    const learning = DASHBOARD_NAV_GROUPS.find((group) => (group.id as string) === "learning");
    const teaching = DASHBOARD_NAV_GROUPS.find((group) => (group.id as string) === "teaching");
    expect(DASHBOARD_NAV_GROUPS.map((group) => group.id)).toEqual(["account"]);
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
    expect(dashboardNavGroupIdForTab("protocols")).toBeNull();
    expect(dashboardNavGroupIdForTab("regions")).toBeNull();
    expect(DASHBOARD_TOP_NAV_ITEMS.map((item) => item.id)).toEqual(["home", "protocols", "regions"]);
    expect(DASHBOARD_TOP_NAV_ITEMS.map((item) => item.label)).toEqual([
      "Home",
      "Protocols",
      "Knowledge Regions",
    ]);
    expect(DASHBOARD_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.id))).not.toContain(
      "practice_performance",
    );
    expect(DASHBOARD_NAV_GROUPS.map((group) => group.id)).not.toContain("solve");
    expect(DASHBOARD_NAV_GROUPS.map((group) => group.id)).not.toContain("verification");
    expect(DASHBOARD_NAV_GROUPS.map((group) => group.id)).not.toContain("calibration");
    expect(DASHBOARD_NAV_GROUPS.map((group) => group.id)).not.toContain("products");
    expect(dashboardHomeCtas().map((cta) => cta.id)).toEqual(["protocols", "regions"]);
    expect(dashboardHomeCtas().map((cta) => cta.label)).toEqual(["Protocols", "Knowledge Regions"]);
    expect(dashboardHomeCtas().map((cta) => cta.href)).toEqual([
      dashboardHrefForTab("protocols"),
      dashboardHrefForTab("regions"),
    ]);
    expect(dashboardHomeCtas().map((cta) => cta.links.map((link) => link.label))).toEqual([
      ["Open protocols"],
      ["Open regions"],
    ]);
    expect(dashboardHomeCtas().map((cta) => cta.links.map((link) => link.id))).toEqual([
      ["protocols"],
      ["regions"],
    ]);
    expect(DASHBOARD_HOME_CTA_USE_CASE_IDS).toEqual({
      protocols: "research-ai",
      regions: "team-insight",
    });
    const byId = Object.fromEntries(USE_CASES.map((row) => [row.id, row]));
    const homeCtas = dashboardHomeCtas();
    expect(homeCtas[0]?.imageSrc).toBe(byId["research-ai"]?.imageSrc);
    expect(homeCtas[1]?.imageSrc).toBe(byId["team-insight"]?.imageSrc);
    expect(dashboardHomeIntegrationsCta()).toEqual({
      id: "integrations",
      label: "Integrations",
      href: dashboardHrefForTab("integrations"),
      eyebrow: "Quick access",
      body: "Connect agents with skill.md, coding-agents.md, MCP, and API keys.",
      action: "Open integrations →",
    });
  });

  it("puts Usage on the Account sidebar and aliases Buy more credits to Usage", () => {
    const account = DASHBOARD_NAV_GROUPS.find((group) => group.id === "account");
    expect(account?.items.map((item) => item.id)).toEqual([
      "usage",
      "organization",
      "protocol_settings",
      "integrations",
    ]);
    expect(account?.items.find((item) => item.id === "protocol_settings")?.label).toBe(
      "Protocol Settings",
    );
    expect(dashboardFrameLabel("protocol_settings")).toBe("Protocol Settings");
    expect(dashboardNavGroupIdForTab("protocol_settings")).toBe("account");
    expect(account?.items.some((item) => item.id === "upgrade")).toBe(false);
    expect(parseDashboardTab("upgrade")).toBe("home");
    expect(parseDashboardTab("usage")).toBe("usage");
    expect(dashboardFrameLabel("usage")).toBe("Usage");
    expect(dashboardNavGroupIdForTab("usage")).toBe("account");
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

  it("presents protocol rows, not workspaces", () => {
    const verify = presentDashboardRecentFlow({
      id: "vf1",
      title: "Linear maps",
      workspaceId: "ws1",
      workspaceTitle: "Algebra",
      createdAt: "2026-04-01T00:00:00.000Z",
      publicToken: "tok",
      questionCount: 4,
    });
    expect(verify).toMatchObject({
      id: "vf1",
      name: "Linear maps",
      title: "Linear maps",
      publicPath: "/v/tok",
      workspacePath: "/protocols/vf1",
      protocolPath: "/protocols/vf1",
      challenge: "",
      questionCount: 4,
    });
    expect(verify).not.toHaveProperty("kind");
    expect(verify).not.toHaveProperty("flowPath");
    expect(verify?.protocolPath).toBe(productFlowPagePath("vf1"));

    const leftover = presentDashboardRecentFlow({
      id: "cf1",
      title: "Priors",
      workspaceId: "ws2",
      publicToken: "ctok",
      questionCount: ["a", "b"],
    });
    expect(leftover?.publicPath).toBe("/v/ctok");
    expect(leftover?.name).toBe("Priors");
    expect(leftover?.workspacePath).toBe("/protocols/cf1");
    expect(leftover?.protocolPath).toBe(productFlowPagePath("cf1"));
    const named = presentDashboardRecentFlow({
      id: "sf1",
      name: "Limits",
      title: "epsilon-delta",
      topic: "epsilon-delta",
      publicToken: "stok",
    });
    expect(named?.publicPath).toBe("/v/stok");
    expect(named?.protocolPath).toBe(productFlowPagePath("sf1"));
    expect(named?.workspacePath).toBe("/protocols/sf1");
    expect(named?.challenge).toBe("epsilon-delta");
    expect(named?.questionCount).toBe(0);
    expect(truncateDashboardFlowTopic("")).toBe("—");
    expect(truncateDashboardFlowTopic("epsilon-delta")).toBe("epsilon-delta");
    expect(truncateDashboardFlowTopic("a".repeat(DASHBOARD_FLOW_TOPIC_MAX))).toHaveLength(
      DASHBOARD_FLOW_TOPIC_MAX,
    );
    expect(truncateDashboardFlowTopic(`  ${"word ".repeat(40)}  `).endsWith("…")).toBe(true);
    expect(truncateDashboardFlowTopic("a".repeat(DASHBOARD_FLOW_TOPIC_MAX + 8)).length).toBe(
      DASHBOARD_FLOW_TOPIC_MAX,
    );
    expect(truncateDashboardFlowName("Limits ε-δ")).toBe("Limits ε-δ");
    expect(truncateDashboardFlowName("a".repeat(DASHBOARD_FLOW_NAME_MAX + 8)).length).toBe(
      DASHBOARD_FLOW_NAME_MAX,
    );
    expect(DASHBOARD_FLOW_NAME_MAX).toBe(40);
    expect(DASHBOARD_FLOW_TOPIC_MAX).toBe(48);
    expect(presentDashboardRecentFlow({ id: "", workspaceId: "ws" })).toBeNull();
    const ownerScoped = presentDashboardRecentFlow({
      id: "vf-owner",
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
          name: "A",
          title: "A",
          workspaceId: "w",
          workspaceTitle: "W",
          createdAt: "2026-01-01T00:00:00.000Z",
          publicPath: "/v/a",
          workspacePath: "/protocols/a",
          protocolPath: "/protocols/a",
          challenge: "",
          questionCount: 1,
        },
        {
          id: "b",
          name: "B",
          title: "B",
          workspaceId: "w",
          workspaceTitle: "W",
          createdAt: "2026-05-01T00:00:00.000Z",
          publicPath: "/v/b",
          workspacePath: "/protocols/b",
          protocolPath: "/protocols/b",
          challenge: "",
          questionCount: 2,
        },
      ],
      1,
    );
    expect(sorted.map((row) => row.id)).toEqual(["b"]);
    const mixed: DashboardRecentFlow[] = Array.from({ length: 101 }, (_, i) => ({
      id: `proto-${i}`,
      name: `S${i}`,
      title: `S${i}`,
      workspaceId: "w",
      workspaceTitle: "W",
      createdAt: `2026-11-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      publicPath: `/v/${i}`,
      workspacePath: `/protocols/${i}`,
      protocolPath: `/protocols/${i}`,
      challenge: "",
      questionCount: 0,
    }));
    mixed.push({
      id: "verify-old",
      name: "Limits",
      title: "Limits",
      workspaceId: "w",
      workspaceTitle: "W",
      createdAt: "2026-10-01T00:00:00.000Z",
      publicPath: "/v/old",
      workspacePath: "/protocols/old",
      protocolPath: "/protocols/old",
      challenge: "ε-δ",
      questionCount: 1,
    });
    expect(sortDashboardRecentFlows(mixed, 100).some((row) => row.id === "verify-old")).toBe(
      false,
    );
    expect(sortDashboardFlowsByCreatedAt(mixed).some((row) => row.id === "verify-old")).toBe(
      true,
    );
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
    expect(dashSrc).not.toContain("DashboardDataStudioTab");
    expect(dashSrc).not.toContain("DashboardPracticePerformanceTab");
    expect(dashSrc).not.toContain("DashboardPracticeTab");
    expect(dashboardFrameLabel(parseDashboardTab("regions"))).toBe("Knowledge Regions");
    expect(dashboardFrameLabel(parseDashboardTab("protocols"))).toBe("Protocols");
    expect(dashSrc).not.toContain("isDashboardStudioTab");
    expect(dashSrc).not.toContain("data-dashboard-data-studio");
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
      "data-dashboard-sidebar-footer",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain(
      "md:border-t md:pl-0 md:pt-2",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      "data-dashboard-nav-group={group.id}",
    );
    expect(DASHBOARD_TOP_NAV_ITEMS.map((item) => item.id)).toEqual(["home", "protocols", "regions"]);
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("data-dashboard-nav-home");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain(
      "data-dashboard-nav-practice",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain(
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
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain("toggleGroup");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain("openGroups");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).not.toContain("<option");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      "data-dashboard-org-switcher-search",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      "visibleOrganizationMemberships",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("py-1");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("md:sticky");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("md:h-full");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("md:max-h-full");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      'className="shrink-0 border-b border-white/20 px-2 py-2"',
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      "data-dashboard-org-switcher",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      "data-dashboard-org-switcher-select",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain("mt-auto");
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      "/api/organization/memberships",
    );
    expect(readRepo("components/dashboard/dashboard-sidebar.tsx")).toContain(
      "/api/organization/switch",
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
    expect(readRepo("lib/dashboard-home-overview.ts")).toContain("Protocols");
    expect(readRepo("lib/dashboard-home-overview.ts")).toContain("Knowledge Regions");
    expect(readRepo("lib/dashboard-home-overview.ts")).not.toContain("Solve / Practice");
    expect(dashSrc).not.toContain("data-dashboard-home-announcements");
    expect(dashSrc).not.toContain("DASHBOARD_ANNOUNCEMENTS");
    expect(dashSrc).not.toContain("data-dashboard-practice-performance");
    expect(dashSrc).not.toContain("data-dashboard-practice-browse");
    expect(dashSrc).not.toContain("data-dashboard-browse-maps-search");
    expect(dashSrc).not.toContain("Quick Work Session");
    expect(dashSrc).not.toContain("data-dashboard-home-stats");
    expect(dashSrc).not.toContain("data-dashboard-recent-flow");
    expect(dashSrc).not.toContain("data-dashboard-type-filter");
    expect(dashSrc).not.toContain("data-dashboard-product-stats");
    expect(dashSrc).not.toContain("data-dashboard-shop");
    expect(dashSrc).toContain("data-dashboard-knowledge-regions");
    expect(dashSrc).toContain("DashboardKnowledgeRegionsTab");
    expect(dashSrc).toContain("DashboardFlowsTab");
    expect(dashSrc).not.toContain("DashboardInsightsTab");
    expect(dashSrc).not.toContain("data-dashboard-insights");
    expect(dashSrc).toContain("data-dashboard-flows");
    expect(dashSrc).toContain("data-dashboard-flow-table");
    expect(dashSrc).toContain("table-fixed");
    expect(dashSrc).toContain("truncateDashboardFlowName");
    expect(dashSrc).toContain("truncateDashboardFlowTopic");
    expect(dashSrc).toContain("data-dashboard-flow-challenge");
    expect(dashSrc).toContain("block truncate");
    expect(dashSrc).not.toContain("data-dashboard-flow-questions");
    expect(dashSrc).not.toContain("{showTopic ? \"Topic\" : \"Questions\"}");
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
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).not.toContain(
      "data-flow-kind",
    );
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).toContain("data-flow-name");
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).toContain("Publish");
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).toContain("data-flow-publish");
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).toContain(
      "productFlowDashboardPath()",
    );
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).not.toContain(
      "payload.flowPath",
    );
    expect(productFlowDashboardPath("verification")).toBe("/dashboard?tab=protocols");
    expect(productFlowDashboardPath("calibration")).toBe("/dashboard?tab=protocols");
    expect(productFlowDashboardPath("solve")).toBe("/dashboard?tab=protocols");
    expect(absoluteFlowPublicUrl("/s/tok", "https://app.example")).toBe("https://app.example/s/tok");
    expect(absoluteFlowPublicUrl("/v/tok", "https://app.example")).toBe("https://app.example/v/tok");
    expect(absoluteFlowPublicUrl("https://app.example/c/tok", "https://other")).toBe(
      "https://app.example/c/tok",
    );
    expect(dashSrc).toContain("FlowPublicActions");
    expect(dashSrc).toContain("id={flow.id}");
    expect(dashSrc).not.toContain("Public URL");
    expect(readRepo("components/product-flow/copy-flow-url-button.tsx")).toContain("data-flow-copy-url");
    expect(readRepo("components/product-flow/copy-flow-url-button.tsx")).toContain("data-flow-copy-id");
    expect(readRepo("components/product-flow/copy-flow-url-button.tsx")).toContain("Copy ID");
    expect(readRepo("components/product-flow/copy-flow-url-button.tsx")).toContain("data-flow-start");
    expect(readRepo("components/product-flow/copy-flow-url-button.tsx")).toContain("absoluteFlowPublicUrl");
    expect(readRepo("components/product-flow/copy-flow-url-button.tsx")).toContain("flowPublicHref");
    expect(readRepo("components/product-flow/product-flow-page.tsx")).toContain("FlowPublicLinks");
    expect(readRepo("components/product-flow/product-flow-page.tsx")).toContain("problemReadOnly");
    expect(flowPublicHref("/s/tok")).toBe("/s/tok");
    expect(flowPublicHref("https://app.example/v/tok")).toBe("/v/tok");
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
    expect(readRepo("app/protocols/new/page.tsx")).toContain("ProductFlowWizard");
    expect(readRepo("app/protocols/[id]/page.tsx")).toContain("ProductFlowPage");
    expect(readRepo("components/product-flow/product-flow-wizard.tsx")).not.toContain(
      "data-solve-flow-editor",
    );
    expect(readRepo("components/product-flow/product-flow-page.tsx")).not.toContain(
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
    expect(readRepo("app/protocols/[id]/page.tsx")).toContain("ProductFlowPage");
    expect(existsSync(join(ROOT, "app/workspace/[[...slug]]/page.tsx"))).toBe(false);
    expect(readRepo("components/dashboard/dashboard-flows-tab.tsx")).toContain(
      "dashboardCreateLabel()",
    );
    expect(readRepo("components/dashboard/dashboard-flows-tab.tsx")).not.toContain(
      "data-dashboard-flow-kind",
    );
    expect(readRepo("components/dashboard/dashboard-flows-tab.tsx")).toContain(
      "md:flex-row md:items-end",
    );
    expect(readRepo("components/dashboard/dashboard-flows-tab.tsx")).not.toContain(
      "TYPE_SELECT",
    );
    expect(readRepo("app/protocols/new/page.tsx")).toContain("ProductFlowWizard");
    expect(readRepo("app/regions/new/page.tsx")).toContain("KnowledgeRegionCreate");
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
    expect(readRepo("app/dashboard/page.tsx")).not.toContain("DashboardUpgradeTab");
    expect(dashSrc).toContain('activeTab === "usage"');
    expect(dashSrc).not.toContain('activeTab === "upgrade"');
    expect(readRepo("components/dashboard/dashboard-upgrade-tab.tsx")).toContain("data-dashboard-upgrade");
    expect(readRepo("components/dashboard/dashboard-upgrade-tab.tsx")).toContain("data-dashboard-buy-credits");
    expect(readRepo("components/dashboard/dashboard-upgrade-tab.tsx")).toContain("Buy more credits");
    expect(readRepo("components/dashboard/dashboard-usage-tab.tsx")).toContain("DashboardUpgradeTab");
    expect(readRepo("components/dashboard/dashboard-usage-tab.tsx")).toContain("embedded");
    expect(readRepo("components/dashboard/dashboard-usage-tab.tsx")).not.toContain(
      'setDashboardTab("upgrade")',
    );
    expect(readRepo("components/dashboard/dashboard-usage-tab.tsx")).not.toContain(
      "data-dashboard-buy-more-credits",
    );
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
    expect(readRepo("components/dashboard/dashboard-integrations-tab.tsx")).toContain(
      "PROTOCOL_API_SKILL_PATH",
    );
    expect(readRepo("components/dashboard/dashboard-integrations-tab.tsx")).toContain(
      "data-dashboard-protocol-skill-link",
    );
    expect(readRepo("components/dashboard/dashboard-integrations-tab.tsx")).toContain("mcpSkillLink");
    expect(readRepo("components/dashboard/dashboard-integrations-tab.tsx")).not.toContain(
      "/docs/learning-map-api",
    );
    expect(readRepo("components/dashboard/dashboard-integrations-tab.tsx")).not.toContain(
      "showWorkspaceLevelNote",
    );
    expect(readRepo("messages/en.json")).toContain("list_protocols");
    expect(readRepo("messages/en.json")).not.toContain("create_workspace or list_workspaces");
    expect(readRepo("messages/en.json")).not.toContain("list_map_tools");
    const enMessages = JSON.parse(readRepo("messages/en.json")) as {
      dashboard: Record<string, string>;
      integrationAccess: Record<string, string>;
    };
    expect(enMessages.dashboard.mcpWorkflowSteps).toContain("list_protocols");
    expect(enMessages.dashboard.mcpWorkflowSteps).toContain("create_protocol");
    expect(enMessages.dashboard.mcpWorkflowSteps).toContain("challenge");
    expect(enMessages.dashboard.mcpWorkflowSteps).not.toContain("create_flow");
    expect(enMessages.dashboard.mcpWorkflowSteps).not.toContain("create_workspace");
    expect(enMessages.integrationAccess.skillDescription.toLowerCase()).toContain("protocol");
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
    expect(skill).toMatch(/^---\nname: protocol-api\n/);
    expect(skill).toContain("list_protocols");
    expect(skill).toContain("create_protocol");
    expect(skill).toContain("get_protocol");
    expect(skill).toContain("update_protocol");
    expect(skill).toContain("delete_protocol");
    expect(skill).toContain("/api/v3/protocols");
    expect(skill).not.toContain("create_flow");
    expect(skill).not.toContain("/api/v3/flows");
    expect(skill).toContain("/docs/proof-of-work-api");
    expect(skill).toContain("/skill.md");
    expect(skill).toContain("create_knowledge_region");
    expect(skill).not.toContain("create_workspace");
    expect(skill).not.toContain("list_map_tools");
    expect(skill).not.toContain("apply_map_tool");
    expect(skill).not.toContain("link_flow");
    expect(skill).not.toContain("/api/v3/workspaces");
    expect(skill).not.toContain("/docs/learning-map-api");
    expect(skill.toLowerCase()).not.toContain("learning map");
  });

  it("loads owner-wide recent flows from verification and calibration tables", () => {
    const route = readRepo("app/api/dashboard/recent-protocols/route.ts");
    expect(route).toContain("requireAuthenticatedUser");
    expect(route).toContain("verify_flows");
    expect(route).not.toContain("calibrate_flows");
    expect(route).toContain("presentDashboardRecentFlow");
  });
});

describe("workspace create query mode", () => {
  it("retired workspace create routes are removed", () => {
    expect(workspaceCreateModeFromQuery("knowledge_region")).toBeNull();
    expect(workspaceCreateModeFromQuery("calibration")).toBeNull();
    expect(workspaceCreateModeFromQuery("blank")).toBe("blank");
    expect(existsSync(join(ROOT, "app/workspace/[[...slug]]/page.tsx"))).toBe(false);
  });
});
