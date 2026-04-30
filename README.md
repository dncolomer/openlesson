# openLesson

**The AI Tutor That Listens to You Think**

openLesson is an open-source AI tutoring platform built on the Socratic method. Instead of giving answers, it listens to students reason aloud, detects gaps in their thinking in real-time, and asks targeted questions to deepen understanding.

Live at [openlesson.academy](https://openlesson.academy)

---

## About

openLesson (codename **Socrates**) is built by [Uncertain Systems](https://x.com/uncertainsys) — a project focused on building the open stack for educational technology.

The core thesis is simple: when you speak your reasoning out loud, gaps become audible — hesitations, contradictions, circular thinking, skipped steps, unexamined assumptions. openLesson uses LLMs to detect those gaps in real-time and responds not with answers, but with the right question at the right time.

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
- **Agent API** — Full REST API for AI agents to use openLesson as a skill programmatically
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
│   ├── api/              # ~44 API routes (gap analysis, probes, plans, chat, etc.)
│   ├── session/          # Active tutoring session pages
│   ├── dashboard/        # User dashboard
│   ├── plan/             # Learning plan views
│   └── ...               # Other pages (pricing, about, legal, solutions)
├── components/           # React components
│   ├── SessionView.tsx   # Core session UI
│   ├── PlanFlow.tsx      # Learning plan directed graph
│   ├── WhiteboardCanvas  # Drawing canvas
│   ├── HeliosChat.tsx    # Helios Chat (Socratic companion)
│   └── ...               # ~50 components total
├── lib/                  # Core libraries
│   ├── openrouter.ts     # LLM orchestration (prompts, gap detection, probes)
│   ├── storage.ts        # Supabase session storage
│   ├── muse.ts           # Muse EEG integration
│   ├── audio.ts          # Audio recording utilities
│   └── ...
├── supabase/             # Database schema & migrations
└── public/               # Static assets & agent skill docs
```

## Agent API

openLesson exposes a REST API for AI agents. Generate an API key from the dashboard and use it to:

- Create and manage learning plans
- Start and control tutoring sessions
- Submit audio for gap analysis
- Retrieve session summaries and reports

See [`public/skill.md`](public/skill.md) for the full agent API documentation.

## Uncertain Systems

openLesson is developed by **Uncertain Systems**, founded by [Daniel Colomer](https://x.com/uncertainsys). The mission is to build open-source infrastructure for education technology — tools that make deep learning accessible to everyone through AI-guided reasoning.

- Website: [openlesson.academy](https://openlesson.academy)
- Twitter/X: [@uncertainsys](https://x.com/uncertainsys)
- Email: daniel@uncertain.systems

## License

Copyright Uncertain Systems (Daniel Colomer). All rights reserved.
