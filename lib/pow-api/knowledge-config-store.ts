/**
 * Knowledge config snapshot persistence and trajectory queries.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  encodeKnowledgeConfig,
  isKnowledgeConfigVector,
  parseProjectionAlgorithmId,
  projectTrajectoryPoints2D,
  projectionFrameId,
  type KnowledgeConfigEmbeddingV1,
  type KnowledgeConfigEncodeInput,
  type KnowledgeConfigSnapshotTrigger,
  type KnowledgeConfigTrajectoryPoint,
  type PowFeatureRow,
  type ProjectionAlgorithmId,
} from "@/lib/knowledge-config";
import type { LearningWorldModelV0 } from "@/lib/prompt-kernel/world-model";
import { l2Distance } from "@/lib/knowledge-config/math";
import {
  normalizeSubject,
  type SubjectRef,
} from "./learning-world-model-store";

export interface KnowledgeConfigSnapshotRow {
  id: string;
  workspace_id: string;
  embedding_model_id: string;
  dim: number;
  vector: number[];
  as_of_ms: number;
  pow_event_count: number;
  confidence: number;
  trigger: string;
  created_at: string;
}

export async function insertKnowledgeConfigSnapshot(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    subject?: SubjectRef | null;
    embedding: KnowledgeConfigEmbeddingV1;
    trigger: KnowledgeConfigSnapshotTrigger;
    lwmId?: string | null;
  },
): Promise<{ id: string | null }> {
  const { subject_user_id, subject_guest_user_id } = normalizeSubject(options.subject);
  const { embedding } = options;

  if (!isKnowledgeConfigVector(embedding.vector, embedding.dim)) {
    console.warn("[knowledge-config-store] invalid vector length, skip insert");
    return { id: null };
  }

  const { data, error } = await supabase
    .from("knowledge_config_snapshots")
    .insert({
      workspace_id: options.workspaceId,
      subject_user_id,
      subject_guest_user_id,
      embedding_model_id: embedding.embedding_model_id,
      dim: embedding.dim,
      vector: embedding.vector,
      as_of_ms: embedding.as_of_ms,
      pow_event_count: embedding.pow_event_count,
      confidence: embedding.confidence,
      trigger: options.trigger,
      lwm_id: options.lwmId ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("[knowledge-config-store] insert failed:", error.message);
    return { id: null };
  }
  const id = (data?.id as string) ?? null;
  // Fire-and-forget: email guests waiting on Map of Knowledge location for this subject.
  if (id && subject_guest_user_id && options.workspaceId) {
    void import("@/lib/map-of-knowledge/map-ready-notify-store")
      .then(({ processPendingMapReadyNotifications }) =>
        processPendingMapReadyNotifications(supabase, {
          guestUserId: subject_guest_user_id,
          workspaceId: options.workspaceId,
        }),
      )
      .catch((err) => {
        console.warn("[knowledge-config-store] map-ready notify skipped:", err);
      });
  }
  return { id };
}

export async function loadLatestKnowledgeConfig(
  supabase: SupabaseClient,
  workspaceId: string,
  subject?: SubjectRef | null,
  embeddingModelId: string = KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
): Promise<KnowledgeConfigSnapshotRow | null> {
  const { subject_user_id, subject_guest_user_id } = normalizeSubject(subject);

  let query = supabase
    .from("knowledge_config_snapshots")
    .select(
      "id, workspace_id, embedding_model_id, dim, vector, as_of_ms, pow_event_count, confidence, trigger, created_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("embedding_model_id", embeddingModelId)
    .order("as_of_ms", { ascending: false })
    // Stable latest when as_of_ms ties (rapid successive scores).
    .order("created_at", { ascending: false })
    .limit(1);

  if (subject_guest_user_id) {
    query = query.eq("subject_guest_user_id", subject_guest_user_id).is("subject_user_id", null);
  } else if (subject_user_id) {
    query = query.eq("subject_user_id", subject_user_id).is("subject_guest_user_id", null);
  } else {
    query = query.is("subject_user_id", null).is("subject_guest_user_id", null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.warn("[knowledge-config-store] load latest failed:", error.message);
    return null;
  }
  if (!data) return null;

  const vector = Array.isArray(data.vector) ? (data.vector as number[]) : [];
  return {
    id: data.id as string,
    workspace_id: data.workspace_id as string,
    embedding_model_id: data.embedding_model_id as string,
    dim: data.dim as number,
    vector,
    as_of_ms: Number(data.as_of_ms),
    pow_event_count: Number(data.pow_event_count),
    confidence: Number(data.confidence),
    trigger: data.trigger as string,
    created_at: data.created_at as string,
  };
}

export type TrajectorySubjectFilter =
  | { kind: "single"; subject?: SubjectRef | null }
  /** Explicit multi-subject cohort (user group). */
  | { kind: "multi"; subjects: SubjectRef[] }
  /** All subjects in the workspace (no subject filter). */
  | { kind: "all" };

export async function loadKnowledgeConfigTrajectory(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    subject?: SubjectRef | null;
    /** When set, overrides single `subject` filter for multi / all scopes. */
    subjectFilter?: TrajectorySubjectFilter;
    fromMs?: number | null;
    toMs?: number | null;
    maxPoints?: number;
    embeddingModelId?: string;
  },
): Promise<KnowledgeConfigTrajectoryPoint[]> {
  const {
    workspaceId,
    subject,
    subjectFilter,
    fromMs,
    toMs,
    maxPoints = 200,
    embeddingModelId = KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  } = options;

  let query = supabase
    .from("knowledge_config_snapshots")
    .select(
      "vector, as_of_ms, confidence, trigger, pow_event_count, created_at, subject_user_id, subject_guest_user_id",
    )
    .eq("workspace_id", workspaceId)
    .eq("embedding_model_id", embeddingModelId)
    .order("as_of_ms", { ascending: true })
    .limit(Math.min(2000, Math.max(1, maxPoints * 4)));

  const filter: TrajectorySubjectFilter =
    subjectFilter ?? { kind: "single", subject: subject ?? null };

  if (filter.kind === "all") {
    // No subject filter — full workspace trajectory cloud.
  } else if (filter.kind === "multi") {
    const userIds = filter.subjects.map((s) => s.user_id).filter(Boolean) as string[];
    const guestIds = filter.subjects.map((s) => s.guest_user_id).filter(Boolean) as string[];
    if (userIds.length === 0 && guestIds.length === 0) {
      return [];
    }
    const orParts: string[] = [];
    if (userIds.length > 0) orParts.push(`subject_user_id.in.(${userIds.join(",")})`);
    if (guestIds.length > 0) orParts.push(`subject_guest_user_id.in.(${guestIds.join(",")})`);
    query = query.or(orParts.join(","));
  } else {
    const { subject_user_id, subject_guest_user_id } = normalizeSubject(filter.subject);
    if (subject_guest_user_id) {
      query = query.eq("subject_guest_user_id", subject_guest_user_id).is("subject_user_id", null);
    } else if (subject_user_id) {
      query = query.eq("subject_user_id", subject_user_id).is("subject_guest_user_id", null);
    } else {
      query = query.is("subject_user_id", null).is("subject_guest_user_id", null);
    }
  }

  if (fromMs != null) query = query.gte("as_of_ms", fromMs);
  if (toMs != null) query = query.lte("as_of_ms", toMs);

  const { data, error } = await query;
  if (error) {
    console.warn("[knowledge-config-store] trajectory failed:", error.message);
    return [];
  }

  const rows = (data || []).map((row) => {
    const asOfMs = Number(row.as_of_ms);
    const subject_user_id = (row.subject_user_id as string | null) ?? null;
    const subject_guest_user_id = (row.subject_guest_user_id as string | null) ?? null;
    return {
      t: new Date(asOfMs).toISOString(),
      as_of_ms: asOfMs,
      vector: Array.isArray(row.vector) ? (row.vector as number[]) : [],
      confidence: Number(row.confidence) || 0,
      trigger: (row.trigger as string) || "score",
      pow_event_count: Number(row.pow_event_count) || 0,
      subject_user_id,
      subject_guest_user_id,
    } satisfies KnowledgeConfigTrajectoryPoint;
  });

  if (rows.length <= maxPoints) return rows;
  // Uniform downsample keeping endpoints
  const out: KnowledgeConfigTrajectoryPoint[] = [];
  const step = (rows.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    out.push(rows[Math.round(i * step)]);
  }
  return out;
}

/** Latest knowledge config across multiple subjects (most recent snapshot wins). */
export async function loadLatestKnowledgeConfigForSubjects(
  supabase: SupabaseClient,
  workspaceId: string,
  subjects: SubjectRef[],
  embeddingModelId: string = KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
): Promise<KnowledgeConfigSnapshotRow | null> {
  if (subjects.length === 0) return null;
  if (subjects.length === 1) {
    return loadLatestKnowledgeConfig(supabase, workspaceId, subjects[0], embeddingModelId);
  }

  const userIds = subjects.map((s) => s.user_id).filter(Boolean) as string[];
  const guestIds = subjects.map((s) => s.guest_user_id).filter(Boolean) as string[];
  if (userIds.length === 0 && guestIds.length === 0) return null;

  const orParts: string[] = [];
  if (userIds.length > 0) orParts.push(`subject_user_id.in.(${userIds.join(",")})`);
  if (guestIds.length > 0) orParts.push(`subject_guest_user_id.in.(${guestIds.join(",")})`);

  const { data, error } = await supabase
    .from("knowledge_config_snapshots")
    .select(
      "id, workspace_id, embedding_model_id, dim, vector, as_of_ms, pow_event_count, confidence, trigger, created_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("embedding_model_id", embeddingModelId)
    .or(orParts.join(","))
    .order("as_of_ms", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn("[knowledge-config-store] multi latest failed:", error.message);
    return null;
  }

  const vector = Array.isArray(data.vector) ? (data.vector as number[]) : [];
  return {
    id: data.id as string,
    workspace_id: data.workspace_id as string,
    embedding_model_id: data.embedding_model_id as string,
    dim: data.dim as number,
    vector,
    as_of_ms: Number(data.as_of_ms),
    pow_event_count: Number(data.pow_event_count),
    confidence: Number(data.confidence),
    trigger: data.trigger as string,
    created_at: data.created_at as string,
  };
}

/** Latest snapshot for any subject in the workspace (scope=all). */
export async function loadLatestKnowledgeConfigAnySubject(
  supabase: SupabaseClient,
  workspaceId: string,
  embeddingModelId: string = KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
): Promise<KnowledgeConfigSnapshotRow | null> {
  const { data, error } = await supabase
    .from("knowledge_config_snapshots")
    .select(
      "id, workspace_id, embedding_model_id, dim, vector, as_of_ms, pow_event_count, confidence, trigger, created_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("embedding_model_id", embeddingModelId)
    .order("as_of_ms", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn("[knowledge-config-store] any-subject latest failed:", error.message);
    return null;
  }

  const vector = Array.isArray(data.vector) ? (data.vector as number[]) : [];
  return {
    id: data.id as string,
    workspace_id: data.workspace_id as string,
    embedding_model_id: data.embedding_model_id as string,
    dim: data.dim as number,
    vector,
    as_of_ms: Number(data.as_of_ms),
    pow_event_count: Number(data.pow_event_count),
    confidence: Number(data.confidence),
    trigger: data.trigger as string,
    created_at: data.created_at as string,
  };
}

export function encodeAndMeasureVelocity(
  input: KnowledgeConfigEncodeInput,
  previous: KnowledgeConfigSnapshotRow | null,
): KnowledgeConfigEmbeddingV1 {
  const embedding = encodeKnowledgeConfig(input);
  if (previous && isKnowledgeConfigVector(previous.vector, KNOWLEDGE_CONFIG_DIM)) {
    const dtHours = Math.max(1e-6, (embedding.as_of_ms - previous.as_of_ms) / 3_600_000);
    embedding.velocity = l2Distance(embedding.vector, previous.vector) / dtHours;
  }
  return embedding;
}

export function trajectoryPathLength(points: KnowledgeConfigTrajectoryPoint[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    if (
      isKnowledgeConfigVector(points[i].vector) &&
      isKnowledgeConfigVector(points[i - 1].vector)
    ) {
      len += l2Distance(points[i].vector, points[i - 1].vector);
    }
  }
  return len;
}

export function projectTrajectory2D(
  points: KnowledgeConfigTrajectoryPoint[],
  algorithm: ProjectionAlgorithmId | string = "random",
) {
  const algo = parseProjectionAlgorithmId(algorithm, "random");
  const validPoints = points.map((p) => ({
    t: p.t,
    as_of_ms: p.as_of_ms,
    vector: isKnowledgeConfigVector(p.vector) ? p.vector : new Array(KNOWLEDGE_CONFIG_DIM).fill(0),
    confidence: p.confidence,
  }));
  return projectTrajectoryPoints2D(validPoints, algo);
}

export function projectionFrameIdForAlgorithm(
  algorithm: ProjectionAlgorithmId | string = "random",
): string {
  return projectionFrameId(parseProjectionAlgorithmId(algorithm, "random"));
}

export function powRowsFromPerformanceContext(
  proofOfWork: Array<{
    type?: string;
    proof_of_work_type?: string;
    block_id?: string | null;
    timestamp_ms?: number;
    tool_name?: string | null;
    tool_action?: string | null;
    metadata?: Record<string, unknown>;
    sample_count?: number | null;
    device_name?: string | null;
  }>,
): PowFeatureRow[] {
  return proofOfWork.map((row) => ({
    proof_of_work_type: row.proof_of_work_type || row.type,
    type: row.type,
    block_id: row.block_id,
    timestamp_ms: row.timestamp_ms,
    tool_name: row.tool_name,
    tool_action: row.tool_action,
    metadata: row.metadata || {},
    sample_count: row.sample_count,
    device_name: row.device_name,
  }));
}

export function knowledgeConfigPointerFromEmbedding(
  embedding: KnowledgeConfigEmbeddingV1,
): NonNullable<LearningWorldModelV0["knowledge_config"]> {
  return {
    embedding_model_id: embedding.embedding_model_id,
    dim: embedding.dim,
    vector: embedding.vector,
    as_of: embedding.as_of,
    as_of_ms: embedding.as_of_ms,
    pow_event_count: embedding.pow_event_count,
    confidence: embedding.confidence,
  };
}
