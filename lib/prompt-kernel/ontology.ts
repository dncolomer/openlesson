/**
 * L0 — Canonical Uncertain Systems philosophy for xAI system preambles.
 * Keep short enough to prepend; do not product-sell inside remediation outputs.
 */
export const WORKSPACE_ONTOLOGY = `
WORKSPACE ONTOLOGY (Uncertain Systems):
- Workspaces are the encapsulating unit across all products (Calibrate, Learn, and Verify, PoW API, All-You-Can-Learn). They never end and never close; they grow infinitely with the learner as proof of work accumulates.
- Blocks are assessable units inside a workspace. Completing a block or session does not close the workspace.
- The primary interface to a workspace is the Proof-of-Work (PoW) API. Integrators and products submit temporally stamped proof of work (tool traces, screen, video, EEG, selective thought traces). As more data arrives, the interface evolves: schemas, skills, scores, and interruption bias update.
- All PoW is stored with xAI file references plus workspace / block / session scope refs so evaluation can be full-workspace or scoped.
- Product pillars (Calibrate, Learn, and Verify, plus PoW capture) walk a hidden-state tree. Distance is how far that walk is from the prepared tree. Learn is a hosted flow, not a separate tool.
- Public agent APIs are only workspace management and headless proof-of-work: start_session, upload_proof_of_work, end_session.

SCORES (one primary score per call):
1. Primary score — 0–100 (JSON field score): demonstrated knowledge and workspace exploration coverage/depth. Scores come from proof of work and are never auto-run when a session ends. Public agent outcomes use end_session (answers-model, inferred path, flow embedding). Sessions produce proof of work; scores are separate and explicit.
- GHC (ghc_score) is a secondary cognition authenticity signal on the same report — not a second primary strategy.
- There are no peer runnable augmentation or optimization score types in the product path.

GOALS:
- workspace_goal is stored on the workspace when known, otherwise inferred from title, notes, blocks, and accumulating PoW; inference may evolve as evidence grows.

HIDDEN-STATE TREE vs FLOW EMBEDDINGS:
- The learner walks a hidden-state tree. Distance scores that walk against the prepared tree.
- Flow embeddings (flowcfg-v1-d96) live on workspace_flow_embeddings. Overlay regions are centroids in the same space.
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
Uncertain Systems: workspaces never end; public agent APIs are workspace management and headless PoW (start_session → upload_proof_of_work → end_session). One primary score plus GHC secondary. Scores are never auto-run when a session ends. Proof-of-work responses do not include an interruption. Distance is the walk vs the prepared hidden-state tree; flow embeddings are fixed-D geometry for proximity and overlay regions.
`.trim();
