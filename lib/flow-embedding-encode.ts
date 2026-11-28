/**
 * Encode Path numbers via the private host. OpenLesson does not run the encoder.
 */

import {
  buildFlowEmbeddingRaw,
  flowEmbeddingRecordFromHost,
  recoverFlowEmbeddingRaw,
  type FlowEmbeddingRaw,
  type FlowEmbeddingRecord,
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

function fnv1a(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SYNTHETIC_SLOTS = 8;

/** Pack free text into a Path tree+walk so the Path model distinguishes texts. */
export function syntheticPathRawFromTexts(texts: readonly string[]): FlowEmbeddingRaw {
  const clean = texts.map((payload) => String(payload || "").trim()).filter(Boolean);
  const tokens = clean.join(" ").toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean);
  const prices = new Array(SYNTHETIC_SLOTS).fill(12);
  for (const token of tokens) {
    const h = fnv1a(token);
    const slot = h % SYNTHETIC_SLOTS;
    prices[slot] = 1 + ((prices[slot]! + 7 + (h % 40)) % 99);
  }
  const whole = fnv1a(clean.join("\n"));
  const wholeSlot = whole % SYNTHETIC_SLOTS;
  prices[wholeSlot] = 1 + ((prices[wholeSlot]! + (whole % 17)) % 99);
  const edges = prices.map((price, index) => ({ toId: `t${index}`, price }));
  const branches: FlowEmbeddingRaw["genModel"]["branches"] = [
    {
      id: "root",
      parentId: null,
      title: "synthetic",
      question: "synthetic",
      territory: "synthetic",
      observation: "synthetic",
      depth: 0,
      status: "open",
      edges,
    },
  ];
  for (let index = 0; index < SYNTHETIC_SLOTS; index += 1) {
    branches.push({
      id: `t${index}`,
      parentId: "root",
      title: `t${index}`,
      question: `t${index}`,
      territory: `t${index}`,
      observation: `t${index}`,
      depth: 1,
      status: "open",
      edges: [],
    });
  }
  const sequence = ["root", ...prices.map((_, index) => `t${index}`)];
  const distance = prices.reduce((sum, price) => sum + price, 0);
  return {
    flowKind: "verify",
    genModel: {
      chapterTitle: "synthetic",
      rootId: "root",
      branches,
    },
    projectedPolicy: {
      sequence,
      steps: sequence.length,
      excess: 0,
      distance,
    },
    pow: [],
  };
}

export async function encodeTextsToFlowVector(texts: readonly string[]): Promise<number[]> {
  const record = await encodeFlowRaw(syntheticPathRawFromTexts(texts));
  return record.vector;
}
