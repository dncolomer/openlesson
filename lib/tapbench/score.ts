/**
 * TAPBench score in native knowledgecfg-v1-d64 (64D Euclidean), not a 2D/3D projection.
 *
 * Region membership matches custom knowledge regions (cosine >= threshold).
 * Distances are L2 in R^64 after unit-normalizing the query and centroid.
 * Closest-border distance is the radial L2 gap from the query to the cosine-threshold
 * sphere around the centroid, reported only when the target is outside the region.
 */

import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  isKnowledgeConfigVector,
} from "@/lib/knowledge-config/types";
import { cosineSimilarity, l2Distance, l2Normalize } from "@/lib/knowledge-config/math";

export class TapbenchScoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TapbenchScoreError";
  }
}

export interface TapbenchRegionGeometry {
  centroid: number[];
  cosine_threshold: number;
  embedding_model_id?: string;
  dim?: number;
  name?: string;
}

export interface TapbenchRegionScore {
  embedding_model_id: typeof KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
  dim: typeof KNOWLEDGE_CONFIG_DIM;
  in_region: boolean;
  /** Direct L2 distance from the target embedding to the region centroid in 64D. */
  distance_to_center: number;
  /**
   * L2 distance in 64D from the target to the closest point on the region border.
   * Null when the target is inside (no outside-border gap).
   */
  distance_to_closest_border: number | null;
  cosine_similarity: number;
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

function assert64D(
  vector: number[],
  label: string,
  embeddingModelId?: string,
  dim?: number,
): void {
  if (
    embeddingModelId != null &&
    embeddingModelId !== KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID
  ) {
    throw new TapbenchScoreError(
      `${label} embedding_model_id must be ${KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID}`,
    );
  }
  if (dim != null && dim !== KNOWLEDGE_CONFIG_DIM) {
    throw new TapbenchScoreError(`${label} dim must be ${KNOWLEDGE_CONFIG_DIM}`);
  }
  if (!isKnowledgeConfigVector(vector, KNOWLEDGE_CONFIG_DIM)) {
    throw new TapbenchScoreError(
      `${label} must be a finite length-${KNOWLEDGE_CONFIG_DIM} ${KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID} vector`,
    );
  }
}

/**
 * Euclidean radius of the cosine-threshold sphere around a unit centroid in R^64.
 * On the unit sphere, cosine(q, c) >= τ ⇔ L2(q, c) <= sqrt(2(1-τ)).
 */
export function cosineThresholdToL2Radius(cosineThreshold: number): number {
  if (!Number.isFinite(cosineThreshold)) {
    throw new TapbenchScoreError("cosine_threshold must be finite");
  }
  const tau = Math.max(-1, Math.min(1, cosineThreshold));
  return Math.sqrt(Math.max(0, 2 * (1 - tau)));
}

/**
 * Score whether a target embedding (the tapbench@ latest snapshot) lies inside a
 * participant-generated region, plus 64D center and closest-border distances.
 */
export function scoreTapbenchRegionIn64D(options: {
  region: TapbenchRegionGeometry;
  targetVector: number[];
}): TapbenchRegionScore {
  const { region, targetVector } = options;
  assert64D(region.centroid, "region centroid", region.embedding_model_id, region.dim);
  assert64D(targetVector, "target vector");
  if (!Number.isFinite(region.cosine_threshold)) {
    throw new TapbenchScoreError("region cosine_threshold must be finite");
  }

  const centroid = l2Normalize(region.centroid);
  const target = l2Normalize(targetVector);
  const cos = cosineSimilarity(target, centroid);
  const in_region = cos >= region.cosine_threshold;
  const distance_to_center = l2Distance(target, centroid);
  const borderRadius = cosineThresholdToL2Radius(region.cosine_threshold);
  const gap = distance_to_center - borderRadius;
  const distance_to_closest_border = in_region ? null : round6(Math.max(0, gap));

  return {
    embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
    dim: KNOWLEDGE_CONFIG_DIM,
    in_region,
    distance_to_center: round6(distance_to_center),
    distance_to_closest_border,
    cosine_similarity: round6(cos),
  };
}
