/**
 * L1 score-generation surface — context setup specialized for vertical scores.
 * Composed via composePrompt as ontology → score-context surface → task.
 */
import type { ScoreVertical } from "../scores";

/**
 * Shared LWM Snapshot score context:
 * score exclusively from proof-of-work evidence attached to the evaluation.
 */
export const SCORE_POW_CONTEXT_LAYER = `
SCORE GENERATION CONTEXT — PROOF-OF-WORK ONLY:
You are scoring an LWM Snapshot from **proof-of-work (PoW) data only**.

Allowed evidence (INPUT):
- Attached PoW artifacts: tool traces, screen/screenshots, video, EEG, and any other uploaded proof-of-work files
- TAP / ILE selective thought traces and transcripts when present as PoW
- Temporally stamped events (timestamps, inter-event gaps, idle, dwell, bursts)
- The workspace performance context JSON that catalogs those PoW refs, block scopes, and counts

Forbidden evidence (do NOT use to invent scores):
- Product marketing, brand claims, or sales copy about Uncertain Systems or partner products
- Unattached world knowledge, resumes, or speculation not grounded in the attached PoW corpus
- Imagined learner history, hypothetical tool runs, or narrative filler when PoW is silent

Rules:
1. Every primary score, marker score, strength, growth area, and gap must be grounded in concrete PoW you can point to (artifact type, tool event, trace fragment, timestamp pattern, or explicit absence of PoW).
2. When PoW is sparse or missing for a claim, lower scores and state the thin-signal honestly — never fabricate competency, readiness, or goal progress.
3. Timestamps and event ordering are first-class: use them for temporal_summary and authenticity (GHC) when present.
4. Remediation outputs (gap repairs, next_steps, suggestions) stay in domain/product/workflow language — never recommend TAP, ILE, block completion, or other Uncertain Systems platform mechanics as outputs. Those products may supply scoring INPUT only.
5. Do not score "potential" or "intent" detached from observed PoW.
`.trim();

/**
 * Verification-only overlay: mandatory submit vs stash (System 1 vs System 2) analysis
 * when TAP/ILE selective-thought PoW is present.
 */
export const SCORE_VERIFICATION_SUBMIT_STASH_OVERLAY = `
VERIFICATION — SUBMIT / STASH ANALYSIS (System 1 vs System 2):
LWM Snapshot (verification) scoring MUST perform an explicit submit/stash analysis when TAP or ILE selective-thought proof of work is present.

Definitions (aligned with TAP/ILE selective thought):
- **System 1**: spontaneous crystallized speech, including **stashed / unsent** thoughts — raw cognition before polish
- **System 2**: deliberate **send**, edit, skip, select/deselect, or **resend** into the dialogue — intentional selection and repair

Required analysis when selective-thought PoW exists:
1. Contrast what was **stashed/unsent (System 1)** vs what was **submitted (System 2)** — knowledge articulated but not sent may show hesitation, incomplete understanding, or metacognitive filtering.
2. Cite **both** sent and unsent/stashed traces in marker rationales, gap_analysis.proof_of_work, temporal_summary, and ghc_score / ghc_confidence notes where relevant.
3. Weight natural temporal pacing, hesitation/repair patterns, and non-templated language for GHC authenticity.
4. Prefer verification markers that reflect demonstrated knowledge coverage from these traces plus other PoW — not polish alone.

When **no** TAP/ILE selective-thought PoW is present:
- Do **not** invent System 1 / System 2 dynamics or fake submit/stash pairs.
- Set ghc_confidence to "none" or "low" and score verification from remaining tool/artifact PoW only, noting the missing selective-thought signal.
`.trim();

/** Shared PoW-only rules for opaque/structural scoring (no semantic stash narrative). */
export const SCORE_POW_CONTEXT_LAYER_OPAQUE = `
SCORE GENERATION CONTEXT — STRUCTURAL PROOF-OF-WORK ONLY (opaque mode):
Score exclusively from structural proof-of-work fields in attached artifacts (verbs, timestamps, phase coverage, goals_achieved presence, tokenized fields, event counts).
Do not invent domain semantics from goal_ref, hashes, or tokens.
When PoW is thin, lower scores honestly. Remediation stays structural (phase/protocol codes), not domain storytelling.
`.trim();

/**
 * Build the L1 surface string for a vertical score call.
 * Verification includes submit/stash System 1–2 overlay; other verticals get PoW-only only.
 */
export function buildScoreContextSurface(vertical: ScoreVertical): string {
  if (vertical === "verification") {
    return `${SCORE_POW_CONTEXT_LAYER}\n\n${SCORE_VERIFICATION_SUBMIT_STASH_OVERLAY}`;
  }
  return SCORE_POW_CONTEXT_LAYER;
}

/**
 * Opaque score surface: PoW/structure only; verification does not force semantic submit/stash.
 */
export function buildOpaqueScoreContextSurface(_vertical: ScoreVertical): string {
  return SCORE_POW_CONTEXT_LAYER_OPAQUE;
}

/** True if text embeds the shared PoW-only score context layer. */
export function scoreInstructionsRequirePowOnly(text: string): boolean {
  return (
    text.includes("PROOF-OF-WORK ONLY") ||
    text.includes("proof-of-work (PoW) data only") ||
    text.includes("Score exclusively from structural proof-of-work")
  );
}

/**
 * True if text requires the verification-only submit/stash overlay
 * (not merely ontology mentions of System 1/2 elsewhere).
 */
export function scoreInstructionsRequireSubmitStashAnalysis(text: string): boolean {
  // Anchor only on the dedicated LWM Snapshot overlay — ontology also mentions System 1/2.
  return (
    /VERIFICATION\s*[—\-]\s*SUBMIT\s*\/\s*STASH\s*ANALYSIS/i.test(text) ||
    text.includes("VERIFICATION — SUBMIT / STASH ANALYSIS")
  );
}
