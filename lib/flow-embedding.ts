/**
 * Deterministic embeddings for a completed Calibrate, Learn, or Verify run.
 * The vector encodes the generative model (tree + catalog size), the projected
 * policy when the flow produced one, and the proof of work. The raw payload is
 * stored with the vector so it can be recovered and re-embedded.
 *
 * Calibrate sounding omits projected policy. Learn and Verify include it.
 * This is not knowledgecfg-v1-d64 and not an LWM snapshot.
 */

import {
  hashUnit,
  l2Normalize,
  projectWithMatrix,
  seededRandomProjection,
} from "@/lib/knowledge-config/math";
import { parseLearningModelSize, type LearningModelSize } from "@/lib/learning-model";
import type { SessionBranchModel } from "@/lib/session-branch-model";
import { scorePolicySequence } from "@/lib/session-policy-score";

export const FLOW_EMBEDDING_MODEL_ID = "flowcfg-v1-d96" as const;
export const FLOW_EMBEDDING_DIM = 96 as const;
export const FLOW_EMBEDDING_STRUCT_DIM = 64 as const;
export const FLOW_EMBEDDING_SEM_DIM = 32 as const;

export type FlowKind = "calibrate" | "learn" | "verify";

export type FlowPowRow = {
  type?: string | null;
  tool_name?: string | null;
  tool_action?: string | null;
  timestamp_ms?: number | null;
  payload?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type FlowGenModelRaw = {
  catalogSize: LearningModelSize;
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
    actions: Array<{ id: string; price: number }>;
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
  raw: FlowEmbeddingRaw;
};

const SEM_BAG_DIM = 96;
const SEM_PROJECTION = seededRandomProjection(
  FLOW_EMBEDDING_SEM_DIM,
  SEM_BAG_DIM,
  `${FLOW_EMBEDDING_MODEL_ID}:sem`,
);

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

function stableObject(value: Record<string, unknown>): string {
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function canonical(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") return stableObject(value as Record<string, unknown>);
  return "null";
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

function compactGenModel(model: SessionBranchModel | null | undefined, catalogSize: LearningModelSize): FlowGenModelRaw {
  const branches = (model?.branches ?? [])
    .map((branch) => ({
      id: textOf(branch.id),
      parentId: branch.parentId == null ? null : textOf(branch.parentId) || null,
      title: textOf(branch.title),
      question: textOf(branch.question),
      territory: textOf(branch.territory),
      observation: textOf(branch.observation),
      depth: Math.max(0, Math.round(numberOf(branch.depth))),
      status: textOf(branch.status) || "open",
      actions: (branch.actions ?? [])
        .map((action) => ({
          id: textOf(action.id),
          price: Math.max(0, Math.min(100, Math.round(numberOf(action.price)))),
        }))
        .filter((action) => action.id)
        .sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .filter((branch) => branch.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    catalogSize,
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
  const scored = scorePolicySequence(model, sequence as never);
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
  catalogSize?: unknown;
  sequence?: readonly string[] | null;
  pow?: readonly FlowPowRow[] | null;
}): FlowEmbeddingRaw {
  const flowKind = parseFlowKind(input.flowKind);
  const catalogSize = parseLearningModelSize(input.catalogSize ?? input.model?.catalogSize);
  return {
    flowKind,
    genModel: compactGenModel(input.model, catalogSize),
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
  const catalogSize = parseLearningModelSize(tree.catalogSize);
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
      catalogSize,
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
          actions: Array.isArray(branch.actions)
            ? branch.actions
                .filter((action): action is Record<string, unknown> => !!action && typeof action === "object")
                .map((action) => ({
                  id: textOf(action.id),
                  price: Math.max(0, Math.min(100, Math.round(numberOf(action.price)))),
                }))
                .filter((action) => action.id)
            : [],
        }))
        .filter((branch) => branch.id),
    },
    projectedPolicy,
    pow,
  };
}

function structFeatures(raw: FlowEmbeddingRaw): number[] {
  const branches = raw.genModel.branches;
  const prices = branches.flatMap((branch) => branch.actions.map((action) => action.price));
  const meanPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const variance =
    prices.length > 1
      ? prices.reduce((sum, price) => sum + (price - meanPrice) ** 2, 0) / prices.length
      : 0;
  const meanDepth = branches.length
    ? branches.reduce((sum, branch) => sum + branch.depth, 0) / branches.length
    : 0;
  const policy = raw.projectedPolicy;
  const pow = raw.pow;
  const features = new Array(FLOW_EMBEDDING_STRUCT_DIM).fill(0);
  features[0] = raw.flowKind === "calibrate" ? 0 : raw.flowKind === "learn" ? 0.5 : 1;
  features[1] = raw.genModel.catalogSize / 16;
  features[2] = clip01(branches.length / 200);
  features[3] = clip01(meanPrice / 100);
  features[4] = clip01(Math.sqrt(variance) / 50);
  features[5] = clip01(meanDepth / 4);
  features[6] = policy ? 1 : 0;
  features[7] = clip01((policy?.steps ?? 0) / 32);
  features[8] = clip01((policy?.distance ?? 0) / 100);
  features[9] = clip01((policy?.excess ?? 0) / 400);
  features[10] = clip01(pow.length / 64);
  features[11] = hashUnit(`kind:${raw.flowKind}`);
  features[12] = hashUnit(`catalog:${raw.genModel.catalogSize}`);
  features[13] = hashUnit(`title:${raw.genModel.chapterTitle}`);
  features[14] = hashUnit(`root:${raw.genModel.rootId}`);
  features[15] = hashUnit(`tree:${canonical(raw.genModel)}`);
  features[16] = hashUnit(`policy:${canonical(policy)}`);
  features[17] = hashUnit(`pow:${canonical(pow)}`);
  features[18] = clip01(branches.filter((branch) => branch.status === "open").length / Math.max(1, branches.length));
  features[19] = clip01(branches.filter((branch) => branch.depth >= 2).length / Math.max(1, branches.length));
  const actionIds = branches.flatMap((branch) => branch.actions.map((action) => action.id)).sort();
  features[20] = hashUnit(`actions:${actionIds.join(",")}`);
  features[21] = hashUnit(`seq:${policy?.sequence.join(" ") ?? ""}`);
  features[22] = hashUnit(`pow-names:${pow.map((row) => `${row.tool_name}:${row.tool_action}`).join("|")}`);
  for (let i = 23; i < FLOW_EMBEDDING_STRUCT_DIM; i += 1) {
    features[i] = hashUnit(`slot:${i}:${canonical(raw)}`);
  }
  return features;
}

export function embedFlowOutput(rawInput: FlowEmbeddingRaw): FlowEmbeddingRecord {
  const recovered = recoverFlowEmbeddingRaw(rawInput);
  const raw = recovered ?? rawInput;
  const struct = l2Normalize(structFeatures(raw));
  const texts = [
    raw.flowKind,
    String(raw.genModel.catalogSize),
    raw.genModel.chapterTitle,
    ...raw.genModel.branches.flatMap((branch) => [
      branch.title,
      branch.question,
      branch.territory,
      branch.observation,
    ]),
    ...(raw.projectedPolicy?.sequence ?? []),
    ...raw.pow.flatMap((row) => [row.tool_name, row.tool_action, row.payload, row.type]),
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const sem = l2Normalize(projectWithMatrix(hashBag(texts), SEM_PROJECTION));
  const paddedStruct = struct.length >= FLOW_EMBEDDING_STRUCT_DIM
    ? struct.slice(0, FLOW_EMBEDDING_STRUCT_DIM)
    : [...struct, ...new Array(FLOW_EMBEDDING_STRUCT_DIM - struct.length).fill(0)];
  const paddedSem = sem.length >= FLOW_EMBEDDING_SEM_DIM
    ? sem.slice(0, FLOW_EMBEDDING_SEM_DIM)
    : [...sem, ...new Array(FLOW_EMBEDDING_SEM_DIM - sem.length).fill(0)];
  return {
    embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
    dim: FLOW_EMBEDDING_DIM,
    vector: l2Normalize([...paddedStruct, ...paddedSem]),
    raw,
  };
}

export function completeFlowEmbedding(input: {
  flowKind: FlowKind | string;
  model?: SessionBranchModel | null;
  catalogSize?: unknown;
  sequence?: readonly string[] | null;
  pow?: readonly FlowPowRow[] | null;
}): FlowEmbeddingRecord {
  return embedFlowOutput(buildFlowEmbeddingRaw(input));
}

export function reembedFlowRaw(raw: FlowEmbeddingRaw): number[] {
  return embedFlowOutput(raw).vector;
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
