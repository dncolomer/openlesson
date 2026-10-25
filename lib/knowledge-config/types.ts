/**
 * Trajectory payload used by Knowledge projection widgets.
 * Live embeddings are flowcfg-v1-d96 (`session_embeddings`).
 */

export type KnowledgeConfigSnapshotTrigger =
  | "pow_upload"
  | "score"
  | "recompute"
  | "scheduled";

export interface KnowledgeConfigSubject {
  user_id?: string | null;
  guest_user_id?: string | null;
}

export interface KnowledgeConfigTrajectoryPoint {
  t: string;
  as_of_ms: number;
  vector: number[];
  confidence: number;
  trigger?: KnowledgeConfigSnapshotTrigger | string;
  pow_event_count?: number;
  subject_user_id?: string | null;
  subject_guest_user_id?: string | null;
}

export interface KnowledgeConfigProjection2D {
  frame_id: string;
  embedding_model_id: string;
  coords: Array<{ t: string; as_of_ms: number; x: number; y: number; confidence: number }>;
}

export function isFiniteEmbeddingVector(vector: unknown, dim: number): vector is number[] {
  return (
    Array.isArray(vector) &&
    vector.length === dim &&
    vector.every((v) => typeof v === "number" && Number.isFinite(v))
  );
}
