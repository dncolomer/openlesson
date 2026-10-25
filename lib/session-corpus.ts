/**
 * Raw session corpus: proof of work + xAI file pointers + field model + result.
 * Embeddings are derived. Re-embed from this record, never from a previous vector.
 */

import {
  completeFlowEmbedding,
  embedFlowOutput,
  recoverFlowEmbeddingRaw,
  type FlowEmbeddingRecord,
  type FlowKind,
  type FlowPowRow,
} from "@/lib/flow-embedding";
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

/**
 * Rebuild Path / Path+Text vectors from the raw corpus.
 * Does not read a previous embedding vector.
 */
export function reembedSessionCorpus(
  record: SessionCorpusRecord,
  family: EmbeddingFamily | FlowKind = record.kind,
): FlowEmbeddingRecord {
  const kind = (parseSessionKind(family) ?? record.kind) as FlowKind;
  const pow = corpusPowToFlowRows(record.proofOfWork);
  if (record.fieldModel) {
    return completeFlowEmbedding({
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
    return embedFlowOutput({
      ...recovered,
      flowKind: kind,
      pow,
      projectedPolicy: kind === "calibrate" ? null : recovered.projectedPolicy,
    });
  }
  return completeFlowEmbedding({
    flowKind: kind,
    sequence: record.sequence,
    pow,
  });
}

export function corpusEmbeddingFamilyId(family: EmbeddingFamily): string {
  return embeddingModelIdForFamily(family);
}
