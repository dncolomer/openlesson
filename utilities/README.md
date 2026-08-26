# Operator utilities

Private CLIs for operators. **Not product features** — they do not appear in TAP/ILE UI, MCP, REST catalogs, or `skill.md`.

Each utility is a folder. Pipeline code lives with the CLI so it is not mixed into `lib/` (product runtime). Tests live under `tests/utilities/`.

`scripts/` stays for ops: migrations, seeds, e2e, Vercel/Supabase one-offs.

## Convention for a new utility

1. Add `utilities/<name>/` with a `main.ts` entry (vite-node + `vitest.config.ts` so `@/` resolves).
2. Load `.env.local` via `scripts/db-connection.mjs` `loadEnvFile` when the tool talks to xAI or the DB.
3. Reuse `lib/` product helpers (`uploadWorkspaceProofOfWork`, TAP/ILE trace builders, TAPBench stash). Do not fork persist paths.
4. Wire an npm script in `package.json`.
5. Add a row to the table below and a short section in the root README if operators will run it.

Next likely occupant: TAPBench operator helpers (session bootstrap, stash/submit from fixtures). Same rules — no MCP/UI surface unless we explicitly promote one.

## Catalog

| Utility | npm script | What it does |
|---|---|---|
| [`import-think-aloud-pow`](import-think-aloud-pow/) | `npm run import:think-aloud-pow` | Video/audio think-aloud → ILE Explore Solo PoW |

## `import-think-aloud-pow`

Turns a think-aloud **video or audio** recording into **ILE Explore Solo** proof of work (`session_mode: project`). No TAP. No Helios chat. No review prompts.

```bash
# persist (default)
npm run import:think-aloud-pow -- --media recording.mp4 --workspace <workspace-id>

# inspect events only
npm run import:think-aloud-pow -- --media recording.mp4 --workspace <workspace-id> --dry-run

# skip STT (word-level JSON fixture)
npm run import:think-aloud-pow -- --transcript tests/fixtures/think-aloud-transcript.json --workspace <workspace-id> --dry-run
```

| Flag | Required | Notes |
|---|---|---|
| `--media` | unless `--transcript` | Video or audio. xAI STT. |
| `--workspace` | yes | Workspace UUID. |
| `--transcript` | no | Word-level JSON (`words: [{ text, start, end }]` in seconds). |
| `--session` | no | ILE session UUID (generated if omitted). |
| `--block` | no | Block UUID. |
| `--dry-run` | no | Print timeline JSON; do not write PoW. |
| `--help` | no | Usage. |

**Needs:** `XAI_API_KEY` for STT and System 2 inference. Persist also needs `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Video stills need `ffmpeg` on PATH; without it, traces still persist and frames are skipped.

**What is written:** `ile-speech-segment`, `ile-thought-trace` (System 1 for every utterance; inferred System 2 promote / `end_of_chain_of_thought`), `ile-idle-heartbeat`, event stills as `type: screen`. Optional short `type: video` if the file is ≤10 MB. Never `type: speech`. Never LWM Snapshot.

Entry: `utilities/import-think-aloud-pow/main.ts`.
