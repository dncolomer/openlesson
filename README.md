# Uncertain Systems

**A Human Learning Harness — verify without a test.**

Uncertain Systems is an open-source platform for knowledge acquisition and knowledge verification. Create a **Learning** or **Verification** workspace, then run Calibrate, Learn, or Verify headless. Agents integrate through two APIs — workspace management and headless proof-of-work — plus MCP.

Live at [uncertain.systems](https://uncertain.systems)

---

## About

Uncertain Systems is built by [Uncertain Systems](https://x.com/uncertainsys). The product is a **Human Learning Harness**: uncheatable proof that knowledge is actually held, without a tutor and without a quiz-in-isolation. The scientific policy underneath it is [epistemic foraging](https://uncertain.systems/science#science-epistemic-foraging): an active search for information that reduces uncertainty, rather than chasing test scores.

Workspaces come in two durable kinds:

- **Standard (map)** — blocks on a knowledge map, Calibrate / Learn / Verify practice links, and the full PoW → Snapshot loop.
- **Verification Workspace** (stored as `knowledge_region`) — Goals / Verification Flows / Context / Knowledge / Settings. Flows collect proof of work from a question pool and a per-flow agent skill. Context is the same notes, files, and links tab. This kind does not mint practice links.

## How It Works

1. **Create a workspace** via workspace management (`POST /api/v3/workspaces` / MCP `create_workspace`) — Learning or Verification — or in the product UI (`/workspace/new`).
2. **Run a flow headless** — `start_session` (calibrate | learn | verify) → `upload_proof_of_work` → `end_session`. The server prepares the answers-model tree, infers the path, and enforces the clock.
3. **Repeat** — more proof of work improves the inferred path. Regenerate the workspace `skill.md` as context grows.

Agents authorize with a Bearer key (ChatGPT, Claude, or any MCP client) and use only these two APIs. Snapshot and Stash are not public agent surfaces.

## Key Features

- **Verification workspaces** — assessable blocks, workspace goals, and continuous proof of work
- **Verification Workspace** — Goals / Verification Flows / Context / Knowledge / Settings; flow-scoped proof of work; custom knowledge regions and Data Studio. Does not mint knowledge links.
- **Headless proof-of-work** — `start_session` → `upload_proof_of_work` → `end_session` for Calibrate, Learn, and Verify (catalogs 4 / 8 / 16, session clock)
- **Public agent APIs + MCP** — workspace management (`/api/v3/workspaces`) and headless proof-of-work (`/api/v3/pow`) with JSON-RPC at `/api/mcp` (Bearer or OAuth)
- **Calibrate, Learn, and Verify** — practice sessions on standard workspaces (knowledge-link mint)
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
| LLM + STT + TTS + Images + Files | xAI (api.x.ai) |
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
| `XAI_API_KEY` | xAI API key (LLM, STT, TTS, images, files) |
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
│   └── docs/             # Interactive Proof-of-Work API reference
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

Uncertain Systems exposes **two** public agent APIs, with MCP parity at `POST /api/mcp`:

- **Workspace management** (`/api/v3/workspaces`, `/api/v3/account`) — create and edit Learning and Verification workspaces, the map, workspace settings, and account settings.
- **Headless proof-of-work** (`/api/v3/pow`) — `start_session` (calibrate | learn | verify) → `upload_proof_of_work` → `end_session`.

Snapshot and Stash are product-UI routes, not public agent families. Generate an API key from the dashboard (`/dashboard`).

See [`public/skill.md`](public/skill.md) and [`docs/PROOF_OF_WORK_API.md`](docs/PROOF_OF_WORK_API.md). Interactive reference: [`/docs/proof-of-work-api`](/docs/proof-of-work-api). Download a **workspace-scoped** skill.md from Settings → Integration.

## Uncertain Systems

Uncertain Systems is developed by **Uncertain Systems**, founded by [Daniel Colomer](https://x.com/uncertainsys). The mission is open infrastructure for verifying knowledge with proof of work — not quizzes in isolation.

- Website: [uncertain.systems](https://uncertain.systems)
- Twitter/X: [@uncertainsys](https://x.com/uncertainsys)
- Email: daniel@uncertain.systems

## License

Copyright Uncertain Systems (Daniel Colomer). All rights reserved.
