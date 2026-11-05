/**
 * L0 — Canonical Uncertain Systems philosophy for xAI system preambles.
 * Keep short enough to prepend; do not product-sell inside remediation outputs.
 */
export const WORKSPACE_ONTOLOGY = `
WORKSPACE ONTOLOGY (Uncertain Systems):
- Learning Maps (stored as workspaces) are the encapsulating unit across Calibrate, Learn, and Verify. They never end and never close; they grow with the learner as proof of work accumulates.
- Blocks are assessable units inside a Learning Map. Completing a block or session does not close the map.
- Proof of work is recorded in the product UI (Calibrate, Learn, and Verify). Public agent APIs create and edit Learning Maps and independent Solve, Calibration, and Verification flows.
- All PoW is stored with xAI file references plus workspace / block / session scope refs so evaluation can be full-workspace or scoped.
- Product pillars (Calibrate, Learn, and Verify) walk a hidden-state tree. Distance is how far that walk is from the prepared tree.
- Public agent APIs are Learning Map and flow CRUD only. Headless start_session / upload_proof_of_work / end_session are not public.

SCORES (one primary score per call):
1. Primary score — 0–100 (JSON field score): demonstrated knowledge and workspace exploration coverage/depth. Scores come from proof of work and are never auto-run when a session ends. Sessions produce proof of work; scores are separate and explicit.
- GHC (ghc_score) is a secondary cognition authenticity signal on the same report — not a second primary strategy.
- There are no peer runnable augmentation or optimization score types in the product path.

GOALS:
- Map intent lives in title, description, notes, and blocks. Calibration flow goal is a flow brief, not a workspace-level goal field.

HIDDEN-STATE TREE vs FLOW EMBEDDINGS:
- The learner walks a hidden-state tree. Distance scores that walk against the prepared tree.
- Flow embeddings (flowcfg-v1-d96) live on session_embeddings. Overlay regions are centroids in the same space.
- Proof-of-work responses do not include an interruption.

TEMPORAL PROOF OF WORK:
- Every PoW event has timestamps. Inter-event gaps, idle bursts, dwell, and speech/tool timing stay on the press they belong to.

SELECTIVE THOUGHT (Free Energy Principle):
- Observations: crystallized spontaneous speech including stashed/unsent thoughts — forage before a policy is chosen.
- Actions: deliberate send, edit, skip, select, resend into chat — the policy the learner commits.
- Insights form when Infer crafts a hidden state from stashed and sent thoughts. These traces are first-class PoW for GHC and the primary score.

REMEDIATION RULE:
- Performance gaps and next steps use domain/product/workflow language. Never recommend Uncertain Systems platform mechanics (running a session, returning to a session, block completion) as remediation outputs — scoring may read those traces as INPUT only.
`.trim();

/** Shorter preamble when token budget is tight (heartbeats). */
export const WORKSPACE_ONTOLOGY_COMPACT = `
Uncertain Systems: Learning Maps never end; public agent APIs CRUD Learning Maps and independent Solve, Calibration, and Verification flows. Proof of work is recorded in the product UI. One primary score plus GHC secondary. Scores are never auto-run when a session ends. Distance is the walk vs the prepared hidden-state tree; flow embeddings are fixed-D geometry for proximity and overlay regions.
`.trim();
