/**
 * Shared score vocabulary for vertical score reports, PoW schema contracts, and TIM features.
 */

export type GhcConfidence = "none" | "low" | "medium" | "high";

/** Product verticals that each have a dedicated score endpoint. */
export type ScoreVertical = "verification" | "augmentation" | "optimization";

export const SCORE_VERTICALS = ["verification", "augmentation", "optimization"] as const;

export const VERTICAL_SCORE_FIELD = {
  verification: "verification_score",
  augmentation: "augmentation_score",
  optimization: "optimization_score",
} as const satisfies Record<ScoreVertical, string>;

/** REST path segment under workspaces/{id}/ */
export const VERTICAL_REST_PATH = {
  verification: "verification-score",
  augmentation: "augmentation-score",
  optimization: "optimization-score",
} as const satisfies Record<ScoreVertical, string>;

/** MCP tool names (underscore form of path segments). */
export const VERTICAL_MCP_TOOL = {
  verification: "verification_score",
  augmentation: "augmentation_score",
  optimization: "optimization_score",
} as const satisfies Record<ScoreVertical, string>;

export const SCORE_FIELD_DESCRIPTIONS = {
  verification_score:
    "0–100 learning verification score: how well the learner has demonstrated knowledge and explored the workspace (coverage + depth of pathways touched).",
  augmentation_score:
    "0–100 learning augmentation score: practice / improvement readiness — how prepared the learner is to close gaps and improve via targeted practice from proof of work.",
  optimization_score:
    "0–100 learning optimization score: progress toward the inferred workspace goal (milestones, activation steps, outcome readiness). Units are score points 0–100, not conversion %.",
  workspace_goal:
    "Plain-language inferred (or owner-set) workspace goal defining success for this workspace.",
  ghc_score:
    "0–100 Genuine Human Cognition score: how genuine/human the PoW source appears. Strongest with TAP/ILE selective thought (System 1 vs System 2) and natural temporal patterns; tool-only dumps yield low ghc_confidence. Secondary signal — not a fourth primary vertical score.",
  ghc_confidence:
    "none | low | medium | high — confidence in ghc_score given available signal quality.",
  temporal_summary:
    "Optional short note on inter-event timing, idle, dwell, or burst patterns that informed scores.",
} as const;

export const VERTICAL_SCORE_INSTRUCTIONS: Record<ScoreVertical, string> = {
  verification: `
Required scoring outputs for **verification** only:
1. score — integer 0–100 **verification_score**: how well the learner has explored the workspace and demonstrated knowledge (block/pathway coverage + depth). Synthesize from all proof of work (not a naive average of markers).
2. workspace_goal — concise phrase. When an authoritative workspace goal is provided, echo it exactly; otherwise infer and allow evolution as PoW grows.
3. ghc_score — integer 0–100 **Genuine Human Cognition** (secondary). Weight selective thought System 1 vs System 2, natural temporal pacing. Tool-only dumps → low ghc_score and ghc_confidence "none" or "low".
4. ghc_confidence — none | low | medium | high.
5. temporal_summary — optional one sentence when timestamps inform the scores.
Do NOT output augmentation_score or optimization_score.
`.trim(),
  augmentation: `
Required scoring outputs for **augmentation** only:
1. score — integer 0–100 **augmentation_score**: practice / improvement readiness from proof of work — how prepared the learner is to close gaps via targeted practice and skill growth (not goal conversion, not pure verification coverage).
2. workspace_goal — concise phrase. When an authoritative workspace goal is provided, echo it exactly; otherwise infer.
3. ghc_score — integer 0–100 secondary GHC when thought traces exist; else 0 with ghc_confidence "none".
4. ghc_confidence — none | low | medium | high.
5. temporal_summary — optional when timing informs readiness to practice.
Do NOT output verification_score or optimization_score.
`.trim(),
  optimization: `
Required scoring outputs for **optimization** only:
1. score — integer 0–100 **optimization_score**: progress toward the workspace goal (milestones, missing activation steps, outcome readiness). This replaces the former conversion likelihood — use score units 0–100, not a percentage label.
2. workspace_goal — concise phrase. When an authoritative workspace goal is provided, echo it exactly; otherwise infer and allow evolution as PoW grows.
3. ghc_score — integer 0–100 secondary GHC when thought traces exist; else 0 with ghc_confidence "none".
4. ghc_confidence — none | low | medium | high.
5. temporal_summary — optional when timing informs goal progress.
Do NOT output verification_score or augmentation_score.
`.trim(),
};

/** @deprecated Use VERTICAL_SCORE_INSTRUCTIONS per vertical */
export const TRIPLE_SCORE_INSTRUCTIONS = VERTICAL_SCORE_INSTRUCTIONS.verification;
