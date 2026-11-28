# Code Review & Improvement Plan — Excalidraw Verification Canvas & Proof-of-Work Event Capture

> **Scope:** Read-only review of the Excalidraw verification canvas front end (`components/ExcalidrawCanvas.tsx`, `components/excalidraw-canvas/*`, `lib/learn-work-canvas*`, `lib/learn-canvas-*`, `components/VerificationFlowRunner.tsx`, `components/TapScoreClient.tsx`, `components/tap-score/*`, `components/session-view/*`, `lib/tap-*`, `lib/behavior-*`) and the proof-of-work (PoW) capture, transport, storage, and embedding-handoff pipeline on branch `cursor/quality-full-refactor-plan-0a58` (commit `30e8c712`).
>
> **Note:** No application code was changed in this review.

---

## Executive Summary

The Excalidraw verification canvas and PoW capture stack works across two distinct entry paths — **public verification protocols** (`/v/[token]` -> `VerificationFlowRunner` -> `TapScoreClient` with `localOpening=true`) and **private/guest verification sessions** (`/verify/session/[token]` -> `PrivateTapSessionPage` -> `TapScoreClient` with `localOpening=false`) — but has accumulated significant architectural fragmentation from its shared Learn/TAP heritage:

- **Three P0 / Critical breakage risks exist on the current branch right now:**
  1. **Deleted Learn API endpoints still called by Verification startup & live policy inference:** `lib/session-branch-field-load.ts:187,248` still fetches `POST /api/learn/session-branch-model` and `lib/session-policy-infer-client.ts:10` still fetches `POST /api/learn/session-policy-infer` — both routes were removed during the Learn cleanup (`L2`). Because `use-tap-score-flow.ts:386-402` blocks starting the verification clock until `loadSessionBranchField` succeeds, **every verification session start will 404 until these endpoints are re-mounted under `/api/verify/session/*`**.
  2. **Public `/v/[token]` protocol runs silently drop 100% of live PoW uploads:** `VerificationFlowRunner.tsx:157-172` mounts `TapScoreClient` with `localOpening=true` and no DB session or `privateToken`; `use-tap-score-flow.ts:379` sets a synthetic non-UUID `tapSessionId = "verification-..."`. Every subsequent `POST /api/verify/session/{canvas,speech,idle,trace}` call fails auth/lookup (`401`/`404`) and is silently swallowed (`.catch(() => {})`), meaning **zero `proof_of_work` rows and zero Canvas Capture Mermaid documents are stored during public `/v/[token]` runs** (only the final summary embedding is persisted via `/api/verification-flow/public/[token]/results`).
  3. **Post-DB-cleanup column mismatch in `lib/pow-api/workspace-proof-of-work.ts:193-194,241` & `lib/tap-score-traces.ts:185`:** `PROOF_OF_WORK_SELECT` still requests `workspace_id, block_id` on `INSERT ... RETURNING` (and `countWorkspaceProofOfWorkForPlan` / `fetchTapSessionTraces` still filter `.eq("workspace_id", ...)`), which will fail with PostgreSQL `42703` once `supabase/upgrade/20261128120000_drop_legacy_non_verification_schema.sql` runs.
- **Transport & reliability weaknesses:** There is **no client-side batching, retry queue, ordering guarantee, or `sendBeacon`/`keepalive` unload flush**. Every single canvas action (`pan`, `zoom`, `move`, `draw_text`, etc.) fires an individual HTTP request that performs a remote BlobStore upload + Postgres insert + count query synchronously. Meanwhile, an entire second capture subsystem (`lib/behavior-capture*.ts` — `BehaviorChunker`, `BehaviorBoardSampler`, `behavior-capture-house.ts`) is **orphaned** (never attached in Verification, silently no-oping on every pointer/speech/canvas tick).
- **Front-end complexity:** `components/ExcalidrawCanvas.tsx` (1,146 LOC, 12 `useState`, **40 `useRef`**, 20 `useEffect`, 13 `useCallback`), `components/TapScoreClient.tsx` (1,039 LOC, **31 `useState`**, 28 `useRef`, 16 `useEffect`), and `components/tap-score/tap-score-phases.tsx` (948 LOC) intertwine Excalidraw scene choreography, overlays, speech recognition, purity clocks, and PoW upload transport.

---

## 1. End-to-End Capture Pipeline Overview

```
ExcalidrawCanvas.tsx (onChange / onPointerUpdate / commands / dictate)
  │
  ├─► IleWorkCanvasPowCollector (lib/learn-work-canvas-pow.ts)
  │     ├─► TapScoreClient -> tap-score-phases.tsx:handleCanvasPowActions()
  │     │     ├─► [Per-event] POST /api/verify/session/canvas ──► BlobStore + proof_of_work
  │     │     └─► [Every N actions if canvasCapture.enabled]
  │     │           POST /api/verify/session/canvas (canvas_document Mermaid .md)
  │     └─► SessionPolicyContext (components/session-view/session-policy-context.tsx)
  │           ├─► In-memory session PoW dev HUD (⌘D / Ctrl+D)
  │           └─► [Every 6 events or 12s] POST /api/learn/session-policy-infer [BROKEN 404]
  │
  ├─► behaviorBoardSampler() (lib/behavior-capture-pointer.ts) ──► [DEAD / NULL in Verification]
  │
  └─► useTapSpeechProofOfWork / useTapIdleProofOfWork / Thought traces / Chat
        ├─► POST /api/verify/session/{speech,idle,trace,chat} ──► BlobStore + proof_of_work
        └─► On session end:
              ├─► Public /v/[token]: POST /api/verification-flow/public/[token]/results
              │     ──► Remote POST $FLOWCFG_EMBEDDINGS_BASE_URL/v1/embed ──► session_embeddings + verify_flows result
              └─► Private /verify/session/[token]:
                    POST /api/session/embed ──► Remote POST /v1/embed ──► session_embeddings
                    POST /api/verify/session/complete ──► BlobStore (transcript JSON) + proof_of_work + sessions.status
```

---

## 2. Complete Catalog of Logged Events & Proof-of-Work Artifacts

### 2.1 Canvas Scene & Tool Events (`tool_name = "canvas"`)

| Event (`tool_action`) | Emitted At (`file:line`) | Payload & Metadata Fields | Frequency / Debounce | Storage Target | Consumers |
|---|---|---|---|---|---|
| `draw_text`, `draw_freedraw`, `draw_rectangle`, `draw_diamond`, `draw_ellipse`, `draw_arrow`, `draw_line`, `draw_image`, `draw_frame` | `lib/learn-work-canvas-pow.ts:87-98,420-470` via `ExcalidrawCanvas.tsx:850,902` -> `tap-score-phases.tsx:465-486` | `session_id`, `tool: "canvas"`, `action`, `timestamp_ms`, `element_ids`, `metadata: { via: "excalidraw", product: "tap", element_ids, element_types, count, ... }` | Suppressed while `gestureBusy` (`pointerDown` / `isResizing` / `isRotating` / `editingElement`); flushed on `pointerUp` or non-busy `onChange`. **1 HTTP POST per event (no batching).** | `POST /api/verify/session/canvas` -> BlobStore JSON + `proof_of_work` (`type="tool"`). **Silently 401/404 on public `/v/[token]`!** | `SessionPolicyContext` (in-memory inference trigger & dev HUD), Data Studio inspect, predictive interruption. **NOT used by `/v/[token]` final embedding** (which only sends `prompt` + `policy.sequence`). |
| `erase`, `delete`, `move`, `rotate`, `multi_select` | `lib/learn-work-canvas-pow.ts:31-35,470-570` via `ExcalidrawCanvas.tsx:850,902` | Same envelope; `element_ids`, `count`, `multi`, position/angle deltas | Same gesture-end flush; **1 HTTP POST per event**. | Same (`POST /api/verify/session/canvas` -> BlobStore + `proof_of_work`) | Same as above. |
| `pan`, `zoom`, `hover` | `lib/learn-work-canvas-pow.ts:36-38,570-620` via `ExcalidrawCanvas.tsx:850,902` | Viewport `scrollX`/`scrollY`/`zoom` delta metadata | Fires on every settled pan/zoom/hover `onChange` (`ZOOM_EPS=0.001`, `POS_EPS=0.5`) — **high-frequency noisy HTTP fan-out** (every wheel/trackpad pan bursts multiple POSTs). | Same (`POST /api/verify/session/canvas` -> BlobStore + `proof_of_work`) | Same as above. High cost in xAI Files uploads for tiny viewport events. |
| `focus`, `next`, `simplify`, `breakdown`, `concepts`, `draw`, `refactor` (Canvas Commands) | `components/excalidraw-canvas/use-work-canvas-commands.ts` -> `lib/learn-work-canvas-pow.ts:44-52,653-682` | `command_id`, `prompt`, `element_ids`, `element_types`, `count`, `multi` | Once per command button/shortcut click | Same (`POST /api/verify/session/canvas`) | Same as above. *(Note: `focus`/`next` are Learn-era commands; `ask`, `check`, `declutter`, `suggest-insight`, `rephrase`, `join`, `elaborate`, `selective-compression`, `clear-overlaps`, `split`, `define`, `answer` remain in `ILE_WORK_CANVAS_RETIRED_COMMAND_POW_IDS` at lines 55-68 for historical read compatibility.)* |
| `expand_more`, `board_prompt` | `components/excalidraw-canvas/use-work-canvas-commands.ts` -> `lib/learn-work-canvas-pow.ts:39-40` | Full prompt text (`canvasPowPromptText`), `element_ids` | Once per canvas ask/prompt submission | Same (`POST /api/verify/session/canvas`) | Same as above. |
| `dictate` | `components/excalidraw-canvas/use-work-canvas-commands.ts` (`writeDictatedText`) -> `lib/learn-work-canvas-pow.ts:73` | Dictated text written onto board, `element_ids` | Once per dictation commit | Same (`POST /api/verify/session/canvas`) | Same as above; also `collectFlowPowTranscripts` (`lib/flow-embedding.ts:328`) checks `action === "dictate"` for Data Studio transcript extraction. |
| `canvas_document` (Mermaid board capture) | `lib/flow-canvas-capture.ts:144-169` via `tap-score-phases.tsx:488-506` | Markdown document (`mimeType: "text/markdown"`, `schema: "canvas-mermaid-v1"`, `format: "mermaid"`, `action_count`, `every_actions`, `session_id`) | Triggered every `everyActions` canvas actions (default `8`, range `2–48`) ONLY when `canvasCapture.enabled === true` | `POST /api/verify/session/canvas` -> BlobStore `.md` + `proof_of_work` (`type="tool"`). **Silently 401/404 on `/v/[token]`!** | Data Studio Stored Record preview. **Explicitly excluded from embeddings** (`isCanvasContentPowRow` in `lib/flow-canvas-capture.ts:105-116`). |
| `canvas_draw` (PNG snapshot — **LEGACY / UNUSED IN LIVE TAP**) | `lib/tap-work-canvas.ts:281-287` (`buildTapCanvasSnapshotUploadItem`), `ExcalidrawCanvas.tsx:790-807` (`debouncedExportPNG`) | Base64 PNG data URL | 500ms debounce in `ExcalidrawCanvas.tsx` whenever `onCanvasChange` prop is passed (not passed by `tap-score-phases.tsx`). | Not uploaded in live verification (dead path unless `onCanvasChange` supplied). | **Dead / none** in verification (`tap-score-phases.tsx` explicitly switched to `canvas_document`). |

### 2.2 Speech, Thought Trace, Chat, Idle & Biosignal Events

| Event (`tool_name` / `tool_action`) | Emitted At (`file:line`) | Payload & Metadata Fields | Frequency / Debounce | Storage Target | Consumers |
|---|---|---|---|---|---|
| `speech` / `speech_start`, `speech_stop` | `lib/useTapSpeechProofOfWork.ts:45-128` -> `POST /api/verify/session/speech` | `tap_session_id`, `event` (`start`/`stop`), `segment_duration_ms`, `transcript_snapshot`, `timestamp_ms`, `practice` flag, `source_link` | `start` on first non-empty Web Speech result; `stop` after `TAP_SPEECH_SEGMENT_GAP_MS` silence gap or `flushSpeechSegment()` | BlobStore JSON + `proof_of_work` (`type="tool"`, `tool_name="speech"`, `tool_action="speech_start"\|"speech_stop"`). **Silently 401/404 on `/v/[token]`!** | Predictive interruption (`withProofOfWorkApiResponse`), Data Studio transcripts. |
| `thought-trace` / `system1_*` (`crystallize`, `pause_finalize`, `auto_stash`) & `system2_*` (`send`, `skip`, `select`, `deselect`, `resend`, `edit`, `remove`, `end_of_chain_of_thought`) | `components/TapScoreClient.tsx` -> `POST /api/verify/session/trace` (`lib/tap-score-traces.ts:116-174`) | `type: "uncertain_systems_tap_thought_trace"`, `trace_type` (mapped via `storedTraceFamily`), `action`, `tap_session_id`, `thought_id`/`thought_ids`, `chain_id`, `text`, `original_text`, `combined`, `timestamp_ms` | Once per thought lifecycle action (stash, auto-stash on silence, edit, send, skip, end chain) | BlobStore JSON + `proof_of_work` (`type="tool"`, `tool_name="thought-trace"`). **Silently 401/404 on `/v/[token]`!** | Predictive interruption, Data Studio. |
| `session-chat` / chat exchange | `app/api/verify/session/chat/route.ts` (`lib/tap-score-traces.ts:81-114`) | `learner_thought`, `helios_reply`, `tap_session_id`, `timestamp_ms` | Once per assistant chat turn | BlobStore JSON + `proof_of_work` (`tool_name="session-chat"`). | Data Studio, session transcript. |
| `idle` / `idle_heartbeat` | `lib/useTapIdleProofOfWork.ts:78-127` -> `POST /api/verify/session/idle` | `tap_session_id`, `idle_duration_ms`, `has_pending_transcription`, `timestamp_ms` | Checked every 5s (`IDLE_CHECK_MS`); emitted once per `TAP_IDLE_POW_INTERVAL_MS` when idle & not speaking | BlobStore JSON + `proof_of_work` (`tool_name="idle"`, `tool_action="idle_heartbeat"`). **Silently 401/404 on `/v/[token]`!** | Predictive interruption (`withProofOfWorkApiResponse`). |
| `transcript` (Session Completion) | `components/tap-score/use-tap-score-flow.ts:595` -> `POST /api/verify/session/complete` (`lib/tap-score-traces.ts:34-69`) | `type: "uncertain_systems_tap_transcript"`, `transcript: [{ role, text, at }]`, `duration_seconds`, `completed_at`, `quality: "impure"` (if impure), `practice` | Once at end of private `/verify/session/[token]` run | BlobStore JSON + `proof_of_work` (`tool_name="transcript"`) + `sessions.status = "completed"` + optional webhook POST. | Export, Data Studio, completion webhook. |
| `session_policy` + `runner` (Completed Embedding) | Public: `VerificationFlowRunner.tsx:127-151` -> `POST /api/verification-flow/public/[token]/results`; Private: `use-tap-score-flow.ts:543` -> `POST /api/session/embed` | `flowKind: "verify"`, `model` (SessionBranchModel), `sequence: string[]`, `pow: [{ type: "speech", tool_name: "runner", payload: prompt }, ...policy.sequence]` | Once on session completion | Remote `POST $FLOWCFG_EMBEDDINGS_BASE_URL/v1/embed` -> `session_embeddings` (+ `sessions.result` via `addPublicFlowResult` on public flows + LTI AGS grade post). | **Primary verification consumer:** Knowledge Regions, polar/2D figures, candidate scoring, LTI AGS grades. |
| Muse EEG (`TapSessionSignals`) | `components/session-view/session-signals.tsx:58-200` | Live Web Bluetooth EEG channel buffers + contact quality (`lib/muse-athena.ts`) | Continuous stream while connected | **In-memory UI only in `TapSessionSignals`!** (EEG upload lived in deleted Learn `use-session-runtime.ts`; `TapSessionSignals` only reports `onLiveChange({ muse: boolean })` for channel purity — **no EEG PoW rows are uploaded in Verification!**) | Channel purity gate (`enforcedChannels.muse`) & sidebar EEG monitor UI. |
| `behavior` / `behavior_chunk` & `behavior_rollup` (**ORPHANED**) | `ExcalidrawCanvas.tsx:876,888`, `useSessionThoughtInterface.ts:11`, `session-policy-context.tsx:29` -> `lib/behavior-capture*.ts` | Quantized pointer coords, scroll/zoom, speech timing, rollup stats | Intended 10s chunks + session rollup | **NOWHERE (DEAD):** `attachBehaviorBoardSampler()` is never called anywhere in Verification; `behaviorBoardSampler()` is always `null`. | **Nothing (dead code).** |

---

## 3. Detailed Findings (with File:Line & Severity)

### 3.1 Critical (P0 — Broken Runtime Behavior)

1. **[CRITICAL] Verification session start & live policy inference call deleted `/api/learn/*` endpoints**
   - **Where:** `lib/session-branch-field-load.ts:187,248` (`fetchImpl("/api/learn/session-branch-model", ...)`) and `lib/session-policy-infer-client.ts:10` (`fetch("/api/learn/session-policy-infer", ...)`), triggered by `components/tap-score/use-tap-score-flow.ts:386-402,445-462` and `components/session-view/session-policy-context.tsx:28`.
   - **Why it matters:** `use-tap-score-flow.ts:400` enforces `if (!sessionClockMayStart({ mode: "verification", fieldReady: field.ok })) throw new Error(...)`. With `/api/learn/session-branch-model` deleted in `L2`, **starting any verification session throws and never enters the `"live"` phase**; and live policy inference silently returns `null` (so `policy.sequence` stays empty).
   - **Fix:** Restore/re-mount verification-only versions at `/api/verify/session/branch-model` and `/api/verify/session/policy-infer` and point `lib/session-branch-field-load.ts` and `lib/session-policy-infer-client.ts` to them.

2. **[CRITICAL] Public `/v/[token]` protocol runs silently drop all live canvas/speech/idle/trace PoW & Canvas Capture uploads**
   - **Where:** `components/VerificationFlowRunner.tsx:157-172` (passes `localOpening` with no DB session/token), `components/tap-score/use-tap-score-flow.ts:379` (creates fake `localId = "verification-..."`), `components/tap-score/tap-score-phases.tsx:465-506`, `lib/tap-work-canvas.ts:337-341`, `lib/useTapSpeechProofOfWork.ts:58`, `lib/useTapIdleProofOfWork.ts:103`.
   - **Why it matters:** Every realtime PoW call hits `/api/verify/session/{canvas,speech,idle,trace}` without a valid session row or `privateToken`, receives HTTP `401`/`404`, and swallows the error. Protocol owners enabling **Capture Canvas** (`canvas_capture.enabled = true`) or auditing PoW in Data Studio get zero canvas/speech/trace PoW rows for public `/v/[token]` runs.
   - **Fix:** Have `POST /api/verification-flow/public/[token]` (claim step) return a real persisted `sessionId` + scoped short-lived `privateToken` (or signed session token) backed by the `sessions` row it already creates, and pass those into `TapScoreClient` so public protocol runs use the exact same authenticated PoW pipeline as private sessions.

3. **[CRITICAL] Post-DB-cleanup SQL error on every `proof_of_work` insert and count**
   - **Where:** `lib/pow-api/workspace-proof-of-work.ts:193-194` (`PROOF_OF_WORK_SELECT = "id, workspace_id, block_id, ..."`), `lib/pow-api/workspace-proof-of-work.ts:241` (`.eq("workspace_id", id)`), and `lib/tap-score-traces.ts:185` (`.eq("workspace_id", workspaceId)`).
   - **Why it matters:** Once Daniel executes `supabase/upgrade/20261128120000_drop_legacy_non_verification_schema.sql`, `proof_of_work.workspace_id` and `proof_of_work.block_id` are dropped; every `insertWorkspaceProofOfWorkRow` call (`canvas`, `speech`, `idle`, `trace`, `chat`, `complete`, `region-simulation-persist`) will fail on `INSERT ... RETURNING workspace_id, block_id`!
   - **Fix:** Remove `workspace_id, block_id` from `PROOF_OF_WORK_SELECT` and replace `countWorkspaceProofOfWorkForPlan` / `fetchTapSessionTraces` filters with `session_id` / `verify_flow_id` / `metadata->>tap_session_id`.

### 3.2 High (Data Loss, Performance & Dead Capture Code)

4. **[HIGH] Zero client-side batching, retry, ordering, or unload flush on canvas/speech/trace uploads**
   - **Where:** `lib/tap-work-canvas.ts:337-341` (`.catch(() => {})`), `components/tap-score/tap-score-phases.tsx:470-487` (`for (const event of events) void uploadTapWorkCanvasPow(...)`), `lib/useTapSpeechProofOfWork.ts:54,148`, `lib/useTapIdleProofOfWork.ts:116`.
   - **Why it matters:**
     - **Tab close / navigation loss:** In-flight or final events are dropped on `beforeunload`/`pagehide` because neither `keepalive: true` nor `navigator.sendBeacon` is used.
     - **Offline / transient 5xx loss:** Every failed POST is silently discarded with no retry queue.
     - **Speech `stop` race condition (`lib/useTapSpeechProofOfWork.ts:54`):** If `speech_start` is still in-flight when `speech_stop` fires, `if (inFlightRef.current) return;` permanently drops the `speech_stop` event (losing `transcriptSnapshot` and `segmentDurationMs`).
     - **High per-event backend amplification:** Every single `pan`/`zoom`/`hover`/`move` event triggers a separate HTTP request -> Supabase auth check -> **remote xAI Files API upload** -> Supabase INSERT -> Supabase COUNT -> predictive interruption check. A 15-minute active canvas session easily fires 200–500+ individual xAI File uploads!

5. **[HIGH] Entire `BehaviorChunker` / `BehaviorBoardSampler` subsystem is orphaned dead code in Verification**
   - **Where:** `lib/behavior-capture-chunk.ts`, `lib/behavior-capture-pointer.ts`, `lib/behavior-capture-house.ts`, `lib/behavior-capture-rollup.ts`, called from `components/ExcalidrawCanvas.tsx:876,888`, `lib/useSessionThoughtInterface.ts:11`, `components/session-view/session-policy-context.tsx:29`.
   - **Why it matters:** `attachBehaviorBoardSampler()` is never called after Learn's `use-session-runtime.ts` was removed, so `recordSpeech()`, `recordUnsys()`, `sampleBoardAppState()`, and `onPointerUpdate()` silently drop every event. Developers reading the canvas code assume a chunked behavior stream is active when it is completely dead.

6. **[HIGH] Muse EEG in Verification (`TapSessionSignals`) never uploads EEG PoW**
   - **Where:** `components/session-view/session-signals.tsx:58-200`.
   - **Why it matters:** `TapSessionSignals` connects to the Muse headband and displays live waveforms / updates `enforcedChannels.muse` liveness, but unlike deleted Learn `use-session-runtime.ts`, **never uploads any `type="eeg"` rows to `proof_of_work`**. If a protocol enforces Muse EEG, EEG data is never persisted to the proof-of-work record.

7. **[HIGH] Severe component bloat, ref mirroring, and coupling between Canvas UI and Logging**
   - **Where:** `components/ExcalidrawCanvas.tsx` (1,146 LOC: 12 `useState`, **40 `useRef`**, 20 `useEffect`, 13 `useCallback`), `components/TapScoreClient.tsx` (1,039 LOC: **31 `useState`**, 28 `useRef`, 16 `useEffect`), `components/tap-score/tap-score-phases.tsx` (948 LOC), `components/session-view/session-policy-context.tsx` (550 LOC, **10 separate React Contexts**).
   - **Why it matters:**
     - `ExcalidrawCanvas.tsx` mixes Excalidraw lifecycle workarounds (mount-wipe protection, viewport centering retry loops up to 40 `requestAnimationFrame`s), LaTeX & thinking-chip DOM overlays, keyboard shortcut routing, PNG export, slash-command bar, AND PoW diff collection (`IleWorkCanvasPowCollector`).
     - Calling `JSON.stringify(sceneData)` on a 250ms timer (`ExcalidrawCanvas.tsx:861`) AND deep-cloning scene elements on every `handleChange` and `pointerUp` (`sanitizeSceneData` + `snapshotIleWorkCanvasPowScene`) allocates heavily during fast freehand drawing (`draw_freedraw`).
     - Re-render hazard: `tap-score-phases.tsx:520-528` calls `setWorkCanvasScene(scene)` on every debounced scene change, re-rendering the entire 948-LOC `TapScorePhases` tree even when nothing in the outer shell needs the scene object.
     - `ExcalidrawCanvas.tsx:542,771` and `TapScoreClient.tsx:656,779,800` carry `react-hooks/exhaustive-deps` lint warnings masking real stale-closure risk.

### 3.3 Medium (Inconsistent Naming, Duplication, Privacy & Missing Events)

8. **[MEDIUM] Inconsistent naming & dual payload schemas across PoW producers**
   - **Where:** `lib/learn-work-canvas-pow.ts` (`ile-canvas-*`, `toolName: "canvas"`), `lib/tap-work-canvas.ts` (`tap-canvas-*`), `lib/tap-score-traces.ts` (`thought-trace`, `session-chat`, `transcript`), `lib/tap-speech-proof-of-work.ts` (`speech`), `lib/tap-idle-proof-of-work.ts` (`idle`), `lib/flow-canvas-capture.ts` (`canvas_document`).
   - **Why it matters:** Some routes expect `payload` base64-encoded (`canvas`), some build JSON server-side (`speech`, `idle`, `trace`), some accept `data` OR `payload` with a brittle regex base64 sniffer (`app/api/verify/session/canvas/route.ts:56`), and 15+ files still carry `ile` / `Learn` prefixes (`learn-work-canvas-*`, `IleWorkCanvasPowEvent`, `IleProofOfWorkUploadItem`).

9. **[MEDIUM] Privacy & PII exposure in stored PoW blobs and metadata**
   - **Where:** `app/api/verify/session/speech/route.ts:85,128` (`transcript_snapshot` stored BOTH in xAI Files AND duplicated in plaintext inside `proof_of_work.metadata`), `app/api/verify/session/trace/route.ts:113-114` (`text` & `original_text` duplicated in `metadata`), `components/ExcalidrawCanvas.tsx` (pasted images / arbitrary text written on canvas captured in `canvas_document` Mermaid markdown when `canvasCapture` is enabled).
   - **Why it matters:** Duplicating full spoken transcripts and learner thought text inside `proof_of_work.metadata` JSONB makes Postgres rows bloated and bypasses BlobStore-only retention/redaction controls. Note: positively, `assertNoPersonMedia` (`lib/behavior-capture.ts`) correctly refuses audio/video binary blobs on PoW uploads.

10. **[MEDIUM] Missing high-signal verification events**
    - No capture for: **window blur / tab visibility loss** (`visibilitychange`, critical anti-cheating signal in verification), **clipboard paste** (`paste` onto canvas — high signal for AI copy-paste!), **undo/redo** (`Ctrl+Z`/`Ctrl+Y` — currently misclassified as `delete` or `draw_*` by scene diffing!), or **protocol start/end lifecycle markers** in `proof_of_work`.

11. **[LOW] Testability gaps**
    - While pure helpers (`learn-work-canvas-pow.ts`, `flow-canvas-capture.ts`, `tap-work-canvas.ts`) have strong unit tests, **zero DOM/integration tests** exercise `ExcalidrawCanvas.tsx` or `TapScoreClient.tsx` event lifecycles, unload flushing, or end-to-end `/v/[token]` PoW persistence.

---

## 4. Target Architecture Design

Replace the 5 separate per-event fetch paths + orphaned `BehaviorChunker` with a **single unified verification capture pipeline**:

1. **Single Typed Event Schema & Registry (`lib/verify-events/schema.ts`):**
   - Discriminated union `VerifyPowEvent` validated with Zod on both client and server:
     - `canvas.action` (`draw_*`, `erase`, `delete`, `move`, `rotate`, `multi_select`, `undo`, `redo`, `paste`, `command`, `dictate`)
     - `canvas.viewport` (`pan`, `zoom` — sampled/aggregated, NOT 1-to-1 BlobStore uploads)
     - `canvas.snapshot` (`canvas_document` Mermaid markdown on configured cadence)
     - `speech.segment` (`start`, `stop` with duration & transcript)
     - `thought.trace` (`system1.*`, `system2.*`)
     - `session.lifecycle` (`start`, `end`, `visibility_hidden`, `visibility_visible`, `purity_hit`, `idle_heartbeat`)
     - `sensor.eeg` (batched Muse quality/band-power windows when `enforcedChannels.muse` is enabled)
   - Every event carries `event_id` (UUID for server-side idempotency), `seq` (monotonic client sequence number), `session_id`, `timestamp_ms`, and typed `payload`.
2. **One Client Capture & Transport Module (`lib/verify-events/capture-client.ts`):**
   - Single in-memory FIFO ring buffer + batch flusher: flushes every **5 seconds OR 15 events** (and immediately on `thought.trace` / `canvas.snapshot` / `session.lifecycle` end) to a single batch endpoint **`POST /api/verify/session/events`**.
   - **Reliability:** Exponential backoff retry (up to 3 attempts) on 429/5xx/network errors; `pagehide` / `visibilitychange(hidden)` flush via `navigator.sendBeacon` (or `fetch(..., { keepalive: true })`); strict FIFO queue (eliminates the `speech_start` blocking `speech_stop` bug!).
   - **Storage efficiency:** Persist a **batch NDJSON/JSON array** as 1 BlobStore file + 1 `proof_of_work` batch row (or lightweight DB rows without uploading 200-byte viewport events to xAI Files!), cutting BlobStore API calls by **10–20×**.
3. **Clean Separation of Canvas UI vs Logging:**
   - `ExcalidrawCanvas.tsx` becomes a pure controlled/imperative canvas component emitting a single `onCanvasEvents(events: CanvasDomainEvent[])` callback — zero knowledge of PoW upload formats, `behaviorBoardSampler`, or API paths.
   - Extract `ExcalidrawCanvas` into 3 focused units: `CanvasHost` (Excalidraw mount + viewport), `CanvasOverlays` (LaTeX + thinking chips + command bar), and `CanvasEventObserver` (diff collector + paste/undo/visibility listeners).

---

## 5. Prioritized Refactor Plan

| Priority | Item | Goal | Files Affected | Effort / Scope | Risk | Verification |
|---|---|---|---|---|---|---|
| **P0-1** | **Fix verification branch-model & policy-infer endpoints** | Re-mount verification-only `/api/verify/session/branch-model` and `/api/verify/session/policy-infer` and repoint `lib/session-branch-field-load.ts` & `lib/session-policy-infer-client.ts`. | 2 new API routes + 2 `lib/` files + API route tests | **S** (4–6 files) | **Low** — restores broken verification start flow | Smoke-test `/v/[token]` start + unit test 200 responses |
| **P0-2** | **Fix `PROOF_OF_WORK_SELECT` & workspace_id filters** | Remove `workspace_id, block_id` from `lib/pow-api/workspace-proof-of-work.ts:193-194,241` and `lib/tap-score-traces.ts:185` so `proof_of_work` inserts work after DB cleanup. | 2 `lib/` files + unit test | **XS** (2 files) | **Low** — prevents guaranteed 42703 DB failure | Run against local PG16 `openlesson_clean` + `npm run test` |
| **P0-3** | **Fix public `/v/[token]` session auth for live PoW** | Return real `sessionId` + scoped session token from `POST /api/verification-flow/public/[token]` claim and pass into `TapScoreClient` so canvas/speech/trace/Mermaid capture persist on public protocol runs. | `VerificationFlowRunner.tsx`, `app/api/verification-flow/public/[token]/route.ts`, `use-tap-score-flow.ts`, `lib/tap-score-session-auth.ts` | **S** (4 files) | **Medium** — touches public claim auth | Integration test claiming `/v/[token]` and posting canvas + speech PoW with 201 status |
| **P1-1** | **Introduce unified `VerifyPowEvent` schema + batched `CaptureClient` + `POST /api/verify/session/events`** | Replace per-event fire-and-forget POSTs (and fix the speech `inFlightRef` drop race) with a typed, ordered, retrying, `sendBeacon`-flushing batch pipeline; add `paste` and `visibilitychange` capture. | `lib/verify-events/*` (new), `app/api/verify/session/events/route.ts` (new), `tap-score-phases.tsx`, `useTapSpeechProofOfWork.ts`, `useTapIdleProofOfWork.ts` | **M** (8–12 files) | **Medium** — keep legacy endpoints as thin adapters during cutover | Unit tests for batching, retry, speech start/stop ordering, unload beacon, idempotency |
| **P1-2** | **Remove orphaned `behavior-capture-*` runtime wiring (keep `assertNoPersonMedia`)** | Delete dead `BehaviorChunker`/`BehaviorBoardSampler`/`behavior-capture-house.ts` calls from `ExcalidrawCanvas.tsx`, `useSessionThoughtInterface.ts`, and `session-policy-context.tsx`; decide whether to wire Muse EEG upload into `CaptureClient`. | `lib/behavior-capture-{chunk,house,pointer,rollup}.ts`, `ExcalidrawCanvas.tsx`, `useSessionThoughtInterface.ts`, `session-policy-context.tsx`, `session-signals.tsx` | **S** (7–9 files) | **Low** — dead no-op path today | `npm run typecheck && npm run test` |
| **P2-1** | **Decompose `ExcalidrawCanvas.tsx` & `TapScoreClient.tsx` state** | Split `ExcalidrawCanvas.tsx` (1,146 LOC, 40 refs) into host/overlays/event-observer; move `TapScoreClient.tsx` (31 `useState`) phase/session state into a `useReducer` machine; remove `setWorkCanvasScene` outer re-renders on every keystroke. | `components/ExcalidrawCanvas.tsx`, `components/excalidraw-canvas/*`, `components/TapScoreClient.tsx`, `components/tap-score/*` | **L** (10–15 files) | **High** — sensitive Excalidraw & speech timing invariants; gate with DOM tests first | Unit tests on reducer + Playwright/manual canvas smoke tests |
| **P2-2** | **Eliminate `ile`/`learn-` naming residue & base64 sniffer** | Rename `lib/learn-work-canvas*` -> `lib/work-canvas/*`, remove retired command IDs from active types, replace regex base64 heuristic in `/api/verify/session/canvas`, and stop duplicating full transcripts inside `proof_of_work.metadata`. | `lib/learn-work-canvas*`, `app/api/verify/session/*`, `lib/tap-work-canvas.ts` | **M** (20+ files, mechanical) | **Low** — pure renames + explicit encoding field | `npm run check && npm run build` |
