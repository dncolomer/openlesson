/**
 * Persist goes over HTTP. Tests intercept POST /v1/embeddings and encode
 * with the in-repo Path function so stored floats still match live Path.
 */
import { embedFlowOutput, FLOW_EMBEDDING_MODEL_ID } from "@/lib/flow-embedding";

process.env.FLOWCFG_EMBEDDINGS_BASE_URL ||= "http://flowcfg-embeddings.test";
process.env.FLOWCFG_EMBEDDINGS_API_KEY ||= "sk-test-flowcfg";

const origin = String(process.env.FLOWCFG_EMBEDDINGS_BASE_URL).replace(/\/+$/, "");
const originalFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (!url.startsWith(`${origin}/v1/embeddings`)) {
    return originalFetch(input as RequestInfo, init);
  }
  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "POST") {
    return Response.json({ error: { message: "Only POST is supported." } }, { status: 405 });
  }
  const rawBody =
    typeof init?.body === "string"
      ? init.body
      : input instanceof Request
        ? await input.clone().text()
        : "";
  const parsed = JSON.parse(rawBody) as { model?: string; input?: unknown };
  const inputText = typeof parsed.input === "string" ? parsed.input : null;
  if (!inputText) {
    return Response.json({ error: { message: "input must be a string" } }, { status: 400 });
  }
  const record = embedFlowOutput(JSON.parse(inputText));
  return Response.json({
    object: "list",
    model: parsed.model || FLOW_EMBEDDING_MODEL_ID,
    data: [
      {
        object: "embedding",
        embedding: record.vector,
        index: 0,
        channel_vectors: record.channel_vectors,
      },
    ],
    usage: { prompt_tokens: Math.max(1, Math.ceil(inputText.length / 4)), total_tokens: 1 },
  });
};

