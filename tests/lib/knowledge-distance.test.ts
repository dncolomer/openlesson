import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  computeKnowledgeDistance,
  createCustomVerificationModelFromVectors,
  createSyntheticKnowledgeRegionFromProfile,
  encodeKnowledgeConfig,
  scoreAgainstCustomVerificationModel,
} from "@/lib/knowledge-config";
import { emptyLearningWorldModel, mergeLearningWorldModelDelta } from "@/lib/prompt-kernel/world-model";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function userVector(score: number, seed: number): number[] {
  return encodeKnowledgeConfig({
    workspaceId: "ws-kd",
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
    worldModel: mergeLearningWorldModelDelta(emptyLearningWorldModel("ws-kd"), {
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

describe("computeKnowledgeDistance (shipped geometry)", () => {
  it("identical user vector and region centroid → near-zero Knowledge distance", () => {
    const v = userVector(88, 1);
    const region = createCustomVerificationModelFromVectors({
      name: "Self region",
      vectors: [v],
      subjects: [{ user_id: "u1" }],
    });

    const kd = computeKnowledgeDistance(v, region);
    expect(kd.knowledge_distance).toBeLessThan(1e-6);
    expect(kd.l2_distance).toBe(kd.knowledge_distance);
    expect(kd.cosine_similarity).toBeCloseTo(1, 5);
    expect(kd.cosine_distance).toBeLessThan(1e-6);
    expect(kd.in_region).toBe(true);
    expect(kd.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(kd.region_name).toBe("Self region");
    expect(region.centroid).toHaveLength(KNOWLEDGE_CONFIG_DIM);
  });

  it("farther user from region yields larger Knowledge distance", () => {
    const experts = [userVector(90, 10), userVector(92, 11), userVector(88, 12)];
    const region = createCustomVerificationModelFromVectors({
      name: "Expert bar",
      vectors: experts,
    });

    const close = computeKnowledgeDistance(userVector(91, 10), region);
    const far = computeKnowledgeDistance(userVector(12, 99), region);

    expect(Number.isFinite(close.knowledge_distance)).toBe(true);
    expect(Number.isFinite(far.knowledge_distance)).toBe(true);
    expect(far.knowledge_distance).toBeGreaterThan(close.knowledge_distance);
    expect(far.cosine_similarity).toBeLessThan(close.cosine_similarity);
  });

  it("scoreAgainstCustomVerificationModel includes Knowledge distance fields", () => {
    const region = createSyntheticKnowledgeRegionFromProfile({
      name: "Synth",
      profile: { verification_score: 80, strengths: ["ops"], pow_types: ["tool"] },
    });
    const score = scoreAgainstCustomVerificationModel(region.centroid, region);
    expect(score.knowledge_distance).toBeLessThan(1e-6);
    expect(score.cosine_distance).toBeLessThan(1e-6);
    expect(score.l2_distance).toBe(score.knowledge_distance);
    expect(typeof score.validation_score).toBe("number");
  });
});

describe("Knowledge distance surfaces", () => {
  it("ships Evaluation API knowledge-distance route without vertical eval pipeline", () => {
    const rel = "app/api/v3/eval/workspaces/[id]/knowledge-distance/route.ts";
    expect(existsSync(join(ROOT, rel))).toBe(true);
    const src = read(rel);
    expect(src).toContain("computeKnowledgeDistanceForSubject");
    expect(src).toContain('computation: "knowledge_distance"');
    expect(src).toContain("knowledge_distance");
    // No vertical-score imports or history writers on this route.
    expect(src).not.toMatch(/from ["']@\/lib\/agent-v2\/run-vertical-score["']/);
    expect(src).not.toMatch(/from ["']@\/lib\/agent-v2\/eval-run-history-store["']/);
    expect(src).not.toContain("insertEvalRunHistory");
    expect(src).toContain("workspaces:read");
  });

  it("workspace cookie route exposes knowledge_distance action", () => {
    const src = read("app/api/workspace/custom-verification-models/route.ts");
    expect(src).toContain("knowledge_distance");
    expect(src).toContain("computeKnowledgeDistanceForSubject");
    expect(src).not.toMatch(/knowledge_distance[\s\S]{0,80}runVerticalScore/);
  });

  it("Embeddings overlay UI shows Knowledge distance (not Settings region cards)", () => {
    const embeddings = read("components/KnowledgeConfigTrajectoryPanel.tsx");
    expect(embeddings).toContain("Knowledge distance");
    expect(embeddings).toContain("data-knowledge-distance");
    expect(embeddings).toContain("data-knowledge-distance-list");
    expect(embeddings).toContain("data-region-overlay-distances");
    expect(embeddings).toContain('action: "knowledge_distance"');
    expect(embeddings).toContain("overlayDistances");

    const settings = read("components/CustomVerificationModelsPanel.tsx");
    expect(settings).not.toContain("data-knowledge-distance-btn");
    expect(settings).not.toContain("Eval against region");
    expect(settings).not.toContain('action: "knowledge_distance"');
    expect(settings).not.toContain('action: "eval"');
    expect(settings).toContain("Embeddings tab");
  });

  it("docs list knowledge-distance under Evaluation API", () => {
    const docs = read("docs/PROOF_OF_WORK_API.md");
    expect(docs).toContain("knowledge-distance");
    expect(docs).toMatch(/Knowledge distance/i);
    expect(docs).toMatch(/not a vertical Eval|not.*Eval score/i);
  });
});
