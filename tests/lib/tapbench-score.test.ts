/**
 * TAPBench 64D region score: in-region, closest-border (outside), center distance.
 * Drives the shipped scorer from real knowledgecfg-v1-d64 vectors. Does not
 * hardcode distances, mock the scorer, or re-implement it in assertions.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  createCustomVerificationModelFromVectors,
  encodeKnowledgeConfig,
} from "@/lib/knowledge-config";
import { l2Normalize } from "@/lib/knowledge-config/math";
import { emptyLearningWorldModel, mergeLearningWorldModelDelta } from "@/lib/prompt-kernel/world-model";
import { scoreTapbenchRegionIn64D } from "@/lib/tapbench/score";

const ROOT = join(__dirname, "../..");

function fixtureVector(score: number, seed: number): number[] {
  return encodeKnowledgeConfig({
    workspaceId: "ws-tapbench-score",
    powRows: [
      {
        proof_of_work_type: "tool",
        timestamp_ms: 2_000_000 + seed * 1000,
        tool_name: "console",
        metadata: { system: 2, selective_thought: true },
      },
      {
        proof_of_work_type: "speech",
        timestamp_ms: 2_000_000 + seed * 1000 + 20_000,
        tool_name: "voice",
        metadata: { system: 1 },
      },
    ],
    worldModel: mergeLearningWorldModelDelta(emptyLearningWorldModel("ws-tapbench-score"), {
      scores_snapshot: {
        verification_score: score,
        augmentation_score: score - 5,
        optimization_score: score - 8,
        ghc_score: 40,
      },
      learning_profile: {
        strengths: score > 50 ? ["depth"] : [],
        friction_patterns: score < 50 ? ["shallow"] : [],
        preferred_modalities: ["tool"],
        temporal_patterns: { avg_dwell_ms: 3000, idle_bursts: 1 },
      },
    }),
    totalBlocks: 4,
  }).vector;
}

function orthogonalUnit(v: number[]): number[] {
  const o = v.slice();
  const tmp = o[0];
  o[0] = -o[1];
  o[1] = tmp;
  return l2Normalize(o);
}

function mixUnit(a: number[], b: number[], t: number): number[] {
  return l2Normalize(a.map((x, i) => x * (1 - t) + b[i] * t));
}

describe("scoreTapbenchRegionIn64D (shipped 64D geometry)", () => {
  it("scores tapbench@ target vs participant region in knowledgecfg-v1-d64", () => {
    const participant = fixtureVector(88, 1);
    const region = createCustomVerificationModelFromVectors({
      name: "Participant region",
      vectors: [participant],
    });
    expect(region.centroid).toHaveLength(KNOWLEDGE_CONFIG_DIM);
    expect(region.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);

    const inside = scoreTapbenchRegionIn64D({
      region,
      targetVector: participant,
    });
    expect(inside.dim).toBe(64);
    expect(inside.embedding_model_id).toBe("knowledgecfg-v1-d64");
    expect(inside.in_region).toBe(true);
    expect(Number.isFinite(inside.distance_to_center)).toBe(true);
    expect(inside.distance_to_closest_border).toBeNull();

    const farTarget = fixtureVector(12, 99);
    const outside = scoreTapbenchRegionIn64D({
      region,
      targetVector: farTarget,
    });
    expect(outside.dim).toBe(64);
    expect(outside.embedding_model_id).toBe("knowledgecfg-v1-d64");
    expect(outside.in_region).toBe(false);
    expect(Number.isFinite(outside.distance_to_center)).toBe(true);
    expect(outside.distance_to_closest_border).not.toBeNull();
    expect(Number.isFinite(outside.distance_to_closest_border as number)).toBe(true);
    expect(outside.distance_to_center).toBeGreaterThan(inside.distance_to_center);
  });

  it("nearer vs farther outside targets disagree in the expected direction", () => {
    const centroidSeed = fixtureVector(90, 3);
    const region = createCustomVerificationModelFromVectors({
      name: "64D cap",
      vectors: [centroidSeed],
    });
    const ortho = orthogonalUnit(region.centroid);
    const nearerVec = mixUnit(region.centroid, ortho, 0.35);
    const fartherVec = mixUnit(region.centroid, ortho, 0.85);

    const nearer = scoreTapbenchRegionIn64D({ region, targetVector: nearerVec });
    const farther = scoreTapbenchRegionIn64D({ region, targetVector: fartherVec });

    expect(nearer.dim).toBe(64);
    expect(farther.dim).toBe(64);
    expect(farther.distance_to_center).toBeGreaterThan(nearer.distance_to_center);

    if (!nearer.in_region && !farther.in_region) {
      expect(farther.distance_to_closest_border).not.toBeNull();
      expect(nearer.distance_to_closest_border).not.toBeNull();
      expect(farther.distance_to_closest_border as number).toBeGreaterThan(
        nearer.distance_to_closest_border as number,
      );
    } else {
      expect(farther.in_region).toBe(false);
      expect(Number.isFinite(farther.distance_to_closest_border as number)).toBe(true);
    }
  });

  it("does not import 2D/3D projection helpers", () => {
    const src = readFileSync(join(ROOT, "lib/tapbench/score.ts"), "utf8");
    expect(src).toContain("knowledgecfg-v1-d64");
    expect(src).toContain("KNOWLEDGE_CONFIG_DIM");
    expect(src).not.toMatch(/project-2d|projection-view|projectKnowledgeConfigTo2D|projectVectors2D|projectVectors3D/);
    expect(src).not.toMatch(/from ["']@\/lib\/knowledge-config\/project-2d["']/);
  });
});
