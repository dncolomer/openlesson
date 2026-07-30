/**
 * Knowledge-config model registry.
 * Product default remains knowledgecfg-v1-d64; experimental models dual-write on score.
 */

import { encodeKnowledgeConfig, type KnowledgeConfigEncodeInput } from "./encoder";
import {
  encodeKnowledgeConfigContent256,
  encodeKnowledgeConfigDual256,
  encodeKnowledgeConfigHybrid192,
} from "./experimental-encoders";
import {
  KNOWLEDGE_CONFIG_CONTENT_D256_DIM,
  KNOWLEDGE_CONFIG_CONTENT_D256_MODEL_ID,
  KNOWLEDGE_CONFIG_CONTENT_D256_SEM_DIM,
  KNOWLEDGE_CONFIG_CONTENT_D256_STRUCT_DIM,
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_DUAL_D256_DIM,
  KNOWLEDGE_CONFIG_DUAL_D256_MODEL_ID,
  KNOWLEDGE_CONFIG_DUAL_D256_S1_DIM,
  KNOWLEDGE_CONFIG_DUAL_D256_S2_DIM,
  KNOWLEDGE_CONFIG_DUAL_D256_STRUCT_DIM,
  KNOWLEDGE_CONFIG_DUAL_D256_TEMPORAL_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  KNOWLEDGE_CONFIG_HYBRID_D192_DIM,
  KNOWLEDGE_CONFIG_HYBRID_D192_MODEL_ID,
  KNOWLEDGE_CONFIG_HYBRID_D192_SEM_DIM,
  KNOWLEDGE_CONFIG_HYBRID_D192_STRUCT_DIM,
  KNOWLEDGE_CONFIG_SEM_DIM,
  KNOWLEDGE_CONFIG_STRUCT_DIM,
  type KnowledgeConfigEmbedding,
} from "./types";

export type KnowledgeConfigEncodeFn = (
  input: KnowledgeConfigEncodeInput,
) => KnowledgeConfigEmbedding;

export interface KnowledgeConfigModelSpec {
  id: string;
  dim: number;
  label: string;
  description: string;
  /** Product UI / LWM pointer default. */
  isProductDefault: boolean;
  /** Dual-written on post-score learner-state path. */
  dualWriteOnScore: boolean;
  struct_dim?: number;
  sem_dim?: number;
  encode: KnowledgeConfigEncodeFn;
}

/** Shipping control encoder. */
export const PRODUCT_KNOWLEDGE_CONFIG_MODEL: KnowledgeConfigModelSpec = {
  id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  dim: KNOWLEDGE_CONFIG_DIM,
  label: "Knowledge config v1 (D=64)",
  description:
    "Hybrid learner-state geometry: 48 structural + 16 semantic dimensions, L2-normalized into a fixed 64-D space.",
  isProductDefault: true,
  dualWriteOnScore: false,
  struct_dim: KNOWLEDGE_CONFIG_STRUCT_DIM,
  sem_dim: KNOWLEDGE_CONFIG_SEM_DIM,
  encode: encodeKnowledgeConfig,
};

/** Experimental models dual-written alongside v1 on each score (no backfill). */
export const EXPERIMENTAL_KNOWLEDGE_CONFIG_MODELS: readonly KnowledgeConfigModelSpec[] = [
  {
    id: KNOWLEDGE_CONFIG_HYBRID_D192_MODEL_ID,
    dim: KNOWLEDGE_CONFIG_HYBRID_D192_DIM,
    label: "Knowledge config hybrid v2 (D=192)",
    description:
      "Higher-D hybrid sibling of v1: 96 structural + 96 semantic residual, same structure-weighted unit-vector recipe.",
    isProductDefault: false,
    dualWriteOnScore: true,
    struct_dim: KNOWLEDGE_CONFIG_HYBRID_D192_STRUCT_DIM,
    sem_dim: KNOWLEDGE_CONFIG_HYBRID_D192_SEM_DIM,
    encode: encodeKnowledgeConfigHybrid192,
  },
  {
    id: KNOWLEDGE_CONFIG_CONTENT_D256_MODEL_ID,
    dim: KNOWLEDGE_CONFIG_CONTENT_D256_DIM,
    label: "Knowledge config content v2 (D=256)",
    description:
      "Content-rich residual from thought-trace / transcript / LWM free text plus expanded structural block.",
    isProductDefault: false,
    dualWriteOnScore: true,
    struct_dim: KNOWLEDGE_CONFIG_CONTENT_D256_STRUCT_DIM,
    sem_dim: KNOWLEDGE_CONFIG_CONTENT_D256_SEM_DIM,
    encode: encodeKnowledgeConfigContent256,
  },
  {
    id: KNOWLEDGE_CONFIG_DUAL_D256_MODEL_ID,
    dim: KNOWLEDGE_CONFIG_DUAL_D256_DIM,
    label: "Knowledge config dual-stream v2 (D=256)",
    description:
      "Dual-stream System 1 / System 2 text channels with temporal fusion and structural block.",
    isProductDefault: false,
    dualWriteOnScore: true,
    struct_dim: KNOWLEDGE_CONFIG_DUAL_D256_STRUCT_DIM,
    encode: encodeKnowledgeConfigDual256,
  },
] as const;

export const ALL_KNOWLEDGE_CONFIG_MODELS: readonly KnowledgeConfigModelSpec[] = [
  PRODUCT_KNOWLEDGE_CONFIG_MODEL,
  ...EXPERIMENTAL_KNOWLEDGE_CONFIG_MODELS,
];

const BY_ID = new Map(ALL_KNOWLEDGE_CONFIG_MODELS.map((m) => [m.id, m]));

export function getKnowledgeConfigModelSpec(
  modelId: string | null | undefined,
): KnowledgeConfigModelSpec | null {
  const id = (modelId || "").trim();
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function encodeKnowledgeConfigForModel(
  modelId: string,
  input: KnowledgeConfigEncodeInput,
): KnowledgeConfigEmbedding {
  const spec = getKnowledgeConfigModelSpec(modelId);
  if (!spec) {
    throw new Error(`Unknown knowledge-config embedding_model_id: ${modelId}`);
  }
  return spec.encode(input);
}

/** Model ids dual-written on score (excludes product v1). */
export function experimentalDualWriteModelIds(): string[] {
  return EXPERIMENTAL_KNOWLEDGE_CONFIG_MODELS.map((m) => m.id);
}

export {
  KNOWLEDGE_CONFIG_DUAL_D256_S1_DIM,
  KNOWLEDGE_CONFIG_DUAL_D256_S2_DIM,
  KNOWLEDGE_CONFIG_DUAL_D256_TEMPORAL_DIM,
};
