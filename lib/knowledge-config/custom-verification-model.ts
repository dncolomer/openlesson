/**
 * Custom verification models: high-validation regions in knowledgecfg space
 * distilled from a cohort of subject embeddings (e.g. internal experts).
 */

import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  isKnowledgeConfigVector,
} from "./types";
import { cosineSimilarity, l2Distance, l2Normalize } from "./math";

export interface CustomVerificationSubjectRef {
  user_id?: string | null;
  guest_user_id?: string | null;
  label?: string | null;
}

export interface CustomVerificationModelSpec {
  name: string;
  embedding_model_id: string;
  dim: number;
  /** Unit-normalized centroid of cohort vectors. */
  centroid: number[];
  /** Mean pairwise cosine among cohort (quality of cluster). */
  cohort_cohesion: number;
  /** Mean L2 radius of cohort members from centroid. */
  mean_radius: number;
  /** Soft membership threshold: cosine ≥ this → strong match (derived from cohort). */
  cosine_threshold: number;
  subject_count: number;
  subjects: CustomVerificationSubjectRef[];
}

export interface CustomVerificationScore {
  /** 0–100 proximity to the custom high-validation region. */
  validation_score: number;
  cosine_similarity: number;
  l2_distance: number;
  /** true when cosine ≥ model.cosine_threshold */
  in_region: boolean;
  embedding_model_id: string;
  model_name: string;
  /**
   * L2 distance in knowledgecfg embedding space between user vector and region centroid.
   * Same units as `l2_distance` — product name for geometry (not a vertical Eval score).
   */
  knowledge_distance: number;
  /** 1 − cosine_similarity (0 = identical direction, up to 2). */
  cosine_distance: number;
}

/**
 * Pure knowledgecfg geometry: distance between a user embedding and a region centroid.
 * Not a vertical Eval (verification/augmentation/optimization) and does not call LLMs.
 */
export interface KnowledgeDistance {
  /** Primary product metric: L2 distance in knowledgecfg-v1-d64 space. */
  knowledge_distance: number;
  l2_distance: number;
  cosine_similarity: number;
  cosine_distance: number;
  /** true when cosine ≥ region.cosine_threshold */
  in_region: boolean;
  embedding_model_id: string;
  region_name: string;
}

export class CustomVerificationModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomVerificationModelError";
  }
}

function assertCompatibleVector(vector: number[], embeddingModelId: string, dim: number) {
  if (embeddingModelId !== KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID) {
    throw new CustomVerificationModelError(
      `embedding_model_id mismatch: expected ${KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID}, got ${embeddingModelId}`,
    );
  }
  if (!isKnowledgeConfigVector(vector, dim) || dim !== KNOWLEDGE_CONFIG_DIM) {
    throw new CustomVerificationModelError(
      `vector must be finite length ${KNOWLEDGE_CONFIG_DIM} for ${KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID}`,
    );
  }
}

/**
 * Build a custom verification model (high-validation region) from cohort embeddings.
 * Pure: no I/O. Callers supply already-loaded knowledge config vectors.
 */
export function createCustomVerificationModelFromVectors(options: {
  name: string;
  vectors: number[][];
  subjects?: CustomVerificationSubjectRef[];
  embedding_model_id?: string;
}): CustomVerificationModelSpec {
  const name = options.name.trim();
  if (!name) {
    throw new CustomVerificationModelError("name is required");
  }
  const embedding_model_id = options.embedding_model_id ?? KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
  const vectors = options.vectors;
  if (!vectors.length) {
    throw new CustomVerificationModelError("at least one subject embedding is required");
  }
  for (const v of vectors) {
    assertCompatibleVector(v, embedding_model_id, KNOWLEDGE_CONFIG_DIM);
  }

  // Mean then re-normalize → geometric centroid on the sphere
  const acc = new Array(KNOWLEDGE_CONFIG_DIM).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < KNOWLEDGE_CONFIG_DIM; i++) acc[i] += v[i];
  }
  for (let i = 0; i < KNOWLEDGE_CONFIG_DIM; i++) acc[i] /= vectors.length;
  const centroid = l2Normalize(acc);

  let cohesionSum = 0;
  let pairCount = 0;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      cohesionSum += cosineSimilarity(vectors[i], vectors[j]);
      pairCount += 1;
    }
  }
  const cohort_cohesion = pairCount > 0 ? cohesionSum / pairCount : 1;

  let radiusSum = 0;
  let minCosineToCentroid = 1;
  for (const v of vectors) {
    radiusSum += l2Distance(v, centroid);
    minCosineToCentroid = Math.min(minCosineToCentroid, cosineSimilarity(v, centroid));
  }
  const mean_radius = radiusSum / vectors.length;

  // Threshold: slightly below weakest cohort member's cosine to centroid (floor 0.35)
  const cosine_threshold = Math.max(0.35, Math.min(0.99, minCosineToCentroid * 0.92));

  const subjects = (options.subjects ?? []).slice(0, vectors.length);

  return {
    name,
    embedding_model_id,
    dim: KNOWLEDGE_CONFIG_DIM,
    centroid,
    cohort_cohesion,
    mean_radius,
    cosine_threshold,
    subject_count: vectors.length,
    subjects,
  };
}

/**
 * Compute Knowledge distance between a user knowledgecfg embedding and a region.
 * Pure embedding-space geometry — not a vertical Eval and not LLM-backed.
 */
export function computeKnowledgeDistance(
  userVector: number[],
  region: Pick<
    CustomVerificationModelSpec,
    "name" | "centroid" | "cosine_threshold" | "embedding_model_id" | "dim"
  >,
): KnowledgeDistance {
  assertCompatibleVector(userVector, region.embedding_model_id, region.dim);
  if (!isKnowledgeConfigVector(region.centroid, region.dim)) {
    throw new CustomVerificationModelError("region centroid is invalid");
  }

  const cos = cosineSimilarity(userVector, region.centroid);
  const dist = l2Distance(userVector, region.centroid);
  const knowledge_distance = Math.round(dist * 1e6) / 1e6;
  const cosine_distance = Math.round((1 - cos) * 1e6) / 1e6;

  return {
    knowledge_distance,
    l2_distance: knowledge_distance,
    cosine_similarity: cos,
    cosine_distance,
    in_region: cos >= region.cosine_threshold,
    embedding_model_id: region.embedding_model_id,
    region_name: region.name,
  };
}

/**
 * Score a subject embedding against a custom verification model (0–100 validation).
 * Pure geometry — does not call LLM or vertical score endpoints.
 * Includes Knowledge distance fields for the same user↔region pair.
 */
export function scoreAgainstCustomVerificationModel(
  vector: number[],
  model: Pick<
    CustomVerificationModelSpec,
    | "name"
    | "centroid"
    | "cosine_threshold"
    | "embedding_model_id"
    | "dim"
    | "mean_radius"
  >,
): CustomVerificationScore {
  const kd = computeKnowledgeDistance(vector, model);
  const cos = kd.cosine_similarity;
  const dist = kd.l2_distance;

  // Map cosine [-1,1] → [0,100], boost when inside region
  const base = ((cos + 1) / 2) * 100;
  const in_region = kd.in_region;
  // Soft penalty by L2 distance relative to cohort mean radius
  const radius = Math.max(1e-6, model.mean_radius || 0.5);
  const radiusFactor = Math.max(0.7, Math.min(1, 1 - (dist - radius) / (radius * 3)));
  let validation_score = base * radiusFactor;
  if (in_region) validation_score = Math.min(100, validation_score + 5);
  validation_score = Math.max(0, Math.min(100, Math.round(validation_score * 10) / 10));

  return {
    validation_score,
    cosine_similarity: cos,
    l2_distance: dist,
    knowledge_distance: kd.knowledge_distance,
    cosine_distance: kd.cosine_distance,
    in_region,
    embedding_model_id: model.embedding_model_id,
    model_name: model.name,
  };
}
