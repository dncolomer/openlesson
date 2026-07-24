/**
 * Knowledge configuration embedding space — fixed-dimensional learner state geometry.
 * Distinct from EEG "brain state" band powers (BrainStateBar).
 *
 * Model contract: vectors with different embedding_model_id are not comparable.
 */

export const KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID = "knowledgecfg-v1-d64" as const;
export const KNOWLEDGE_CONFIG_DIM = 64 as const;
export const KNOWLEDGE_CONFIG_STRUCT_DIM = 48 as const;
export const KNOWLEDGE_CONFIG_SEM_DIM = 16 as const;

export type KnowledgeConfigEmbeddingModelId = typeof KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;

export type KnowledgeConfigSnapshotTrigger =
  | "pow_upload"
  | "score"
  | "recompute"
  | "scheduled";

export interface KnowledgeConfigSubject {
  user_id?: string | null;
  guest_user_id?: string | null;
}

/** Pointer stored on learning world model / returned by Snapshot API. */
export interface KnowledgeConfigPointer {
  embedding_model_id: KnowledgeConfigEmbeddingModelId | string;
  dim: number;
  vector: number[];
  as_of: string;
  as_of_ms?: number;
  pow_event_count: number;
  confidence: number;
}

export interface KnowledgeConfigEmbeddingV1 {
  embedding_model_id: typeof KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
  dim: typeof KNOWLEDGE_CONFIG_DIM;
  vector: number[];
  as_of: string;
  as_of_ms: number;
  pow_event_count: number;
  confidence: number;
  /** L2 trajectory speed since previous sample when known. */
  velocity?: number | null;
}

export interface KnowledgeConfigTrajectoryPoint {
  t: string;
  as_of_ms: number;
  vector: number[];
  confidence: number;
  trigger: KnowledgeConfigSnapshotTrigger | string;
  pow_event_count: number;
  /** Present when trajectory rows are loaded with subject identity (multi-subject viz). */
  subject_user_id?: string | null;
  subject_guest_user_id?: string | null;
}

export interface KnowledgeConfigProjection2D {
  frame_id: string;
  embedding_model_id: string;
  coords: Array<{ t: string; as_of_ms: number; x: number; y: number; confidence: number }>;
}

export function isKnowledgeConfigVector(
  vector: unknown,
  dim: number = KNOWLEDGE_CONFIG_DIM,
): vector is number[] {
  return (
    Array.isArray(vector) &&
    vector.length === dim &&
    vector.every((v) => typeof v === "number" && Number.isFinite(v))
  );
}
