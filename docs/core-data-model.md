# Core data model: Learning Maps, Protocols, sessions, proof of work

This is the reconstruction contract for database, backend, and UI adapters.
The live product is **Embeddable Knowledge Verification Protocols**. Storage is
one Learning Map, one protocol table (`verify_flows`, presented as Protocols),
one session table (`learn` | `verify`), one proof-of-work table, verification
embeddings (`verify-flowcfg-v1-d96` / `flowcfg-v1-d96`), Knowledge Regions with
no type, and a raw corpus that can be backed up and re-embedded.

Pulled from staging Postgres on 2026-10-25 (project `zdlohvfhkepzvbtxguos`),
then collapsed to Protocols-only by `supabase/migrations/20261126120000_protocols_only.sql`.

## Why this exists

The product has three containers:

1. A **Learning Map** (`workspaces` + `blocks`). This is the only workspace.
2. A **Protocol** (stored in `verify_flows`). These are not workspaces. The
   former Topic/Problem field is **The Protocol Challenge**.
3. **Sessions** on a map or a protocol. One person, one run. Live kinds are
   `learn` | `verify`.

The moat is the **raw corpus**:

- every proof-of-work row (action, tool name, metadata, timestamps)
- the xAI File bytes those rows point at (transcripts, screens, video, EEG, JSON)
- the hidden-state tree used for that run (`field_model`)
- the typed session result (Distance on Verify)
- embeddings as **derived** artifacts, versioned per family, rebuildable

Embeddings can be thrown away and rebuilt. Proof of work and xAI files cannot.

## Key Decisions

1. **Only Learning Maps are workspaces.** Protocols are owner-scoped with
   public tokens. Staging already constrains `workspace_kind` to
   `standard` (`20261025180000_flow_owner_user.sql`).
2. **One `sessions` table** with `kind` `learn` | `verify`. Guest TAP/ILE tables
   dual-wrote, then dropped. Calibrate and Solve kinds are not live writers.
3. **Proof of work always belongs to a session.** Workspace and protocol ids are
   copied onto the row for listing. Product code never deletes proof-of-work
   rows or their xAI files. Session delete is restrict or archive-only.
4. **One embedding family** (`verify-flowcfg-v1-d96`, algorithm `flowcfg-v1-d96`).
   Registry table `embedding_models` keeps the verification row. Training for a
   later algorithm lives in the private repo `flowcfg-trained-v1` and must not
   mutate v1. CPU harness: `npm run corpus:harness`.
5. **Verify result** is the mapped path scored as Distance. Keep the result
   even without a dedicated results screen.
6. **Insight-crafting is gone.** There is no `insights` table and no Solve
   insight loop. Infer catalog action `insight` is a map tool, not that loop.
7. **Raw corpus export** is a first-class operator path: JSONL of sessions +
   proof of work + embedding metadata + xAI file ids, optional download of
   file bytes. Re-embed reads the corpus, not the previous vector.
8. **UI adapters.** Current Protocols, leftover Learn canvas kernel, Data Studio,
   and MCP screens keep working. No restyle in this plan.
9. **Protocols have no parent workspace.** `owner_user_id` is required. Optional
   `workspace_id` may remain as a topic pointer during dual-read, then drop.
10. **Knowledge Regions** stay named Knowledge Regions and have no type.

## Target tables

Keep: `profiles`, `organizations`, `organization_invites`,
`organization_guest_users`, `agent_api_keys`, MCP OAuth tables,
`pending_checkouts`,
`workspaces`, `blocks`,
`verify_flows` (presented as Protocols), `sessions`,
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

Protocols-only wipe (`20261126120000_protocols_only.sql`) drops `solve_flows`,
`calibrate_flows`, `insights`, leftover session kinds, knowledge-region
type/product columns, and non-verification embedding-model rows.

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

## Open Questions

None remaining from the cleanup conversation. Live defaults: one sessions
table, proof of work on the session, verification embeddings only, Protocols
without a parent workspace, `sessions.block_id` instead of `block_sessions`.

## Historical PR plan

Earlier reconstruction PRs dual-wrote Calibrate/Verify and three embedding
families. Those products are retired. Historical SQL files stay as history.
Do not `db:migrate` production from this environment unless asked.
Do not push unless asked.

UI adapters may keep older TypeScript names (`VerificationFlow`) while tables
stay `verify_flows` and the product name is Protocol.
`lib/rabbit-hole-expand.ts` (Expand-block question generation) is not the
Rabbit Hole game; keep it unless a later PR retires Expand.
