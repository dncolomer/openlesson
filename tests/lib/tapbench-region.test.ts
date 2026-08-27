/**
 * TAPBench public region list (custom_verification_models on catalog workspaces).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  encodeKnowledgeConfig,
  createCustomVerificationModelFromVectors,
} from "@/lib/knowledge-config";
import { emptyLearningWorldModel, mergeLearningWorldModelDelta } from "@/lib/prompt-kernel/world-model";
import { ownerScoreForRegion, publicTapbenchRegionView } from "@/lib/tapbench/region";

const ROOT = join(__dirname, "../..");

function fixtureVector(score: number, seed: number): number[] {
  return encodeKnowledgeConfig({
    workspaceId: "ws-tapbench-region",
    powRows: [
      {
        proof_of_work_type: "tool",
        timestamp_ms: 2_000_000 + seed * 1000,
        tool_name: "console",
        metadata: { system: 2, selective_thought: true },
      },
    ],
    worldModel: mergeLearningWorldModelDelta(emptyLearningWorldModel("ws-tapbench-region"), {
      scores_snapshot: {
        verification_score: score,
        augmentation_score: score - 5,
        optimization_score: score - 8,
        ghc_score: 40,
      },
    }),
    totalBlocks: 4,
  }).vector;
}

describe("TAPBench public regions", () => {
  it("maps custom_verification_models rows to the public results view", () => {
    const view = publicTapbenchRegionView({
      id: "reg-1",
      workspace_id: "ws-tao",
      name: "Tao Lean five-lemma cohort",
      subject_count: 5,
      cosine_threshold: 0.92,
      mean_radius: 0.0016,
      cohort_cohesion: 0.9999,
      created_at: "2026-08-26T19:14:22.012Z",
      subjects: [
        { guest_user_id: "g1" },
        { guest_user_id: "g2" },
        { guest_user_id: null },
      ],
      in_region: false,
      distance_to_center: 0.41,
      distance_to_closest_border: 0.12,
    });
    expect(view.id).toBe("reg-1");
    expect(view.name).toBe("Tao Lean five-lemma cohort");
    expect(view.subject_count).toBe(5);
    expect(view.guest_user_ids).toEqual(["g1", "g2"]);
    expect(view.in_region).toBe(false);
    expect(view.distance_to_center).toBe(0.41);
    expect(view.distance_to_closest_border).toBe(0.12);
  });

  it("scores tapbench@ snapshot against the region center and border", () => {
    const cohort = fixtureVector(88, 1);
    const spec = createCustomVerificationModelFromVectors({
      name: "Tao Lean five-lemma cohort",
      vectors: [cohort],
    });
    const inside = ownerScoreForRegion(spec, cohort);
    expect(inside.in_region).toBe(true);
    expect(inside.distance_to_center).not.toBeNull();
    expect(Number.isFinite(inside.distance_to_center as number)).toBe(true);
    expect(inside.distance_to_closest_border).not.toBeNull();

    const outside = ownerScoreForRegion(spec, fixtureVector(12, 99));
    expect(outside.in_region).toBe(false);
    expect(outside.distance_to_center).toBeGreaterThan(inside.distance_to_center as number);
    expect(outside.distance_to_closest_border).not.toBeNull();
    expect(Number.isFinite(outside.distance_to_closest_border as number)).toBe(true);

    const missing = ownerScoreForRegion(spec, null);
    expect(missing.in_region).toBeNull();
    expect(missing.distance_to_center).toBeNull();
    expect(missing.distance_to_closest_border).toBeNull();
  });

  it("POST region name is the Results label; default is task title plus region", () => {
    const src = readFileSync(join(ROOT, "lib/tapbench/region.ts"), "utf8");
    expect(src).toContain("options.name?.trim()");
    expect(src).toContain("${title} region");
    expect(src).toContain("ownerScoreForRegion");
    expect(src).toContain("loadTapbenchOwnerLatestEmbedding");
  });

  it("public results API and TAPBench tables list regions with owner distances", () => {
    const api = readFileSync(join(ROOT, "app/api/v3/tapbench/results/route.ts"), "utf8");
    const landing = readFileSync(join(ROOT, "components/TapbenchLanding.tsx"), "utf8");
    const experiment = readFileSync(
      join(ROOT, "components/TapbenchExperimentTutorial.tsx"),
      "utf8",
    );
    const table = readFileSync(join(ROOT, "components/TapbenchResultsTable.tsx"), "utf8");
    expect(api).toContain("listTapbenchPublicRegions");
    expect(api).toContain("regions:");
    expect(table).toContain("data-tapbench-results-table");
    expect(table).toContain("data-tapbench-owner-distance-note");
    expect(table).toContain("tapbench@uncertain.systems");
    expect(table).not.toContain("data-tapbench-col-filter");
    expect(table).not.toContain("data-tapbench-pagination");
    expect(landing).toContain("TapbenchResultsTable");
    expect(experiment).toContain("You can name it; ScoreBoard shows that name");
    expect(landing).not.toContain("/tapbench/results");
  });
});
