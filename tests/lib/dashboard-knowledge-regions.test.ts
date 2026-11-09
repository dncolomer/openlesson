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
      "/dashboard?tab=verification_studio&region=r-1",
    );
    expect(dashboardKnowledgeRegionHref("calibration", "r-c")).toBe(
      productRegionPagePath("calibration", "r-c"),
    );
    expect(productRegionPagePath("calibration", "r-c")).toBe(
      "/dashboard?tab=calibration_studio&region=r-c",
    );
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
    expect(readRepo("app/calibration/regions/[id]/page.tsx")).toContain("redirect");
    expect(readRepo("app/calibration/regions/[id]/page.tsx")).toContain("productRegionPagePath");
    expect(readRepo("app/verification/regions/[id]/page.tsx")).toContain("redirect");
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).toContain(
      "dashboardKnowledgeRegionStudioHref(kind, region.id)",
    );
    expect(readRepo("components/dashboard/dashboard-knowledge-regions-tab.tsx")).toContain(
      "Open in Data Studio",
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
    ).toBe(false);
    expect(productFlowNewPath("verification")).toBe("/verification/flows/new");
  });
});
