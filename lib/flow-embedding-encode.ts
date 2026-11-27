/**
 * Encode Path numbers via the private host. OpenLesson does not run the encoder.
 */

import {
  buildFlowEmbeddingRaw,
  flowEmbeddingRecordFromHost,
  recoverFlowEmbeddingRaw,
  type FlowEmbeddingRaw,
  type FlowEmbeddingRecord,
  type FlowPowRow,
} from "@/lib/flow-embedding";
import { requestFlowcfgEmbeddings } from "@/lib/flowcfg-embeddings-api";

export async function encodeFlowRaw(
  rawInput: FlowEmbeddingRaw | unknown,
): Promise<FlowEmbeddingRecord> {
  const recovered = recoverFlowEmbeddingRaw(rawInput);
  if (!recovered) throw new Error("flowcfg embeddings: recoverable raw is required");
  const encoded = await requestFlowcfgEmbeddings(recovered);
  return flowEmbeddingRecordFromHost({
    raw: recovered,
    embedding: encoded.embedding,
    channel_vectors: encoded.channel_vectors,
  });
}

export async function encodeFlowEmbedding(
  input: Parameters<typeof buildFlowEmbeddingRaw>[0],
): Promise<FlowEmbeddingRecord> {
  return encodeFlowRaw(buildFlowEmbeddingRaw(input));
}

export async function encodeTextsToFlowVector(texts: readonly string[]): Promise<number[]> {
  const pow: FlowPowRow[] = texts
    .map((payload) => String(payload || "").trim())
    .filter(Boolean)
    .map((payload, index) => ({
      type: "speech",
      tool_name: "synthetic",
      timestamp_ms: index + 1,
      payload,
    }));
  const record = await encodeFlowEmbedding({ flowKind: "verify", pow });
  return record.vector_path_text;
}
