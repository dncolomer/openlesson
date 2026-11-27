# Uncertain Systems

**A Human Learning Harness — verify without a test.**

Uncertain Systems is an open-source platform for knowledge acquisition and knowledge verification. Create **knowledge verification protocols** (`create_protocol` or cookie `POST /api/dashboard/protocols`) and **knowledge regions** (`create_knowledge_region` or the dashboard wizard). Agents integrate through `/api/v3/protocols`, `/api/v3/knowledge-regions`, plus MCP. Proof of work is recorded in the product UI.

Live at [uncertain.systems](https://uncertain.systems)

---

## About

Uncertain Systems is built by [Uncertain Systems](https://x.com/uncertainsys). The product is a **Human Learning Harness**: uncheatable proof that knowledge is actually held, without a tutor and without a quiz-in-isolation. The scientific policy underneath it is [epistemic foraging](https://uncertain.systems/science#science-epistemic-foraging): an active search for information that reduces uncertainty, rather than chasing test scores.

The hosted product is **Embeddable Knowledge Verification Protocols**. Knowledge Regions stay as regions (no type). A protocol runs The Protocol Challenge against a region and records proof of work.

## How It Works

1. **Create a protocol** — MCP `create_protocol` / REST `POST /api/v3/protocols` with `challenge` (The Protocol Challenge). Cookie dashboard remains `POST /api/dashboard/protocols`. Do not send `kind`.
2. **Read or update** — `get_protocol` / `update_protocol`. Upload context with `upload_protocol_file`; generate Unsys with `generate_protocol_unsys_seed`.
3. **Create a knowledge region** — `get_knowledge_region_options` then `create_knowledge_region` with `protocol_ids`, `strategy_ids`, and optional `ai_use_catalog_ids`. Cookie dashboard remains `/regions/new`.
4. **Learners run the protocol** in the product UI. Proof of work is recorded there.

Agents authorize with a Bearer key (ChatGPT, Claude, coding agents, or any MCP client) and use protocol and knowledge-region management. Snapshot, Stash, and headless proof-of-work are not public agent surfaces.

## Key Features

- **Embeddable Knowledge Verification Protocols** — public protocol runs with The Protocol Challenge
- **Knowledge Regions** — domain geometry for protocols, without a type field
- **Public agent APIs + MCP** — Protocol API (`/api/v3/protocols`) and Knowledge Regions API (`/api/v3/knowledge-regions`) with JSON-RPC at `/api/mcp` (Bearer or OAuth)
- **Knowledge map** — React Flow block graph, simulation, DAGs, learner mode
- **Muse EEG and face tracking** — optional biosignals on session proof of work
- **unsys** — practice dialogue in Learn sessions and workspace chat

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Database & Auth | Supabase (PostgreSQL + RLS + Auth) |
| LLM + STT + Files | xAI (api.x.ai) |
| Payments | Stripe |
| Graph Visualization | React Flow (@xyflow/react) |
| Code Editor | Monaco Editor |
| EEG | Muse headband via Web Bluetooth |
| Face Tracking | MediaPipe |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- An xAI API key (https://console.x.ai)

### Setup

1. Clone the repository:

```bash
git clone https://github.com/dncolomer/openlesson.git
cd openlesson
```

2. Install dependencies:

```bash
npm install
```

3. Copy the environment template and fill in your keys:

```bash
cp .env.local.example .env.local
```

Required environment variables:

| Variable | Description |
|---|---|
| `XAI_API_KEY` | xAI API key (cloud default for LLM, STT, files) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `NEXT_PUBLIC_APP_URL` | App URL (default: `http://localhost:3000`) |

Optional:

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key for payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `MCP_OAUTH_SECRET` | MCP OAuth signing secret (defaults to service role key in dev) |
| `SUPABASE_DB_URL` | Session-mode pooler URL for migration scripts |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | OpenAI-compatible Chat Completions (default: xAI) |
| `BLOB_STORE` / `BLOB_STORE_DIR` | `xai` (default) or `fs` with a disk directory for local/on-prem blobs |

4. Set up the database by running the schema in `supabase/schema.sql` against your Supabase project (or apply `supabase/migrations`).

5. Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Project Structure

```
├── app/                  # Next.js App Router pages & API routes
│   ├── api/              # REST/MCP routes (workspaces, Calibrate/Learn/Verify, PoW/Snapshot/Stash, admin)
│   ├── workspace/        # Workspace views; create at /workspace/new
│   ├── session/          # Learn tutoring session pages
│   ├── tap/              # Legacy Calibrate/Verify session redirects
│   ├── dashboard/        # User dashboard & API key management
│   └── docs/             # Interactive Learning Map API reference
├── components/           # React components
│   ├── SessionView.tsx   # Learn session UI
│   ├── WorkspaceView.tsx # Workspace shell (map vs Verification Workspace)
│   └── thought-ui/       # Shared dialogue / thought components
├── lib/                  # Product runtime (PoW, Calibrate/Learn/Verify, xAI, maps, billing)
│   ├── pow-api/          # PoW / Snapshot / Stash / MCP
│   ├── xai-client.ts     # xAI API client
│   └── workspace-kind.ts # standard vs knowledge_region
├── utilities/            # Operator CLIs (not product features) — see utilities/README.md
│   └── import-think-aloud-pow/
├── scripts/              # Ops: migrations, seeds, e2e, one-off backfills
├── docs/                 # Design notes and API docs
├── supabase/             # Database schema & migrations
├── tests/                # Vitest (tests/lib mirrors lib/; tests/utilities mirrors utilities/)
└── public/               # Static assets; skill.md for standard-workspace agent integrations
```

`utilities/` vs `scripts/`: new operator tools (think-aloud import) go in `utilities/<name>/`. `scripts/` is ops automation (DB, CI, seeds). Product code stays in `app/`, `components/`, and `lib/`.

## Operator utilities

These are **not** Calibrate/Learn/Verify/MCP features. Catalog and conventions: [`utilities/README.md`](utilities/README.md).

### Import think-aloud PoW (Learn Explore Solo)

Turns a think-aloud video or audio file into Learn Explore Solo proof of work. Persist is the default; `--dry-run` prints the event list.

```bash
npm run import:think-aloud-pow -- --media recording.mp4 --workspace <workspace-id>
npm run import:think-aloud-pow -- --media recording.mp4 --workspace <workspace-id> --dry-run
```

Requires `XAI_API_KEY` (STT + action inference). Persist also needs Supabase service-role env. Video stills need `ffmpeg`; without it, traces still write. Full flags: `npm run import:think-aloud-pow -- --help`.

## Public agent APIs (v3)

Uncertain Systems exposes **two** public agent families, with MCP parity at `POST /api/mcp`:

- **Protocol API** (`/api/v3/protocols`) — create, list, update, and delete knowledge verification protocols (`create_protocol`, `challenge`).
- **Knowledge Regions API** (`/api/v3/knowledge-regions`) — CRUD, simulation wizard, jobs, stored runs, candidate render, uncertainty-model walk.

Headless proof-of-work, Snapshot, and Stash are not public agent families. Generate an API key from the dashboard (`/dashboard`).

See [`public/skill.md`](public/skill.md), [`public/coding-agents.md`](public/coding-agents.md), [`docs/PROOF_OF_WORK_API.md`](docs/PROOF_OF_WORK_API.md), and [`docs/KNOWLEDGE_REGION_API.md`](docs/KNOWLEDGE_REGION_API.md). Interactive reference: [`/docs/proof-of-work-api`](/docs/proof-of-work-api).

## Uncertain Systems

Uncertain Systems is developed by **Uncertain Systems**, founded by [Daniel Colomer](https://x.com/uncertainsys). The mission is open infrastructure for verifying knowledge with proof of work — not quizzes in isolation.

- Website: [uncertain.systems](https://uncertain.systems)
- Twitter/X: [@uncertainsys](https://x.com/uncertainsys)
- Email: daniel@uncertain.systems

## License

Copyright Uncertain Systems (Daniel Colomer). All rights reserved.
