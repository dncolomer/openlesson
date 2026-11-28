/**
 * HTTP client for the private flowcfg embeddings host.
 * Custom POST /v1/embed with Bearer auth and structured Path raw.
 * Always requests the Path model. Multimodal encode is not an app offering.
 */

import {
  recoverFlowEmbeddingRaw,
  type FlowEmbeddingRaw,
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
} from "@/lib/flow-embedding";
import type { FlowEmbeddingChannelVectors } from "@/lib/flow-embedding-space";
import { parseFlowEmbeddingChannelVectors } from "@/lib/flow-embedding-space";

export const FLOWCFG_EMBEDDINGS_MODEL = FLOW_EMBEDDING_MODEL_ID;

export type FlowcfgEmbeddingsResult = {
  embedding: number[];
  channel_vectors: FlowEmbeddingChannelVectors;
  model: string;
};

function baseUrl(): string {
  return String(process.env.FLOWCFG_EMBEDDINGS_BASE_URL || "").replace(/\/+$/, "");
}

function apiKey(): string {
  return String(process.env.FLOWCFG_EMBEDDINGS_API_KEY || "");
}

export function flowcfgEmbeddingsConfigured(): boolean {
  return Boolean(baseUrl() && apiKey());
}

function asRaw(input: FlowEmbeddingRaw | unknown): FlowEmbeddingRaw {
  const recovered = recoverFlowEmbeddingRaw(input);
  if (recovered) return recovered;
  throw new Error("flowcfg embeddings: recoverable raw is required");
}

function embedRequestBody(raw: FlowEmbeddingRaw) {
  return {
    genModel: raw.genModel,
    projectedPolicy: raw.projectedPolicy,
    pow: raw.pow,
  };
}

export async function requestFlowcfgEmbeddings(
  rawInput: FlowEmbeddingRaw | unknown,
): Promise<FlowcfgEmbeddingsResult> {
  const raw = asRaw(rawInput);
  const origin = baseUrl();
  const key = apiKey();
  if (!origin || !key) {
    throw new Error("FLOWCFG_EMBEDDINGS_BASE_URL and FLOWCFG_EMBEDDINGS_API_KEY are required");
  }
  const response = await fetch(`${origin}/v1/embed`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: FLOWCFG_EMBEDDINGS_MODEL,
      raw: embedRequestBody(raw),
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    model?: unknown;
    embedding?: unknown;
    channel_vectors?: unknown;
    data?: unknown;
    object?: unknown;
    error?: { message?: unknown };
  } | null;
  if (payload && (payload.object !== undefined || payload.data !== undefined)) {
    throw new Error("flowcfg embeddings: OpenAI envelope is not supported");
  }
  if (!response.ok) {
    const message =
      payload && typeof payload.error?.message === "string"
        ? payload.error.message
        : `flowcfg embeddings HTTP ${response.status}`;
    throw new Error(message);
  }
  const embedding = Array.isArray(payload?.embedding)
    ? payload.embedding.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    : [];
  if (embedding.length !== FLOW_EMBEDDING_DIM) {
    throw new Error(`flowcfg embeddings: expected ${FLOW_EMBEDDING_DIM}-d Path vector`);
  }
  const channel_vectors =
    parseFlowEmbeddingChannelVectors(payload?.channel_vectors) ?? { path: embedding };
  return {
    embedding,
    channel_vectors,
    model: typeof payload?.model === "string" ? payload.model : FLOWCFG_EMBEDDINGS_MODEL,
  };
}
