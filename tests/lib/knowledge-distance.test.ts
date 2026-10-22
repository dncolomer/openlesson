import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeKnowledgeDistance,
  createCustomVerificationModelFromVectors,
  createSyntheticKnowledgeRegionFromProfile,
  scoreAgainstCustomVerificationModel,
} from "@/lib/knowledge-config";
import {
  embedTextsToFlowVector,
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
} from "@/lib/flow-embedding";
import { readKnowledgePanelSurface } from "../helpers/surface-source";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function userVector(score: number, seed: number): number[] {
  return embedTextsToFlowVector([
    "ws-kd",
    `score ${score}`,
    `seed ${seed}`,
    score > 50 ? "depth" : "shallow",
    "tool console",
    "speech voice",
  ]);
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
    expect(kd.embedding_model_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(kd.region_name).toBe("Self region");
    expect(region.centroid).toHaveLength(FLOW_EMBEDDING_DIM);
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
  it("retired Snapshot API knowledge-distance route is gone", () => {
    expect(
      existsSync(join(ROOT, "app/api/v3/snapshot/workspaces/[id]/knowledge-distance/route.ts")),
    ).toBe(false);
  });

  it("workspace cookie route exposes knowledge_distance action", () => {
    const src = read("app/api/workspace/custom-knowledge-regions/route.ts");
    expect(src).toContain("knowledge_distance");
    expect(src).toContain("computeKnowledgeDistanceForSubject");
    expect(src).not.toMatch(/knowledge_distance[\s\S]{0,80}runVerticalScore/);
  });

  it("Embeddings overlay UI shows Knowledge distance (not Settings region cards)", () => {
    const embeddings = readKnowledgePanelSurface();
    expect(embeddings).toContain("Knowledge distance");
    expect(embeddings).toContain("data-knowledge-distance");
    expect(embeddings).toContain("data-knowledge-distance-list");
    expect(embeddings).toContain("data-region-overlay-distances");
    expect(embeddings).toContain("flowEmbeddingDistanceToRegion");
    expect(embeddings).toContain("overlayDistances");

    const settings = read("components/CustomVerificationModelsPanel.tsx");
    expect(settings).not.toContain("data-knowledge-distance-btn");
    expect(settings).not.toContain("Eval against region");
    expect(settings).not.toContain('action: "knowledge_distance"');
    expect(settings).not.toContain('action: "eval"');
    expect(settings).toContain("Embeddings tab");
  });

  it("public agent docs do not catalog knowledge-distance as an agent API", () => {
    const docs = read("docs/PROOF_OF_WORK_API.md");
    expect(docs).not.toContain("knowledge-distance");
    expect(docs).toContain("start_session");
    expect(
      existsSync(join(ROOT, "app/api/v3/snapshot/workspaces/[id]/knowledge-distance/route.ts")),
    ).toBe(false);
  });
});
