/**
 * Recoverable Path raw and read-time mixing of stored basis channels.
 * Encoding lives only on the private flowcfg-embeddings host. OpenLesson
 * packs raw, persists host `channel_vectors`, and mixes named spaces
 * (path+audio, path+eeg, …) at read.
 */

import type { SessionBranchModel } from "@/lib/session-branch-model";
import { scorePolicySequence } from "@/lib/session-policy-score";
import {
  mixFlowEmbeddingSpace,
  parseFlowEmbeddingChannelVectors,
  parseFlowEmbeddingSpace,
  type FlowEmbeddingChannelVectors,
} from "@/lib/flow-embedding-space";
import { isCanvasContentPowRow } from "@/lib/flow-canvas-capture";

export {
  FLOW_EMBEDDING_SPACE_EXTRA_WEIGHT as FLOW_EMBEDDING_PATH_TEXT_TEXT_WEIGHT,
  FLOW_EMBEDDING_SPACE_PATH_WEIGHT as FLOW_EMBEDDING_PATH_TEXT_PATH_WEIGHT,
} from "@/lib/flow-embedding-space";

export const FLOW_EMBEDDING_MODEL_ID = "flowcfg-v1-d96" as const;
export const FLOW_EMBEDDING_PATH_TEXT_MODEL_ID = "flowcfg-pathtext-v1-d96" as const;
export const FLOW_EMBEDDING_DIM = 96 as const;
export const FLOW_EMBEDDING_CHANNELS = ["path", "path_text"] as const;
export type FlowEmbeddingChannel = (typeof FLOW_EMBEDDING_CHANNELS)[number];
export const FLOW_EMBEDDING_CHANNEL_LABELS: Record<FlowEmbeddingChannel, string> = {
  path: "Path",
  path_text: "Path + Text",
};

export type FlowKind = "verify";

export type FlowPowRow = {
  type?: string | null;
  tool_name?: string | null;
  tool_action?: string | null;
  timestamp_ms?: number | null;
  payload?: string | null;
  metadata?: Record<string, unknown> | null;
  xai_file_id?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
};

export type FlowGenModelRaw = {
  chapterTitle: string;
  rootId: string;
  branches: Array<{
    id: string;
    parentId: string | null;
    title: string;
    question: string;
    territory: string;
    observation: string;
    depth: number;
    status: string;
    edges: Array<{ toId: string; price: number }>;
  }>;
};

export type FlowProjectedPolicyRaw = {
  sequence: string[];
  steps: number;
  excess: number;
  distance: number;
};

export type FlowEmbeddingRaw = {
  flowKind: FlowKind;
  genModel: FlowGenModelRaw;
  projectedPolicy: FlowProjectedPolicyRaw | null;
  pow: FlowPowRow[];
};

export type FlowEmbeddingRecord = {
  embedding_model_id: typeof FLOW_EMBEDDING_MODEL_ID;
  dim: typeof FLOW_EMBEDDING_DIM;
  vector: number[];
  vector_path_text: number[];
  channel_vectors: FlowEmbeddingChannelVectors;
  raw: FlowEmbeddingRaw;
};

const FLOW_KINDS = new Set<FlowKind>(["verify"]);

function textOf(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function numberOf(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseFlowKind(value: unknown): FlowKind {
  return FLOW_KINDS.has(value as FlowKind) ? (value as FlowKind) : "verify";
}

function compactEdges(rawEdges: unknown, rawActions?: unknown): Array<{ toId: string; price: number }> {
  const fromList = (raw: unknown, idKeys: readonly string[]) => {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
      .map((row) => {
        let toId = "";
        for (const key of idKeys) {
          toId = textOf(row[key]);
          if (toId) break;
        }
        return {
          toId,
          price: Math.max(0, Math.min(100, Math.round(numberOf(row.price)))),
        };
      })
      .filter((edge) => edge.toId)
      .sort((a, b) => a.toId.localeCompare(b.toId) || a.price - b.price);
  };
  const edges = fromList(rawEdges, ["toId", "id", "leadsBranchId"]);
  if (edges.length) return edges;
  return fromList(rawActions, ["toId", "leadsBranchId", "id"]);
}

function compactGenModel(model: SessionBranchModel | null | undefined): FlowGenModelRaw {
  const branches = (model?.branches ?? [])
    .map((branch) => {
      const legacy = branch as { edges?: unknown; actions?: unknown };
      return {
        id: textOf(branch.id),
        parentId: branch.parentId == null ? null : textOf(branch.parentId) || null,
        title: textOf(branch.title),
        question: textOf(branch.question),
        territory: textOf(branch.territory),
        observation: textOf(branch.observation),
        depth: Math.max(0, Math.round(numberOf(branch.depth))),
        status: textOf(branch.status) || "open",
        edges: compactEdges(legacy.edges, legacy.actions),
      };
    })
    .filter((branch) => branch.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    chapterTitle: textOf(model?.chapterTitle),
    rootId: textOf(model?.rootId) || "root",
    branches,
  };
}

function compactPow(rows: readonly FlowPowRow[] | null | undefined): FlowPowRow[] {
  const compacted = (rows ?? [])
    .filter((row) => !isCanvasContentPowRow(row))
    .map((row, index) => ({
      type: textOf(row.type) || "tool",
      tool_name: textOf(row.tool_name) || null,
      tool_action: textOf(row.tool_action) || null,
      timestamp_ms: Number.isFinite(Number(row.timestamp_ms)) ? Number(row.timestamp_ms) : index + 1,
      payload: textOf(row.payload) || null,
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? row.metadata
          : null,
    }));
  compacted.sort(
    (a, b) =>
      (a.timestamp_ms ?? 0) - (b.timestamp_ms ?? 0) ||
      textOf(a.tool_name).localeCompare(textOf(b.tool_name)),
  );
  return compacted;
}

function compactPolicy(
  _flowKind: FlowKind,
  model: SessionBranchModel | null | undefined,
  sequence: readonly string[] | null | undefined,
): FlowProjectedPolicyRaw | null {
  if (!model || !Array.isArray(sequence) || sequence.length === 0) return null;
  const scored = scorePolicySequence(model, sequence);
  return {
    sequence: scored.sequence.slice(),
    steps: scored.steps,
    excess: scored.excess,
    distance: scored.distance,
  };
}

function isSpeechEmbeddingPowRow(row: FlowPowRow): boolean {
  const name = textOf(row.tool_name).toLowerCase();
  const action = textOf(row.tool_action).toLowerCase();
  const type = textOf(row.type).toLowerCase();
  return (
    type === "speech" ||
    name.includes("speech") ||
    name === "transcript" ||
    action.startsWith("speech_")
  );
}

/** Canvas-only embedding: drop spoken rows so Path+Text matches Path. */
export function powRowsForCanvasEmbedding(
  rows: readonly FlowPowRow[] | null | undefined,
): FlowPowRow[] {
  return (rows ?? []).filter((row) => !isSpeechEmbeddingPowRow(row));
}

export function buildFlowEmbeddingRaw(input: {
  flowKind: FlowKind | string;
  model?: SessionBranchModel | null;
  catalogSize?: unknown;
  sequence?: readonly string[] | null;
  pow?: readonly FlowPowRow[] | null;
  audioEnforced?: boolean;
}): FlowEmbeddingRaw {
  const flowKind = parseFlowKind(input.flowKind);
  const pow = input.audioEnforced === false ? powRowsForCanvasEmbedding(input.pow) : input.pow;
  return {
    flowKind,
    genModel: compactGenModel(input.model),
    projectedPolicy: compactPolicy(flowKind, input.model, input.sequence),
    pow: compactPow(pow),
  };
}

export function recoverFlowEmbeddingRaw(value: unknown): FlowEmbeddingRaw | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as { raw?: unknown; flowKind?: unknown; genModel?: unknown };
  const source =
    record.raw && typeof record.raw === "object" && !Array.isArray(record.raw)
      ? (record.raw as Record<string, unknown>)
      : (record as Record<string, unknown>);
  const gen = source.genModel;
  if (!gen || typeof gen !== "object" || Array.isArray(gen)) return null;
  const tree = gen as Record<string, unknown>;
  const branches = Array.isArray(tree.branches) ? tree.branches : [];
  const flowKind = parseFlowKind(source.flowKind);
  const policyRaw = source.projectedPolicy;
  let projectedPolicy: FlowProjectedPolicyRaw | null = null;
  if (policyRaw && typeof policyRaw === "object" && !Array.isArray(policyRaw)) {
    const policy = policyRaw as Record<string, unknown>;
    const sequence = Array.isArray(policy.sequence)
      ? policy.sequence.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
    if (sequence.length) {
      projectedPolicy = {
        sequence,
        steps: numberOf(policy.steps, sequence.length),
        excess: numberOf(policy.excess),
        distance: numberOf(policy.distance),
      };
    }
  }
  const pow = Array.isArray(source.pow) ? compactPow(source.pow as FlowPowRow[]) : [];
  return {
    flowKind,
    genModel: {
      chapterTitle: textOf(tree.chapterTitle),
      rootId: textOf(tree.rootId) || "root",
      branches: branches
        .filter((branch): branch is Record<string, unknown> => !!branch && typeof branch === "object")
        .map((branch) => ({
          id: textOf(branch.id),
          parentId: branch.parentId == null ? null : textOf(branch.parentId) || null,
          title: textOf(branch.title),
          question: textOf(branch.question),
          territory: textOf(branch.territory),
          observation: textOf(branch.observation),
          depth: Math.max(0, Math.round(numberOf(branch.depth))),
          status: textOf(branch.status) || "open",
          edges: compactEdges(branch.edges, branch.actions),
        }))
        .filter((branch) => branch.id),
    },
    projectedPolicy,
    pow,
  };
}

export function parseFlowEmbeddingChannel(value: unknown): FlowEmbeddingChannel {
  return value === "path_text" ? "path_text" : "path";
}

export function flowEmbeddingChannelLabel(channel: FlowEmbeddingChannel | string): string {
  return FLOW_EMBEDDING_CHANNEL_LABELS[parseFlowEmbeddingChannel(channel)];
}

export function flowEmbeddingModelIdForChannel(channel: FlowEmbeddingChannel | string): string {
  return parseFlowEmbeddingChannel(channel) === "path_text"
    ? FLOW_EMBEDDING_PATH_TEXT_MODEL_ID
    : FLOW_EMBEDDING_MODEL_ID;
}

/** Transcripts extracted from PoW for UI. Encoding of those texts is on the host. */
export function collectFlowPowTranscripts(pow: readonly FlowPowRow[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const next = value.trim();
    if (!next || seen.has(next)) return;
    if (next.startsWith("{") || next.startsWith("[")) {
      try {
        const parsed = JSON.parse(next) as unknown;
        collectFromUnknown(parsed, 0);
      } catch {
        return;
      }
      return;
    }
    seen.add(next);
    out.push(next);
  };
  const collectFromUnknown = (value: unknown, depth: number) => {
    if (depth > 5 || value == null) return;
    if (typeof value === "string") {
      push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collectFromUnknown(item, depth + 1);
      return;
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      for (const key of ["transcript_snapshot", "transcript", "text", "prompt", "speech", "dictation"]) {
        if (key in record) collectFromUnknown(record[key], depth + 1);
      }
    }
  };
  for (const row of pow) {
    const name = textOf(row.tool_name).toLowerCase();
    const action = textOf(row.tool_action).toLowerCase();
    const type = textOf(row.type).toLowerCase();
    const spoken =
      type === "speech" ||
      name.includes("speech") ||
      name === "transcript" ||
      action.startsWith("speech_") ||
      action === "dictate";
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : null;
    if (meta) {
      push(meta.transcript_snapshot);
      push(meta.transcript);
      if (spoken) {
        push(meta.text);
        push(meta.prompt);
        push(meta.speech);
        push(meta.dictation);
      }
    }
    if (spoken) push(row.payload);
  }
  return out;
}

export function isFlowEmbeddingVector(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === FLOW_EMBEDDING_DIM &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function storedChannelVectors(record: {
  vector?: number[];
  channel_vectors?: FlowEmbeddingChannelVectors | null;
}): FlowEmbeddingChannelVectors {
  const stored = parseFlowEmbeddingChannelVectors(record.channel_vectors);
  if (stored) return stored;
  const path = isFlowEmbeddingVector(record.vector)
    ? record.vector
    : new Array(FLOW_EMBEDDING_DIM).fill(0);
  return { path };
}

export function vectorForFlowSpace(
  record: {
    vector?: number[];
    vector_path_text?: number[];
    channel_vectors?: FlowEmbeddingChannelVectors | null;
  },
  space: string = "path",
): number[] {
  const parsed = parseFlowEmbeddingSpace(space);
  const canonical = parsed.ok ? parsed.space : "path";
  return mixFlowEmbeddingSpace(storedChannelVectors(record), canonical);
}

export function vectorForFlowChannel(
  record: {
    vector?: number[];
    vector_path_text?: number[];
    channel_vectors?: FlowEmbeddingChannelVectors | null;
  },
  channel: FlowEmbeddingChannel | string = "path",
): number[] {
  if (parseFlowEmbeddingChannel(channel) === "path_text") {
    return vectorForFlowSpace(record, "path+audio");
  }
  const parsed = parseFlowEmbeddingSpace(channel);
  if (parsed.ok && parsed.space !== "path") {
    return vectorForFlowSpace(record, parsed.space);
  }
  return vectorForFlowSpace(record, "path");
}

export function vectorsMatch(a: readonly number[], b: readonly number[], eps = 1e-9): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (Math.abs(a[i] - b[i]) > eps) return false;
  }
  return true;
}

export function flowEmbeddingRecordFromHost(input: {
  raw: FlowEmbeddingRaw;
  embedding: number[];
  channel_vectors: FlowEmbeddingChannelVectors;
}): FlowEmbeddingRecord {
  const channel_vectors =
    parseFlowEmbeddingChannelVectors(input.channel_vectors) ?? { path: input.embedding };
  return {
    embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
    dim: FLOW_EMBEDDING_DIM,
    vector: channel_vectors.path,
    vector_path_text: mixFlowEmbeddingSpace(channel_vectors, "path+audio"),
    channel_vectors,
    raw: input.raw,
  };
}
