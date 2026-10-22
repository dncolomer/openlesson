/**
 * Synthetic knowledge regions in flowcfg-v1-d96 space.
 */

import {
  embedTextsToFlowVector,
  FLOW_EMBEDDING_MODEL_ID,
  isFlowEmbeddingVector,
} from "@/lib/flow-embedding";
import {
  createCustomVerificationModelFromVectors,
  type CustomVerificationModelSpec,
  CustomVerificationModelError,
} from "./custom-verification-model";
import { l2Normalize } from "./math";
import { projectVectors2D } from "./project-2d";

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
 * Encode a synthetic competency profile into a flowcfg-v1-d96 unit vector.
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

  const texts = [
    workspaceId,
    profile.name || "",
    profile.description || "",
    `verification ${verification}`,
    `augmentation ${augmentation}`,
    `optimization ${optimization}`,
    `ghc ${ghc}`,
    ...strengths,
    ...friction,
    ...modalities,
    ...powTypes,
    ...tools,
  ];

  const vector = embedTextsToFlowVector(texts);
  if (!isFlowEmbeddingVector(vector)) {
    throw new CustomVerificationModelError("synthetic encoder produced invalid flowcfg vector");
  }
  return l2Normalize(vector);
}

/**
 * Build a custom knowledge region spec from a synthetic profile.
 */
export function createSyntheticKnowledgeRegionFromProfile(options: {
  name: string;
  profile: SyntheticRegionProfile;
  description?: string | null;
  workspaceId?: string;
}): CustomVerificationModelSpec {
  const name = options.name.trim();
  if (!name) throw new CustomVerificationModelError("name is required");

  const vector = encodeSyntheticRegionProfile(
    options.profile,
    options.workspaceId || "synthetic-region",
  );
  const model = createCustomVerificationModelFromVectors({
    name,
    vectors: [vector],
    subjects: [{ label: `synthetic:${FLOW_EMBEDDING_MODEL_ID}` }],
    embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
  });

  return {
    ...model,
    mean_radius: Math.max(model.mean_radius, 0.35),
    cosine_threshold: Math.min(model.cosine_threshold, 0.72),
    subjects: [{ label: "synthetic:grok-4.5" }],
  };
}

/**
 * Project a saved region centroid into the flowcfg UI 2D frame.
 */
export function projectKnowledgeRegionToOverlay(input: {
  id: string;
  name: string;
  centroid: number[];
  mean_radius?: number;
  cosine_threshold?: number;
  source?: string | null;
}): KnowledgeRegionOverlay2D {
  if (!isFlowEmbeddingVector(input.centroid)) {
    throw new CustomVerificationModelError("region centroid must be flowcfg-v1-d96");
  }
  const [xy] = projectVectors2D([input.centroid], "random");
  const meanRadius =
    typeof input.mean_radius === "number" && Number.isFinite(input.mean_radius)
      ? Math.max(0, input.mean_radius)
      : 0.4;
  const threshold =
    typeof input.cosine_threshold === "number" && Number.isFinite(input.cosine_threshold)
      ? input.cosine_threshold
      : 0.5;
  const radius = Math.max(0.04, Math.min(0.55, meanRadius * 0.42 + (1 - threshold) * 0.12));
  return {
    id: input.id,
    name: input.name,
    x: xy?.x ?? 0,
    y: xy?.y ?? 0,
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
