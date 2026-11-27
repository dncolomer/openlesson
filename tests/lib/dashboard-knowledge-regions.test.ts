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

  it("keeps teammate regions when listing an organization catalog", () => {
    const regions = presentDashboardKnowledgeRegions([
      {
        id: "mine",
        name: "Mine",
        owner_user_id: "me",
        subject_count: 2,
        created_at: "2026-05-02",
      },
      {
        id: "theirs",
        name: "Theirs",
        owner_user_id: "them",
        subject_count: 1,
        created_at: "2026-05-03",
      },
    ]);
    expect(regions.map((row) => row.id)).toEqual(["theirs", "mine"]);
  });

});
