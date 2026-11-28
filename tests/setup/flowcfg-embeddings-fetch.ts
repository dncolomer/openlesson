/**
 * Persist goes over HTTP. Tests intercept POST /v1/embed with a SHA-256
 * stand-in. This is not the production Path encoder. Path is hashed from
 * genModel + projectedPolicy only. Extra channels stay independent; the
 * OpenLesson client does not mix them.
 */
import { createHash } from "node:crypto";
import {
  collectFlowPowTranscripts,
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  recoverFlowEmbeddingRaw,
} from "@/lib/flow-embedding";
import { l2Normalize } from "@/lib/knowledge-config/math";
import type { FlowEmbeddingChannelVectors } from "@/lib/flow-embedding-space";

process.env.FLOWCFG_EMBEDDINGS_BASE_URL ||= "http://flowcfg-embeddings.test";
process.env.FLOWCFG_EMBEDDINGS_API_KEY ||= "sk-test-flowcfg";

const origin = String(process.env.FLOWCFG_EMBEDDINGS_BASE_URL).replace(/\/+$/, "");
const originalFetch = globalThis.fetch.bind(globalThis);

function unitFromSeed(seed: string): number[] {
  const digest = createHash("sha256").update(seed).digest();
  const values = Array.from({ length: FLOW_EMBEDDING_DIM }, (_, i) => {
    const b = digest[i % digest.length]!;
    return (b / 255) * 2 - 1 + (i + 1) * 1e-4;
  });
  return l2Normalize(values);
}

function stubHostEmbedding(rawInput: unknown): {
  embedding: number[];
  channel_vectors: FlowEmbeddingChannelVectors;
} {
  const recovered = recoverFlowEmbeddingRaw(rawInput);
  const path = unitFromSeed(
    `path:${JSON.stringify({
      genModel: recovered?.genModel ?? null,
      projectedPolicy: recovered?.projectedPolicy ?? null,
    })}`,
  );
  const channel_vectors: FlowEmbeddingChannelVectors = { path };
  const pow = recovered?.pow ?? [];
  const transcripts = collectFlowPowTranscripts(pow);
  if (transcripts.length) channel_vectors.audio = unitFromSeed(`audio:${JSON.stringify(transcripts)}`);
  const typedSeed = (type: string) =>
    JSON.stringify(
      pow
        .filter((row) => String(row.type || "").toLowerCase() === type)
        .map((row) => row.payload ?? ""),
    );
  if (pow.some((row) => String(row.type || "").toLowerCase() === "eeg")) {
    channel_vectors.eeg = unitFromSeed(`eeg:${typedSeed("eeg")}`);
  }
  if (pow.some((row) => String(row.type || "").toLowerCase() === "video")) {
    channel_vectors.video = unitFromSeed(`video:${typedSeed("video")}`);
  }
  if (pow.some((row) => String(row.type || "").toLowerCase() === "screen")) {
    channel_vectors.screen = unitFromSeed(`screen:${typedSeed("screen")}`);
  }
  return { embedding: path, channel_vectors };
}

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const embedUrl = `${origin}/v1/embed`;
  if (url !== embedUrl && !url.startsWith(`${embedUrl}?`)) {
    return originalFetch(input as RequestInfo, init);
  }
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "POST") {
    return Response.json({ error: { message: "Only POST is supported.", code: "method_not_allowed" } }, { status: 405 });
  }
  const rawBody =
    typeof init?.body === "string"
      ? init.body
      : input instanceof Request
        ? await input.clone().text()
        : "";
  const parsed = JSON.parse(rawBody) as { model?: string; raw?: unknown; input?: unknown };
  if (parsed.input !== undefined) {
    return Response.json(
      { error: { message: "OpenAI envelope is not supported. Send { model, raw } to POST /v1/embed.", code: "invalid_request" } },
      { status: 400 },
    );
  }
  if (!parsed.raw || typeof parsed.raw !== "object") {
    return Response.json(
      { error: { message: "raw must be one recoverable Path object (genModel, projectedPolicy, pow).", code: "invalid_request" } },
      { status: 400 },
    );
  }
  const encoded = stubHostEmbedding(parsed.raw);
  return Response.json({
    model: parsed.model || FLOW_EMBEDDING_MODEL_ID,
    embedding: encoded.embedding,
    channel_vectors: encoded.channel_vectors,
  });
};
