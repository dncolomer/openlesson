/**
 * Deterministic embeddings for a completed Calibrate, Learn, or Verify run.
 * Path space (`flowcfg-v1-d96`, stored default) is the hidden-state tree and
 * priced walk. Path + Text (`flowcfg-pathtext-v1-d96`, stored channel `path_text`)
 * mixes that walk with spoken and written transcripts. Identity, event logs, and UI tool counts stay
 * off-vector in recoverable raw. Calibrate sounding omits projected policy.
 */

import {
  hashUnit,
  l2Normalize,
  projectWithMatrix,
  seededRandomProjection,
} from "@/lib/knowledge-config/math";
import type { SessionBranchModel } from "@/lib/session-branch-model";
import { scorePolicySequence } from "@/lib/session-policy-score";

export const FLOW_EMBEDDING_MODEL_ID = "flowcfg-v1-d96" as const;
export const FLOW_EMBEDDING_PATH_TEXT_MODEL_ID = "flowcfg-pathtext-v1-d96" as const;
export const FLOW_EMBEDDING_DIM = 96 as const;
export const FLOW_EMBEDDING_STRUCT_DIM = 64 as const;
export const FLOW_EMBEDDING_SEM_DIM = 32 as const;
export const FLOW_EMBEDDING_CHANNELS = ["path", "path_text"] as const;
export type FlowEmbeddingChannel = (typeof FLOW_EMBEDDING_CHANNELS)[number];
export const FLOW_EMBEDDING_CHANNEL_LABELS: Record<FlowEmbeddingChannel, string> = {
  path: "Path",
  path_text: "Path + Text",
};
export const FLOW_EMBEDDING_PATH_TEXT_PATH_WEIGHT = 0.75;
export const FLOW_EMBEDDING_PATH_TEXT_TEXT_WEIGHT = 0.25;

export type FlowKind = "calibrate" | "learn" | "verify";

export type FlowPowRow = {
  type?: string | null;
  tool_name?: string | null;
  tool_action?: string | null;
  timestamp_ms?: number | null;
  payload?: string | null;
  metadata?: Record<string, unknown> | null;
  xai_file_id?: string | null;
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
  /** Path space: hidden-state tree + walk. Default stored vector. */
  vector: number[];
  /** Path + Text space: walk mixed with spoken and written transcripts. */
  vector_path_text: number[];
  raw: FlowEmbeddingRaw;
};

const SEM_BAG_DIM = 96;
const WALK_PROJECTION = seededRandomProjection(32, 10, `${FLOW_EMBEDDING_MODEL_ID}:hidden-walk`);
const TREE_BAG_PROJECTION = seededRandomProjection(32, 8, `${FLOW_EMBEDDING_MODEL_ID}:hidden-tree`);

const FLOW_KINDS = new Set<FlowKind>(["calibrate", "learn", "verify"]);

function textOf(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function numberOf(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseFlowKind(value: unknown): FlowKind {
  return FLOW_KINDS.has(value as FlowKind) ? (value as FlowKind) : "learn";
}

function clip01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function hashBag(texts: readonly string[]): number[] {
  const bag = new Array(SEM_BAG_DIM).fill(0);
  for (const text of texts) {
    const clean = text.trim();
    if (!clean) continue;
    const tokens = clean.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean);
    const pieces = tokens.length ? tokens : [clean.toLowerCase()];
    for (const piece of pieces) {
      bag[Math.floor(hashUnit(`${FLOW_EMBEDDING_MODEL_ID}:${piece}`) * SEM_BAG_DIM)] += 1;
    }
  }
  const max = Math.max(1, ...bag);
  return bag.map((n) => n / max);
}

/** Hash free text into a unit flowcfg-v1-d96 vector (synthetic regions, demo seeds). */
export function embedTextsToFlowVector(texts: readonly string[]): number[] {
  return l2Normalize(hashBag(texts));
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
  const compacted = (rows ?? []).map((row, index) => ({
    type: textOf(row.type) || "tool",
    tool_name: textOf(row.tool_name) || null,
    tool_action: textOf(row.tool_action) || null,
    timestamp_ms: Number.isFinite(Number(row.timestamp_ms)) ? Number(row.timestamp_ms) : index + 1,
    payload: textOf(row.payload) || null,
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata
      : null,
  }));
  compacted.sort((a, b) => (a.timestamp_ms ?? 0) - (b.timestamp_ms ?? 0) || textOf(a.tool_name).localeCompare(textOf(b.tool_name)));
  return compacted;
}

function compactPolicy(
  flowKind: FlowKind,
  model: SessionBranchModel | null | undefined,
  sequence: readonly string[] | null | undefined,
): FlowProjectedPolicyRaw | null {
  if (flowKind === "calibrate") return null;
  if (!model || !Array.isArray(sequence) || sequence.length === 0) return null;
  const scored = scorePolicySequence(model, sequence);
  return {
    sequence: scored.sequence.slice(),
    steps: scored.steps,
    excess: scored.excess,
    distance: scored.distance,
  };
}

export function buildFlowEmbeddingRaw(input: {
  flowKind: FlowKind | string;
  model?: SessionBranchModel | null;
  /** Ignored. Catalog size is no longer part of the gen model. */
  catalogSize?: unknown;
  sequence?: readonly string[] | null;
  pow?: readonly FlowPowRow[] | null;
}): FlowEmbeddingRaw {
  const flowKind = parseFlowKind(input.flowKind);
  return {
    flowKind,
    genModel: compactGenModel(input.model),
    projectedPolicy: compactPolicy(flowKind, input.model, input.sequence),
    pow: compactPow(input.pow),
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
  if (flowKind !== "calibrate" && policyRaw && typeof policyRaw === "object" && !Array.isArray(policyRaw)) {
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

export function flowEmbeddingModelIdForChannel(
  channel: FlowEmbeddingChannel | string,
): string {
  return parseFlowEmbeddingChannel(channel) === "path_text"
    ? FLOW_EMBEDDING_PATH_TEXT_MODEL_ID
    : FLOW_EMBEDDING_MODEL_ID;
}

function mean(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length);
}

function nodeFeature(branch: FlowGenModelRaw["branches"][number]): number[] {
  const prices = branch.edges.map((edge) => edge.price);
  return [
    clip01(branch.depth / 4),
    clip01(mean(prices) / 100),
    clip01(branch.edges.length / 8),
    branch.status === "open" ? 1 : branch.status === "closed" ? 0.3 : 0.6,
    branch.parentId ? 1 : 0,
    clip01((prices.length ? Math.min(...prices) : 0) / 100),
    clip01(Math.max(0, ...prices) / 100),
    clip01(branch.depth === 0 ? 0 : 1),
  ];
}

function edgePriceIndex(branches: FlowGenModelRaw["branches"]): Map<string, number> {
  const index = new Map<string, number>();
  for (const branch of branches) {
    for (const edge of branch.edges) {
      index.set(`${branch.id}>${edge.toId}`, edge.price);
    }
  }
  return index;
}

function treeSketch(raw: FlowEmbeddingRaw): number[] {
  const branches = raw.genModel.branches;
  const prices = branches.flatMap((branch) => branch.edges.map((edge) => edge.price));
  const depths = branches.map((branch) => branch.depth);
  const scalars = new Array(32).fill(0);
  scalars[0] = raw.flowKind === "calibrate" ? 0 : raw.flowKind === "learn" ? 0.5 : 1;
  scalars[1] = clip01(branches.length / 200);
  scalars[2] = clip01(prices.length / 64);
  scalars[3] = clip01(mean(prices) / 100);
  scalars[4] = clip01(stdev(prices) / 50);
  scalars[5] = clip01(mean(depths) / 4);
  scalars[6] = clip01(
    branches.filter((branch) => branch.status === "open").length / Math.max(1, branches.length),
  );
  scalars[7] = clip01(
    branches.filter((branch) => branch.depth >= 2).length / Math.max(1, branches.length),
  );
  scalars[8] = branches.some((branch) => branch.id === raw.genModel.rootId) ? 1 : 0;
  scalars[9] = clip01((depths.length ? Math.max(...depths) : 0) / 8);
  const leaves = branches.filter((branch) => branch.edges.length === 0).length;
  scalars[10] = clip01(leaves / Math.max(1, branches.length));
  scalars[11] = clip01(mean(branches.map((branch) => branch.edges.length)) / 8);
  scalars[12] = clip01((prices.length ? Math.min(...prices) : 0) / 100);
  scalars[13] = clip01((prices.length ? Math.max(...prices) : 0) / 100);
  scalars[14] = clip01(Math.log1p(branches.length) / 6);
  scalars[15] = raw.projectedPolicy ? 1 : 0;

  const bag = new Array(8).fill(0);
  for (const branch of branches) {
    const feat = nodeFeature(branch);
    for (let i = 0; i < feat.length; i += 1) bag[i] += feat[i];
  }
  const treeBag = l2Normalize(projectWithMatrix(bag, TREE_BAG_PROJECTION));
  return [...scalars, ...treeBag];
}

function walkSketch(raw: FlowEmbeddingRaw): number[] {
  const branches = raw.genModel.branches;
  const byId = new Map(branches.map((branch) => [branch.id, branch]));
  const prices = edgePriceIndex(branches);
  const sequence = raw.projectedPolicy?.sequence ?? [];
  const policy = raw.projectedPolicy;
  const unique = new Set(sequence);
  const takenPrices: number[] = [];
  let cursor = raw.genModel.rootId;
  const walk = new Array(10).fill(0);
  const decay = 0.85;
  for (let t = 0; t < sequence.length; t += 1) {
    const id = sequence[t];
    const branch = byId.get(id);
    const price = prices.get(`${cursor}>${id}`) ?? 0;
    takenPrices.push(price);
    const weight = decay ** (sequence.length - 1 - t);
    const feat = branch ? nodeFeature(branch) : new Array(8).fill(0);
    const step = [...feat, clip01(price / 100), clip01((t + 1) / Math.max(1, sequence.length))];
    const projected = projectWithMatrix(step, WALK_PROJECTION);
    for (let i = 0; i < walk.length && i < projected.length; i += 1) {
      walk[i] += projected[i] * weight;
    }
    cursor = id;
  }
  const last = sequence.length ? byId.get(sequence[sequence.length - 1]) : null;
  const scalars = [
    policy ? 1 : 0,
    clip01((policy?.steps ?? sequence.length) / 32),
    clip01((policy?.distance ?? 0) / 100),
    clip01((policy?.excess ?? 0) / 400),
    clip01(unique.size / Math.max(1, branches.length)),
    clip01(sequence.length / 32),
    sequence[0] === raw.genModel.rootId ? 1 : 0,
    clip01((last?.depth ?? 0) / 4),
  ];
  const walk32 = sequence.length
    ? l2Normalize(projectWithMatrix(pad(walk, 10), WALK_PROJECTION))
    : new Array(32).fill(0);
  return [...scalars, ...walk32.slice(0, 24)];
}

function pad(values: number[], dim: number): number[] {
  if (values.length >= dim) return values.slice(0, dim);
  return [...values, ...new Array(dim - values.length).fill(0)];
}

function pathVector(raw: FlowEmbeddingRaw): number[] {
  const tree = pad(treeSketch(raw), FLOW_EMBEDDING_STRUCT_DIM);
  const walk = pad(walkSketch(raw), FLOW_EMBEDDING_SEM_DIM);
  return l2Normalize([...tree, ...walk]);
}

function collectPowTranscripts(pow: readonly FlowPowRow[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const next = value.trim();
    if (!next || seen.has(next)) return;
    if (next.startsWith("{") || next.startsWith("[")) {
      try {
        const parsed = JSON.parse(next) as unknown;
        collectFromUnknown(parsed, out, seen, 0);
      } catch {
        return;
      }
      return;
    }
    seen.add(next);
    out.push(next);
  };
  const collectFromUnknown = (value: unknown, into: string[], had: Set<string>, depth: number) => {
    if (depth > 5 || value == null) return;
    if (typeof value === "string") {
      push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collectFromUnknown(item, into, had, depth + 1);
      return;
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      for (const key of ["transcript_snapshot", "transcript", "text", "prompt", "speech", "dictation"]) {
        if (key in record) collectFromUnknown(record[key], into, had, depth + 1);
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

function textVector(raw: FlowEmbeddingRaw): number[] {
  const texts = collectPowTranscripts(raw.pow);
  if (!texts.length) return new Array(FLOW_EMBEDDING_DIM).fill(0);
  return l2Normalize(hashBag(texts));
}

function pathTextVector(path: number[], text: number[]): number[] {
  if (text.every((value) => value === 0)) return path;
  const mixed = path.map(
    (value, index) =>
      value * FLOW_EMBEDDING_PATH_TEXT_PATH_WEIGHT +
      (text[index] ?? 0) * FLOW_EMBEDDING_PATH_TEXT_TEXT_WEIGHT,
  );
  return l2Normalize(mixed);
}

export function embedFlowChannels(rawInput: FlowEmbeddingRaw): {
  raw: FlowEmbeddingRaw;
  path: number[];
  path_text: number[];
} {
  const recovered = recoverFlowEmbeddingRaw(rawInput);
  const raw = recovered ?? rawInput;
  const path = pathVector(raw);
  const path_text = pathTextVector(path, textVector(raw));
  return { raw, path, path_text };
}

export function embedFlowOutput(rawInput: FlowEmbeddingRaw): FlowEmbeddingRecord {
  const { raw, path, path_text } = embedFlowChannels(rawInput);
  return {
    embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
    dim: FLOW_EMBEDDING_DIM,
    vector: path,
    vector_path_text: path_text,
    raw,
  };
}

export function completeFlowEmbedding(input: {
  flowKind: FlowKind | string;
  model?: SessionBranchModel | null;
  /** Ignored. Catalog size is no longer part of the gen model. */
  catalogSize?: unknown;
  sequence?: readonly string[] | null;
  pow?: readonly FlowPowRow[] | null;
}): FlowEmbeddingRecord {
  return embedFlowOutput(buildFlowEmbeddingRaw(input));
}

export function reembedFlowRaw(
  raw: FlowEmbeddingRaw,
  channel: FlowEmbeddingChannel | string = "path",
): number[] {
  const embedded = embedFlowChannels(raw);
  return parseFlowEmbeddingChannel(channel) === "path_text" ? embedded.path_text : embedded.path;
}

export function vectorForFlowChannel(
  record: Pick<FlowEmbeddingRecord, "vector" | "vector_path_text" | "raw">,
  channel: FlowEmbeddingChannel | string = "path",
): number[] {
  const parsed = parseFlowEmbeddingChannel(channel);
  if (parsed === "path_text") {
    if (Array.isArray(record.vector_path_text) && record.vector_path_text.length === FLOW_EMBEDDING_DIM) {
      return record.vector_path_text;
    }
    return reembedFlowRaw(record.raw, "path_text");
  }
  if (Array.isArray(record.vector) && record.vector.length === FLOW_EMBEDDING_DIM) {
    return record.vector;
  }
  return reembedFlowRaw(record.raw, "path");
}

export function isFlowEmbeddingVector(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === FLOW_EMBEDDING_DIM &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function vectorsMatch(a: readonly number[], b: readonly number[], eps = 1e-9): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (Math.abs(a[i] - b[i]) > eps) return false;
  }
  return true;
}
