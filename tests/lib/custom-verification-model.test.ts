import { describe, expect, it } from "vitest";
import {
  createCustomVerificationModelFromVectors,
  scoreAgainstCustomVerificationModel,
  CustomVerificationModelError,
  pathTextRegionCompanionNames,
  voiceRegionName,
} from "@/lib/knowledge-config";
import {
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
} from "@/lib/flow-embedding";
import { l2Normalize } from "@/lib/knowledge-config/math";

async function expertVector(score: number, seed: number): Promise<number[]> {
  return l2Normalize(
    Array.from({ length: FLOW_EMBEDDING_DIM }, (_, i) =>
      Math.cos(i * 0.25 + score * 0.01) + (seed % 3) * 0.02,
    ),
  );
}

describe("custom verification model (shipped geometry)", () => {
  it("creates a high-validation region from expert cohort embeddings", async () => {
    const experts = [await expertVector(88, 1), await expertVector(88, 1), await expertVector(88, 1)];
    const model = createCustomVerificationModelFromVectors({
      name: "Production SRE bar",
      vectors: experts,
      subjects: [
        { user_id: "expert-1", label: "Alice" },
        { user_id: "expert-2", label: "Bob" },
        { user_id: "expert-3", label: "Cara" },
      ],
    });

    expect(model.name).toBe("Production SRE bar");
    expect(model.embedding_model_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(voiceRegionName(model.name)).toBe("Production SRE bar · Path + Text");
    expect(voiceRegionName("Production SRE bar · Voice")).toBe("Production SRE bar · Voice");
    expect(pathTextRegionCompanionNames(model.name)).toEqual([
      "Production SRE bar · Path + Text",
      "Production SRE bar · Voice",
    ]);
    expect(model.dim).toBe(FLOW_EMBEDDING_DIM);
    expect(model.centroid).toHaveLength(FLOW_EMBEDDING_DIM);
    expect(model.subject_count).toBe(3);
    expect(model.cohort_cohesion).toBeGreaterThan(0.5);
    expect(model.cosine_threshold).toBeGreaterThan(0.3);
    expect(model.cosine_threshold).toBeLessThanOrEqual(0.99);
  });

  it("scores a strong expert higher than a weak novice against the model", async () => {
    const experts = [await expertVector(90, 10), await expertVector(92, 11), await expertVector(88, 12)];
    const model = createCustomVerificationModelFromVectors({
      name: "SRE custom verification model",
      vectors: experts,
    });

    const expertLike = experts[0]!;
    const novice = l2Normalize(
      Array.from({ length: FLOW_EMBEDDING_DIM }, (_, i) => -Math.cos(i * 0.25 + 0.9)),
    );

    const high = scoreAgainstCustomVerificationModel(expertLike, model);
    const low = scoreAgainstCustomVerificationModel(novice, model);

    expect(high.validation_score).toBeGreaterThan(low.validation_score);
    expect(high.cosine_similarity).toBeGreaterThan(low.cosine_similarity);
    expect(high.model_name).toBe("SRE custom verification model");
    expect(high.embedding_model_id).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(high.validation_score).toBeGreaterThan(50);
  });

  it("rejects empty cohort and invalid vectors", async () => {
    expect(() =>
      createCustomVerificationModelFromVectors({ name: "x", vectors: [] }),
    ).toThrow(CustomVerificationModelError);

    expect(() =>
      createCustomVerificationModelFromVectors({
        name: "x",
        vectors: [[1, 2, 3]],
      }),
    ).toThrow(CustomVerificationModelError);
  });
});
