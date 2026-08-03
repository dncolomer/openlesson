# Prompt architecture and quality review (TAP / ILE generation + LWM Snapshot scoring)

**Date:** 2026-08-03  
**Scope:** Shipped TypeScript under `lib/prompt-kernel/`, `lib/prompts.ts`, TAP/ILE generation consumers, and LWM Snapshot scoring builders.  
**Non-goals:** No prompt rewrites in this document — recommendations only.

---

## 1. End-to-end prompt architecture

### 1.1 Layered composition (`composePrompt`)

All kernel-era system prompts are assembled by `composePrompt` in `lib/prompt-kernel/compose.ts`:

| Layer | Name | Density / role |
|---|---|---|
| **L0** | Ontology | `WORKSPACE_ONTOLOGY` (full) or `WORKSPACE_ONTOLOGY_COMPACT` or omitted (`none`) |
| **L1** | Surface | Product-specific language: TAP, ILE, or score-context |
| **L2** | Task | Per-call contract / instructions |
| **Notes** | Context notes | Optional runtime notes (not file attachments themselves) |

Order is always **ontology → surface → task → contextNotes**, joined with blank lines. Kernel version: `PROMPT_SYSTEM_VERSION` (`lib/prompt-kernel/version.ts`).

```
composePrompt({ ontology, surface, task, contextNotes? })
  → [L0 ontology?] + [L1 surface?] + L2 task + [notes?]
```

**L0 ontology** (`lib/prompt-kernel/ontology.ts`) encodes product philosophy: never-ending workspaces, PoW API as primary capture interface, single LWM Snapshot primary score + GHC secondary, System 1/2 selective thought, TIM interruption model, and the remediation rule (never recommend platform mechanics as outputs).

### 1.2 Surfaces (L1)

| Surface | File | Primary private goal |
|---|---|---|
| `TAP_SURFACE` (+ selective / practice overlays) | `lib/prompt-kernel/surfaces/tap.ts` | Maximize genuine System 1/2 thought traces as PoW |
| `ILE_SURFACE` (+ tools block / context body) | `lib/prompt-kernel/surfaces/ile.ts` | Optimize chapter progress + augment with tool-routed practice artifacts |
| `buildScoreContextSurface(vertical)` | `lib/prompt-kernel/surfaces/score-context.ts` | Score from PoW only; verification adds submit/stash analysis |

### 1.3 Central registry (user-overridable)

`lib/prompts.ts` holds `DEFAULT_PROMPTS` + `getPrompt(key, overrides)` + `PROMPT_META` for the Dashboard editor.

| Mechanism | Location |
|---|---|
| Defaults | `DEFAULT_PROMPTS` keys |
| Overrides storage | `profiles.metadata.prompts` |
| Loader | `getUserPrompts()` in `lib/user-prompts.ts` (server-only) |
| Resolver | `getPrompt(key, overrides)` → override if set, else default |

**Active registry keys (9):**  
`gap_detection`, `opening_probe`, `probe_generation`, `report_generation`, `follow_up_sessions`, `generate_objectives`, `session_plan_create`, `session_plan_update`

**Important architectural split:** registry prompts are **string templates** with `{placeholders}`. They **do not** go through `composePrompt` / L0 ontology. ILE practice-coach language is duplicated into those strings (and `ILE_CONTEXT` re-exports `ILE_CONTEXT_BODY` from the kernel for shared blurb use). Kernel builders (TAP facilitator, Helios chat system, LWM score instructions) **do** use `composePrompt`.

### 1.4 Major call paths

#### TAP (conversational / selective thought)

```
workspace brief
  → buildTapScoreInstructions (lib/tap-score.ts)
      → buildTapFacilitatorInstructions
          composePrompt({ ontology: "compact", surface: TAP_SURFACE, task: facilitator rules + workspace block })
  → buildTapSelectiveThoughtSystemPrompt(facilitator, { practice? })
      composePrompt({ ontology: "none", surface: TAP_SURFACE, task: facilitator + SELECTIVE overlay [+ PRACTICE overlay] })
  → POST app/api/workspace-tap-score/chat  (system message = selective prompt)
```

Openings / topic cards:

```
buildTapScoreInstructions + buildTapOpeningQuestionTask | buildTapPracticeOpeningQuestionTask | buildTapStartingTopicsTask
  → LLM  (fallback: buildTapOpeningQuestionFallback / StartingTopicsFallback)
```

#### TAP / TAPBench / ILE Project exercises (domain exercise author)

```
generateDomainExercise (lib/pow-api/tapbench-exercise-generate.ts)
  system: buildDomainExerciseAuthorSystemPrompt(surface)   // NOT composePrompt
  user:   buildDomainExerciseAuthorUserPrompt (workspace context assembly)
  quality gate: isLowQualityTapbenchExercise → fallback buildTapbenchExerciseFallback
  surfaces: tapbench | tap_exercise | ile_project
```

Exercise TAP shell (solo, no Helios dialogue) is framed in `lib/exercise-tap.ts` with out-loud stripping and thin-frame rejection; generation prefers `generateTapExercisePrompt`.

#### ILE (Helios + probes + plans)

```
Helios live chat:
  buildIleHeliosChatSystemPrompt()
    composePrompt({ ontology: "compact", surface: ILE_SURFACE, task: Helios voice/rules })
  → app/api/session-chat/route.ts (BASE_SYSTEM_PROMPT)

Opening / mid probes / session plan create|update:
  getPrompt("opening_probe" | "probe_generation" | "session_plan_*", userOverrides)
  → lib/xai.ts (generateOpeningProbe, generateProbe, createSessionPlanLLM, updateSessionPlanLLM)
  Placeholders filled at call site; optional ILE_CONTEXT_BODY language embedded in defaults.

Welcome:
  buildIleWelcomeSystemPrompt()  // ontology: none
```

#### LWM Snapshot scoring

```
buildVerticalScoreInstructions(vertical, blockId?, workspaceGoal?, stylePrompt?)
  composePrompt({
    ontology: "full",
    surface: buildScoreContextSurface(vertical),  // PoW-only + (verification: submit/stash overlay)
    task: LWM_SNAPSHOT_INSTRUCTIONS + markers/gaps/next_steps + WORLD_MODEL_DELTA + PERFORMANCE_REMEDIATION_GUARDRAILS
  })
  schema field descriptions: SCORE_FIELD_DESCRIPTIONS + PERFORMANCE_*_SCHEMA
  post-process: sanitizeRemediationStrings / isPlatformRemediationSuggestion

TAP complete scoring also appends buildTraceScoringInstructions (System1/2 counts + manifest) in lib/tap-score-traces.ts
```

### 1.5 Architecture map (summary)

```
┌──────────────────────────────────────────────────────────────────┐
│ L0 WORKSPACE_ONTOLOGY (full | compact | none)                    │
└────────────────────────────┬─────────────────────────────────────┘
                             │ composePrompt
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   TAP_SURFACE          ILE_SURFACE      SCORE_POW_CONTEXT
   + selective/practice + tools block    + submit/stash (verif)
         │                   │                   │
         ▼                   ▼                   ▼
   L2 TAP task          L2 Helios task    L2 LWM Snapshot task
   (facilitator,        (chat/welcome)    (markers, gaps, GHC…)
    opening tasks)
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
     Registry DEFAULT_PROMPTS        Domain exercise author
     (ILE probes/plans;              (standalone system+user;
      getPrompt + overrides;          quality helpers; no L0)
      no composePrompt)
```

---

## 2. TAP dialog / question / exercise generation — quality review

**Product goal:** genuine, well-designed elicitation that yields strong System 1 and System 2 PoW for later LWM Snapshot + GHC scoring.

### 2.1 Strengths (grounded in shipped text)

1. **Clear dual objective model (private vs visible)**  
   `TAP_SURFACE` states primary goal as maximizing System 1 (spontaneous/stashed) and System 2 (send/edit/skip/select/resend) traces, while learner-visible speech must sound like natural knowledge-checking — definitions, causal links, examples, comparisons, predictions, repairs. Platform jargon and dual-process explanations are banned from learner-facing turns.

2. **Strong anti-theater rules**  
   Explicit NEVER lists for “say/talk/think … out loud”, Uncertain Systems / PoW / TAP product names, scoring jargon. Tests in `tests/lib/tap-ile-prompt-surfaces.test.ts` lock these bans. This is essential for genuine PoW: stage directions produce performative speech, not cognition.

3. **Selective-thought overlay is operationally useful**  
   One concise elicitation; optional brief mirror; prioritize knowledge-thick moves; favor prompts that invite both spontaneous continuation and deliberate send/repair — without naming systems to the learner. Practice overlay correctly lowers difficulty for warm-ups without leaking “practice mode.”

4. **Opening generation prefers concrete problems**  
   `buildTapOpeningQuestionTask` rejects syllabus restatements, generic icebreakers, meta “approach” questions, and stage directions; if context is only a topic list, invent a small concrete problem. Starting topics require distinct domain angles and openingQuestions that yield System 1/2 traces.

5. **Domain exercise author + quality gate**  
   Shared author for TAPBench / human TAP drill / ILE Project Mode with hard bans on topic-list restatements and weak openers (“Using what you know about…”, “Demonstrate your understanding…”). `isLowQualityTapbenchExercise` + pure fallbacks prevent the worst “paste the syllabus” failures. Exercise TAP framing strips out-loud stage directions.

6. **Runtime workspace grounding**  
   `buildTapScoreInstructions` injects block inventory, files, sessions, and “never invent unrelated topics.” Marker axes for later scoring (Conceptual Clarity, Causal Reasoning, etc.) are named in the facilitator so elicitation can cover competency dimensions.

### 2.2 Gaps relative to high-quality PoW elicitation

1. **Suggested facilitator opening vs opening-task standard**  
   Facilitator suggests: *“What is the core idea you took away… first time?”* — a mild, generic knowledge-check. The dedicated opening task is stricter (concrete calculation, design choice, causal chain, misuse debug). Models often copy the suggested opening, undercutting the better opening-task contract. Fallbacks similarly lean on “core idea of {title}.”

2. **Few GOOD/BAD exemplars on TAP (unlike ILE registry)**  
   ILE `opening_probe` / `probe_generation` include concrete GOOD patterns and BAD bans. TAP surface lists abstract tactics only. Without few-shot domain-agnostic exemplars of *excellent* vs *thin* elicitation, models regress to safe, vague questions that yield thin PoW.

3. **No explicit “trace thickness” success criteria**  
   Private goal says “maximize genuine traces,” but prompts do not define what counts as *enough* for scoring (e.g. learner produces a definition + mechanism + example + failure mode). Facilitators may stop after one short exchange or over-interrogate without a coverage plan across the six TAP markers.

4. **Weak adaptive strategy for System 1 vs System 2 balance**  
   Overlay says “favor both,” but does not instruct when to open space for spontaneous stashable speech vs force a deliberate decision (compare, choose, repair, commit). High GHC depends on natural temporal pacing and submit/stash contrast — generation rarely steers for that contrast deliberately.

5. **Repair / contradiction handling is light**  
   “If wrong, first prompt them to notice the contradiction; correct only if stuck” is good, but there is no guidance on *how* to scaffold contradiction detection without leaking the answer or collapsing into lecture — common failure mode that pollutes PoW with facilitator content.

6. **Exercise vs conversational product split is clear; quality of exercise text still depends on block context quality**  
   Author prompt is solid, but thin workspace/block descriptions still push the model toward invented problems that may be off-scope. Fallback “Solve a non-trivial problem in {title}…” is honest but not domain-authentic when materials exist only as title lists.

7. **No mid-session “evidence appetite” feedback into live TAP**  
   LWM evidence_appetite can bias schema generation elsewhere; live TAP chat does not receive “prefer more causal reasoning traces” style guidance. Sessions do not adapt elicitation to known blind spots from prior snapshots.

### 2.3 Concrete improvement opportunities (recommendations only)

| Priority | Opportunity | Placement |
|---|---|---|
| P0 | Align suggested opening + fallbacks with opening-task quality bar (concrete problem-in-context, not “core idea”) | `buildTapFacilitatorInstructions` suggested opening; `buildTapOpeningQuestionFallback` / topics fallbacks |
| P0 | Add 4–6 GOOD / BAD elicitation exemplars (domain-agnostic shells) to `TAP_SURFACE` or selective overlay | Same pattern as ILE `opening_probe` |
| P1 | Add private “trace thickness checklist” (definition → mechanism → example → edge/transfer → repair) and instruct covering markers over the session | Facilitator task goals |
| P1 | Explicit System 1 invitation moves vs System 2 commitment moves (without learner-facing jargon) | `TAP_SELECTIVE_THOUGHT_OVERLAY` |
| P2 | Optional LWM evidence_appetite / blind_spots injection into TAP chat system notes | `workspace-tap-score/chat` contextNotes |
| P2 | Stronger exercise author grounding when file excerpts exist (require using at least one constraint from materials) | Domain exercise user prompt |

---

## 3. ILE dialog / probe / session-plan / chapter exercise — quality review

**Product goal:** productive practice that produces durable PoW (artifacts + progress), not endless interrogation; chapter-completable sessions inside never-ending workspaces.

### 3.1 Strengths

1. **Optimize + augment product framing is clear and consistent**  
   `ILE_SURFACE`, Helios chat builder, `ILE_CONTEXT_BODY`, and registry defaults all reject TAP dual-stream as primary goal; prefer tasks, tool routes, checkpoints, Mark-as-Done, next-chapter movement.

2. **Anti–endless-validation is operationally strong**  
   `session_plan_update` NO-ENDLESS-DRILLING POLICY, gap timing patience (<30s since last probe), `can_auto_advance` good-enough rules, and probe archive discipline reduce the “Helios is never satisfied” failure mode. Skipped chapters are correctly excluded as blockers.

3. **Tool-routed practice is first-class**  
   Canvas / Notebook / Grokipedia / screen share / external IDEs are named with when-to-use guidance. Opening and probe prompts include GOOD patterns that create observable artifacts.

4. **Session plan design mixes interaction types**  
   `session_plan_create` requires question | task | suggestion | checkpoint mix, spatial map layout, and more tasks/suggestions than pure questions for procedural topics — supports PoW diversity (sketches, logs, worked examples).

5. **Project Mode exercises share domain-exercise quality path**  
   Same author + low-quality rejection as TAP drills, with longer length budget for chapter-scale work.

6. **Learner-visible speech hygiene**  
   Same out-loud / platform bans as TAP; tools may be named for routing (correct product distinction).

### 3.2 Gaps relative to durable PoW practice

1. **Registry path lacks L0 ontology and can drift from kernel**  
   Probes and plans are long free-standing strings. Product rules must be hand-duplicated. Today they are aligned, but `report_generation` still frames “tutoring session” and can recommend ILE tools in “Next Time,” which conflicts philosophically with LWM remediation guardrails (platform mechanics not as outputs — different surface, same brand risk).

2. **`gap_detection` optimizes for speech/reasoning gaps, not artifact progress**  
   Gap scoring (0–1) listens for hesitation, circular thinking, etc. That is TAP-adjacent. For ILE, a learner may be productively silent while coding on a shared screen; pure audio gap detection can over-probe or under-score progress. Session update partly compensates with activity context, but the dedicated gap prompt does not mention tools/artifacts.

3. **25-word cap on opening/probe text**  
   Forces brevity (good for UX) but can produce under-specified tool tasks (“Sketch the architecture”) without success criteria, yielding thin PoW.

4. **Limited guidance on artifact quality for later scoring**  
   Prompts say produce sketches/notes/attempts, not *what makes those scorable* (labeled critical path, decision + rationale, checkable outcome). PoW can be voluminous but low-information.

5. **`session_plan_update` is very large**  
   Many concurrent jobs (gap score, plan change, next_request, archive, auto-advance, tools). Models may drop chapter-closure or invent validation after workable answers under load. Complexity is a quality risk even with good rules.

6. **Weak coupling between chapter objectives and PoW types**  
   Plan steps do not declare expected PoW modality (canvas vs notebook vs speech). Scoring later must infer. Specifying intended evidence per chapter would improve both practice and LWM coverage scoring.

7. **Opening probe still allows pure questions**  
   Prefer tools, but a sharp question is allowed; without success criteria, ILE can still become Q&A theater.

### 3.3 Concrete improvement opportunities

| Priority | Opportunity | Placement |
|---|---|---|
| P0 | Add success criteria to probe/task GOOD patterns (“Sketch X on Canvas **and label A/B**”) | `opening_probe`, `probe_generation`, `ILE_SURFACE` tactics |
| P1 | Extend `gap_detection` with tool/artifact progress signals (or merge into session_plan_update-only gap logic) | `DEFAULT_PROMPTS.gap_detection` |
| P1 | Per-step expected PoW modality in session_plan_create JSON | `session_plan_create` schema |
| P2 | Route report_generation remediation language through same platform-ban spirit as LWM (domain next steps, tools OK as practice, not product sales) | `report_generation` |
| P2 | Consider slim composePrompt wrapper for registry ILE prompts (compact ontology + ILE_SURFACE + task body) to stop dual-source drift | Future architecture |

---

## 4. LWM Snapshot scoring prompt stack — structure and guidance review

### 4.1 Composition order (what each layer contributes)

For product LWM Snapshot (`buildVerticalScoreInstructions("verification", …)`):

1. **L0 full ontology** — workspace never ends; single snapshot strategy; GHC secondary; System 1/2 definition; remediation rule (no platform outputs).
2. **L1 `SCORE_POW_CONTEXT_LAYER`** — score from attached PoW only; forbidden invented history/marketing; thin-signal honesty; timestamps first-class; remediation domain language.
3. **L1 `SCORE_VERIFICATION_SUBMIT_STASH_OVERLAY`** (verification only) — mandatory submit/stash System 1 vs 2 analysis when selective-thought PoW exists; else do not invent; low GHC confidence.
4. **L2 task** — produce structured report for scope (block vs full workspace); authoritative workspace_goal if provided; embeds:
   - `LWM_SNAPSHOT_INSTRUCTIONS` / `VERTICAL_SCORE_INSTRUCTIONS[vertical]`
   - marker_scores 4–8 with PoW-grounded rationales
   - gap_analysis.gaps + next_steps (directions + events)
   - suggestions
   - `WORLD_MODEL_DELTA_INSTRUCTIONS`
   - `PERFORMANCE_REMEDIATION_GUARDRAILS`
   - thin-PoW honesty + optional style section
5. **Schema field descriptions** (`SCORE_FIELD_DESCRIPTIONS` + performance schemas) — reinforce meanings of score, ghc_*, temporal_summary, remediation fields at JSON schema level.
6. **Runtime addenda** — e.g. TAP `buildTraceScoringInstructions` injects System1/2 counts + manifest into scoring context when traces exist.
7. **Post-process** — strip platform remediation strings from model output.

### 4.2 How scores are currently derived / prompted

| Field | How instructed today |
|---|---|
| **Primary `score` (0–100)** | “How well the learner has explored the workspace and demonstrated knowledge (block/pathway coverage + depth). Synthesize from all proof of work (not a naive average of markers).” Schema: same idea via `lwm_snapshot_score` description. |
| **`lwm_snapshot_score`** | Set equal to `score` when schema allows (product named field). |
| **Markers** | 4–8 competency axes; each 0–100 + one-sentence rationale grounded in specific PoW; optional block_id. No fixed global marker set at LWM level (TAP live markers are separate fixed six). |
| **GHC `ghc_score` / `ghc_confidence`** | 0–100 authenticity of human cognition; weight System 1 vs 2 and natural temporal pacing; tool-only dumps → low score + none/low confidence. Submit/stash overlay requires citing sent vs unsent when selective thought present. |
| **`temporal_summary`** | Optional one sentence when timestamps inform scores. |
| **`workspace_goal`** | Echo authoritative if provided; else infer and allow evolution. |
| **Gaps / next_steps / suggestions** | Concrete deficiencies with PoW proof; next_steps split directions vs granular events; never TAP/ILE/blocks as remediation outputs. |
| **`world_model_delta`** | Optional partial LWM update (coverage, profile, appetite, scores_snapshot mirrors). |
| **Thin PoW** | Lower scores honestly; empty gaps only when truly insufficient. |

### 4.3 What is underspecified for score derivation

These are the main places where different model runs can legitimately disagree:

1. **No numeric band anchors for primary score**  
   Nothing defines what 0–20 / 21–40 / 41–60 / 61–80 / 81–100 mean in terms of coverage × depth. “Synthesize, don’t average markers” is directionally right but uncalibrated.

2. **No explicit relationship between primary score and marker scores**  
   Independent? Roughly central tendency with penalty for blind spots? Floor at worst critical marker? Unspecified → inconsistent spider vs headline score.

3. **Coverage vs depth weighting undefined**  
   Ontology and instructions mention both; no relative weight or “deep on one pathway vs shallow on many” policy.

4. **GHC scale lacks behavioral anchors**  
   Confidence levels exist; score bands do not (e.g. fully templated tool dump vs rich selective thought with natural hesitation/repair).

5. **Marker taxonomy unconstrained**  
   “Aligned to workspace blocks or eval definition” invites free invention; hard to compare snapshots over time unless caller supplies a fixed definition.

6. **Sparse PoW policy is qualitative only**  
   “Lower scores” without floors/ceilings (e.g. “no selective thought + sparse tools → primary ≤ 35 unless …”).

7. **Severity (“business risk”)**  
   Severity should reflect business risk — good for product workspaces, odd for pure learning workspaces; no mapping from gap severity to score impact.

8. **Two confidence concepts**  
   Report-level `confidence` (emerging…well-connected) vs `ghc_confidence` — lightly specified interaction.

### 4.4 Recommended additional score-derivation guidance (placeable; not implemented)

#### A. Primary score band anchors — place in `LWM_SNAPSHOT_INSTRUCTIONS` (after item 1) or `SCORE_FIELD_DESCRIPTIONS.lwm_snapshot_score`

```text
PRIMARY SCORE BANDS (coverage × demonstrated depth of knowledge in PoW):
- 0–20: Little usable PoW, or PoW does not demonstrate the workspace goal / block objective.
- 21–40: Partial contact — some relevant traces/artifacts, major pathways or core claims unproven or contradicted without repair.
- 41–60: Solid partial demonstration — several competencies evidenced with concrete PoW, but clear blind spots or shallow transfer remain.
- 61–80: Strong demonstration across most relevant pathways with depth (definition + mechanism + application or checkable artifact); residual gaps are secondary.
- 81–100: Dense, consistent PoW: broad pathway coverage AND depth, repairs of weak claims, and (when present) selective-thought evidence that knowledge is learner-owned—not facilitator-fed.

Use the full 0–100 range. Prefer the lower band when evidence is ambiguous. Do not award 70+ for polished but thin restatements without application, mechanism, or artifact.
```

#### B. Primary ↔ markers contract — place in `buildVerticalScoreInstructions` “Additional required outputs” §6

```text
MARKER ↔ PRIMARY CONSISTENCY:
- marker_scores explain the primary score; they are not a second independent grading system.
- Primary score should be consistent with markers: if most markers are <50, primary is rarely >60; if a critical goal-linked marker is <40, primary should usually sit in a lower band even if other markers are high.
- Do not set primary as the arithmetic mean of markers. Prefer a judgment of overall goal progress with markers as the decomposition, applying a blind-spot penalty when important pathways have low markers or empty PoW.
```

#### C. GHC behavioral anchors — place in `SCORE_VERIFICATION_SUBMIT_STASH_OVERLAY` or `SCORE_FIELD_DESCRIPTIONS.ghc_score`

```text
GHC SCORE ANCHORS (secondary authenticity signal):
- 0–25 + ghc_confidence none|low: tool-only dumps, copy-paste, or no selective-thought / natural timing signal.
- 26–50 + low|medium: some human traces but highly prompted, templated, or missing submit/stash contrast.
- 51–75 + medium|high: natural pacing, hesitation/repair, System 1 vs System 2 contrast visible in selective-thought PoW.
- 76–100 + high: rich dual-stream traces, non-templated language, temporal patterns consistent with genuine cognition; cite concrete stash vs submit pairs.

Never inflate GHC because domain content is correct — correctness belongs in the primary LWM Snapshot score; GHC measures authenticity of the cognition source.
```

#### D. Thin-PoW floors — place in `SCORE_POW_CONTEXT_LAYER` Rules

```text
THIN / MISSING POW DEFAULTS:
- If total PoW is empty or non-diagnostic for the goal: primary score ≤ 15, markers low or empty with rationales citing absence, gaps may be empty only when nothing specific can be named, ghc_confidence "none".
- If only unstructured tool events without outcomes: primary usually ≤ 40 unless events clearly demonstrate goal progress.
- If selective thought is absent: do not invent System 1/2 dynamics; cap ghc_confidence at low; still score domain demonstration from remaining PoW.
```

#### E. Optional calibration micro-examples — place as short appendix in L2 task (token-cost aware)

```text
CALIBRATION SKETCHES (illustrative, not exhaustive):
- Rich TAP: many System1 crystallizations + deliberate System2 sends repairing a wrong causal link + concrete example → primary mid/high band if topic covered; GHC mid/high with high confidence.
- Tool CRUD storm with no decisions/rationale → primary low/mid; GHC low; appetite want_more includes decision_rationale.
- Single correct one-line definition with no mechanism/application → primary low band despite correctness.
```

#### F. Fixed marker sets when eval definition exists

When the caller has an eval definition / TAP markers, pass them in contextNotes and add:

```text
When a marker list is provided in context, use those ids/labels for marker_scores (do not invent parallel axes). Score only axes for which PoW exists or note absence in rationale with low score.
```

### 4.5 Placement summary

| Guidance | Best stack home | Why |
|---|---|---|
| Primary bands | `LWM_SNAPSHOT_INSTRUCTIONS` + schema description | Shared by all verification calls |
| Marker consistency | L2 task in `buildVerticalScoreInstructions` | Already owns marker contract |
| GHC anchors | Submit/stash overlay + `ghc_score` field description | Selective-thought path only for full anchors; field desc always present |
| Thin-PoW floors | `SCORE_POW_CONTEXT_LAYER` | Applies to all verticals/surfaces |
| Calibration sketches | L2 task (optional compact) | High token cost; keep short |
| Fixed markers | contextNotes at call site | Per-eval, not global |

---

## 5. Inventory / test alignment notes

| Claim | Locked by shipped tests |
|---|---|
| `composePrompt` order ontology → surface → task | `tests/lib/prompt-kernel.test.ts` |
| TAP System 1/2 + no Socratic identity + out-loud bans | `tests/lib/tap-ile-prompt-surfaces.test.ts` |
| ILE chapter-aware optimize/augment + registry path | same |
| Score PoW-only + verification submit/stash layering | `tests/lib/score-prompt-layer.test.ts`, `tests/lib/performance-report.test.ts` |
| Domain exercise surfaces + quality helpers | `tests/lib/tapbench-exercise-generate.test.ts` |
| Architecture + quality review structural assertions | `tests/lib/prompt-architecture-quality-review.test.ts` |

**Drift note:** `tests/fixtures/prompt-inventory/prompt-analysis.md` (generated 2026-07-11) still describes some older framing; live defaults in `lib/prompts.ts` and kernel surfaces are the source of truth for this review. Inventory domain tags (`tap-ghc-scoring`, `session-helios`, `pow-api`, `registry`) still match the architectural buckets above.

---

## 6. Bottom line

- **Architecture** is intentionally layered: kernel `composePrompt` for TAP/ILE chat systems and LWM scoring; a parallel **user-overridable registry** for ILE probes/plans; a **standalone domain-exercise author** for timed problems across TAP/ILE/TAPBench.
- **TAP generation quality** is strong on authenticity hygiene (anti-stage-direction, dual-stream private goals) but weaker on *design excellence* of questions (generic openings, few exemplars, no trace-thickness / marker-coverage plan). That is the main risk to “good PoW data.”
- **ILE generation quality** is strong on chapter closure and tool-routed practice; risks are thin success criteria on short probes, speech-centric gap detection, and registry/kernel dual maintenance.
- **LWM scoring** is well structured (ontology → PoW-only → submit/stash → task → schema → sanitize) but **under-specified on numeric derivation** (bands, marker–primary consistency, GHC anchors, thin-PoW floors). Adding the guidance in §4.4 would improve calibration without changing code contracts.
