# Code Review & Improvement Plan — Knowledge Region Simulations & OpenRouter AI-Use Harness

> **Scope:** Read-only review of behaviour simulation (`lib/region-simulation.ts`, `lib/region-simulation-actor.ts`, `lib/region-simulation-board.ts`, `lib/region-simulation-clock.ts`, `lib/region-simulation-occupancy.ts`, `lib/region-simulation-run.ts`, `lib/region-simulation-persist.ts`), durable jobs & Vercel Cron (`lib/region-simulation-jobs.ts`, `lib/region-simulation-flags.ts`, `app/api/cron/region-simulation-drain/route.ts`, `app/api/dashboard/region-simulation/**`, `app/api/v3/knowledge-regions/**`, `app/api/lti/region-simulation/route.ts`, `vercel.json`), and the OpenRouter AI-use simulation harness (`lib/ai/openrouter.ts`, `lib/region-simulation-ai-use-catalog.ts`, `lib/region-simulation-harness.ts`, `components/product-flow/region-simulation-setup.tsx`) on branch `cursor/quality-full-refactor-plan-0a58` (commit `30e8c712`).
>
> **Note:** No application code was changed in this review. Embedding computation is treated strictly as an external remote HTTP service (`POST $FLOWCFG_EMBEDDINGS_BASE_URL/v1/embed`).

---

## Executive Summary

The region simulation subsystem combines two distinct simulation families behind a shared durable job queue (`public.region_simulation_jobs`) and a 1-minute Vercel Cron drainer (`vercel.json`):

1. **Exploration Strategy Simulations (`family: "exploration"`):** Deterministic synthetic runs across 5 built-in strategies (`exploit-heavy`, `information-seeking`, `novelty-seeking`, `balanced`, `narrow-and-deep`), executing either an abstract tree walk (`runRegionSimulationSample`) or a headless Excalidraw board actor (`runCanvasFaithfulExplorationSample`).
2. **AI-Use Simulations (`family: "ai_use"`):** Multi-round tool-calling OpenRouter runs across 5 cataloged models (`openai/gpt-4o-mini` low/high, `anthropic/claude-sonnet-4.5`, `google/gemini-2.5-flash`, `x-ai/grok-4.5`), checkpointed 1 LLM round per tick using an organization's sealed OpenRouter API key.

The architecture is thoughtfully split into checkpointable ticks with `after()` chaining and cron fallback, **but our audit uncovered 4 Critical and 6 High production-impacting defects** spanning broken USD cost capping, non-atomic job leasing (double billing & duplicate rows), multi-org API key mix-ups, Vercel 60s serverless timeouts, OpenRouter parameter incompatibility, and low behavioral realism for calibration.

---

## 1. Architecture & Execution Flow

```
Trigger (Dashboard / v3 API / LTI)
  └─► enqueueRegionSimulation() ──► INSERT region_simulation_jobs (status="queued")
        └─► tickRegionSimulationJob(jobId) [sync or via Next.js after()]
              │
              ├─► family="exploration": 1 sample per tick
              │     ├─► walkExploration() -> remote POST /v1/embed -> session_embeddings
              │     ├─► persistRegionSimulationProof() -> N serial BlobStore puts + proof_of_work inserts
              │     └─► refreshAfterTick() -> recomputes ALL region clusters after EVERY sample
              │
              └─► family="ai_use": 1 OpenRouter tool round per tick (up to 24 rounds/sample)
                    ├─► loadOpenRouterApiKeyForOwnerUser(owner_user_id)
                    ├─► openRouterChatCompletions() (45s timeout × 2 attempts)
                    ├─► applyBoardOp() + inferOccupancyHid() -> save JSONB checkpoint
                    └─► On sample done: persistAiUseSample() + refreshAfterTick()

Background recovery:
  Vercel Cron (* * * * *) ──► GET /api/cron/region-simulation-drain (maxDuration=60)
    └─► drainRegionSimulationJobs(cap=10) ──► sequential loop awaiting tickRegionSimulationJob()
```

---

## 2. Detailed Findings (with File:Line & Severity)

### 2.1 Critical (Cost Safety, Concurrency, Multi-Org Billing & Timeouts)

1. **[CRITICAL] `$5` OpenRouter USD cost cap is completely ineffective — `usage.cost` is never requested**
   - **Where:** `lib/ai/openrouter.ts:125-130,163-179` and `lib/region-simulation-jobs.ts:517-519,553`.
   - **Why it matters:** `parseCost()` reads `payload.usage.cost`, **but OpenRouter only includes `usage.cost` when `usage: { include: true }` is sent in the request body**, which `openRouterChatCompletions()` omits. Consequently `result.costUsd` is always `0` in production, `job.cost_usd` stays `0`, and `if (job.cost_usd >= openRouterJobMaxUsd())` never fires — leaving an organization's OpenRouter balance uncapped during runaway or high-sample jobs.

2. **[CRITICAL] Non-atomic lease acquisition (TOCTOU race) causes duplicate OpenRouter spend & duplicate DB rows**
   - **Where:** `lib/region-simulation-jobs.ts:336-346` (`acquireLease`) and `lib/flow-embedding-store.ts:194` (`id: makeId()`).
   - **Why it matters:** `acquireLease()` performs a plain `SELECT`, checks `leaseExpired(job)` in JavaScript, and then executes an unconditional `UPSERT`. Because three independent callers trigger ticks concurrently — `after(() => tickRegionSimulationJob(id))`, client polling `POST /api/dashboard/region-simulation/jobs/[id]/tick`, and the 1-minute Vercel Cron — two invocations can both pass `leaseExpired()`, both acquire the lease, double-bill OpenRouter for the same round, and insert duplicate `session_embeddings` + `proof_of_work` rows (there is no `UNIQUE (owner_user_id, run_id)` constraint or idempotent upsert on `run_id`).

3. **[CRITICAL] Vercel 60s serverless timeout budget is routinely exceeded by cron drain, OpenRouter retries, and `after()` chaining**
   - **Where:** `app/api/cron/region-simulation-drain/route.ts:8` (`maxDuration = 60`), `lib/region-simulation-jobs.ts:50-52,619-647`, `app/api/dashboard/region-simulation/jobs/[id]/tick/route.ts:13,39-42`, `lib/ai/openrouter.ts:9-10,183-191`.
   - **Why it matters:**
     - **Single OpenRouter call can exceed 60s:** `OPENROUTER_ROUND_TIMEOUT_MS = 45_000` × `OPENROUTER_MAX_ATTEMPTS = 2` = up to **90s** inside a `maxDuration = 60` route.
     - **Cron drain loops sequentially up to 10 jobs (`lib/region-simulation-jobs.ts:640-645`):** Even 2 AI-use jobs taking 35s each kill the cron invocation mid-flight at 60s, stranding jobs in `status="running"` until their 55s lease expires.
     - **`after()` shares the route's 60s budget (`tick/route.ts:39-40`):** Running one synchronous tick plus chaining another `tickRegionSimulationJob` in `after()` inside a single 60s serverless execution guarantees frequent mid-tick kills.

4. **[CRITICAL] Multi-org OpenRouter API key mismatch — bills or fails against the wrong organization**
   - **Where:** `lib/region-simulation-jobs.ts:520` (`loadOpenRouterApiKeyForOwnerUser(job.owner_user_id)`), `lib/organization/org-backend-runtime.ts:118-139`, and `app/api/dashboard/region-simulation/route.ts:35`.
   - **Why it matters:** `loadOpenRouterApiKeyForOwnerUser()` looks up `profiles.organization_id` instead of `job.plan.organizationId`. For any multi-organization user (supported since commit `2b2d8afc`), running a simulation in Org B while `profiles.organization_id` points to Org A — or switching active orgs while a durable job drains asynchronously — either fails with `OPENROUTER_ORG_KEY_MISSING` or **charges Org A's OpenRouter key for Org B's simulation**.

### 2.2 High (OpenRouter Compatibility, Reliability, Calibration Realism & Performance)

5. **[HIGH] OpenRouter `AI_USE_CATALOG` parameter incompatibilities cause 404/400 provider rejections**
   - **Where:** `lib/region-simulation-ai-use-catalog.ts:25-76` and `lib/ai/openrouter.ts:169-179`.
   - **Why it matters:** `openRouterChatCompletions` sets `provider: { require_parameters: true, data_collection: "deny" }`, `tool_choice: "required"`, AND `reasoning: { exclude: true, effort: "low" | "high" }`.
     - `openai/gpt-4o-mini` (catalog rows `gpt-mini-low` and `gpt-mini-high`, lines 26-44) is **not a reasoning model**; sending `reasoning.effort` alongside `require_parameters: true` causes OpenRouter to reject with HTTP `404 No endpoints found that can handle the requested parameters` (or makes `gpt-mini-low` and `gpt-mini-high` produce identical behavior if ignored!).
     - Combining `data_collection: "deny"` + `require_parameters: true` + `tool_choice: "required"` + `reasoning` on `google/gemini-2.5-flash` and `x-ai/grok-4.5` is similarly brittle when upstream OpenRouter provider availability shifts.

6. **[HIGH] Zero job-level retry & 0ms backoff on OpenRouter 429s — one transient blip kills an entire multi-minute job**
   - **Where:** `lib/region-simulation-jobs.ts:574-581` and `lib/ai/openrouter.ts:183-222`.
   - **Why it matters:**
     - In `openRouterChatCompletions`, a `429` or `502` retries **immediately with 0ms delay**, ignoring `Retry-After` headers.
     - In `tickRegionSimulationJob`, ANY error immediately flips `job.status = "failed"` permanently — discarding all remaining samples and any in-progress `checkpoint` without a per-item retry counter or partial-success continuation.

7. **[HIGH] Calibration realism & feature-flag gaps undermine usefulness of simulated regions**
   - **Where:** `lib/region-simulation-flags.ts:11-26`, `lib/region-simulation-actor.ts:56-115,148-219`, `lib/region-simulation-occupancy.ts:66-81`, `lib/region-simulation-harness.ts:32,239-245`, `lib/region-simulation-jobs.ts:190,369`.
   - **Why it matters:**
     - **Production defaults disable canvas-faithful and AI-use simulations:** `regionSimulationCanvasFaithfulEnabled()` and `regionSimulationAiUseEnabled()` return `false` when `NODE_ENV === "production"` unless `REGION_SIM_CANVAS_FAITHFUL=1` and `REGION_SIM_AI_USE=1` are explicitly set — meaning production exploration silently falls back to the non-canvas abstract tree walk (`runRegionSimulationSample`).
     - **Circular self-fulfilling exploration actor:** `pickExplorationOp` (`region-simulation-actor.ts:68-115`) literally writes `hidQuestion` and `cheapChildTitle` from the ground-truth branch model onto the simulated board, which `inferOccupancyHid` (`region-simulation-occupancy.ts:29-36,77`) then scores via token Jaccard similarity against the exact same branch text. Furthermore, `cheap` always commits after 1 draw of 12 words and `novel` always commits after 2 draws at fixed grid coordinates (`80 + 40 * slot`). This creates artificially tight, synthetic clusters that do not reflect messy human verification sessions.
     - **AI-use prompt models a "careful student", not AI-assisted cheating:** `lib/region-simulation-harness.ts:240-243` instructs the OpenRouter model: *"You are solving a problem on a Work canvas the way a careful student would. Use tools to draw, select, break down, and rewrite. Do not click hidden states."* First, *"Do not click hidden states"* leaks internal architecture jargon into the prompt. Second, if AI-use regions are intended to separate genuine human problem-solving from AI-assisted / copy-pasted behavior, prompting the LLM to imitate a "careful student" actively blurs the boundary between human and AI-use regions!
     - **Multi-protocol & multi-question truncation in AI-use:** `enqueueRegionSimulation` (`lib/region-simulation-jobs.ts:369`) silently truncates to `flows.slice(0, 1)` whenever `ai_use` is selected, and `buildAiUseJobItems` (`line 190`) only uses `input.flow.problems[0]` — ignoring all other protocols and questions in the wizard selection.
     - **`AI_USE_MAX_BOARD_STEPS` (16) is dead/unenforced:** Defined at `lib/region-simulation-harness.ts:32` but never checked in `runAiUseHarnessRound`, allowing a single OpenRouter response with 20 tool calls to exceed the intended step cap.

8. **[HIGH] O(N²) cluster recomputation & N serial BlobStore uploads inside every tick**
   - **Where:** `lib/region-simulation-jobs.ts:510,558,604-617` (`refreshAfterTick`) and `lib/region-simulation-persist.ts:50-92` (`persistRegionSimulationProof`).
   - **Why it matters:**
     - After **every single sample**, `refreshAfterTick` reloads all owner embeddings from Supabase, recomputes every strategy/AI-use cluster, and updates `knowledge_regions`. On a 60-sample job (5 strategies × 12 samples), clustering runs 60 times instead of once on completion (or every K samples).
     - `persistRegionSimulationProof` uploads every individual simulated PoW row serially to xAI Files (`store.put`) inside the tick (15–30 serial network roundtrips per sample) and swallows errors silently (`catch { /* embedding already stored */ }` at line 131).

### 2.3 Medium (Determinism, Secrets Hygiene, Idempotency & Test Coverage)

9. **[MEDIUM] Non-determinism & checkpoint bloat in AI-use simulations**
   - **Where:** `lib/ai/openrouter.ts:167` (`temperature: 0.2`, no `seed` passed even when supported), `lib/region-simulation-harness.ts:114-133,262` (`wallStartedAt: Date.now()`, wall-clock latency `result.wallMs` injected into simulated board clock via `advanceOpenRouterClock`), `lib/region-simulation-jobs.ts:242-265`.
   - **Why it matters:** Because real OpenRouter network latency (`wallMs`) drives `runtime.clockMs`, re-running an AI-use simulation with the same seed produces different dwell/timing PoW timestamps. Meanwhile, storing the entire `scene`, full `messages` transcript, and full `pow` array inside `region_simulation_jobs.checkpoint` JSONB causes multi-hundred-KB row rewrites on every tool round.

10. **[MEDIUM] Minor secrets & header hygiene smells in `lib/ai/openrouter.ts`**
    - **Where:** `lib/ai/openrouter.ts:79-85` (`openRouterHashSecret` falls back to hardcoded `"openlesson"` if encryption env vars are unset and truncates secret to 32 chars) and `lib/ai/openrouter.ts:98` (`HTTP-Referer` defaults to outdated `"https://openlesson.app"` instead of `"https://uncertain.systems"`).
    - **Why it matters:** Positive note: org OpenRouter API keys are properly AES-256-GCM sealed at rest (`lib/crypto/seal.ts`) and never logged or returned in public GET responses (`publicAiUseCatalog` omits slugs and keys). Cleaning up the HMAC fallback and referer header closes the remaining hygiene gaps.

11. **[MEDIUM] Legacy Learn code & post-DB-cleanup column references inside simulation modules**
    - **Where:** `lib/region-simulation-harness.ts:83,172,177` (still describes & branches on `flowKind !== "learn"` for `focus`/`next` commands even though Learn is removed), `lib/region-simulation-actor.ts:83-94` (`if (input.flowKind === "learn")`), `lib/region-simulation-board.ts:32` (`"verify" | "learn"`), and `lib/region-simulation-persist.ts:72` (calls `insertWorkspaceProofOfWorkRow`, which currently selects dropped `workspace_id, block_id` as noted in Part A).

12. **[MEDIUM] Test coverage gaps (1,255 LOC across 4 test files, but key failure modes untested)**
    - **Where:** `tests/lib/region-simulation.test.ts`, `region-simulation-openrouter.test.ts`, `region-simulation-actor.test.ts`, `region-simulation-board.test.ts`.
    - **What's missing:**
      - Zero tests for **concurrent lease contention** (`acquireLease` race between cron + `tick` route + `after()`).
      - Zero tests verifying `usage: { include: true }` / real OpenRouter cost-cap enforcement.
      - Zero tests for **multi-org OpenRouter key resolution** (`job.plan.organizationId` vs `profiles.organization_id`).
      - Zero tests for **transient OpenRouter 429/5xx retry + backoff** or **partial sample failure recovery** without killing the whole job.
      - Zero tests for `drainRegionSimulationJobs` time-budgeting under slow ticks.
      - `scripts/check-openrouter-catalog.ts` exists to validate catalog slugs against live OpenRouter, but is never run in CI or scheduled workflows.

---

## 3. Prioritized Improvement Plan

| Priority | Item | Goal | Files Affected | Effort / Scope | Risk | Verification |
|---|---|---|---|---|---|---|
| **P0-1** | **Fix OpenRouter cost accounting & enforce hard USD cap** | Send `usage: { include: true }` in `openRouterChatCompletions`, estimate conservative fallback cost from `usage.prompt_tokens`/`completion_tokens` if provider omits `usage.cost`, and atomically check/increment `cost_usd` before each round. | `lib/ai/openrouter.ts`, `lib/region-simulation-jobs.ts`, `tests/lib/region-simulation-openrouter.test.ts` | **S** (3 files) | **Low** — strictly safer billing guard | Unit test verifying `usage: { include: true }` in payload, fallback token pricing, and job stop at `$max` |
| **P0-2** | **Make lease acquisition atomic & add embedding idempotency** | Replace read-then-upsert `acquireLease()` with a single conditional SQL update (`WHERE status IN ('queued','running') AND (lease_until IS NULL OR lease_until < now())`) via RPC or Supabase filter + add unique/upsert guard on `(owner_user_id, run_id)` in `session_embeddings`. | `lib/region-simulation-jobs.ts`, `lib/flow-embedding-store.ts`, new migration + unit tests | **S** (4 files) | **Low** — prevents double billing & duplicate rows | Concurrency test spawning 5 parallel `tickRegionSimulationJob` calls and asserting exactly 1 executes |
| **P0-3** | **Fix multi-org OpenRouter key resolution** | Add `loadOpenRouterApiKeyForOrganization(admin, organizationId)` and pass `job.plan.organizationId` in `tickRegionSimulationJob` and `POST /api/dashboard/region-simulation` (falling back to owner's org only when `organizationId` is null). | `lib/organization/org-backend-runtime.ts`, `lib/region-simulation-jobs.ts`, `app/api/dashboard/region-simulation/route.ts`, `app/api/lti/region-simulation/route.ts` | **S** (4–5 files) | **Low** — fixes cross-org billing bug | Unit test with multi-org user verifying Org B's key is used regardless of active `profiles.organization_id` |
| **P0-4** | **Prevent 60s Vercel serverless timeouts in cron & tick routes** | 1) Lower `OPENROUTER_ROUND_TIMEOUT_MS` to `25_000` (max 1 retry = 50s, or 1 attempt per tick + job-level retry). 2) Add a `deadlineMs` wall-clock budget (~45s) in `drainRegionSimulationJobs` and tick jobs concurrently with bounded concurrency (`2–3`) instead of 10 sequentially. 3) Stop chaining a second full tick inside `after()` of `tick/route.ts` when remaining budget < 30s (let cron or lightweight self-trigger resume). | `lib/ai/openrouter.ts`, `lib/region-simulation-jobs.ts`, `app/api/cron/region-simulation-drain/route.ts`, `app/api/dashboard/region-simulation/jobs/[id]/tick/route.ts` | **M** (4–5 files) | **Medium** — tune lease (65s) > route maxDuration (60s) | Unit test with simulated slow 30s ticks verifying cron stops cleanly before 45s budget without stranding leases |
| **P1-1** | **Fix `AI_USE_CATALOG` model/parameter compatibility & verify via catalog check** | Replace `openai/gpt-4o-mini` reasoning-effort entries with actual reasoning models (or drop `reasoning` for non-reasoning models), remove `require_parameters: true` when optional reasoning fields are present, and wire `npm run check:openrouter-catalog` into weekly CI (when key available). | `lib/region-simulation-ai-use-catalog.ts`, `lib/ai/openrouter.ts`, `scripts/check-openrouter-catalog.ts` | **S** (3 files) | **Low** — eliminates OpenRouter 404 routing errors | Run `npm run check:openrouter-catalog` against OpenRouter API locally |
| **P1-2** | **Add per-item retry with backoff & batch cluster refreshes** | Track `item_attempts` on job checkpoint (retry transient 429/5xx up to 3 times with exponential backoff + `Retry-After` honoring before marking an individual sample failed and advancing cursor instead of aborting the whole job); move `refreshAfterTick` to run on job completion (plus optional every-N-samples checkpoint) instead of every single sample; batch simulated PoW proof persistence into 1 BlobStore file per sample instead of N serial uploads. | `lib/region-simulation-jobs.ts`, `lib/region-simulation-persist.ts`, `lib/ai/openrouter.ts` | **M** (4–5 files) | **Medium** — verify UI progress bar still updates smoothly via `job.progress` | Unit tests for 429 backoff, single-sample failure tolerance, and 1-file-per-sample PoW persist |
| **P1-3** | **Improve simulation prompts & behavioral realism for calibration** | 1) Align AI-use system prompts to realistic AI-assisted personas (e.g., direct AI-generated answer paste, iterative LLM-assisted steps) and remove internal jargon (`"Do not click hidden states"`). 2) Enforce `AI_USE_MAX_BOARD_STEPS`. 3) Support multi-question / multi-protocol spread in `buildAiUseJobItems`. 4) Revisit `regionSimulationCanvasFaithfulEnabled()` / `regionSimulationAiUseEnabled()` production defaults and make exploration actors vary step counts/revisions/noise rather than copying branch text verbatim. | `lib/region-simulation-harness.ts`, `lib/region-simulation-actor.ts`, `lib/region-simulation-jobs.ts`, `lib/region-simulation-flags.ts` | **M** (5–6 files) | **Medium** — re-validate separation between exploration and AI-use regions on staging after tuning | Run staging region simulation comparing human verification sessions vs updated exploration & AI-use clusters |
| **P2-1** | **Clean up Learn-era remnants & OpenRouter header/HMAC hygiene** | Remove `flowKind === "learn"` / `focus_note` / `next_note` branches in `region-simulation-{board,actor,harness}.ts`; update default `HTTP-Referer` to `https://uncertain.systems`; fail closed or warn in `openRouterHashSecret` in production. | `lib/region-simulation-{board,actor,harness}.ts`, `lib/ai/openrouter.ts` | **XS** (4 files) | **Low** — dead branches & header default | `npm run typecheck && npm run test` |
