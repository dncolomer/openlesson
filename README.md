# Uncertain Systems

**A Human Learning Harness — verify without a test.**

Uncertain Systems is an open-source platform for knowledge acquisition and knowledge verification. Create a **Verification Workspace**, stream **proof of work**, and score readiness with an **LWM Snapshot**. Agents integrate through the Proof-of-Work API, Snapshot API, TAPBench Stash API, and MCP — the same loop the product UI uses.

Live at [uncertain.systems](https://uncertain.systems)

---

## About

Uncertain Systems is built by [Uncertain Systems](https://x.com/uncertainsys). The product is a **Human Learning Harness**: uncheatable proof that knowledge is actually held, without a tutor and without a quiz-in-isolation.

Workspaces come in two durable kinds:

- **Standard (map)** — blocks on a knowledge map, TAP / ILE practice links, TAPBench agent sessions, and the full PoW → Snapshot loop.
- **Knowledge Region** — Goals / Knowledge / Settings shell. Proof of work is produced **outside** the map (partner tools, TAPBench Stash). Agents use the **PoW API + TAPBench Stash API**, not guest-link mint.

## How It Works

1. **Create a workspace** in the product UI (`/workspace/new`) — blank map, template, or Knowledge Region. Workspace create is UI-only; there is no `POST /workspaces` or MCP `create_workspace`.
2. **Collect proof of work** — upload tool/screen/video/EEG artifacts (`POST .../proof-of-work`), or buffer via TAPBench Stash then stash/submit (`/api/v3/stash`).
3. **Snapshot** — call `lwm_snapshot` (REST `POST .../lwm-snapshot`) for a 0–100 LWM Snapshot + GHC, spider markers, gaps, and next actions. Optional world model, knowledge config, distance, and custom regions live under `/api/v3/snapshot`.
4. **Repeat** — more proof of work improves evaluation. Re-fetch the PoW schema and regenerate the workspace `skill.md` as context grows.

On **standard** workspaces you can also mint TAP / ILE / TAPBench knowledge links for human or agent sessions. **Knowledge Region** workspaces do not mint those links; their agent path is PoW capture plus TAPBench Stash.

## Key Features

- **Verification workspaces** — assessable blocks, workspace goals, and continuous proof of work
- **Knowledge Region workspaces** — Goals / Knowledge / Settings; external PoW; custom knowledge regions and Data Studio
- **LWM Snapshot** — sole product score strategy (`lwm_snapshot` / `POST .../lwm-snapshot`); GHC is secondary on the same report
- **Proof-of-Work API + MCP** — REST under `/api/v3/{pow,snapshot,stash}` with JSON-RPC at `/api/mcp` (Bearer or OAuth)
- **TAPBench Stash** — `buffer_proof_of_work` / `stash_proof_of_work` / `submit_stashed_proof_of_work` for agent PoW
- **Think Aloud Protocol (TAP) and ILE** — practice sessions on standard workspaces (knowledge-link mint)
- **Knowledge map** — React Flow block graph, simulation, DAGs, learner mode
- **Muse EEG and face tracking** — optional biosignals on session proof of work
- **Helios** — Socratic companion in session and workspace chat

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
│   ├── api/              # 162 route.ts handlers (workspaces, TAP/ILE, PoW/Snapshot/Stash, MCP, admin)
│   ├── workspace/        # Workspace views; create at /workspace/new
│   ├── session/          # ILE tutoring session pages
│   ├── tap/              # Think Aloud Protocol sessions
│   ├── tapbench/         # TAPBench agent sessions
│   ├── dashboard/        # User dashboard & API key management
│   └── docs/             # Interactive Proof-of-Work API reference
├── components/           # React components (~212 TSX files)
│   ├── SessionView.tsx   # ILE session UI
│   ├── WorkspaceView.tsx # Workspace shell (map vs Knowledge Region)
│   ├── WorkspaceIntegrationPanel.tsx  # Settings → Integration (skill.md + MCP)
│   └── thought-ui/       # Shared dialogue / thought components
├── lib/                  # Core libraries (~392 TS modules)
│   ├── xai.ts            # LLM orchestration
│   ├── xai-client.ts     # xAI API client
│   ├── workspace-kind.ts # standard vs knowledge_region
│   ├── pow-api/          # PoW / Snapshot / Stash / MCP (/api/v3/{pow,snapshot,stash}, /api/mcp)
│   └── ...
├── supabase/             # Database schema & migrations
├── tests/lib/            # Vitest unit tests (lib-focused)
└── public/               # Static assets; skill.md for standard-workspace agent integrations
```

## Proof-of-Work, Snapshot, and Stash APIs (v3)

Uncertain Systems exposes a scoped REST API and MCP transport for integrators and agents. **Workspaces are created in the product UI** (`/workspace/new`) — not via API or MCP. Generate an API key from the dashboard (`/dashboard`) and use it to:

- List and read existing verification workspaces, blocks, and learning progress
- Upload proof-of-work artifacts (`POST .../proof-of-work`) and fetch the live PoW schema
- Request LWM Snapshot / world model / knowledge config (`/api/v3/snapshot`)
- Buffer agent PoW via TAPBench Stash (`buffer_proof_of_work` / `stash_proof_of_work` / `submit_stashed_proof_of_work` under `/api/v3/stash`)
- Connect via MCP (`POST /api/mcp`, Bearer or OAuth) with parity to public agent REST

On **standard** workspaces, mint TAP and TAPBench knowledge links via `POST .../tap-links` / `POST .../tapbench-links` (MCP `create_tap_link` / `create_tapbench_link`). **Knowledge Region** skill.md and Integration MCP copy omit those mint endpoints — agents there use PoW + Snapshot + TAPBench Stash only. Mint APIs still 403 if called against a Knowledge Region workspace.

See [`public/skill.md`](public/skill.md) (global catalog, includes mint tools for standard workspaces) and [`docs/PROOF_OF_WORK_API.md`](docs/PROOF_OF_WORK_API.md). Interactive reference: [`/docs/proof-of-work-api`](/docs/proof-of-work-api). Download a **workspace-scoped** skill.md from Settings → Integration.

## Uncertain Systems

Uncertain Systems is developed by **Uncertain Systems**, founded by [Daniel Colomer](https://x.com/uncertainsys). The mission is open infrastructure for verifying knowledge with proof of work — not quizzes in isolation.

- Website: [uncertain.systems](https://uncertain.systems)
- Twitter/X: [@uncertainsys](https://x.com/uncertainsys)
- Email: daniel@uncertain.systems

## License

Copyright Uncertain Systems (Daniel Colomer). All rights reserved.
