# Core data model: Learning Maps, flows, sessions, proof of work

This is the reconstruction contract for database, backend, and UI adapters.
The live session and Data Studio screens stay. Storage becomes one Learning Map,
two product flows, one session table, one proof-of-work table, versioned
embeddings, and a raw corpus that can be backed up and re-embedded.

Pulled from staging Postgres on 2026-10-25 (project `zdlohvfhkepzvbtxguos`),
not from migration files.

## Why this exists

The product has three containers:

1. A **Learning Map** (`workspaces` + `blocks`). This is the only workspace.
2. A **Calibrate flow** and a **Verify flow**. These are not workspaces.
3. **Sessions** on any of those three. One person, one run.

The moat is the **raw corpus**:

- every proof-of-work row (action, tool name, metadata, timestamps)
- the xAI File bytes those rows point at (transcripts, screens, video, EEG, JSON)
- the hidden-state tree used for that run (`field_model`)
- the typed session result (Distance, sounding classification, insights)
- embeddings as **derived** artifacts, versioned per family, rebuildable

Embeddings can be thrown away and rebuilt. Proof of work and xAI files cannot.

## Key Decisions

1. **Only Learning Maps are workspaces.** Calibrate and Verify are owner-scoped
   flows with public tokens. Staging already constrains `workspace_kind` to
   `standard` (`20261025180000_flow_owner_user.sql`).
2. **One `sessions` table** with `kind` `learn` | `calibrate` | `verify`. Guest
   TAP/ILE tables dual-write, then drop.
3. **Proof of work always belongs to a session.** Workspace and flow ids are
   copied onto the row for listing. Product code never deletes proof-of-work
   rows or their xAI files. Session delete is restrict or archive-only.
4. **Three embedding families, same algorithm at v1** (`flowcfg-v1-d96`).
   Registry table `embedding_models` lets Calibrate, Learn, and Verify version
   independently. Stored vectors stay on `flowcfg-v1-d96` until a family ships
   its own algorithm.
5. **Calibrate result** is the sounding band already computed in
   `lib/calibrate-sounding.ts` (`unranked` | `lost` | `localized` | `coverage`),
   the uncertain/trusted question ids, and an optional one-step expert proof.
   That JSON is no longer stuffed inside `workspace_calibration_proofs.events`.
6. **Verify result** is the mapped path scored as Distance. Keep the result
   even without a dedicated results screen.
7. **Insights** stay, Learn sessions only.
8. **Raw corpus export** is a first-class operator path: JSONL of sessions +
   proof of work + embedding metadata + xAI file ids, optional download of
   file bytes. Re-embed reads the corpus, not the previous vector.
9. **UI adapters.** Current Calibrate, Learn, Verify, Data Studio, All You Can
   Learn, and MCP screens keep working. No restyle in this plan.
10. **Flows have no parent workspace.** `owner_user_id` is required. Optional
    `workspace_id` may remain as a topic pointer during dual-read, then drop.

## Target tables

Keep: `profiles`, `organizations`, `organization_invites`,
`organization_guest_users`, `agent_api_keys`, MCP OAuth tables,
`pending_checkouts`, `aycl_purchases`, `aycl_complimentary_links`,
`workspaces`, `blocks`, `calibrate_flows` (today `workspace_calibration_flows`),
`verify_flows` (today `workspace_verification_flows`), `sessions`, `insights`,
`embedding_models`, `session_embeddings` (today `workspace_flow_embeddings`),
`knowledge_regions` (today `custom_verification_models`), `proof_of_work`
(today `workspace_proof_of_work`).

Drop (empty leftover products): `partners`, `partner_referrals`,
`partner_revenue`, `agent_proofs`, `agent_proof_batches`,
`user_solana_wallets`, `map_type_library`, `agent_assistant_conversations`.

Drop after code is gone: `rabbit_hole_*`, `leads`, `map_ready_notify_requests`,
`probes`, `session_audio`, `session_transcript`, `session_screenshots`,
`session_tool`, `session_eeg`, `session_facial`, `session_analysis`,
`session_plans`, `workspace_files`, `workspace_external_resources`,
`workspace_goals`, `block_goals`, `workspace_headless_sessions`,
`workspace_calibrate_sessions`, `workspace_verify_sessions`,
`workspace_learn_links`, `workspace_calibration_identities`,
`workspace_verification_identities`, `workspace_calibration_proofs`
(after results live on `sessions.result`).

## Typed contract

Canonical TypeScript lives in `lib/core-data-model.ts`. Session corpus
(export, backup, re-embed) lives in `lib/session-corpus.ts`.

Proof-of-work types stay `tool` | `screen` | `video` | `eeg`. Binaries live on
xAI Files (`xai_file_id`). The database stores the pointer and the action
metadata.

A finished run writes:

1. `sessions.result` (typed)
2. `sessions.field_model` (hidden-state tree used at birth — required to retrain Path)
3. `proof_of_work` rows (already written during the run)
4. `session_embeddings` derived from (2) + (3) under a registry model id

Re-embed: load corpus → `completeFlowEmbedding` / family model → insert a new
embedding row. Never overwrite proof of work.

## Calibrate result (what staging actually stores today)

`workspace_calibration_proofs.events` currently holds a JSON **string** inside
one `sounding` event: band, coverage depth, reliability, taps, proof choice.
Promote that to `sessions.result` as `CalibrateResult`.

## Open Questions

None remaining from the cleanup conversation. Six defaults already accepted
unless a later PR says otherwise: one sessions table, proof of work on the
session, three embedding families with a shared v1 algorithm, sounding band as
the Calibrate classification, flows without a parent workspace, `sessions.block_id`
instead of `block_sessions`.

## PR Plan

### PR 1: Add the core data-model types and this contract

- **Files/components affected:** `docs/core-data-model.md`, `lib/core-data-model.ts`, `tests/lib/core-data-model.test.ts`
- **Dependencies:** None
- **Description:** Add the typed contract (session kinds, results, proof of work, embedding models, knowledge regions) and freeze it with tests. No runtime writers change. No schema drop.

### PR 2: Add the session corpus backup and re-embed path

- **Files/components affected:** `lib/session-corpus.ts`, `tests/lib/session-corpus.test.ts`, `scripts/backup-session-corpus.ts`, `scripts/reembed-session-corpus.ts`, `package.json`, `lib/xai-files.ts`
- **Dependencies:** PR 1
- **Description:** Define a corpus record (session, field model, result, proof-of-work pointers, xAI file ids, embedding metadata). Operator script dumps JSONL + optional xAI file bytes. Re-embed rebuilds vectors from the corpus using the current algorithm, without reading the previous vector. This is the moat: raw data stays exportable for future models.

### PR 3: Registry embedding models, session kind columns, drop empty leftover tables

- **Files/components affected:** `supabase/migrations/20261025200000_core_data_model_foundation.sql`, `lib/flow-embedding.ts`, `lib/core-data-model.ts`, `scripts/verify-rls-policies.mjs`, `tests/lib/core-data-model.test.ts`
- **Dependencies:** PR 2
- **Description:** Create `embedding_models` with three v1 rows (learn/calibrate/verify, algorithm `flowcfg-v1-d96`). Add `sessions.kind`, `sessions.result`, `sessions.field_model`, `sessions.block_id`, flow ids, `workspace_flow_embeddings.session_id`. Drop empty leftover tables with no remaining writers: partners, Solana proofs, map type library, agent assistant conversations. Do not drop tables that still have `.from()` writers.

### PR 4: Delete Rabbit Hole, leads, and Map of Knowledge notify

- **Files/components affected:** `app/rabbit-hole/**`, `app/api/rabbit-hole/**`, `lib/rabbit-hole.ts`, `lib/map-of-knowledge/map-ready-notify-store.ts`, `scripts/import-rabbit-hole-questions.mjs`, `supabase/migrations/20261025210000_drop_rabbit_hole_leads_notify.sql`, related tests, `package.json` import script, `profiles` bonus columns
- **Dependencies:** PR 3
- **Description:** Remove the Rabbit Hole product, marketing leads, and map-ready notify. Drop those tables. Leave sounding “rabbit-hole” tap rules in Calibrate (different concept).

### PR 5: Point leftover media writers at proof of work and drop sensor tables

- **Files/components affected:** `lib/storage/media.ts`, `app/api/session-files/upload/route.ts`, `lib/storage/sessions.ts`, `scripts/verify-rls-policies.mjs`, `supabase/migrations/20261025220000_drop_session_sensor_tables.sql`
- **Dependencies:** PR 3
- **Description:** Session audio, transcript, screenshots, tool, EEG, facial, and analysis writes go to `workspace_proof_of_work` with an xAI file id. Then drop the per-sensor tables. Probes go with this PR if nothing else writes them.

### PR 6: Remove Context files, Dantes resources, goals, and session plans

- **Files/components affected:** `app/api/workspace/files/route.ts`, `app/api/workspace/external-resources/route.ts`, `lib/storage/session-plans.ts`, workspace Context UI, Goals panels, `supabase/migrations/20261025230000_drop_context_goals_session_plans.sql`
- **Dependencies:** PR 3
- **Description:** Unhook writers and screens for workspace files, Dantes links, workspace/block goals, and session plans. Drop those tables. Context notes on `workspaces.notes` stay. Map types stay on `workspaces.workspace_map_types`.

### PR 7: Dual-write unified sessions and typed results

- **Files/components affected:** `lib/storage/sessions.ts`, `lib/guest-session-tables.ts`, `lib/calibration-flow-repository.ts`, `lib/verification-flow-repository.ts`, `lib/flow-embedding-store.ts`, `lib/pow-api/headless-session.ts`, Calibrate/Verify complete routes
- **Dependencies:** PR 3
- **Description:** Every new Learn, Calibrate, Verify, and headless run writes `sessions` with `kind`, parent ids, `result`, and `field_model`. Proof of work sets `session_id`. Embeddings set `session_id`. Guest tokens live on the session. Keep TAP/ILE tables readable until the next PR.

### PR 8: Drop TAP/ILE session tables, identity tables, block_sessions, and headless cache

- **Files/components affected:** `supabase/migrations/20261025240000_drop_legacy_session_tables.sql`, `lib/guest-session-tables.ts`, TAP/ILE link mint routes, `lib/block-previous-sessions.ts`
- **Dependencies:** PR 7
- **Description:** After dual-read is gone, drop `workspace_calibrate_sessions`, `workspace_verify_sessions`, `workspace_learn_links`, identity tables, `workspace_calibration_proofs` (moved to `sessions.result`), `block_sessions`, `workspace_headless_sessions`. Guest URLs keep working via `sessions.private_token_hash`.

### PR 9: Rename knowledge regions and attach them to a model plus a map or a flow

- **Files/components affected:** `lib/knowledge-config/custom-verification-model.ts`, `lib/pow-api/custom-verification-model-crud.ts`, `supabase/migrations/20261025250000_knowledge_regions.sql`, Data Studio region loaders
- **Dependencies:** PR 3
- **Description:** Treat `custom_verification_models` as knowledge regions in code. Require a registry `embedding_model_id`. Attach to a workspace or a Calibrate/Verify flow. Stop using the 64-dimension `knowledgecfg-v1-d64` default. Do not treat old 64-dimension rows as live Path points. UI names stay Knowledge Region.

## Implementation notes

- Historical SQL files stay. Each drop is its own forward migration.
- Do not `db:migrate` production from this environment unless asked.
- Do not push unless asked.
- UI adapters may keep old TypeScript names (`CalibrationFlow`, `VerificationFlow`) while tables rename.
- `lib/rabbit-hole-expand.ts` (Expand-block question generation) is not the Rabbit Hole game; keep it unless a later PR retires Expand.
