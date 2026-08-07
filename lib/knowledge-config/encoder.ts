/**
 * knowledgecfg-v1-d64 hybrid encoder:
 *   z = concat(normalize(z_struct[48]), normalize(z_sem[16])) then optional global normalize.
 * Deterministic: same feature inputs → same vector.
 */

import type { LearningWorldModelV0 } from "@/lib/prompt-kernel/world-model";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  KNOWLEDGE_CONFIG_SEM_DIM,
  KNOWLEDGE_CONFIG_STRUCT_DIM,
  type KnowledgeConfigEmbeddingV1,
} from "./types";
import {
  clip01,
  hashUnit,
  l2Normalize,
  projectWithMatrix,
  scoreToUnit,
  seededRandomProjection,
} from "./math";

/** Minimal PoW row shape used for feature extraction. */
export interface PowFeatureRow {
  proof_of_work_type?: string | null;
  type?: string | null;
  block_id?: string | null;
  timestamp_ms?: number | null;
  tool_name?: string | null;
  tool_action?: string | null;
  metadata?: Record<string, unknown> | null;
  sample_count?: number | null;
  device_name?: string | null;
}

export interface KnowledgeConfigEncodeInput {
  workspaceId: string;
  /** Total blocks in workspace for coverage denominator. */
  totalBlocks?: number;
  powRows: PowFeatureRow[];
  worldModel?: LearningWorldModelV0 | null;
  /** Override as-of; default max timestamp_ms or now. */
  asOfMs?: number;
  /**
   * Evaluated goal text for this snapshot (multi-goals joined).
   * Included in the semantic bag so distinct goal selections produce distinct embeddings.
   */
  evaluatedGoalsText?: string | null;
}

const SEM_BAG_DIM = 64;
const SEM_PROJECTION = seededRandomProjection(
  KNOWLEDGE_CONFIG_SEM_DIM,
  SEM_BAG_DIM,
  `${KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID}:sem`,
);

/** Fixed 2D frame for UI (first two principal-ish axes of structured block). */
const PROJECTION_2D = seededRandomProjection(2, KNOWLEDGE_CONFIG_DIM, `${KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID}:ui2d`);

function depthToUnit(depth: string | undefined): number {
  switch (depth) {
    case "solid":
      return 1;
    case "shallow":
      return 0.5;
    case "none":
    default:
      return 0;
  }
}

function ghcConfidenceUnit(confidence: string | null | undefined): number {
  switch (confidence) {
    case "high":
      return 1;
    case "medium":
      return 2 / 3;
    case "low":
      return 1 / 3;
    default:
      return 0;
  }
}

function powType(row: PowFeatureRow): string {
  return (row.proof_of_work_type || row.type || "tool").toLowerCase();
}

function isThoughtTrace(row: PowFeatureRow): boolean {
  const meta = row.metadata || {};
  const name = (row.tool_name || "").toLowerCase();
  const action = (row.tool_action || "").toLowerCase();
  if (meta.selective_thought === true || meta.thought_trace === true) return true;
  if (meta.system === 1 || meta.system === 2 || meta.system === "1" || meta.system === "2") return true;
  if (name.includes("speech") || name.includes("thought") || action.includes("speech")) return true;
  if (typeof meta.source === "string" && /tap|ile|speech|thought/i.test(meta.source)) return true;
  return false;
}

function system1Share(rows: PowFeatureRow[]): number {
  let s1 = 0;
  let s2 = 0;
  for (const row of rows) {
    const meta = row.metadata || {};
    const sys = meta.system ?? meta.system_n;
    if (sys === 1 || sys === "1" || meta.stash === true) s1 += 1;
    if (sys === 2 || sys === "2" || meta.submit === true) s2 += 1;
  }
  const total = s1 + s2;
  if (total === 0) return 0;
  return s1 / total;
}

function temporalFeatures(timestamps: number[]): {
  logMeanGap: number;
  burstiness: number;
  idleBurstRate: number;
  spanNorm: number;
} {
  if (timestamps.length < 2) {
    return { logMeanGap: 0, burstiness: 0, idleBurstRate: 0, spanNorm: 0 };
  }
  const sorted = [...timestamps].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(Math.max(0, sorted[i] - sorted[i - 1]));
  }
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance =
    gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / Math.max(1, gaps.length);
  const std = Math.sqrt(variance);
  // Burstiness B = (σ - μ) / (σ + μ) ∈ [-1,1] → map to [0,1]
  const burst = (std + mean) > 0 ? (std - mean) / (std + mean) : 0;
  const idleThreshold = Math.max(60_000, mean * 3);
  const idleBursts = gaps.filter((g) => g >= idleThreshold).length;
  const spanMs = sorted[sorted.length - 1] - sorted[0];
  // Normalize span to ~4h
  const spanNorm = clip01(spanMs / (4 * 3600 * 1000));
  // log mean gap: 1s → ~0, 1h → ~1
  const logMeanGap = clip01(Math.log1p(mean / 1000) / Math.log1p(3600));
  return {
    logMeanGap,
    burstiness: clip01((burst + 1) / 2),
    idleBurstRate: clip01(idleBursts / gaps.length),
    spanNorm,
  };
}

function buildStruct48(input: KnowledgeConfigEncodeInput): number[] {
  const wm = input.worldModel;
  const scores = wm?.scores_snapshot;
  const rows = input.powRows;
  const n = rows.length;
  const totalBlocks = Math.max(1, input.totalBlocks ?? wm?.exploration.block_coverage.length ?? 1);

  const typeCounts = { tool: 0, screen: 0, video: 0, eeg: 0, other: 0 };
  const blockIds = new Set<string>();
  let thought = 0;
  const timestamps: number[] = [];

  for (const row of rows) {
    const t = powType(row);
    if (t === "tool" || t === "screen" || t === "video" || t === "eeg") typeCounts[t] += 1;
    else typeCounts.other += 1;
    if (row.block_id) blockIds.add(row.block_id);
    if (isThoughtTrace(row)) thought += 1;
    if (typeof row.timestamp_ms === "number" && Number.isFinite(row.timestamp_ms)) {
      timestamps.push(row.timestamp_ms);
    }
  }

  const denom = Math.max(1, n);
  const temporal = temporalFeatures(timestamps);
  const coverage = wm?.exploration.block_coverage ?? [];
  const meanDepth =
    coverage.length === 0
      ? blockIds.size > 0
        ? 0.35
        : 0
      : coverage.reduce((s, c) => s + depthToUnit(c.depth), 0) / coverage.length;
  const fracBlocksTouched = clip01(
    (coverage.length ? coverage.filter((c) => c.depth !== "none").length : blockIds.size) /
      totalBlocks,
  );
  const blindSpotDensity = clip01((wm?.exploration.blind_spots.length ?? 0) / 8);
  const pathwayDensity = clip01((wm?.exploration.pathways_touched.length ?? 0) / 12);
  const strengthDensity = clip01((wm?.learning_profile.strengths.length ?? 0) / 8);
  const frictionDensity = clip01((wm?.learning_profile.friction_patterns.length ?? 0) / 8);
  const modalityDensity = clip01((wm?.learning_profile.preferred_modalities.length ?? 0) / 6);
  const wantMore = clip01((wm?.evidence_appetite.want_more.length ?? 0) / 6);
  const saturated = clip01((wm?.evidence_appetite.saturated.length ?? 0) / 6);
  const goalConf = clip01(wm?.inferred_goal.confidence ?? 0);
  const avgDwell = wm?.learning_profile.temporal_patterns.avg_dwell_ms;
  const dwellUnit =
    avgDwell != null && Number.isFinite(avgDwell)
      ? clip01(Math.log1p(avgDwell / 1000) / Math.log1p(600))
      : temporal.logMeanGap;
  const idleBurstsStored = wm?.learning_profile.temporal_patterns.idle_bursts;
  const idleUnit =
    idleBurstsStored != null && Number.isFinite(idleBurstsStored)
      ? clip01(idleBurstsStored / Math.max(1, n))
      : temporal.idleBurstRate;

  // 48 dims — order is part of the model contract; do not reorder without bumping model id.
  const features: number[] = [
    // 0–3 scores
    scoreToUnit(scores?.verification_score),
    scoreToUnit(scores?.augmentation_score),
    scoreToUnit(scores?.optimization_score),
    scoreToUnit(scores?.ghc_score),
    // 4–7 coverage / goal
    fracBlocksTouched,
    meanDepth,
    blindSpotDensity,
    goalConf,
    // 8–12 evidence mix
    typeCounts.tool / denom,
    typeCounts.screen / denom,
    typeCounts.video / denom,
    typeCounts.eeg / denom,
    thought / denom,
    // 13–16 temporal
    temporal.logMeanGap,
    temporal.burstiness,
    idleUnit,
    temporal.spanNorm,
    // 17–20 profile densities
    strengthDensity,
    frictionDensity,
    modalityDensity,
    pathwayDensity,
    // 21–24 appetite + thought systems
    wantMore,
    saturated,
    system1Share(rows),
    clip01(n / 50), // evidence volume (saturates at ~50 artifacts)
    // 25–28 dwell / authenticity proxies
    dwellUnit,
    ghcConfidenceUnit(
      // ghc confidence not always on LWM; derive weakly from ghc score
      scores?.ghc_score != null
        ? scores.ghc_score >= 70
          ? "high"
          : scores.ghc_score >= 40
            ? "medium"
            : scores.ghc_score > 0
              ? "low"
              : "none"
        : "none",
    ),
    clip01(blockIds.size / totalBlocks),
    typeCounts.other / denom,
    // 29–35 reserved structural slots (zeros keep dim stable for sparse signals)
    clip01((wm?.inferred_goal.source === "workspace" ? 1 : wm?.inferred_goal.source === "evolved" ? 0.7 : 0.3)),
    clip01(timestamps.length / Math.max(1, n)),
    n > 0 ? 1 : 0,
    clip01(Math.log1p(n) / Math.log1p(200)),
    // tool diversity
    clip01(
      new Set(rows.map((r) => (r.tool_name || "").toLowerCase()).filter(Boolean)).size / 12,
    ),
    clip01(
      new Set(rows.map((r) => (r.tool_action || "").toLowerCase()).filter(Boolean)).size / 16,
    ),
    // device/eeg presence
    rows.some((r) => r.device_name || powType(r) === "eeg") ? 1 : 0,
  ];

  // Pad / trim to exactly 48
  while (features.length < KNOWLEDGE_CONFIG_STRUCT_DIM) features.push(0);
  return features.slice(0, KNOWLEDGE_CONFIG_STRUCT_DIM).map(clip01);
}

function bagOfTokens(text: string, dim: number): number[] {
  const bag = new Array(dim).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9_+.-]+/)
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return bag;
  for (const tok of tokens) {
    const i = Math.floor(hashUnit(tok) * dim) % dim;
    bag[i] += 1;
  }
  return l2Normalize(bag);
}

function buildSem16(
  wm: LearningWorldModelV0 | null | undefined,
  evaluatedGoalsText?: string | null,
): number[] {
  if (!wm && !evaluatedGoalsText?.trim()) {
    return new Array(KNOWLEDGE_CONFIG_SEM_DIM).fill(0);
  }
  const parts = [
    evaluatedGoalsText?.trim() || "",
    wm?.inferred_goal?.text || "",
    ...(wm?.learning_profile?.strengths || []),
    ...(wm?.learning_profile?.friction_patterns || []),
    ...(wm?.learning_profile?.preferred_modalities || []),
    ...(wm?.evidence_appetite?.want_more || []),
    ...(wm?.evidence_appetite?.saturated || []),
    ...(wm?.exploration?.blind_spots || []),
    ...(wm?.exploration?.pathways_touched || []),
  ];
  const bag = bagOfTokens(parts.join(" "), SEM_BAG_DIM);
  return l2Normalize(projectWithMatrix(bag, SEM_PROJECTION));
}

function confidenceFromInput(input: KnowledgeConfigEncodeInput): number {
  const n = input.powRows.length;
  const hasScores =
    input.worldModel?.scores_snapshot &&
    (input.worldModel.scores_snapshot.verification_score != null ||
      input.worldModel.scores_snapshot.augmentation_score != null ||
      input.worldModel.scores_snapshot.optimization_score != null);
  const volume = clip01(Math.log1p(n) / Math.log1p(30));
  const scoreBoost = hasScores ? 0.25 : 0;
  const coverageBoost = clip01((input.worldModel?.exploration.block_coverage.length ?? 0) / 4) * 0.2;
  return clip01(volume * 0.55 + scoreBoost + coverageBoost);
}

export function encodeKnowledgeConfig(input: KnowledgeConfigEncodeInput): KnowledgeConfigEmbeddingV1 {
  // Weighted concat so structured axes dominate; residual cannot overwhelm cross-workspace geometry.
  const zStruct = l2Normalize(buildStruct48(input)).map((x) => x * Math.sqrt(0.85));
  const zSem = l2Normalize(
    buildSem16(input.worldModel, input.evaluatedGoalsText),
  ).map((x) => x * Math.sqrt(0.15));
  const concatenated = [...zStruct, ...zSem];
  while (concatenated.length < KNOWLEDGE_CONFIG_DIM) concatenated.push(0);
  const vector = l2Normalize(concatenated.slice(0, KNOWLEDGE_CONFIG_DIM));

  const timestamps = input.powRows
    .map((r) => r.timestamp_ms)
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t));
  const asOfMs =
    input.asOfMs ??
    (timestamps.length ? Math.max(...timestamps) : Date.now());

  return {
    embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
    dim: KNOWLEDGE_CONFIG_DIM,
    vector,
    as_of: new Date(asOfMs).toISOString(),
    as_of_ms: asOfMs,
    pow_event_count: input.powRows.length,
    confidence: confidenceFromInput(input),
  };
}

export function projectKnowledgeConfigTo2D(vector: number[]): { x: number; y: number } {
  const projected = projectWithMatrix(vector, PROJECTION_2D);
  return { x: projected[0] ?? 0, y: projected[1] ?? 0 };
}

export function emptyKnowledgeConfig(asOfMs = Date.now()): KnowledgeConfigEmbeddingV1 {
  return {
    embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
    dim: KNOWLEDGE_CONFIG_DIM,
    vector: new Array(KNOWLEDGE_CONFIG_DIM).fill(0),
    as_of: new Date(asOfMs).toISOString(),
    as_of_ms: asOfMs,
    pow_event_count: 0,
    confidence: 0,
  };
}
