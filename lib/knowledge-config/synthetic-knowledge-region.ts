/**
 * Synthetic knowledge regions in knowledgecfg-v1-d64 space.
 * Profiles are encoded via the real knowledge-config encoder so vectors stay
 * compatible with cohort-created custom verification models / regions.
 */

import { emptyLearningWorldModel, mergeLearningWorldModelDelta } from "@/lib/prompt-kernel/world-model";
import {
  createCustomVerificationModelFromVectors,
  type CustomVerificationModelSpec,
  CustomVerificationModelError,
} from "./custom-verification-model";
import { encodeKnowledgeConfig, projectKnowledgeConfigTo2D } from "./encoder";
import { l2Normalize } from "./math";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  isKnowledgeConfigVector,
} from "./types";

export interface SyntheticRegionProfile {
  /** Short label for the ideal user / competency region. */
  name?: string;
  /** Free-text description of the region. */
  description?: string;
  /** 0–100 verification / exploration strength. */
  verification_score?: number | null;
  augmentation_score?: number | null;
  optimization_score?: number | null;
  ghc_score?: number | null;
  strengths?: string[];
  friction_patterns?: string[];
  preferred_modalities?: string[];
  /** Synthetic proof-of-work type tags used as bag-of-words features. */
  pow_types?: string[];
  tool_names?: string[];
}

export interface KnowledgeRegionOverlay2D {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Radius in the same projected frame units as x/y. */
  radius: number;
  cosine_threshold: number;
  source?: string | null;
}

function clampScore(n: unknown, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.min(100, v));
}

/**
 * Encode a synthetic competency profile into a knowledgecfg-v1-d64 unit vector
 * using the real hybrid encoder (not a parallel embedding space).
 */
export function encodeSyntheticRegionProfile(
  profile: SyntheticRegionProfile,
  workspaceId = "synthetic-region",
): number[] {
  const verification = clampScore(profile.verification_score, 70);
  const augmentation = clampScore(profile.augmentation_score, verification - 5);
  const optimization = clampScore(profile.optimization_score, verification - 10);
  const ghc = clampScore(profile.ghc_score, 55);

  const strengths = (profile.strengths || []).filter(Boolean).slice(0, 12);
  const friction = (profile.friction_patterns || []).filter(Boolean).slice(0, 8);
  const modalities = (profile.preferred_modalities || ["tool", "speech"]).filter(Boolean).slice(0, 6);
  const powTypes = (profile.pow_types || ["tool", "screen", "speech"]).filter(Boolean).slice(0, 8);
  const tools = (
    profile.tool_names?.length
      ? profile.tool_names
      : strengths.length
        ? strengths.map((s) => s.slice(0, 24))
        : ["synthetic"]
  ).filter(Boolean);

  const baseMs = 1_700_000_000_000;
  const powRows = powTypes.flatMap((type, i) => {
    const tool = tools[i % Math.max(1, tools.length)] || "synthetic";
    return [
      {
        proof_of_work_type: type,
        timestamp_ms: baseMs + i * 45_000,
        tool_name: tool,
        tool_action: "practice",
        metadata: {
          selective_thought: type === "speech" || type === "tool",
          system: 2,
          synthetic_region: true,
        },
      },
      {
        proof_of_work_type: type,
        timestamp_ms: baseMs + i * 45_000 + 15_000,
        tool_name: tool,
        metadata: { synthetic_region: true },
      },
    ];
  });

  const worldModel = mergeLearningWorldModelDelta(emptyLearningWorldModel(workspaceId), {
    scores_snapshot: {
      verification_score: verification,
      augmentation_score: augmentation,
      optimization_score: optimization,
      ghc_score: ghc,
    },
    learning_profile: {
      strengths: strengths.length ? strengths : ["synthetic-competency"],
      friction_patterns: friction,
      preferred_modalities: modalities,
      temporal_patterns: { avg_dwell_ms: 4000, idle_bursts: 1 },
    },
    inferred_goal: {
      text: profile.description || profile.name || "synthetic knowledge region",
      confidence: 0.7,
      source: "evolved",
    },
  });

  const embedding = encodeKnowledgeConfig({
    workspaceId,
    powRows: powRows.length
      ? powRows
      : [
          {
            proof_of_work_type: "tool",
            timestamp_ms: baseMs,
            tool_name: "synthetic",
            metadata: { synthetic_region: true, system: 2 },
          },
        ],
    worldModel,
    totalBlocks: Math.max(3, strengths.length + 2),
    asOfMs: baseMs + powRows.length * 45_000,
  });

  if (!isKnowledgeConfigVector(embedding.vector, KNOWLEDGE_CONFIG_DIM)) {
    throw new CustomVerificationModelError("synthetic encoder produced invalid knowledgecfg vector");
  }
  if (embedding.embedding_model_id !== KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID) {
    throw new CustomVerificationModelError("synthetic encoder embedding_model_id mismatch");
  }
  return l2Normalize(embedding.vector);
}

/**
 * Build a custom knowledge region spec from a synthetic profile.
 * Geometry matches cohort-created regions (same centroid/threshold contract).
 */
export function createSyntheticKnowledgeRegionFromProfile(options: {
  name: string;
  profile: SyntheticRegionProfile;
  description?: string | null;
  workspaceId?: string;
}): CustomVerificationModelSpec {
  const name = options.name.trim();
  if (!name) throw new CustomVerificationModelError("name is required");

  const vector = encodeSyntheticRegionProfile(options.profile, options.workspaceId || "synthetic-region");
  const model = createCustomVerificationModelFromVectors({
    name,
    vectors: [vector],
    subjects: [{ label: "synthetic:knowledgecfg-v1-d64" }],
  });

  // Synthetic regions get a slightly softer default radius for overlay readability.
  return {
    ...model,
    mean_radius: Math.max(model.mean_radius, 0.35),
    cosine_threshold: Math.min(model.cosine_threshold, 0.72),
    subjects: [{ label: "synthetic:grok-4.5" }],
  };
}

/**
 * Project a saved region centroid into the fixed knowledgecfg UI 2D frame
 * used by trajectory projections (same projectKnowledgeConfigTo2D matrix).
 */
export function projectKnowledgeRegionToOverlay(input: {
  id: string;
  name: string;
  centroid: number[];
  mean_radius?: number;
  cosine_threshold?: number;
  source?: string | null;
}): KnowledgeRegionOverlay2D {
  if (!isKnowledgeConfigVector(input.centroid, KNOWLEDGE_CONFIG_DIM)) {
    throw new CustomVerificationModelError("region centroid must be knowledgecfg-v1-d64");
  }
  const { x, y } = projectKnowledgeConfigTo2D(input.centroid);
  const meanRadius = typeof input.mean_radius === "number" && Number.isFinite(input.mean_radius)
    ? Math.max(0, input.mean_radius)
    : 0.4;
  const threshold =
    typeof input.cosine_threshold === "number" && Number.isFinite(input.cosine_threshold)
      ? input.cosine_threshold
      : 0.5;
  // Map high-D radius + threshold into a readable 2D disc in projection units.
  const radius = Math.max(0.04, Math.min(0.55, meanRadius * 0.42 + (1 - threshold) * 0.12));
  return {
    id: input.id,
    name: input.name,
    x,
    y,
    radius,
    cosine_threshold: threshold,
    source: input.source ?? null,
  };
}

/** Batch helper for multi-select overlays on the embeddings projection widget. */
export function projectKnowledgeRegionsToOverlays(
  regions: Array<{
    id: string;
    name: string;
    centroid: number[];
    mean_radius?: number;
    cosine_threshold?: number;
    source?: string | null;
  }>,
): KnowledgeRegionOverlay2D[] {
  return regions.map((r) => projectKnowledgeRegionToOverlay(r));
}
