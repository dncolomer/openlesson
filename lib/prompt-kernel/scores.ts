/**
 * Shared score vocabulary for performance reports, PoW schema contracts, and TIM features.
 */

export type GhcConfidence = "none" | "low" | "medium" | "high";

export const SCORE_FIELD_DESCRIPTIONS = {
  overall_score:
    "0–100 learning / exploration score: how well the learner has explored the workspace and demonstrated knowledge coverage and depth.",
  conversion_score:
    "0–100 estimated likelihood of achieving the workspace conversion_goal from all proof of work — distinct from exploration.",
  conversion_goal:
    "Plain-language definition of what conversion/success means for this workspace (authoritative stored goal, else inferred).",
  ghc_score:
    "0–100 Genuine Human Cognition score: how genuine/human the PoW source appears. Strongest with TAP/ILE selective thought (System 1 vs System 2) and natural temporal patterns; tool-only dumps yield low ghc_confidence.",
  ghc_confidence:
    "none | low | medium | high — confidence in ghc_score given available signal quality.",
  temporal_summary:
    "Optional short note on inter-event timing, idle, dwell, or burst patterns that informed scores.",
} as const;

export const TRIPLE_SCORE_INSTRUCTIONS = `
Required scoring outputs:
1. overall_score — integer 0–100 **learning / exploration** score: how well the learner has explored the workspace and demonstrated knowledge (block/pathway coverage + depth). Synthesize from all proof of work (not a naive average of markers).
2. conversion_score — integer 0–100 **conversion likelihood** of achieving conversion_goal from proof of work (abandonment, missing activation steps, milestones). Separate from overall_score.
3. conversion_goal — concise phrase. When an authoritative workspace conversion goal is provided, echo it exactly; otherwise infer and allow evolution as PoW grows.
4. ghc_score — integer 0–100 **Genuine Human Cognition**. Weight: selective thought System 1 (including stashed/unsent) vs System 2 (send/edit/skip), natural temporal pacing, hesitation/repair patterns, and non-templated language. Tool-only or agent-trace dumps without human thought → low ghc_score and ghc_confidence "none" or "low". TAP/ILE scoped PoW → can support medium/high ghc_confidence.
5. ghc_confidence — none | low | medium | high.
6. temporal_summary — optional one sentence when timestamps/inter-event gaps inform the scores.
`.trim();
