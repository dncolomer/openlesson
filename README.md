# Uncertain Systems

**The AI Tutor That Listens to You Think**

Uncertain Systems is an open-source AI tutoring platform built on the Socratic method. Instead of giving answers, it listens to students reason aloud, detects gaps in their thinking in real-time, and asks targeted questions to deepen understanding.

Live at [uncertain.systems](https://uncertain.systems)

---

## About

Uncertain Systems (codename **Socrates**) is built by [Uncertain Systems](https://x.com/uncertainsys) — a project focused on building the open stack for educational technology.

The core thesis is simple: when you speak your reasoning out loud, gaps become audible — hesitations, contradictions, circular thinking, skipped steps, unexamined assumptions. Uncertain Systems uses LLMs to detect those gaps in real-time and responds not with answers, but with the right question at the right time.

## How It Works

1. **Think aloud** — Students speak their reasoning into the microphone while working through a problem or topic
2. **Gap detection** — Audio is streamed to an LLM that analyzes reasoning quality, scoring gaps on a 0–1 scale
3. **Socratic probes** — When gaps are detected, the AI generates targeted follow-up questions that expose hidden assumptions and push thinking deeper
4. **Adaptive planning** — Session plans adjust in real-time based on student progress

## Key Features

- **Audio-first tutoring** — Real-time analysis of spoken reasoning with configurable analysis intervals
- **Multi-session learning plans** — Directed graph of learning sessions for any topic, visualized with React Flow
- **Whiteboard canvas** — Built-in drawing tool; AI can analyze drawings for reasoning gaps
- **Notebook** — Text-based note-taking with AI gap analysis
- **Helios Chat** — Direct text conversation with Helios, your Socratic companion
- **Session reports** — AI-generated post-session reports covering gaps, progress, strengths, and next steps
- **Muse EEG integration** — Real-time brainwave monitoring via Muse headband over Web Bluetooth
- **Face tracking** — MediaPipe-based engagement and attention signals
- **Agent API** — Full REST API for AI agents to use Uncertain Systems as a skill programmatically
- **YouTube-based plans** — Generate structured learning plans from YouTube video URLs

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

4. Set up the database by running the schema in `supabase/schema.sql` against your Supabase project.

5. Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Project Structure

```
├── app/                  # Next.js App Router pages & API routes
│   ├── api/              # 123 API routes (ILE sessions, workspaces, TAP, agent v2, admin, demo)
│   ├── session/          # Active ILE tutoring session pages
│   ├── workspace/        # Workspace & block graph views (/plan/:id redirects here)
│   ├── tap/              # Think Aloud Protocol (TAP) scoring sessions
│   ├── dashboard/        # User dashboard & API key management
│   └── ...               # Other pages (pricing, docs, legal, platform)
├── components/           # React components (~109 TSX files)
│   ├── SessionView.tsx   # Core ILE session UI
│   ├── WorkspaceView.tsx # Workspace block graph
│   ├── TapScoreClient.tsx # TAP scoring UI
│   └── thought-ui/       # Shared dialogue / thought components
├── lib/                  # Core libraries (~121 modules)
│   ├── xai.ts            # LLM orchestration (gap detection, probes, reports)
│   ├── xai-client.ts     # xAI API client (chat, JSON schema, files)
│   ├── prompts.ts        # Helios prompt templates
│   ├── storage.ts        # Supabase session & workspace persistence
│   ├── agent-v2/         # Agentic API v2 (auth, MCP, proof-of-work, TAP links)
│   ├── tap-score*.ts     # TAP scoring logic
│   └── ...
├── supabase/             # Database schema & migrations
├── tests/lib/            # Vitest unit tests (lib-focused)
└── public/               # Static assets; skill.md for agent integrations
```

## Agent API (v2)

Uncertain Systems exposes a scoped REST API and MCP transport for AI agents. Generate an API key from the dashboard (`/dashboard`) and use it to:

- Create and manage verification workspaces and blocks
- Issue Think Aloud Protocol (TAP) links, poll completion via `GET .../tap-links`, and score via unified performance analysis
- Upload proof-of-work artifacts and request performance context
- Connect via MCP OAuth (`/api/mcp`) for tool-based integrations

See [`public/skill.md`](public/skill.md) and [`docs/PROOF_OF_WORK_API.md`](docs/PROOF_OF_WORK_API.md) for full documentation. Interactive reference: [`/docs/proof-of-work-api`](/docs/proof-of-work-api).

## Uncertain Systems

Uncertain Systems is developed by **Uncertain Systems**, founded by [Daniel Colomer](https://x.com/uncertainsys). The mission is to build open-source infrastructure for education technology — tools that make deep learning accessible to everyone through AI-guided reasoning.

- Website: [uncertain.systems](https://uncertain.systems)
- Twitter/X: [@uncertainsys](https://x.com/uncertainsys)
- Email: daniel@uncertain.systems

## License

Copyright Uncertain Systems (Daniel Colomer). All rights reserved.
