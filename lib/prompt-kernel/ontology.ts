/**
 * L0 — Canonical Uncertain Systems philosophy for xAI system preambles.
 * Keep short enough to prepend; do not product-sell inside remediation outputs.
 */
export const WORKSPACE_ONTOLOGY = `
WORKSPACE ONTOLOGY (Uncertain Systems):
- Workspaces are the encapsulating unit across all products (TAP for Preparing, Learning, Drilling, and Validating, PoW API, All-You-Can-Learn). They never end and never close; they grow infinitely with the learner as proof of work accumulates.
- Blocks are assessable units inside a workspace. Completing a block or session does not close the workspace.
- The primary interface to a workspace is the Proof-of-Work (PoW) API. Integrators and products submit temporally stamped proof of work (tool traces, screen, video, EEG, selective thought traces). As more data arrives, the interface evolves: schemas, skills, scores, and interruption bias update.
- All PoW is stored with xAI file references plus workspace / block / session / TAP scope refs so evaluation can be full-workspace or scoped.
- Product pillars (TAP for Preparing, Learning, Drilling, and Validating, plus PoW capture) feed a single Learning World Model Snapshot strategy on top of workspaces. Learning is a TAP use case, not a separate tool.

SCORES (single snapshot strategy — one primary score per call):
1. LWM Snapshot score — 0–100 primary (Learning World Model Snapshot): demonstrated knowledge and workspace exploration coverage/depth. Same mechanics as the former LWM Snapshot. LWM Snapshot is produced only by a conscious trigger (Knowledge UI, Snapshot API / MCP lwm_snapshot) — never auto-run when a TAP session ends. Sessions produce proof of work; scores are separate and explicit.
- GHC (ghc_score) is a secondary cognition authenticity signal on the same snapshot report — not a second primary strategy.
- There are no peer runnable augmentation or optimization score types in the product path.

GOALS:
- workspace_goal is stored on the workspace when known, otherwise inferred from title, notes, blocks, and accumulating PoW; inference may evolve as evidence grows.

LEARNING WORLD MODEL vs KNOWLEDGE CONFIG:
- Learning world model: running record of which mistakes a person closes, which they commit past, and the press embeddings beside them. It does not keep a judge essay.
- Knowledge config: press embeddings. Each press embeds the button line and the drawing-and-speech slice. A session bundle is those vectors. Judged snapshots are not the geometry.
- Proof-of-work responses do not include an interruption.

TEMPORAL PROOF OF WORK:
- Every PoW event has timestamps. Inter-event gaps, idle bursts, dwell, and speech/tool timing stay on the press they belong to.

SELECTIVE THOUGHT (TAP):
- System 1: crystallized spontaneous speech including stashed/unsent thoughts.
- System 2: deliberate send, edit, skip, select, resend into chat.
- Insights form from stashed and sent thoughts. These traces are first-class PoW for GHC and LWM Snapshot.

REMEDIATION RULE:
- Performance gaps and next steps use domain/product/workflow language. Never recommend Uncertain Systems platform mechanics (running a TAP session, returning to a session, block completion) as remediation outputs — scoring may read those traces as INPUT only.
`.trim();

/** Shorter preamble when token budget is tight (TIM, heartbeats). */
export const WORKSPACE_ONTOLOGY_COMPACT = `
Uncertain Systems: workspaces never end; PoW API is the primary capture interface; Snapshot API exposes LWM Snapshot (lwm_snapshot), learning world model, and knowledge config (knowledgecfg-v1-d64). Single snapshot strategy; GHC is secondary. LWM Snapshot is manual (Knowledge UI) or Snapshot API / MCP — not auto-run when a TAP session ends. TIM may attach interruption on PoW responses. LWM is symbolic; knowledge config is fixed-D geometry for proximity and trajectories.
`.trim();
