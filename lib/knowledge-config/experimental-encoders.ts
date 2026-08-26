/**
 * Experimental knowledge-config encoders (offline, deterministic).
 * Dual-written on score alongside knowledgecfg-v1-d64; not product UI focus.
 *
 * Models:
 *   knowledgecfg-v2-hybrid-d192  — same hybrid recipe, expanded struct/sem
 *   knowledgecfg-v2-content-d256 — content residual from thought/transcript/LWM text
 *   knowledgecfg-v2-dual-d256    — System1 / System2 channels + temporal fusion
 */

import type { LearningWorldModelV0 } from "@/lib/prompt-kernel/world-model";
import {
  asBlockCoverageList,
  asNamedList,
  type KnowledgeConfigEncodeInput,
  type PowFeatureRow,
} from "./encoder";
import type { KnowledgeConfigEmbedding } from "./types";
import {
  KNOWLEDGE_CONFIG_CONTENT_D256_DIM,
  KNOWLEDGE_CONFIG_CONTENT_D256_MODEL_ID,
  KNOWLEDGE_CONFIG_CONTENT_D256_SEM_DIM,
  KNOWLEDGE_CONFIG_DUAL_D256_DIM,
  KNOWLEDGE_CONFIG_DUAL_D256_MODEL_ID,
  KNOWLEDGE_CONFIG_DUAL_D256_S1_DIM,
  KNOWLEDGE_CONFIG_DUAL_D256_S2_DIM,
  KNOWLEDGE_CONFIG_DUAL_D256_STRUCT_DIM,
  KNOWLEDGE_CONFIG_DUAL_D256_TEMPORAL_DIM,
  KNOWLEDGE_CONFIG_HYBRID_D192_DIM,
  KNOWLEDGE_CONFIG_HYBRID_D192_MODEL_ID,
  KNOWLEDGE_CONFIG_HYBRID_D192_SEM_DIM,
  KNOWLEDGE_CONFIG_HYBRID_D192_STRUCT_DIM,
} from "./types";
import {
  clip01,
  hashUnit,
  l2Normalize,
  projectWithMatrix,
  scoreToUnit,
  seededRandomProjection,
} from "./math";

const STRUCT_WEIGHT = Math.sqrt(0.85);
const SEM_WEIGHT = Math.sqrt(0.15);

const HYBRID_SEM_BAG = 128;
const HYBRID_SEM_PROJ = seededRandomProjection(
  KNOWLEDGE_CONFIG_HYBRID_D192_SEM_DIM,
  HYBRID_SEM_BAG,
  `${KNOWLEDGE_CONFIG_HYBRID_D192_MODEL_ID}:sem`,
);

const CONTENT_BAG = 256;
const CONTENT_PROJ = seededRandomProjection(
  KNOWLEDGE_CONFIG_CONTENT_D256_SEM_DIM,
  CONTENT_BAG,
  `${KNOWLEDGE_CONFIG_CONTENT_D256_MODEL_ID}:content`,
);

const DUAL_S1_BAG = 128;
const DUAL_S2_BAG = 128;
const DUAL_S1_PROJ = seededRandomProjection(
  KNOWLEDGE_CONFIG_DUAL_D256_S1_DIM,
  DUAL_S1_BAG,
  `${KNOWLEDGE_CONFIG_DUAL_D256_MODEL_ID}:s1`,
);
const DUAL_S2_PROJ = seededRandomProjection(
  KNOWLEDGE_CONFIG_DUAL_D256_S2_DIM,
  DUAL_S2_BAG,
  `${KNOWLEDGE_CONFIG_DUAL_D256_MODEL_ID}:s2`,
);

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
  if (meta.trace_type === "system1" || meta.trace_type === "system2") return true;
  if (name.includes("speech") || name.includes("thought") || action.includes("speech")) return true;
  if (typeof meta.source === "string" && /tap|ile|speech|thought/i.test(meta.source)) return true;
  return false;
}

function systemChannel(row: PowFeatureRow): 1 | 2 | 0 {
  const meta = row.metadata || {};
  const sys = meta.system ?? meta.system_n;
  if (sys === 1 || sys === "1" || meta.stash === true || meta.trace_type === "system1") return 1;
  if (sys === 2 || sys === "2" || meta.submit === true || meta.trace_type === "system2") return 2;
  const action = (row.tool_action || "").toLowerCase();
  if (action.startsWith("system1") || /crystallize|auto_stash|pause_finalize|stash/.test(action)) {
    return 1;
  }
  if (action.startsWith("system2") || /submit|send|select|resend|deselect|end_of_chain/.test(action)) {
    return 2;
  }
  return 0;
}

function system1Share(rows: PowFeatureRow[]): number {
  let s1 = 0;
  let s2 = 0;
  for (const row of rows) {
    const ch = systemChannel(row);
    if (ch === 1) s1 += 1;
    if (ch === 2) s2 += 1;
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
  gapP25: number;
  gapP75: number;
  gapCv: number;
  eventRate: number;
} {
  if (timestamps.length < 2) {
    return {
      logMeanGap: 0,
      burstiness: 0,
      idleBurstRate: 0,
      spanNorm: 0,
      gapP25: 0,
      gapP75: 0,
      gapCv: 0,
      eventRate: 0,
    };
  }
  const sorted = [...timestamps].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(Math.max(0, sorted[i] - sorted[i - 1]));
  }
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance = gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / Math.max(1, gaps.length);
  const std = Math.sqrt(variance);
  const burst = std + mean > 0 ? (std - mean) / (std + mean) : 0;
  const idleThreshold = Math.max(60_000, mean * 3);
  const idleBursts = gaps.filter((g) => g >= idleThreshold).length;
  const spanMs = sorted[sorted.length - 1] - sorted[0];
  const spanNorm = clip01(spanMs / (4 * 3600 * 1000));
  const logMeanGap = clip01(Math.log1p(mean / 1000) / Math.log1p(3600));
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const p25 = sortedGaps[Math.floor((sortedGaps.length - 1) * 0.25)] ?? 0;
  const p75 = sortedGaps[Math.floor((sortedGaps.length - 1) * 0.75)] ?? 0;
  const eventRate = spanMs > 0 ? clip01((gaps.length + 1) / (spanMs / 60_000 + 1e-6) / 10) : 0;
  return {
    logMeanGap,
    burstiness: clip01((burst + 1) / 2),
    idleBurstRate: clip01(idleBursts / gaps.length),
    spanNorm,
    gapP25: clip01(Math.log1p(p25 / 1000) / Math.log1p(3600)),
    gapP75: clip01(Math.log1p(p75 / 1000) / Math.log1p(3600)),
    gapCv: mean > 0 ? clip01(std / mean / 3) : 0,
    eventRate,
  };
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

/** Collect free-text strings from a PoW row metadata / nested payload. */
export function extractTextFragmentsFromRow(row: PowFeatureRow): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim().length > 0) out.push(v.trim());
  };
  const meta = row.metadata || {};
  push(meta.text);
  push(meta.original_text);
  push(meta.transcript_snapshot);
  push(meta.learner_thought);
  push(meta.helios_reply);
  push(meta.content);
  push(meta.utterance);
  if (meta.payload && typeof meta.payload === "object" && meta.payload !== null) {
    const p = meta.payload as Record<string, unknown>;
    push(p.text);
    push(p.original_text);
    push(p.transcript_snapshot);
    push(p.learner_thought);
  }
  return out;
}

export function collectSystemChannelTexts(rows: PowFeatureRow[]): {
  system1: string;
  system2: string;
  all: string;
} {
  const s1: string[] = [];
  const s2: string[] = [];
  const all: string[] = [];
  for (const row of rows) {
    const frags = extractTextFragmentsFromRow(row);
    if (frags.length === 0) continue;
    const joined = frags.join(" ");
    all.push(joined);
    const ch = systemChannel(row);
    if (ch === 1) s1.push(joined);
    else if (ch === 2) s2.push(joined);
    else {
      // Unlabeled free text contributes to both residual bags lightly via "all" only.
    }
  }
  return {
    system1: s1.join(" "),
    system2: s2.join(" "),
    all: all.join(" "),
  };
}

function lwmText(wm: LearningWorldModelV0 | null | undefined): string {
  if (!wm) return "";
  const parts = [
    wm.inferred_goal?.text || "",
    ...asNamedList(wm.learning_profile?.strengths).map(String),
    ...asNamedList(wm.learning_profile?.friction_patterns).map(String),
    ...asNamedList(wm.learning_profile?.preferred_modalities).map(String),
    ...asNamedList(wm.evidence_appetite?.want_more).map(String),
    ...asNamedList(wm.evidence_appetite?.saturated).map(String),
    ...asNamedList(wm.exploration?.blind_spots).map(String),
    ...asNamedList(wm.exploration?.pathways_touched).map(String),
  ];
  return parts.join(" ");
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
  const coverageBoost =
    clip01(asBlockCoverageList(input.worldModel?.exploration?.block_coverage).length / 4) * 0.2;
  const texts = collectSystemChannelTexts(input.powRows);
  const textBoost = texts.all.length > 0 ? 0.1 : 0;
  return clip01(volume * 0.5 + scoreBoost + coverageBoost + textBoost);
}

function asOfFromInput(input: KnowledgeConfigEncodeInput): number {
  const timestamps = input.powRows
    .map((r) => r.timestamp_ms)
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t));
  return input.asOfMs ?? (timestamps.length ? Math.max(...timestamps) : Date.now());
}

/**
 * Expanded structural features (96-D). Order is part of hybrid-d192 / content-d256 contract.
 * First 48 mirror v1-style axes; remaining 48 densify modality, tools, and temporal stats.
 */
function buildStruct96(input: KnowledgeConfigEncodeInput): number[] {
  const wm = input.worldModel;
  const scores = wm?.scores_snapshot;
  const rows = input.powRows;
  const n = rows.length;
  const coverage = asBlockCoverageList(wm?.exploration?.block_coverage);
  const totalBlocks = Math.max(1, input.totalBlocks ?? coverage.length ?? 1);

  const typeCounts = { tool: 0, screen: 0, video: 0, eeg: 0, other: 0 };
  const blockIds = new Set<string>();
  let thought = 0;
  let s1 = 0;
  let s2 = 0;
  const timestamps: number[] = [];
  const toolBins = new Array(12).fill(0);
  const actionBins = new Array(12).fill(0);

  for (const row of rows) {
    const t = powType(row);
    if (t === "tool" || t === "screen" || t === "video" || t === "eeg") typeCounts[t] += 1;
    else typeCounts.other += 1;
    if (row.block_id) blockIds.add(row.block_id);
    if (isThoughtTrace(row)) thought += 1;
    const ch = systemChannel(row);
    if (ch === 1) s1 += 1;
    if (ch === 2) s2 += 1;
    if (typeof row.timestamp_ms === "number" && Number.isFinite(row.timestamp_ms)) {
      timestamps.push(row.timestamp_ms);
    }
    const tn = (row.tool_name || "").toLowerCase();
    const ta = (row.tool_action || "").toLowerCase();
    if (tn) toolBins[Math.floor(hashUnit(`tool:${tn}`) * 12) % 12] += 1;
    if (ta) actionBins[Math.floor(hashUnit(`act:${ta}`) * 12) % 12] += 1;
  }

  const denom = Math.max(1, n);
  const temporal = temporalFeatures(timestamps);
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
  const blindSpotDensity = clip01(asNamedList(wm?.exploration?.blind_spots).length / 8);
  const pathwayDensity = clip01(asNamedList(wm?.exploration?.pathways_touched).length / 12);
  const strengthDensity = clip01(asNamedList(wm?.learning_profile?.strengths).length / 8);
  const frictionDensity = clip01(asNamedList(wm?.learning_profile?.friction_patterns).length / 8);
  const modalityDensity = clip01(asNamedList(wm?.learning_profile?.preferred_modalities).length / 6);
  const wantMore = clip01(asNamedList(wm?.evidence_appetite?.want_more).length / 6);
  const saturated = clip01(asNamedList(wm?.evidence_appetite?.saturated).length / 6);
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
    // 13–16 temporal core
    temporal.logMeanGap,
    temporal.burstiness,
    idleUnit,
    temporal.spanNorm,
    // 17–20 profile densities
    strengthDensity,
    frictionDensity,
    modalityDensity,
    pathwayDensity,
    // 21–24 appetite + systems
    wantMore,
    saturated,
    system1Share(rows),
    clip01(n / 50),
    // 25–28 dwell / authenticity
    dwellUnit,
    ghcConfidenceUnit(
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
    // 29–35 v1-style reserved densified
    clip01(
      wm?.inferred_goal.source === "workspace"
        ? 1
        : wm?.inferred_goal.source === "evolved"
          ? 0.7
          : 0.3,
    ),
    clip01(timestamps.length / Math.max(1, n)),
    n > 0 ? 1 : 0,
    clip01(Math.log1p(n) / Math.log1p(200)),
    clip01(new Set(rows.map((r) => (r.tool_name || "").toLowerCase()).filter(Boolean)).size / 12),
    clip01(new Set(rows.map((r) => (r.tool_action || "").toLowerCase()).filter(Boolean)).size / 16),
    rows.some((r) => r.device_name || powType(r) === "eeg") ? 1 : 0,
    // 36–43 extra temporal / system counts
    temporal.gapP25,
    temporal.gapP75,
    temporal.gapCv,
    temporal.eventRate,
    clip01(s1 / denom),
    clip01(s2 / denom),
    clip01((s1 + s2) / denom),
    clip01(
      rows.filter((r) => extractTextFragmentsFromRow(r).length > 0).length / denom,
    ),
  ];

  // 44–55 tool hash bins (normalized)
  for (let i = 0; i < 12; i++) features.push(toolBins[i] / denom);
  // 56–67 action hash bins
  for (let i = 0; i < 12; i++) features.push(actionBins[i] / denom);
  // 68–71 sample/device proxies
  const sampleSum = rows.reduce((s, r) => s + (Number(r.sample_count) || 0), 0);
  features.push(clip01(Math.log1p(sampleSum) / Math.log1p(5000)));
  features.push(clip01(new Set(rows.map((r) => r.device_name).filter(Boolean)).size / 4));
  features.push(clip01(typeCounts.screen / Math.max(1, typeCounts.tool + typeCounts.screen)));
  features.push(clip01(typeCounts.eeg / Math.max(1, n)));
  // 72–95 reserved zeros for future structural signals (keep dim contract)
  while (features.length < KNOWLEDGE_CONFIG_HYBRID_D192_STRUCT_DIM) features.push(0);
  return features.slice(0, KNOWLEDGE_CONFIG_HYBRID_D192_STRUCT_DIM).map(clip01);
}

function buildStruct64Dual(input: KnowledgeConfigEncodeInput): number[] {
  // Dual-stream uses a 64-D structural prefix (first 64 of struct96).
  return buildStruct96(input).slice(0, KNOWLEDGE_CONFIG_DUAL_D256_STRUCT_DIM);
}

function buildTemporal32(input: KnowledgeConfigEncodeInput): number[] {
  const rows = input.powRows;
  const timestamps = rows
    .map((r) => r.timestamp_ms)
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t));
  const temporal = temporalFeatures(timestamps);
  const n = rows.length;
  let s1 = 0;
  let s2 = 0;
  let s1Ts: number[] = [];
  let s2Ts: number[] = [];
  for (const row of rows) {
    const ch = systemChannel(row);
    if (ch === 1) {
      s1 += 1;
      if (typeof row.timestamp_ms === "number") s1Ts.push(row.timestamp_ms);
    }
    if (ch === 2) {
      s2 += 1;
      if (typeof row.timestamp_ms === "number") s2Ts.push(row.timestamp_ms);
    }
  }
  const t1 = temporalFeatures(s1Ts);
  const t2 = temporalFeatures(s2Ts);
  const denom = Math.max(1, n);
  const features = [
    temporal.logMeanGap,
    temporal.burstiness,
    temporal.idleBurstRate,
    temporal.spanNorm,
    temporal.gapP25,
    temporal.gapP75,
    temporal.gapCv,
    temporal.eventRate,
    clip01(s1 / denom),
    clip01(s2 / denom),
    system1Share(rows),
    clip01(n / 50),
    t1.logMeanGap,
    t1.burstiness,
    t1.spanNorm,
    t1.eventRate,
    t2.logMeanGap,
    t2.burstiness,
    t2.spanNorm,
    t2.eventRate,
    // interleave: mean lag between s1 and s2 events
    s1Ts.length && s2Ts.length
      ? clip01(
          Math.abs(
            s1Ts.reduce((a, b) => a + b, 0) / s1Ts.length -
              s2Ts.reduce((a, b) => a + b, 0) / s2Ts.length,
          ) /
            (3600 * 1000),
        )
      : 0,
    clip01(Math.log1p(n) / Math.log1p(200)),
    n > 0 ? 1 : 0,
    clip01(timestamps.length / Math.max(1, n)),
  ];
  while (features.length < KNOWLEDGE_CONFIG_DUAL_D256_TEMPORAL_DIM) features.push(0);
  return features.slice(0, KNOWLEDGE_CONFIG_DUAL_D256_TEMPORAL_DIM).map(clip01);
}

function finishEmbedding(
  modelId: string,
  dim: number,
  vector: number[],
  input: KnowledgeConfigEncodeInput,
): KnowledgeConfigEmbedding {
  const asOfMs = asOfFromInput(input);
  return {
    embedding_model_id: modelId,
    dim,
    vector,
    as_of: new Date(asOfMs).toISOString(),
    as_of_ms: asOfMs,
    pow_event_count: input.powRows.length,
    confidence: confidenceFromInput(input),
  };
}

/** Higher-D hybrid sibling of v1 (√0.85 structure / √0.15 semantic residual). */
export function encodeKnowledgeConfigHybrid192(
  input: KnowledgeConfigEncodeInput,
): KnowledgeConfigEmbedding {
  const zStruct = l2Normalize(buildStruct96(input)).map((x) => x * STRUCT_WEIGHT);
  const bag = bagOfTokens(lwmText(input.worldModel), HYBRID_SEM_BAG);
  const zSem = l2Normalize(projectWithMatrix(bag, HYBRID_SEM_PROJ)).map((x) => x * SEM_WEIGHT);
  const concatenated = [...zStruct, ...zSem];
  while (concatenated.length < KNOWLEDGE_CONFIG_HYBRID_D192_DIM) concatenated.push(0);
  const vector = l2Normalize(concatenated.slice(0, KNOWLEDGE_CONFIG_HYBRID_D192_DIM));
  return finishEmbedding(
    KNOWLEDGE_CONFIG_HYBRID_D192_MODEL_ID,
    KNOWLEDGE_CONFIG_HYBRID_D192_DIM,
    vector,
    input,
  );
}

/** Content-rich residual: thought/transcript text + LWM text (not dual-channel). */
export function encodeKnowledgeConfigContent256(
  input: KnowledgeConfigEncodeInput,
): KnowledgeConfigEmbedding {
  const zStruct = l2Normalize(buildStruct96(input)).map((x) => x * STRUCT_WEIGHT);
  const channel = collectSystemChannelTexts(input.powRows);
  const contentText = [channel.all, lwmText(input.worldModel)].filter(Boolean).join(" ");
  const bag = bagOfTokens(contentText, CONTENT_BAG);
  const zSem = l2Normalize(projectWithMatrix(bag, CONTENT_PROJ)).map((x) => x * SEM_WEIGHT);
  const concatenated = [...zStruct, ...zSem];
  while (concatenated.length < KNOWLEDGE_CONFIG_CONTENT_D256_DIM) concatenated.push(0);
  const vector = l2Normalize(concatenated.slice(0, KNOWLEDGE_CONFIG_CONTENT_D256_DIM));
  return finishEmbedding(
    KNOWLEDGE_CONFIG_CONTENT_D256_MODEL_ID,
    KNOWLEDGE_CONFIG_CONTENT_D256_DIM,
    vector,
    input,
  );
}

/**
 * Dual-stream: structural + System1 text + System2 text + temporal fusion.
 * Channel weights keep process signal balanced with structure.
 */
export function encodeKnowledgeConfigDual256(
  input: KnowledgeConfigEncodeInput,
): KnowledgeConfigEmbedding {
  const wStruct = Math.sqrt(0.5);
  const wS1 = Math.sqrt(0.2);
  const wS2 = Math.sqrt(0.2);
  const wTemp = Math.sqrt(0.1);

  const zStruct = l2Normalize(buildStruct64Dual(input)).map((x) => x * wStruct);
  const channel = collectSystemChannelTexts(input.powRows);
  // Fall back lightly to LWM text when channel text is empty so sparse PoW still moves.
  const s1Text = channel.system1 || (channel.all ? "" : lwmText(input.worldModel));
  const s2Text = channel.system2 || (channel.all ? "" : lwmText(input.worldModel));
  const zS1 = l2Normalize(projectWithMatrix(bagOfTokens(s1Text, DUAL_S1_BAG), DUAL_S1_PROJ)).map(
    (x) => x * wS1,
  );
  const zS2 = l2Normalize(projectWithMatrix(bagOfTokens(s2Text, DUAL_S2_BAG), DUAL_S2_PROJ)).map(
    (x) => x * wS2,
  );
  const zTemp = l2Normalize(buildTemporal32(input)).map((x) => x * wTemp);

  const concatenated = [...zStruct, ...zS1, ...zS2, ...zTemp];
  while (concatenated.length < KNOWLEDGE_CONFIG_DUAL_D256_DIM) concatenated.push(0);
  const vector = l2Normalize(concatenated.slice(0, KNOWLEDGE_CONFIG_DUAL_D256_DIM));
  return finishEmbedding(
    KNOWLEDGE_CONFIG_DUAL_D256_MODEL_ID,
    KNOWLEDGE_CONFIG_DUAL_D256_DIM,
    vector,
    input,
  );
}
