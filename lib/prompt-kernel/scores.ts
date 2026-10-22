/**
 * Shared score vocabulary for TAP scorecard JSON, PoW schema contracts, and interruption features.
 *
 * Product: one primary score plus GHC as a secondary signal.
 * Primary JSON field is `score`. Vertical wire key remains `verification`.
 * Marketing pillars (learning verification / optimization / augmentation) remain
 * separate value language — they are not peer score product types.
 */

export type GhcConfidence = "none" | "low" | "medium" | "high";

/**
 * Stored vertical keys. Only {@link SNAPSHOT_VERTICAL} is product-runnable.
 * augmentation / optimization exist for reading historical archives.
 */
export type ScoreVertical = "verification" | "augmentation" | "optimization";

/**
 * Sole product score strategy wire key (stable TAP JSON vertical).
 * Do not surface this wire key as the product name “verification score”.
 */
export const SNAPSHOT_VERTICAL: ScoreVertical = "verification";

/** Runnable verticals only (single primary-score strategy). */
export const SCORE_VERTICALS = [SNAPSHOT_VERTICAL] as const;

/** Historical TAP scorecard labels. */
export const LWM_SNAPSHOT_LABEL = "LWM Snapshot";
export const LWM_SNAPSHOT_FULL_LABEL = "Learning World Model Snapshot";

/** Named score fields on report objects (history-compatible keys). */
export const VERTICAL_SCORE_FIELD = {
  verification: "verification_score",
  augmentation: "augmentation_score",
  optimization: "optimization_score",
} as const satisfies Record<ScoreVertical, string>;

/**
 * TAP scorecard primary named field.
 */
export const SNAPSHOT_SCORE_FIELD = "score" as const;

/** History-compatible mirror of the primary score (not a product name). */
export const SNAPSHOT_HISTORY_SCORE_FIELD = VERTICAL_SCORE_FIELD[SNAPSHOT_VERTICAL];

/** Historical TAP scorecard REST path segment. The Snapshot API family is retired. */
export const SNAPSHOT_REST_PATH = "lwm-snapshot" as const;

/**
 * REST path for TAP scorecard contracts. All historical vertical keys resolve to
 * the same retired Snapshot path — no separate *-score routes ship.
 */
export const VERTICAL_REST_PATH = {
  verification: SNAPSHOT_REST_PATH,
  augmentation: SNAPSHOT_REST_PATH,
  optimization: SNAPSHOT_REST_PATH,
} as const satisfies Record<ScoreVertical, string>;

/** Historical TAP scorecard MCP tool name. Not a public agent MCP tool. */
export const SNAPSHOT_MCP_TOOL = "lwm_snapshot" as const;

/** MCP tool for TAP scorecard contracts — sole product tool name on those contracts. */
export const VERTICAL_MCP_TOOL = {
  verification: SNAPSHOT_MCP_TOOL,
  augmentation: SNAPSHOT_MCP_TOOL,
  optimization: SNAPSHOT_MCP_TOOL,
} as const satisfies Record<ScoreVertical, string>;

export const SCORE_FIELD_DESCRIPTIONS = {
  score:
    "0–100 primary score: how well the learner has demonstrated knowledge and explored the workspace (coverage + depth of pathways touched). Sole primary score strategy product-wide.",
  verification_score:
    "History-compatible mirror of score. Not a product-facing score type name — prefer score in TAP JSON.",
  augmentation_score:
    "Legacy field only — not a peer runnable strategy. Prefer score.",
  optimization_score:
    "Legacy field only — not a peer runnable strategy. Prefer score.",
  workspace_goal:
    "Plain-language inferred (or owner-set) workspace goal defining success for this workspace.",
  ghc_score:
    "0–100 Genuine Human Cognition score: how genuine/human the PoW source appears. Strongest with Calibrate, Learn, and Verify selective thought (observations vs actions) and natural temporal patterns; tool-only dumps yield low ghc_confidence. Secondary signal — not a second primary snapshot strategy.",
  ghc_confidence:
    "none | low | medium | high — confidence in ghc_score given available signal quality.",
  temporal_summary:
    "Optional short note on inter-event timing, idle, dwell, or burst patterns that informed scores.",
} as const;

/** Instructions for the single primary-score strategy. */
export const LWM_SNAPSHOT_INSTRUCTIONS = `
Required scoring outputs for the primary score only:
1. score — integer 0–100 primary score: how well the learner has explored the workspace and demonstrated knowledge (block/pathway coverage + depth). Synthesize from all proof of work (not a naive average of markers). This is the sole primary score strategy product-wide.
2. workspace_goal — concise phrase. When an authoritative workspace goal is provided, echo it exactly; otherwise infer and allow evolution as PoW grows.
3. ghc_score — integer 0–100 **Genuine Human Cognition** (secondary). Weight selective thought observations vs actions, natural temporal pacing. Tool-only dumps → low ghc_score and ghc_confidence "none" or "low".
4. ghc_confidence — none | low | medium | high.
5. temporal_summary — optional one sentence when timestamps inform the scores.
Do NOT invent separate augmentation or optimization primary scores — there is only one primary score strategy.
Do NOT call the primary score a "verification score" (or verification_score as a product type name) — use score.
`.trim();

export const VERTICAL_SCORE_INSTRUCTIONS: Record<ScoreVertical, string> = {
  verification: LWM_SNAPSHOT_INSTRUCTIONS,
  // Legacy strings kept so historical report recovery never hits undefined.
  augmentation: LWM_SNAPSHOT_INSTRUCTIONS,
  optimization: LWM_SNAPSHOT_INSTRUCTIONS,
};

/** @deprecated Use LWM_SNAPSHOT_INSTRUCTIONS */
export const TRIPLE_SCORE_INSTRUCTIONS = LWM_SNAPSHOT_INSTRUCTIONS;

export function isRunnableScoreVertical(value: unknown): value is typeof SNAPSHOT_VERTICAL {
  return value === SNAPSHOT_VERTICAL;
}

export function parseScoreVertical(value: unknown): ScoreVertical | null {
  if (value === "verification" || value === "augmentation" || value === "optimization") {
    return value;
  }
  return null;
}

/** Normalize any historical vertical to the single product strategy. */
export function toSnapshotVertical(_vertical?: ScoreVertical | null): typeof SNAPSHOT_VERTICAL {
  return SNAPSHOT_VERTICAL;
}
