/**
 * Map stored Calibrate / Learn / Verify embeddings (flowcfg-v1-d96) onto the
 * Knowledge projection payload.
 */

import { l2Distance } from "@/lib/knowledge-config/math";
import {
  computeKnowledgeDistance,
  type CustomVerificationModelSpec,
} from "@/lib/knowledge-config/custom-verification-model";
import {
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
  isFlowEmbeddingVector,
  parseFlowEmbeddingChannel,
  type FlowEmbeddingChannel,
  type FlowKind,
} from "@/lib/flow-embedding";
import type {
  AvailableSubject,
  KnowledgeConfigResponse,
} from "@/components/knowledge-panel/widgets";

export type FlowEmbeddingViewRow = {
  id: string;
  flow_kind: FlowKind | string;
  flow_id: string | null;
  identity: string | null;
  vector: number[];
  created_at: string;
  embedding_model_id: string;
  dim?: number;
};

export function flowEmbeddingGuestId(row: {
  identity?: string | null;
  id?: string | null;
}): string {
  return String(row.identity || "").trim() || String(row.id || "").trim();
}

export function flowEmbeddingSubjectKey(row: {
  identity?: string | null;
  id?: string | null;
}): string {
  const guest = flowEmbeddingGuestId(row);
  return guest ? `g:${guest}` : "";
}

export function filterFlowEmbeddingRows(
  rows: readonly FlowEmbeddingViewRow[],
  input?: { flowId?: string | null; flowKind?: FlowKind | string | null },
): FlowEmbeddingViewRow[] {
  const flowId = String(input?.flowId ?? "").trim();
  const flowKind = String(input?.flowKind ?? "").trim();
  return rows.filter((row) => {
    if (row.embedding_model_id !== FLOW_EMBEDDING_MODEL_ID) return false;
    if (!isFlowEmbeddingVector(row.vector)) return false;
    if (flowId && String(row.flow_id || "").trim() !== flowId) return false;
    if (flowKind && String(row.flow_kind || "").trim() !== flowKind) return false;
    return true;
  });
}

export function sameStringList(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** Keep the previous selection identity when the key list is unchanged. */
export function reconcileSelectedSubjectKeys(
  prev: readonly string[],
  available: readonly string[],
): string[] {
  const keep = prev.filter((key) => available.includes(key));
  const next = keep.length > 0 ? keep : available.slice();
  if (sameStringList(prev, next)) return prev as string[];
  return next;
}

export function sameFlowEmbeddingList(
  left: readonly FlowEmbeddingViewRow[],
  right: readonly FlowEmbeddingViewRow[],
): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every(
    (row, index) =>
      row.id === right[index]?.id &&
      row.created_at === right[index]?.created_at &&
      row.embedding_model_id === right[index]?.embedding_model_id,
  );
}

export function filterFlowEmbeddingRowsBySubjectKeys(
  rows: readonly FlowEmbeddingViewRow[],
  selectedKeys: readonly string[],
): FlowEmbeddingViewRow[] {
  const keys = selectedKeys.map((key) => key.trim()).filter(Boolean);
  if (keys.length === 0) return rows.slice();
  const want = new Set(keys);
  return rows.filter((row) => want.has(flowEmbeddingSubjectKey(row)));
}

export function subjectsFromFlowEmbeddings(
  rows: readonly FlowEmbeddingViewRow[],
): AvailableSubject[] {
  const byKey = new Map<string, AvailableSubject>();
  for (const row of filterFlowEmbeddingRows(rows)) {
    const guest = flowEmbeddingGuestId(row);
    if (!guest) continue;
    const key = `g:${guest}`;
    const asOf = Date.parse(row.created_at) || 0;
    const prev = byKey.get(key);
    if (prev && prev.as_of_ms >= asOf) continue;
    byKey.set(key, {
      user_id: null,
      guest_user_id: guest,
      embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
      as_of_ms: asOf,
      confidence: 1,
      label: guest,
    });
  }
  return Array.from(byKey.values()).sort((a, b) => b.as_of_ms - a.as_of_ms);
}

function pathLength(points: Array<{ vector: number[] }>): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]?.vector;
    const b = points[i]?.vector;
    if (!isFlowEmbeddingVector(a) || !isFlowEmbeddingVector(b)) continue;
    const d = l2Distance(a, b);
    if (Number.isFinite(d)) len += d;
  }
  return len;
}

export function knowledgeConfigFromFlowEmbeddings(
  rows: readonly FlowEmbeddingViewRow[],
): KnowledgeConfigResponse {
  const usable = filterFlowEmbeddingRows(rows).slice().sort((a, b) => {
    const ta = Date.parse(a.created_at) || 0;
    const tb = Date.parse(b.created_at) || 0;
    return ta - tb;
  });
  const points = usable.map((row) => {
    const as_of_ms = Date.parse(row.created_at) || 0;
    return {
      t: row.created_at,
      as_of_ms,
      vector: row.vector,
      confidence: 1,
      subject_user_id: null as string | null,
      subject_guest_user_id: flowEmbeddingGuestId(row),
    };
  });
  const last = points[points.length - 1];
  return {
    knowledge_config: {
      embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
      dim: FLOW_EMBEDDING_DIM,
      confidence: last?.confidence ?? 0,
      pow_event_count: points.length,
      as_of: last?.t,
      empty: points.length === 0,
    },
    available_subjects: subjectsFromFlowEmbeddings(usable),
    trajectory: {
      point_count: points.length,
      path_length: pathLength(points),
      points,
      projection: {
        algorithm: "random",
        frame_id: "flowcfg-client",
        coords: [],
      },
    },
  };
}

export function regionMatchesFlowEmbeddingChannel(
  region: {
    embedding_model_id?: string | null;
    centroid?: number[] | null;
  },
  channel: FlowEmbeddingChannel | "any" = "path",
): boolean {
  if (!Array.isArray(region.centroid) || region.centroid.length !== FLOW_EMBEDDING_DIM) {
    return false;
  }
  const model = String(region.embedding_model_id || "");
  if (channel === "any") {
    return model === FLOW_EMBEDDING_MODEL_ID || model === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID;
  }
  if (parseFlowEmbeddingChannel(channel) === "path_text") {
    return model === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID;
  }
  return model === FLOW_EMBEDDING_MODEL_ID;
}

/** Knowledge tab overlay: path space only (`flowcfg-v1-d96`). */
export function regionMatchesFlowEmbeddingSpace(region: {
  embedding_model_id?: string | null;
  centroid?: number[] | null;
}): boolean {
  return regionMatchesFlowEmbeddingChannel(region, "path");
}

export function latestFlowVectorForSubject(
  points: readonly {
    vector?: number[] | null;
    as_of_ms?: number;
    subject_guest_user_id?: string | null;
    subject_user_id?: string | null;
  }[],
  subject: { guestUserId?: string | null; userId?: string | null },
): number[] | null {
  const guest = String(subject.guestUserId || "").trim();
  const user = String(subject.userId || "").trim();
  let latest: { as_of_ms: number; vector: number[] } | null = null;
  for (const point of points) {
    const vec = Array.isArray(point.vector) ? point.vector : [];
    if (!isFlowEmbeddingVector(vec)) continue;
    const g = String(point.subject_guest_user_id || "").trim();
    const u = String(point.subject_user_id || "").trim();
    const match = guest ? g === guest : user ? u === user && !g : false;
    if (!match) continue;
    const as_of_ms = Number(point.as_of_ms) || 0;
    if (!latest || as_of_ms >= latest.as_of_ms) latest = { as_of_ms, vector: vec };
  }
  return latest?.vector ?? null;
}

export function flowEmbeddingDistanceToRegion(
  vector: number[],
  region: {
    name: string;
    centroid: number[];
    cosine_threshold: number;
    embedding_model_id: string;
  },
): ReturnType<typeof computeKnowledgeDistance> {
  const spec: Pick<
    CustomVerificationModelSpec,
    "name" | "centroid" | "cosine_threshold" | "embedding_model_id" | "dim"
  > = {
    name: region.name,
    centroid: region.centroid,
    cosine_threshold: region.cosine_threshold,
    embedding_model_id: region.embedding_model_id,
    dim: region.centroid.length,
  };
  return computeKnowledgeDistance(vector, spec);
}
