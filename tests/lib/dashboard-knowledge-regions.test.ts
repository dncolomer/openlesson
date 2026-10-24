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
  it("keeps verification and calibration regions on their own workspaces", () => {
    const regions = presentDashboardKnowledgeRegions(
      [
        { id: "learn", title: "Maps", workspace_kind: "standard" },
        { id: "v1", title: "Verify A", workspace_kind: "knowledge_region" },
        { id: "c1", root_topic: "Calibrate A", workspace_kind: "calibration" },
      ],
      [
        { id: "r-learn", name: "Skip", workspace_id: "learn", subject_count: 2, created_at: "2026-01-01" },
        { id: "r-v", name: "Limits", workspace_id: "v1", subject_count: 4, created_at: "2026-05-02" },
        {
          id: "r-voice",
          name: "Limits · Path + Text",
          workspace_id: "v1",
          subject_count: 4,
          created_at: "2026-05-03",
          embedding_model_id: "flowcfg-pathtext-v1-d96",
        },
        { id: "r-c", name: "Priors", workspace_id: "c1", description: "thin", subject_count: 1, created_at: "2026-05-01" },
        { id: "orphan", name: "Gone", workspace_id: "missing", subject_count: 1 },
      ],
      "verification",
    );
    expect(regions).toEqual([
      {
        id: "r-v",
        name: "Limits",
        description: null,
        workspaceId: "v1",
        workspaceTitle: "Verify A",
        subjectCount: 4,
        createdAt: "2026-05-02",
      },
    ]);
    const calibrate = presentDashboardKnowledgeRegions(
      [
        { id: "c1", root_topic: "Calibrate A", workspace_kind: "calibration" },
      ],
      [
        { id: "r-c", name: "Priors", workspace_id: "c1", description: "thin", subject_count: 1, created_at: "2026-05-01" },
      ],
      "calibration",
    );
    expect(calibrate[0]?.workspaceTitle).toBe("Calibrate A");
    expect(calibrate[0]?.description).toBe("thin");
    expect(parseDashboardKnowledgeRegionKind("verification")).toBe("verification");
    expect(parseDashboardKnowledgeRegionKind("learning")).toBeNull();
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
    expect(route).toContain("custom_verification_models");
    expect(route).toContain("presentDashboardKnowledgeRegions");
    expect(route).toContain("buildVoiceRegionFromFlowRaws");
    const dash = readDashboardSurface();
    expect(dash).toContain("data-dashboard-knowledge-regions");
    expect(dash).toContain("DASHBOARD_KNOWLEDGE_REGIONS_PATH");
    expect(dash).toContain("Your Shop");
    expect(dash).toContain("data-create-flow-first");
    expect(readRepo("components/product-flow/knowledge-region-create.tsx")).toContain(
      "data-region-create-from-flow",
    );
    expect(readRepo("components/product-flow/knowledge-region-create.tsx")).toContain(
      "data-create-flow-first",
    );
    expect(readRepo("components/knowledge-panel/models-view.tsx")).toContain(
      "Overlay regions on the right.",
    );
    expect(readRepo("app/verification/regions/new/page.tsx")).toContain('kind="verification"');
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
