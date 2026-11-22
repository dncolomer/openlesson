import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readDashboardSurface, readRepo } from "../helpers/surface-source";
import {
  dashboardKnowledgeRegionCreateHref,
  dashboardKnowledgeRegionHref,
  parseDashboardKnowledgeRegionKind,
  presentDashboardKnowledgeRegions,
} from "@/lib/dashboard-knowledge-regions";
import {
  knowledgeRegionCreateOffersFlowSelect,
  productFlowNewPath,
  productRegionEditPath,
  productRegionNewPath,
  productRegionPagePath,
} from "@/lib/product-flow";

describe("dashboard knowledge regions", () => {
  it("lists verification and calibration regions by owner_user_id", () => {
    const regions = presentDashboardKnowledgeRegions(
      [
        {
          id: "r-learn",
          name: "Skip",
          owner_user_id: "me",
          product: null,
          subject_count: 2,
          created_at: "2026-01-01",
        },
        {
          id: "r-v",
          name: "Limits",
          owner_user_id: "me",
          product: "verification",
          subject_count: 4,
          created_at: "2026-05-02",
        },
        {
          id: "r-voice",
          name: "Limits · Path + Text",
          owner_user_id: "me",
          product: "verification",
          subject_count: 4,
          created_at: "2026-05-03",
          embedding_model_id: "flowcfg-pathtext-v1-d96",
        },
        {
          id: "r-c",
          name: "Priors",
          owner_user_id: "me",
          product: "calibration",
          description: "thin",
          subject_count: 1,
          created_at: "2026-05-01",
        },
        {
          id: "other",
          name: "Gone",
          owner_user_id: "them",
          product: "verification",
          subject_count: 1,
        },
      ],
      "verification",
      "me",
    );
    expect(regions).toEqual([
      {
        id: "r-v",
        kind: "verification",
        name: "Limits",
        description: null,
        workspaceId: "",
        workspaceTitle: "Verification flows",
        subjectCount: 4,
        createdAt: "2026-05-02",
      },
    ]);
    const calibrate = presentDashboardKnowledgeRegions(
      [
        {
          id: "r-c",
          name: "Priors",
          owner_user_id: "me",
          product: "calibration",
          description: "thin",
          subject_count: 1,
          created_at: "2026-05-01",
        },
      ],
      "calibration",
      "me",
    );
    expect(calibrate[0]?.workspaceTitle).toBe("Calibration flows");
    expect(calibrate[0]?.description).toBe("thin");
    expect(parseDashboardKnowledgeRegionKind("verification")).toBe("verification");
    expect(parseDashboardKnowledgeRegionKind("solve")).toBe("solve");
    expect(parseDashboardKnowledgeRegionKind("learning")).toBeNull();
    const solveRegions = presentDashboardKnowledgeRegions(
      [
        {
          id: "r-s",
          name: "Limits cohort",
          owner_user_id: "me",
          product: "solve",
          subject_count: 3,
          created_at: "2026-06-01",
        },
        {
          id: "r-v",
          name: "Limits",
          owner_user_id: "me",
          product: "verification",
          subject_count: 4,
          created_at: "2026-05-02",
        },
      ],
      "solve",
      "me",
    );
    expect(solveRegions).toEqual([
      {
        id: "r-s",
        kind: "solve",
        name: "Limits cohort",
        description: null,
        workspaceId: "",
        workspaceTitle: "Solve flows",
        subjectCount: 3,
        createdAt: "2026-06-01",
      },
    ]);
    expect(dashboardKnowledgeRegionHref("solve", "r-s")).toBe(
      productRegionPagePath("solve", "r-s"),
    );
    expect(dashboardKnowledgeRegionHref("verification", "r-1")).toBe(
      "/verification/regions/r-1",
    );
    expect(dashboardKnowledgeRegionHref("calibration", "r-c")).toBe(
      productRegionPagePath("calibration", "r-c"),
    );
    expect(productRegionPagePath("calibration", "r-c")).toBe("/calibration/regions/r-c");
    expect(productRegionEditPath("verification", "r-1")).toBe("/verification/regions/r-1/edit");
    expect(productRegionEditPath("solve", "r-s")).toBe("/solve/regions/r-s/edit");
    expect(dashboardKnowledgeRegionCreateHref("verification")).toBe(
      productRegionNewPath("verification"),
    );
    expect(knowledgeRegionCreateOffersFlowSelect(0)).toEqual({
      canSelectExistingFlow: false,
      needsCreateFlowFirst: true,
    });
    expect(knowledgeRegionCreateOffersFlowSelect(2).canSelectExistingFlow).toBe(true);
  });

  it("wires the owner dashboard regions API and tab", () => {
    const route = readRepo("app/api/dashboard/knowledge-regions/route.ts");
    expect(route).toContain("requireAuthenticatedUser");
    expect(route).toContain("knowledge_regions");
    expect(route).toContain("presentDashboardKnowledgeRegions");
    expect(route).toContain("owner_user_id");
    expect(route).not.toContain("listProductFlowWorkspaceIds");
    expect(route).not.toContain("getSolveFlowById");
    expect(route).toContain("Regions are created by running a simulation");
    const dash = readDashboardSurface();
    expect(dash).toContain("data-dashboard-knowledge-regions");
    expect(dash).toContain("DASHBOARD_KNOWLEDGE_REGIONS_PATH");
    expect(dash).toContain("running a simulation of exploration strategies");
    expect(dash).toContain("data-create-flow-first");
    expect(readRepo("components/product-flow/knowledge-region-create.tsx")).not.toContain(
      "data-region-create-from-flow",
    );
    expect(readRepo("components/product-flow/region-simulation-setup.tsx")).toContain(
      "data-create-flow-first",
    );
    expect(readRepo("components/product-flow/knowledge-region-create.tsx")).toContain(
      "RegionSimulationSetup",
    );
    expect(readRepo("components/product-flow/region-simulation-setup.tsx")).toContain(
      "data-run-simulation",
    );
    expect(readRepo("app/api/dashboard/region-simulation/route.ts")).toContain(
      "runRegionSimulation",
    );
    expect(readRepo("components/knowledge-panel/models-view.tsx")).toContain(
      "Overlay regions on the right.",
    );
    expect(readRepo("app/verification/regions/new/page.tsx")).toContain('kind="verification"');
    expect(readRepo("app/solve/regions/new/page.tsx")).toContain('kind="solve"');
    expect(readRepo("app/calibration/regions/[id]/page.tsx")).toContain("KnowledgeRegionPage");
    expect(readRepo("app/calibration/regions/[id]/page.tsx")).not.toContain("redirect");
    expect(readRepo("app/verification/regions/[id]/page.tsx")).toContain("KnowledgeRegionPage");
    expect(readRepo("app/verification/regions/[id]/page.tsx")).not.toContain("redirect");
    expect(readRepo("app/solve/regions/[id]/page.tsx")).toContain("KnowledgeRegionPage");
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).toContain(
      "dashboardKnowledgeRegionHref(region.kind, region.id)",
    );
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).toContain(
      "data-dashboard-type-filter",
    );
    expect(readRepo("app/regions/new/page.tsx")).toContain("KnowledgeRegionCreate");
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).not.toContain(
      "dashboardKnowledgeRegionStudioHref",
    );
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).toContain(
      "Open details",
    );
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).toContain(
      "data-open-region-edit",
    );
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).toContain(
      "dashboardKnowledgeRegionEditHref",
    );
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).not.toContain(
      "Open in Data Studio",
    );
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).toContain(
      "data-open-region-details",
    );
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).toContain(
      "data-dashboard-knowledge-region-table",
    );
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).not.toContain(
      "data-dashboard-knowledge-region-grid",
    );
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).not.toContain(
      "?section=knowledge",
    );
    expect(
      existsSync(join(__dirname, "../../components/product-flow/knowledge-region-page.tsx")),
    ).toBe(true);
    expect(readRepo("app/verification/regions/[id]/edit/page.tsx")).toContain('mode="edit"');
    expect(readRepo("app/calibration/regions/[id]/edit/page.tsx")).toContain('mode="edit"');
    expect(readRepo("app/solve/regions/[id]/edit/page.tsx")).toContain('mode="edit"');
    expect(readRepo("app/api/dashboard/knowledge-regions/[id]/route.ts")).toContain(
      "trashRegionSimulation",
    );
    expect(readRepo("app/api/dashboard/knowledge-regions/[id]/route.ts")).toContain(
      "export async function DELETE",
    );
    const detailsPage = readRepo("components/product-flow/knowledge-region-page.tsx");
    expect(detailsPage).toContain("data-knowledge-region-details");
    expect(detailsPage).toContain('mode === "edit"');
    expect(detailsPage).toContain('mode === "view" && figure');
    expect(detailsPage).toContain("data-knowledge-region-trash");
    expect(detailsPage).not.toContain("data-knowledge-region-remove-simulated");
    expect(detailsPage).not.toContain("data-knowledge-region-remove-cluster");
    expect(detailsPage).toContain("data-knowledge-region-summary");
    expect(detailsPage).toContain("<details");
    expect(detailsPage).toContain("lg:grid-cols-[7fr_3fr]");
    expect(detailsPage).toContain("data-knowledge-region-clusters");
    expect(detailsPage).toContain("data-knowledge-region-controls");
    expect(detailsPage).not.toContain("data-knowledge-region-samples");
    expect(detailsPage).toContain("data-knowledge-region-legend");
    expect(detailsPage).toContain("data-knowledge-region-polar");
    expect(detailsPage).toContain("data-knowledge-region-projection");
    expect(detailsPage).toContain("data-knowledge-region-figure-zoom-fit");
    expect(detailsPage).toContain("data-knowledge-region-figure-frame");
    expect(detailsPage).toContain("data-knowledge-region-figure-mode");
    expect(detailsPage).toContain('data-knowledge-region-figure-mode-option="quadrant"');
    expect(detailsPage).toContain('data-knowledge-region-figure-space-option="quadrant"');
    expect(detailsPage).toContain('data-knowledge-region-figure-track-option="path"');
    expect(detailsPage).toContain("data-knowledge-region-section");
    expect(detailsPage).toContain("data-knowledge-region-identity");
    expect(detailsPage).toContain("data-knowledge-region-identity-focus");
    expect(detailsPage).toContain("KnowledgeRegionInspect");
    expect(detailsPage).toContain("inspectStudioEmbedding");
    expect(readRepo("components/product-flow/knowledge-region-inspect.tsx")).toContain(
      "data-knowledge-region-inspect",
    );
    expect(readRepo("components/product-flow/knowledge-region-inspect.tsx")).toContain(
      "DataStudioInspectFields",
    );
    expect(detailsPage).not.toContain("zoomStudioCamera");
    expect(detailsPage).not.toContain("panStudioCamera");
    expect(readRepo("app/api/dashboard/knowledge-regions/[id]/route.ts")).toContain(
      "presentKnowledgeRegionDetails",
    );
    expect(productFlowNewPath("verification")).toBe("/verification/flows/new");
  });
});
