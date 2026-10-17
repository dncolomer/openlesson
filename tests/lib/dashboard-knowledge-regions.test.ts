import { describe, expect, it } from "vitest";
import { readDashboardSurface, readRepo } from "../helpers/surface-source";
import {
  dashboardKnowledgeRegionHref,
  parseDashboardKnowledgeRegionKind,
  presentDashboardKnowledgeRegions,
} from "@/lib/dashboard-knowledge-regions";

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
    expect(dashboardKnowledgeRegionHref("ws-1")).toBe("/workspace/ws-1?section=knowledge");
  });

  it("wires the owner dashboard regions API and tab", () => {
    const route = readRepo("app/api/dashboard/knowledge-regions/route.ts");
    expect(route).toContain("requireAuthenticatedUser");
    expect(route).toContain("custom_verification_models");
    expect(route).toContain("presentDashboardKnowledgeRegions");
    const dash = readDashboardSurface();
    expect(dash).toContain("data-dashboard-knowledge-regions");
    expect(dash).toContain("DASHBOARD_KNOWLEDGE_REGIONS_PATH");
    expect(dash).toContain("Your Shop");
  });
});
