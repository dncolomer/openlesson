/**
 * Learning world model v0 — evolving representation of how a learner
 * explores a workspace. Separate from TIM (interruption world model).
 *
 * Optional dual geometry: knowledge_config points into the fixed knowledgecfg-v1-d64 space
 * (see lib/knowledge-config). Subject scoping enables multi-learner workspaces.
 */

import type { KnowledgeConfigPointer, KnowledgeConfigSubject } from "@/lib/knowledge-config/types";

export type BlockCoverageDepth = "none" | "shallow" | "solid";

export interface LearningWorldModelV0 {
  version: 1;
  workspace_id: string;
  /** Learner subject within the workspace. Omitted = workspace-level aggregate. */
  subject?: KnowledgeConfigSubject;
  updated_at: string;
  inferred_goal: {
    text: string;
    confidence: number;
    source: "workspace" | "inferred" | "evolved";
  };
  exploration: {
    block_coverage: Array<{
      block_id: string;
      depth: BlockCoverageDepth;
      evidence_refs: string[];
    }>;
    pathways_touched: string[];
    blind_spots: string[];
  };
  learning_profile: {
    strengths: string[];
    friction_patterns: string[];
    preferred_modalities: string[];
    temporal_patterns: {
      avg_dwell_ms: number | null;
      idle_bursts: number | null;
    };
  };
  evidence_appetite: {
    want_more: string[];
    saturated: string[];
  };
  scores_snapshot: {
    /** Primary LWM Snapshot score (history wire key — not a product score type name). */
    verification_score: number | null;
    /** Legacy fields — not written by the single snapshot strategy. */
    augmentation_score: number | null;
    optimization_score: number | null;
    ghc_score: number | null;
  };
  /** Latest knowledge config pointer (vector lives in snapshots table / Snapshot API). */
  knowledge_config?: KnowledgeConfigPointer | null;
}

export type LearningWorldModelDelta = Partial<
  Pick<
    LearningWorldModelV0,
    | "inferred_goal"
    | "exploration"
    | "learning_profile"
    | "evidence_appetite"
    | "scores_snapshot"
    | "subject"
    | "knowledge_config"
  >
>;

export function emptyLearningWorldModel(
  workspaceId: string,
  subject?: KnowledgeConfigSubject | null,
): LearningWorldModelV0 {
  return {
    version: 1,
    workspace_id: workspaceId,
    ...(subject ? { subject: { ...subject } } : {}),
    updated_at: new Date().toISOString(),
    inferred_goal: {
      text: "",
      confidence: 0,
      source: "inferred",
    },
    exploration: {
      block_coverage: [],
      pathways_touched: [],
      blind_spots: [],
    },
    learning_profile: {
      strengths: [],
      friction_patterns: [],
      preferred_modalities: [],
      temporal_patterns: {
        avg_dwell_ms: null,
        idle_bursts: null,
      },
    },
    evidence_appetite: {
      want_more: [],
      saturated: [],
    },
    scores_snapshot: {
      verification_score: null,
      augmentation_score: null,
      optimization_score: null,
      ghc_score: null,
    },
    knowledge_config: null,
  };
}

/** Merge a partial delta into a base model; returns a new object. */
export function mergeLearningWorldModelDelta(
  base: LearningWorldModelV0,
  delta: LearningWorldModelDelta | null | undefined,
): LearningWorldModelV0 {
  if (!delta) return { ...base, updated_at: new Date().toISOString() };

  return {
    ...base,
    updated_at: new Date().toISOString(),
    subject: delta.subject ? { ...base.subject, ...delta.subject } : base.subject,
    inferred_goal: delta.inferred_goal
      ? { ...base.inferred_goal, ...delta.inferred_goal }
      : base.inferred_goal,
    exploration: delta.exploration
      ? {
          block_coverage: delta.exploration.block_coverage ?? base.exploration.block_coverage,
          pathways_touched: delta.exploration.pathways_touched ?? base.exploration.pathways_touched,
          blind_spots: delta.exploration.blind_spots ?? base.exploration.blind_spots,
        }
      : base.exploration,
    learning_profile: delta.learning_profile
      ? {
          strengths: delta.learning_profile.strengths ?? base.learning_profile.strengths,
          friction_patterns:
            delta.learning_profile.friction_patterns ?? base.learning_profile.friction_patterns,
          preferred_modalities:
            delta.learning_profile.preferred_modalities ?? base.learning_profile.preferred_modalities,
          temporal_patterns: {
            ...base.learning_profile.temporal_patterns,
            ...(delta.learning_profile.temporal_patterns ?? {}),
          },
        }
      : base.learning_profile,
    evidence_appetite: delta.evidence_appetite
      ? {
          want_more: delta.evidence_appetite.want_more ?? base.evidence_appetite.want_more,
          saturated: delta.evidence_appetite.saturated ?? base.evidence_appetite.saturated,
        }
      : base.evidence_appetite,
    scores_snapshot: delta.scores_snapshot
      ? {
          ...base.scores_snapshot,
          // Ignore explicit nulls so a partial scores_snapshot cannot wipe other verticals.
          ...Object.fromEntries(
            Object.entries(delta.scores_snapshot).filter(([, v]) => v !== null && v !== undefined),
          ),
        }
      : base.scores_snapshot,
    knowledge_config:
      delta.knowledge_config !== undefined ? delta.knowledge_config : base.knowledge_config ?? null,
  };
}

/** Serialize for export/transfer across workspaces or apps. */
export function serializeLearningWorldModel(model: LearningWorldModelV0): string {
  return JSON.stringify(model);
}

export function parseLearningWorldModel(raw: unknown): LearningWorldModelV0 | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1 || typeof obj.workspace_id !== "string") return null;
  const subject =
    obj.subject && typeof obj.subject === "object"
      ? (obj.subject as KnowledgeConfigSubject)
      : undefined;
  const base = emptyLearningWorldModel(obj.workspace_id, subject);
  return mergeLearningWorldModelDelta(base, obj as LearningWorldModelDelta);
}

/** Subset safe to pass into TIM feature envelopes. */
export function learningWorldModelForTim(
  model: LearningWorldModelV0 | null | undefined,
): {
  inferred_goal?: string | null;
  evidence_appetite?: { want_more: string[]; saturated: string[] };
  scores_snapshot?: {
    verification_score?: number | null;
    augmentation_score?: number | null;
    optimization_score?: number | null;
    ghc_score?: number | null;
  };
  temporal_patterns?: Record<string, unknown> | null;
  knowledge_config_confidence?: number | null;
} | undefined {
  if (!model) return undefined;
  return {
    inferred_goal: model.inferred_goal?.text || null,
    evidence_appetite: model.evidence_appetite,
    scores_snapshot: model.scores_snapshot,
    temporal_patterns: model.learning_profile?.temporal_patterns ?? null,
    knowledge_config_confidence: model.knowledge_config?.confidence ?? null,
  };
}

/** Format evidence appetite into PoW schema collection_guidance bias text. */
export function formatEvidenceAppetiteGuidance(
  model: LearningWorldModelV0 | null | undefined,
): string {
  if (!model?.evidence_appetite) return "";
  const { want_more, saturated } = model.evidence_appetite;
  if (!want_more.length && !saturated.length) return "";
  const lines: string[] = ["Learning world model evidence appetite (bias collection toward gaps):"];
  if (want_more.length) {
    lines.push(`- Prefer more of: ${want_more.join(", ")}`);
  }
  if (saturated.length) {
    lines.push(`- Already saturated (de-emphasize): ${saturated.join(", ")}`);
  }
  return lines.join("\n");
}

export const WORLD_MODEL_DELTA_INSTRUCTIONS = `
Optional world_model_delta: when enough proof of work exists, return a partial learning world model update (not the full history):
- inferred_goal evolution if evidence shifts what success means
- exploration.block_coverage / blind_spots
- learning_profile strengths, friction_patterns, preferred_modalities, temporal_patterns
- evidence_appetite.want_more vs saturated (what PoW types TIM and schema generation should bias toward next)
- scores_snapshot mirroring the LWM Snapshot primary score and ghc_score and ghc_score from this evaluation — do not invent separate augmentation/optimization primaries
`.trim();
