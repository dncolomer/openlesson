/**
 * L0 — Canonical Uncertain Systems philosophy for xAI system preambles.
 * Keep short enough to prepend; do not product-sell inside remediation outputs.
 */
export const WORKSPACE_ONTOLOGY = `
WORKSPACE ONTOLOGY (Uncertain Systems):
- Workspaces are the encapsulating unit across all products (TAP, ILE, PoW API, future ALE, All-You-Can-Learn). They never end and never close; they grow infinitely with the learner as proof of work accumulates.
- Blocks are assessable units inside a workspace. Completing a block or session does not close the workspace.
- The primary interface to a workspace is the Proof-of-Work (PoW) API. Integrators and products submit temporally stamped proof of work (tool traces, screen, video, EEG, selective thought traces). As more data arrives, the interface evolves: schemas, skills, scores, and interruption bias update.
- All PoW is stored with xAI file references plus workspace / block / session / TAP / ILE scope refs so evaluation can be full-workspace or scoped.
- Three pillars on top of workspaces: learning verification, learning augmentation, learning optimization.

SCORES (each vertical has its own endpoint — one primary score per call):
1. verification_score — 0–100 learning verification: demonstrated knowledge and workspace exploration coverage/depth. TAP (Think Aloud Protocol) is a verification tool and always surfaces verification score only.
2. augmentation_score — 0–100 learning augmentation: practice / improvement readiness from proof of work.
3. optimization_score — 0–100 learning optimization: progress toward the inferred workspace goal (score units 0–100, not conversion %).
- GHC (ghc_score) is a secondary cognition authenticity signal, not a fourth primary vertical score button.

GOALS:
- workspace_goal is stored on the workspace when known, otherwise inferred from title, notes, blocks, and accumulating PoW; inference may evolve as evidence grows.

LEARNING WORLD MODEL vs KNOWLEDGE CONFIG vs TIM:
- Learning world model: evolving symbolic representation of how the learner explores blocks, strengths/friction, temporal patterns, evidence appetite (what PoW types still help), and latest scores. Workspace- and subject-scoped; exportable/transferable when serialized. Durable via Evaluation API.
- Knowledge config: fixed-dimensional embedding (knowledgecfg-v1-d64, D=64) of learner state in a globally comparable configuration space. Same axes across workspaces/users; distance = proximity. Trajectories support time analysis; expert regions (future) are densities in this space.
- TIM (Trace Interruption Model): interruption world model. On (nearly) every PoW API success response, TIM may recommend a timed intervention (interruption: null | { delay_ms, intervention, … }). Consumers schedule, supersede on later responses, and never stack timers. TIM may read LWM + scores when provided.
- Evaluation surface (scores, LWM, knowledge config) is conceptually separate from PoW capture; both share workspace auth.
- Today TIM is platform-hosted and co-deployed with the PoW API. Architecturally it is a swappable provider — later it may be an independent external world model service while the consumer interruption contract stays stable.

TEMPORAL PROOF OF WORK:
- Every PoW event has timestamps. Inter-event gaps, idle bursts, dwell, and speech/tool timing are informative for verification, augmentation, optimization, GHC, and TIM.

SELECTIVE THOUGHT (TAP / ILE):
- System 1: crystallized spontaneous speech including stashed/unsent thoughts.
- System 2: deliberate send, edit, skip, select, resend into chat.
- Insights form from stashed and sent thoughts. These traces are first-class PoW for GHC and learning verification.

REMEDIATION RULE:
- Performance gaps and next steps use domain/product/workflow language. Never recommend Uncertain Systems platform mechanics (TAP sessions, ILE, block completion) as remediation outputs — those products may supply scoring INPUT only.
`.trim();

/** Shorter preamble when token budget is tight (TIM, heartbeats). */
export const WORKSPACE_ONTOLOGY_COMPACT = `
Uncertain Systems: workspaces never end; PoW API is the primary capture interface; Evaluation API exposes scores, learning world model, and knowledge config (knowledgecfg-v1-d64). Scores are verification_score, augmentation_score, and optimization_score; workspace_goal is inferred or owner-set; GHC is secondary. TAP auto-results use verification only. TIM may attach interruption on PoW responses. LWM is symbolic; knowledge config is fixed-D geometry for proximity and trajectories.
`.trim();
