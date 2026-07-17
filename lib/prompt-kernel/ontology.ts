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
- Three pillars on top of workspaces: learning verification, learning optimization, learning augmentation.

SCORES (workspace analysis always reasons in these terms):
1. overall_score — 0–100 learning / exploration score: how well the learner has explored the workspace and demonstrated knowledge. Proxy for knowledge coverage and depth of pathways touched.
2. conversion_score — 0–100 likelihood of completing the inferred (or stored) conversion goal given current proof of work. Distinct from exploration: strong learning can coexist with low conversion odds.
3. ghc_score — 0–100 Genuine Human Cognition score. Estimates how genuine / human the PoW source appears. Highest signal when scoped to TAP/ILE selective thought (System 1 spontaneous/stashed vs System 2 deliberate send/edit/skip) and natural temporal patterns. Tool-only dumps → low confidence GHC.

GOALS:
- conversion_goal is stored on the workspace when known, otherwise inferred from title, notes, blocks, and accumulating PoW; inference may evolve as evidence grows.

LEARNING WORLD MODEL vs TIM:
- Learning world model: evolving representation of how the learner explores blocks, strengths/friction, temporal patterns, evidence appetite (what PoW types still help), and latest scores. Exportable/transferable across workspaces or apps when serialized.
- TIM (Trace Interruption Model): interruption world model. On (nearly) every PoW API success response, TIM may recommend a timed intervention (interruption: null | { delay_ms, intervention, … }). Consumers schedule, supersede on later responses, and never stack timers.
- Today TIM is platform-hosted and co-deployed with the PoW API. Architecturally it is a swappable provider — later it may be an independent external world model service while the consumer interruption contract stays stable.

TEMPORAL PROOF OF WORK:
- Every PoW event has timestamps. Inter-event gaps, idle bursts, dwell, and speech/tool timing are informative for exploration, conversion, GHC, and TIM.

SELECTIVE THOUGHT (TAP / ILE):
- System 1: crystallized spontaneous speech including stashed/unsent thoughts.
- System 2: deliberate send, edit, skip, select, resend into chat.
- Insights form from stashed and sent thoughts. These traces are first-class PoW for GHC and learning verification.

REMEDIATION RULE:
- Performance gaps and next steps use domain/product/workflow language. Never recommend Uncertain Systems platform mechanics (TAP sessions, ILE, block completion) as remediation outputs — those products may supply scoring INPUT only.
`.trim();

/** Shorter preamble when token budget is tight (TIM, heartbeats). */
export const WORKSPACE_ONTOLOGY_COMPACT = `
Uncertain Systems: workspaces never end; PoW API is the primary interface; scores are overall_score (learning/exploration), conversion vs conversion_goal, and GHC (genuine human cognition from selective thought + temporal naturalness). TIM (Trace Interruption Model) may attach interruption on every PoW response; prefer null when low-signal. Learning world model tracks exploration, evidence appetite, and scores; TIM is a separate swappable interruption model.
`.trim();
