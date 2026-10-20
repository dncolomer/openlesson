import { describe, expect, it } from "vitest";
import { readDashboardSurface, readRepo } from "../helpers/surface-source";
import {
  DASHBOARD_CATALOG_PATH,
  DASHBOARD_MAPS_ADD_PATH,
  DASHBOARD_MAPS_REMOVE_PATH,
  DASHBOARD_MAPS_TRY_PATH,
  PUBLISH_PLAY_COPY_MESSAGE,
  collectPublicMapCategories,
  filterPublicMapCatalog,
  DASHBOARD_HOME_HERO_COUNT,
  DASHBOARD_HOME_SECONDARY_COUNT,
  partitionPublicMapCatalog,
  pickHomeMapTryBlock,
  presentPublicMapCatalog,
  presentPublicMapCatalogItem,
  rejectPublishPlayCopy,
  truncatePublicMapSummary,
} from "@/lib/dashboard-home-catalog";
import {
  learningWorkspaceFeatures,
  workspaceSupportsFeature,
} from "@/lib/workspace-capabilities";
import { settingsShowsMakePublic } from "@/lib/workspace-settings-tabs";
import {
  DASHBOARD_NAV_GROUPS,
  dashboardFrameLabel,
  isDashboardMyMapsTab,
  parseDashboardTab,
} from "@/lib/dashboard-nav";
import {
  dashboardMapBuyCheckoutBody,
  ADD_TO_MY_MAPS_LABEL,
  REMOVE_FROM_MY_MAPS_LABEL,
  catalogMapIsInMyMaps,
  decideAddToMyMaps,
  decideRemoveFromMyMaps,
  findExistingPlayCopyId,
  isPlayCopyWorkspace,
  playCopyBlockSidebar,
  playCopyFulfillOwnerUserId,
  playCopyStartSessionLabel,
  playCopyStartSessionTarget,
  playCopyMyMapsHref,
  playCopyWorkspaceHref,
} from "@/lib/workspace-play-copy";
import { workspaceShell } from "@/lib/workspace-mode";
import { START_NEW_SESSION_LABEL } from "@/lib/block-previous-sessions";
import { LANDING_FEATURED_MAP_IDS } from "@/lib/marketing/landing-featured-ids";

function row(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "map-1",
    title: "Limits",
    root_topic: "Calculus",
    is_public: true,
    aycl_category: "Math",
    created_at: "2026-06-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("dashboard home public catalog", () => {
  it("presents public maps and drops unpublished rows", () => {
    expect(presentPublicMapCatalogItem(row())).toMatchObject({
      id: "map-1",
      title: "Limits",
      category: "Math",
      isAycl: false,
      priceLabel: null,
    });
    expect(presentPublicMapCatalogItem(row({ is_public: false }))).toBeNull();
    expect(presentPublicMapCatalogItem(row({ aycl_category: "  " }))).toMatchObject({
      id: "map-1",
      category: "",
    });
    expect(presentPublicMapCatalogItem(row({ is_play_copy: true }))).toBeNull();
    expect(
      presentPublicMapCatalogItem(row({ workspace_kind: "knowledge_region" })),
    ).toBeNull();
    expect(workspaceSupportsFeature("standard", "make_public")).toBe(true);
    expect(settingsShowsMakePublic("standard")).toBe(true);
    expect(rejectPublishPlayCopy({ makingPublic: true, isPlayCopy: true })).toBe(
      PUBLISH_PLAY_COPY_MESSAGE,
    );
    expect(rejectPublishPlayCopy({ makingPublic: true, isPlayCopy: false })).toBeNull();
    expect(
      presentPublicMapCatalogItem(
        row({ is_all_you_can_learn: true, aycl_full_price_cents: 2500 }),
      )?.priceLabel,
    ).toBe("$25");
    expect(
      presentPublicMapCatalogItem(
        row({ description: "A map of limits and continuity.", aycl_summary: null }),
      )?.summary,
    ).toBe("A map of limits and continuity.");
    expect(
      presentPublicMapCatalogItem(
        row({
          aycl_summary: null,
          description: null,
          workspace_goal: "Prove the squeeze theorem.",
        }),
      )?.summary,
    ).toBe("Prove the squeeze theorem.");
    expect(truncatePublicMapSummary("Short blurb")).toBe("Short blurb");
    expect(truncatePublicMapSummary("word ".repeat(80)).endsWith("…")).toBe(true);
  });

  it("searches by name and category and partitions hero, secondary, grid, and AYCL paid", () => {
    const pinned = LANDING_FEATURED_MAP_IDS.slice(
      0,
      DASHBOARD_HOME_HERO_COUNT + DASHBOARD_HOME_SECONDARY_COUNT + 2,
    );
    const items = presentPublicMapCatalog([
      row({
        id: "newer-public",
        title: "Newer public map",
        created_at: "2026-10-01T00:00:00.000Z",
      }),
      ...pinned.map((id, index) =>
        row({
          id,
          title: `Featured ${index}`,
          created_at: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        }),
      ),
      row({
        id: "s1",
        title: "Secondary algebra",
        aycl_category: "Science",
        created_at: "2026-06-05T00:00:00.000Z",
      }),
      row({
        id: "paid",
        title: "Paid studio",
        is_all_you_can_learn: true,
        aycl_category: "Design",
        created_at: "2026-06-04T00:00:00.000Z",
      }),
      ...Array.from({ length: 10 }, (_, index) =>
        row({
          id: `g${index}`,
          title: `Grid ${index}`,
          created_at: `2026-05-${String(20 - index).padStart(2, "0")}T00:00:00.000Z`,
        }),
      ),
    ]);
    const parts = partitionPublicMapCatalog(items);
    expect(parts.hero.map((item) => item.id)).toEqual(
      LANDING_FEATURED_MAP_IDS.slice(0, DASHBOARD_HOME_HERO_COUNT),
    );
    expect(parts.hero[0]?.id).toBe(LANDING_FEATURED_MAP_IDS[0]);
    expect(parts.secondary.map((item) => item.id)).toEqual(
      LANDING_FEATURED_MAP_IDS.slice(
        DASHBOARD_HOME_HERO_COUNT,
        DASHBOARD_HOME_HERO_COUNT + DASHBOARD_HOME_SECONDARY_COUNT,
      ),
    );
    expect(parts.grid.map((item) => item.id)).toContain("newer-public");
    expect(parts.grid.map((item) => item.id)).toContain(
      LANDING_FEATURED_MAP_IDS[DASHBOARD_HOME_HERO_COUNT + DASHBOARD_HOME_SECONDARY_COUNT],
    );
    expect(parts.grid.map((item) => item.id)).not.toContain(LANDING_FEATURED_MAP_IDS[0]);
    expect(parts.ayclPaid.map((item) => item.id)).toEqual(["paid"]);
    expect(filterPublicMapCatalog(items, { query: "algebra" }).map((item) => item.id)).toEqual([
      "s1",
    ]);
    expect(filterPublicMapCatalog(items, { query: "design" }).map((item) => item.id)).toEqual([
      "paid",
    ]);
    expect(filterPublicMapCatalog(items, { category: "Science" }).map((item) => item.id)).toEqual([
      "s1",
    ]);
    expect(collectPublicMapCategories(items)).toEqual(["Design", "Math", "Science"]);
  });

  it("picks the start block for Try Now, else the first by position", () => {
    expect(pickHomeMapTryBlock([])).toBeNull();
    expect(pickHomeMapTryBlock([{ id: "  " }])).toBeNull();
    const laterStart = {
      id: "b-start",
      is_start: true,
      position_x: 40,
      position_y: 80,
    };
    expect(
      pickHomeMapTryBlock([
        { id: "b-top", is_start: false, position_x: 10, position_y: 0 },
        laterStart,
      ]),
    ).toEqual(laterStart);
    expect(
      pickHomeMapTryBlock([
        { id: "right", position_x: 20, position_y: 10 },
        { id: "left", position_x: 5, position_y: 10 },
        { id: "below", position_x: 0, position_y: 30 },
      ])?.id,
    ).toBe("left");
  });

});

describe("add to my maps and play copies", () => {
  it("forks free public maps, requires buy for AYCL, and reuses an existing play copy", () => {
    expect(
      decideAddToMyMaps({
        source: { id: "src", is_public: true, is_all_you_can_learn: false },
      }),
    ).toEqual({ action: "fork" });
    expect(
      decideAddToMyMaps({
        source: { id: "src", is_public: true, is_all_you_can_learn: true },
      }),
    ).toEqual({ action: "buy" });
    expect(
      decideAddToMyMaps({
        source: { id: "src", is_public: false },
      }),
    ).toEqual({ action: "reject", reason: "not_public" });
    expect(
      decideAddToMyMaps({
        source: { id: "src", is_public: true },
        existingCopies: [
          { id: "copy-1", original_workspace_id: "src", is_play_copy: true },
        ],
      }),
    ).toEqual({ action: "reuse", copyId: "copy-1" });
    expect(isPlayCopyWorkspace({ is_play_copy: true })).toBe(true);
    expect(findExistingPlayCopyId([{ id: "x", original_workspace_id: "src" }], "src")).toBeNull();
    expect(playCopyWorkspaceHref("abc")).toBe("/workspace/abc");
    expect(playCopyMyMapsHref()).toBe("/dashboard?tab=my_maps");
    expect(dashboardMapBuyCheckoutBody("src")).toEqual({
      priceType: "all_you_can_learn",
      workspaceId: "src",
      ayclAccessTier: "full",
      dashboardPlayCopy: true,
    });
    expect(
      playCopyFulfillOwnerUserId({
        dashboardPlayCopy: true,
        purchaserUserId: "user-1",
        guestUserId: "guest-1",
      }),
    ).toBe("user-1");
    expect(
      playCopyFulfillOwnerUserId({
        dashboardPlayCopy: false,
        purchaserUserId: "user-1",
        guestUserId: "guest-1",
      }),
    ).toBe("guest-1");
    expect(
      catalogMapIsInMyMaps(
        [{ id: "copy-1", original_workspace_id: "src", is_play_copy: true }],
        "src",
      ),
    ).toBe(true);
    expect(catalogMapIsInMyMaps([], "src")).toBe(false);
    expect(
      decideRemoveFromMyMaps({
        sourceWorkspaceId: "src",
        existingCopies: [
          { id: "copy-1", original_workspace_id: "src", is_play_copy: true },
        ],
      }),
    ).toEqual({ action: "remove", copyId: "copy-1" });
    expect(
      decideRemoveFromMyMaps({ sourceWorkspaceId: "src", existingCopies: [] }),
    ).toEqual({ action: "reject", reason: "not_found" });
    expect(
      decideRemoveFromMyMaps({
        sourceWorkspaceId: "copy-1",
        existingCopies: [
          { id: "copy-1", original_workspace_id: "src", is_play_copy: true },
        ],
      }),
    ).toEqual({ action: "remove", copyId: "copy-1" });
    expect(ADD_TO_MY_MAPS_LABEL).toBe("Add to my Maps");
    expect(REMOVE_FROM_MY_MAPS_LABEL).toBe("Remove from my Maps");
  });

  it("play View chrome is map-only with a block sidebar and start-session target", () => {
    const shell = workspaceShell({
      kind: "standard",
      authoring: true,
      playCopy: true,
      isOwner: true,
      isLoggedIn: true,
    });
    expect(shell.playView).toBe(true);
    expect(shell.sections).toEqual(["workspace"]);
    expect(shell.authoringDrawers).toBe(false);
    expect(shell.practiceDrawer).toBe(false);
    expect(playCopyBlockSidebar({ title: "Derivatives", description: "Rate of change." })).toEqual({
      title: "Derivatives",
      description: "Rate of change.",
    });
    expect(playCopyStartSessionLabel()).toBe(START_NEW_SESSION_LABEL);
    expect(playCopyStartSessionTarget().id).toBe("explore_dialog");
  });
});

describe("dashboard home and my maps surface", () => {
  it("wires Home cinematic catalog, floating prompt bar, My Maps, and play View", () => {
    const learning = DASHBOARD_NAV_GROUPS.find((group) => group.id === "learning");
    expect(learning?.items.map((item) => item.id)).toEqual(["my_maps", "learning", "shop"]);
    expect(learning?.items.map((item) => item.label)).toEqual([
      "My Maps",
      "Build",
      "Your Shop",
    ]);
    expect(isDashboardMyMapsTab("my_maps")).toBe(true);
    expect(parseDashboardTab("my_maps")).toBe("my_maps");
    expect(dashboardFrameLabel("my_maps")).toBe("My Maps");

    const dash = readDashboardSurface();
    expect(readRepo("lib/dashboard-home-catalog.ts")).toContain("orderLandingFeaturedMaps");
    expect(readRepo("lib/dashboard-home-catalog.ts")).toContain("landing-featured-ids");
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toMatch(
      /className="console-copy sticky[^"]*"[\s\S]*data-dashboard-play-bar/,
    );
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx").indexOf("data-dashboard-home-hero")).toBeLessThan(
      readRepo("components/dashboard/dashboard-home-tab.tsx").indexOf("data-dashboard-play-bar"),
    );
    expect(dash).toContain("data-dashboard-home-hero");
    expect(dash).toContain("data-dashboard-map-hero-summary");
    expect(dash).toContain("data-dashboard-map-card-summary");
    expect(dash).toContain('fallback="aesthetic"');
    expect(dash).toContain("coverImagePool={workspaceCoverPool}");
    expect(dash).toContain("truncatePublicMapSummary");
    expect(dash).toContain("data-dashboard-home-secondary");
    expect(dash).toContain("data-dashboard-home-maps-grid");
    expect(dash).toContain("data-dashboard-home-aycl");
    expect(dash).toContain("data-dashboard-home-search");
    expect(dash).toContain("data-dashboard-play-bar");
    expect(dash).toContain("Quick Work Session");
    expect(dash).toContain("data-dashboard-map-detail");
    expect(dash).toContain("data-dashboard-home-detail");
    expect(dash).toContain("data-dashboard-home-list");
    expect(dash).toContain("data-dashboard-map-back");
    expect(dash).toContain("Back to maps");
    expect(dash).toContain("data-dashboard-map-detail-summary");
    expect(dash).toContain("data-dashboard-map-detail-cta");
    expect(dash).toContain("data-dashboard-map-detail-explore");
    expect(dash).toContain("Explore and Learn");
    expect(dash).toContain("Workspace map");
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).not.toContain(
      'aria-modal="true"',
    );
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).not.toContain(
      'role="dialog"',
    );
    expect(readRepo("components/dashboard/dashboard-home-map-detail.tsx")).not.toContain(
      'aria-modal="true"',
    );
    expect(dash).toContain("data-dashboard-add-to-my-maps");
    expect(dash).toContain("data-dashboard-map-buy");
    expect(dash).toContain("data-dashboard-map-try-now");
    expect(dash).toContain("Try Now");
    expect(dash).toContain("data-dashboard-my-maps");
    expect(dash).toContain("data-dashboard-my-maps-card");
    expect(dash).toContain("data-dashboard-my-maps-authored");
    expect(dash).toContain("data-dashboard-my-maps-authored-card");
    expect(dash).toContain("data-dashboard-my-maps-play");
    expect(dash).toContain("authoredMaps={learningWorkspaces}");
    expect(dash).toContain("isAuthoredLearningMap");
    expect(readRepo("components/dashboard/dashboard-my-maps-tab.tsx")).toContain(
      "WorkspaceCardHero",
    );
    expect(readRepo("components/dashboard/dashboard-my-maps-tab.tsx")).toContain(
      'fallback="aesthetic"',
    );
    expect(readRepo("components/dashboard/dashboard-my-maps-tab.tsx")).toContain(
      "DASHBOARD_MAPS_REMOVE_PATH",
    );
    expect(readRepo("components/dashboard/dashboard-my-maps-tab.tsx")).toContain(
      "data-dashboard-remove-from-my-maps",
    );
    expect(readRepo("components/dashboard/dashboard-my-maps-tab.tsx")).toContain(
      "REMOVE_FROM_MY_MAPS_LABEL",
    );
    expect(readRepo("app/api/dashboard/maps/remove/route.ts")).toContain(
      'copySelect().eq("id", workspaceId)',
    );
    expect(dash).toContain("DASHBOARD_CATALOG_PATH");
    expect(dash).toContain("DASHBOARD_MAPS_ADD_PATH");
    expect(dash).toContain("DASHBOARD_MAPS_REMOVE_PATH");
    expect(dash).toContain("DASHBOARD_MAPS_TRY_PATH");
    expect(dash).toContain(DASHBOARD_CATALOG_PATH);
    expect(dash).toContain(DASHBOARD_MAPS_ADD_PATH);
    expect(dash).toContain(DASHBOARD_MAPS_REMOVE_PATH);
    expect(dash).toContain(DASHBOARD_MAPS_TRY_PATH);
    expect(dash).toContain("REMOVE_FROM_MY_MAPS_LABEL");
    expect(dash).toContain("playCopies={myMaps}");
    expect(dash).toContain("data-dashboard-remove-from-my-maps");
    expect(readRepo("app/api/dashboard/maps/remove/route.ts")).toContain(
      "decideRemoveFromMyMaps",
    );
    expect(readRepo("app/api/dashboard/maps/remove/route.ts")).toContain(
      "setWorkspaceArchived",
    );

    const tryRoute = readRepo("app/api/dashboard/maps/try/route.ts");
    expect(tryRoute).toContain("pickHomeMapTryBlock");
    expect(tryRoute).toContain('dashboardPlayHref("learn"');
    expect(tryRoute).toContain("session_mode: \"learning\"");
    expect(tryRoute).toContain("isPlayCopy: true");
    expect(tryRoute).toContain("rejectIfFreeWeeklySessionLimit");

    expect(readRepo("app/api/workspaces/[id]/visibility/route.ts")).not.toContain(
      "rejectPublishWithoutCategory",
    );
    expect(readRepo("app/api/workspaces/[id]/visibility/route.ts")).toContain(
      "rejectPublishPlayCopy",
    );
    expect(learningWorkspaceFeatures()).toContain("make_public");
    expect(readRepo("lib/fork-workspace.ts")).toContain("is_play_copy");
    expect(readRepo("app/api/dashboard/maps/add/route.ts")).toContain("decideAddToMyMaps");
    expect(readRepo("app/api/dashboard/maps/add/route.ts")).toContain("playCopyMyMapsHref");
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).toContain(
      "playCopyMyMapsHref",
    );
    expect(readRepo("components/dashboard/dashboard-home-tab.tsx")).not.toContain(
      "playCopyWorkspaceHref",
    );
    expect(readRepo("components/WorkspaceView.tsx")).toContain("playCopy:");
    expect(readRepo("components/workspace-view/workspace-chrome.tsx")).toContain(
      "data-workspace-play-view",
    );
    expect(readRepo("components/workspace-view/workspace-chrome.tsx")).toContain(
      "data-workspace-back-dashboard",
    );
    expect(readRepo("components/workspace-view/workspace-chrome.tsx")).not.toContain(
      "<Navbar",
    );
    expect(readRepo("components/workspace-view/workspace-play-sidebar.tsx")).toContain(
      "data-workspace-play-block-sidebar",
    );
    expect(readRepo("components/workspace-view/workspace-play-sidebar.tsx")).toContain(
      "data-workspace-play-start-session",
    );
  });
});
