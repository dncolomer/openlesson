import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readDashboardSurface, readRepo } from "../helpers/surface-source";
import {
  dashboardKnowledgeRegionCreateHref,
  dashboardKnowledgeRegionHref,
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
  it("lists owner regions as Protocols and skips path-text embeddings", () => {
    const regions = presentDashboardKnowledgeRegions(
      [
        {
          id: "r-learn",
          name: "Skip",
          owner_user_id: "me",
          subject_count: 2,
          created_at: "2026-01-01",
        },
        {
          id: "r-v",
          name: "Limits",
          owner_user_id: "me",
          subject_count: 4,
          created_at: "2026-05-02",
        },
        {
          id: "r-voice",
          name: "Limits · Path + Text",
          owner_user_id: "me",
          subject_count: 4,
          created_at: "2026-05-03",
          embedding_model_id: "flowcfg-pathtext-v1-d96",
        },
        {
          id: "r-c",
          name: "Priors",
          owner_user_id: "me",
          description: "thin",
          subject_count: 1,
          created_at: "2026-05-01",
        },
        {
          id: "other",
          name: "Gone",
          owner_user_id: "them",
          subject_count: 1,
        },
      ],
      "me",
    );
    expect(regions.map((row) => row.id)).toEqual(["r-v", "r-c", "r-learn"]);
    expect(regions[0]).toMatchObject({
      id: "r-v",
      name: "Limits",
      description: null,
      workspaceId: "",
      workspaceTitle: "Protocols",
      subjectCount: 4,
      createdAt: "2026-05-02",
    });
    expect(regions[0]).not.toHaveProperty("kind");
    expect(regions[1]?.workspaceTitle).toBe("Protocols");
    expect(regions[1]?.description).toBe("thin");
    const leftoverSolve = presentDashboardKnowledgeRegions(
      [
        {
          id: "r-s",
          name: "Limits cohort",
          owner_user_id: "me",
          subject_count: 3,
          created_at: "2026-06-01",
        },
      ],
      "me",
    );
    expect(leftoverSolve[0]?.workspaceTitle).toBe("Protocols");
    expect(dashboardKnowledgeRegionHref("r-s")).toBe(productRegionPagePath("r-s"));
    expect(dashboardKnowledgeRegionHref("r-1")).toBe("/regions/r-1");
    expect(productRegionPagePath("r-c")).toBe("/regions/r-c");
    expect(productRegionEditPath("r-1")).toBe("/regions/r-1/edit");
    expect(dashboardKnowledgeRegionCreateHref()).toBe(productRegionNewPath());
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
    expect(readRepo("app/api/dashboard/region-simulation/route.ts")).toContain(
      "publicAiUseCatalog",
    );
    expect(readRepo("app/api/dashboard/region-simulation/route.ts")).toContain(
      "AI_USE_DEFAULT_CHECKED",
    );
    expect(readRepo("components/knowledge-panel/models-view.tsx")).toContain(
      "Overlay regions on the right.",
    );
    expect(readRepo("app/regions/new/page.tsx")).toContain("KnowledgeRegionCreate");
    expect(readRepo("app/regions/[id]/page.tsx")).toContain("KnowledgeRegionPage");
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).toContain(
      "dashboardKnowledgeRegionHref(region.id)",
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
    expect(readRepo("app/regions/[id]/edit/page.tsx")).toContain('mode="edit"');
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
    expect(detailsPage).toContain("PRODUCT_CREATE_SHELL");
    expect(detailsPage).not.toContain("max-w-5xl");
    expect(detailsPage).not.toContain("max-w-3xl");
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
    expect(detailsPage).toContain('data-knowledge-region-figure-space-option="ai_use"');
    expect(detailsPage).toContain('data-knowledge-region-figure-track-option="path"');
    expect(detailsPage).toContain("data-knowledge-region-section");
    expect(detailsPage).toContain("data-knowledge-region-identity");
    expect(detailsPage).toContain("data-knowledge-region-identity-focus");
    expect(detailsPage).toContain("KnowledgeRegionInspect");
    expect(detailsPage).toContain("DASHBOARD_REGION_SIMULATION_JOBS_PATH");
    expect(detailsPage).toContain("inspectStudioEmbedding");
    expect(readRepo("components/product-flow/knowledge-region-inspect.tsx")).toContain(
      "data-knowledge-region-inspect",
    );
    expect(readRepo("components/product-flow/knowledge-region-inspect.tsx")).toContain(
      "data-knowledge-region-inspect-ai-use-nearest",
    );
    expect(readRepo("components/product-flow/knowledge-region-inspect.tsx")).toContain(
      "DataStudioInspectFields",
    );
    expect(readRepo("components/product-flow/knowledge-region-inspect.tsx")).toContain(
      'data-knowledge-region-inspect-tab="unsys"',
    );
    expect(readRepo("components/product-flow/knowledge-region-inspect.tsx")).toContain(
      'data-knowledge-region-inspect-panel="unsys"',
    );
    expect(readRepo("components/product-flow/knowledge-region-inspect.tsx")).toContain(
      "data-knowledge-region-unsys-walk",
    );
    expect(readRepo("components/product-flow/knowledge-region-inspect.tsx")).toContain(
      "highlightId={highlightHid}",
    );
    expect(readRepo("components/product-flow/knowledge-region-inspect.tsx")).toContain(
      'data-knowledge-region-inspect-tab="record"',
    );
    expect(readRepo("components/product-flow/knowledge-region-inspect.tsx")).toContain(
      "data-knowledge-region-distance-table",
    );
    expect(readRepo("components/data-studio/DataStudioInspect.tsx")).toContain("data-stored-record");
    expect(readRepo("components/product-flow/knowledge-region-page.tsx")).toContain("runRecord");
    expect(detailsPage).not.toContain("zoomStudioCamera");
    expect(detailsPage).not.toContain("panStudioCamera");
    expect(readRepo("app/api/dashboard/knowledge-regions/[id]/route.ts")).toContain(
      "presentKnowledgeRegionDetails",
    );
    expect(productFlowNewPath()).toBe("/protocols/new");
  });
});
