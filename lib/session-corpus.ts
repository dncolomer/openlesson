/**
 * Raw session corpus: proof of work + xAI file pointers + field model + result.
 * Embeddings are derived. Re-embed from this record, never from a previous vector.
 */

import {
  buildFlowEmbeddingRaw,
  recoverFlowEmbeddingRaw,
  type FlowEmbeddingRaw,
  type FlowEmbeddingRecord,
  type FlowKind,
  type FlowPowRow,
} from "@/lib/flow-embedding";
import { encodeFlowRaw } from "@/lib/flow-embedding-encode";
import type { SessionBranchModel } from "@/lib/session-branch-model";
import {
  embeddingModelIdForFamily,
  parseSessionKind,
  parseSessionResult,
  type EmbeddingFamily,
  type ProofOfWorkType,
  type SessionKind,
  type SessionResult,
} from "@/lib/core-data-model";

export type CorpusProofOfWork = {
  id: string;
  type: ProofOfWorkType | string;
  toolName: string | null;
  toolAction: string | null;
  mimeType: string | null;
  fileName: string | null;
  xaiFileId: string | null;
  timestampMs: number;
  metadata: Record<string, unknown>;
  payload: string | null;
};

export type CorpusEmbeddingMeta = {
  id: string;
  embeddingModelId: string;
  family: EmbeddingFamily | SessionKind;
  dim: number;
  createdAt: string | null;
};

export type SessionCorpusRecord = {
  sessionId: string;
  kind: SessionKind;
  fieldModel: SessionBranchModel | null;
  /** Compact genModel from embedding.raw when the session has no field_model yet. */
  genModel: unknown | null;
  result: SessionResult | null;
  sequence: string[];
  proofOfWork: CorpusProofOfWork[];
  embeddings: CorpusEmbeddingMeta[];
  xaiFileIds: string[];
};

export function collectXaiFileIds(proofOfWork: readonly CorpusProofOfWork[]): string[] {
  const ids = new Set<string>();
  for (const row of proofOfWork) {
    const id = typeof row.xaiFileId === "string" ? row.xaiFileId.trim() : "";
    if (id) ids.add(id);
  }
  return [...ids];
}

export function corpusPowToFlowRows(proofOfWork: readonly CorpusProofOfWork[]): FlowPowRow[] {
  return proofOfWork.map((row) => ({
    type: row.type,
    tool_name: row.toolName,
    tool_action: row.toolAction,
    timestamp_ms: row.timestampMs,
    payload: row.payload,
    metadata: row.metadata,
    xai_file_id: row.xaiFileId,
  }));
}

export function sequenceFromResult(result: SessionResult | null): string[] {
  if (!result) return [];
  if (result.kind === "calibrate") return [];
  return result.projectedPolicy?.sequence ?? [];
}

export function buildSessionCorpusRecord(input: {
  sessionId: string;
  kind?: unknown;
  fieldModel?: SessionBranchModel | null;
  genModel?: unknown | null;
  result?: unknown;
  proofOfWork?: CorpusProofOfWork[] | null;
  embeddings?: CorpusEmbeddingMeta[] | null;
}): SessionCorpusRecord {
  const kind = parseSessionKind(input.kind) ?? "learn";
  const result = parseSessionResult(input.result);
  const proofOfWork = Array.isArray(input.proofOfWork) ? input.proofOfWork : [];
  return {
    sessionId: input.sessionId,
    kind,
    fieldModel: input.fieldModel ?? null,
    genModel: input.genModel ?? null,
    result,
    sequence: sequenceFromResult(result),
    proofOfWork,
    embeddings: Array.isArray(input.embeddings) ? input.embeddings : [],
    xaiFileIds: collectXaiFileIds(proofOfWork),
  };
}

export function corpusRecordToFlowRaw(
  record: SessionCorpusRecord,
  _family: EmbeddingFamily | SessionKind = record.kind,
): FlowEmbeddingRaw {
  const kind: FlowKind = "verify";
  const pow = corpusPowToFlowRows(record.proofOfWork);
  if (record.fieldModel) {
    return buildFlowEmbeddingRaw({
      flowKind: kind,
      model: record.fieldModel,
      sequence: record.sequence,
      pow,
    });
  }
  const recovered = recoverFlowEmbeddingRaw({
    flowKind: kind,
    genModel: record.genModel,
    projectedPolicy:
      record.result && record.result.kind !== "calibrate" ? record.result.projectedPolicy : null,
    pow,
  });
  if (recovered) {
    return {
      ...recovered,
      flowKind: kind,
      pow,
      projectedPolicy: recovered.projectedPolicy,
    };
  }
  return buildFlowEmbeddingRaw({
    flowKind: kind,
    sequence: record.sequence,
    pow,
  });
}

/**
 * Rebuild Path / Path+Text vectors from the raw corpus via the embeddings host.
 */
export async function reembedSessionCorpus(
  record: SessionCorpusRecord,
  family: EmbeddingFamily | SessionKind = record.kind,
): Promise<FlowEmbeddingRecord> {
  return encodeFlowRaw(corpusRecordToFlowRaw(record, family));
}

export function corpusEmbeddingFamilyId(family: EmbeddingFamily): string {
  return embeddingModelIdForFamily(family);
}
