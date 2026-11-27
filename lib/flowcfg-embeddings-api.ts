/**
 * HTTP client for the private flowcfg embeddings host.
 * OpenAI embeddings envelope: POST /v1/embeddings with Bearer auth.
 * input is a JSON string of recoverable Path raw (genModel, projectedPolicy, pow).
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
  const response = await fetch(`${origin}/v1/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: FLOWCFG_EMBEDDINGS_MODEL,
      input: JSON.stringify(embedRequestBody(raw)),
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    model?: unknown;
    data?: Array<{
      embedding?: unknown;
      channel_vectors?: unknown;
    }>;
    error?: { message?: unknown };
  } | null;
  if (!response.ok) {
    const message =
      payload && typeof payload.error?.message === "string"
        ? payload.error.message
        : `flowcfg embeddings HTTP ${response.status}`;
    throw new Error(message);
  }
  const item = payload?.data?.[0];
  const embedding = Array.isArray(item?.embedding)
    ? item.embedding.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    : [];
  if (embedding.length !== FLOW_EMBEDDING_DIM) {
    throw new Error(`flowcfg embeddings: expected ${FLOW_EMBEDDING_DIM}-d Path vector`);
  }
  const channel_vectors =
    parseFlowEmbeddingChannelVectors(item?.channel_vectors) ?? { path: embedding };
  return {
    embedding,
    channel_vectors,
    model: typeof payload?.model === "string" ? payload.model : FLOWCFG_EMBEDDINGS_MODEL,
  };
}
