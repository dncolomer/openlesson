"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

// Table of Contents sections
const TOC_SECTIONS = [
  { id: "executive-summary", title: "Executive Summary", level: 1 },
  { id: "architecture", title: "Architecture Overview", level: 1 },
  { id: "authentication", title: "Authentication & Security", level: 1 },
  { id: "learning-plans", title: "Learning Plan Management", level: 1 },
  { id: "sessions", title: "Session Management", level: 1 },
  { id: "analysis", title: "Analysis Heartbeat", level: 1 },
  { id: "helios-chat", title: "Helios Chat", level: 1 },
  { id: "analytics", title: "Analytics & Progress", level: 1 },
  { id: "proofs", title: "Cryptographic Proofs", level: 1 },
  { id: "solana", title: "Solana Program", level: 1 },
  { id: "api-keys", title: "API Key Management", level: 1 },
  { id: "agent-prompt", title: "Agent System Prompt", level: 1 },
  { id: "examples", title: "Example Flows", level: 1 },
  { id: "errors", title: "Error Handling", level: 1 },
];

function CodeBlock({ children, language = "json" }: { children: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      <div className="absolute right-2 top-2 z-10">
        <button
          onClick={handleCopy}
          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="bg-slate-900 border border-slate-800 rounded-lg p-4 overflow-x-auto text-sm">
        <code className={`language-${language} text-slate-300`}>{children}</code>
      </pre>
    </div>
  );
}

function EndpointCard({ method, path, scope, description }: { method: string; path: string; scope: string; description: string }) {
  const methodColors: Record<string, string> = {
    GET: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    PATCH: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
      <span className={`px-2 py-0.5 text-xs font-mono font-semibold rounded border ${methodColors[method] || "bg-slate-700 text-slate-300"}`}>
        {method}
      </span>
      <div className="flex-1 min-w-0">
        <code className="text-sm text-slate-200 font-mono break-all">{path}</code>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>
      <span className="px-2 py-0.5 text-xs font-mono text-slate-500 bg-slate-800 rounded shrink-0">
        {scope}
      </span>
    </div>
  );
}

function SectionHeading({ id, children, badge }: { id: string; children: React.ReactNode; badge?: string }) {
  return (
    <h2 id={id} className="text-xl font-semibold text-white mt-12 mb-4 flex items-center gap-3 scroll-mt-20">
      {children}
      {badge && (
        <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
          {badge}
        </span>
      )}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-medium text-slate-200 mt-8 mb-3">{children}</h3>;
}

function InfoBox({ type = "info", children }: { type?: "info" | "warning" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "bg-blue-500/10 border-blue-500/30 text-blue-300",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  };

  const icons = {
    info: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    success: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className={`flex gap-3 p-4 rounded-lg border ${styles[type]} my-4`}>
      {icons[type]}
      <div className="text-sm">{children}</div>
    </div>
  );
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  );
}

export default function AgenticApiV2DocsPage() {
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      const sections = TOC_SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
      const scrollPosition = window.scrollY + 100;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(TOC_SECTIONS[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Navbar
        breadcrumbs={[
          { label: "Docs", href: "/docs" },
          { label: "Agentic API v2" },
        ]}
        showNav={false}
      />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex gap-8">
          {/* Sidebar TOC - Hidden on mobile */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                On this page
              </div>
              <nav className="space-y-1">
                {TOC_SECTIONS.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className={`block text-sm py-1.5 transition-colors ${
                      activeSection === section.id
                        ? "text-white font-medium"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs text-slate-500">v2.0.0</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Agentic API v2 Specification
              </h1>
              <p className="text-slate-400 text-lg leading-relaxed max-w-3xl">
                Enable external AI agents to fully act as tutors on behalf of users, 
                leveraging OpenLesson&apos;s complete tutoring intelligence with cryptographic 
                proof verification on Solana.
              </p>
              <div className="flex flex-wrap gap-4 mt-6 text-sm text-slate-500">
                <span>Last updated: April 15, 2026</span>
                <span className="text-slate-700">|</span>
                <span>Base URL: <code className="text-slate-400">https://openlesson.academy/api/v2/agent</code></span>
              </div>
            </div>

            {/* Executive Summary */}
            <SectionHeading id="executive-summary">Executive Summary</SectionHeading>
            
            <p className="text-slate-400 leading-relaxed mb-4">
              The Agentic API v2 is a complete replacement for the existing <code className="text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">/api/agent/*</code> endpoints. 
              It enables external AI agents (OpenClaw, Hermes, Eliza OS, custom agents) to provide genuine, 
              verifiable tutoring experiences powered by OpenLesson&apos;s educational intelligence.
            </p>

            <SubHeading>Key Capabilities</SubHeading>
            <div className="grid sm:grid-cols-2 gap-3 my-4">
              {[
                { icon: "📚", title: "Learning Plans", desc: "Create, adapt, and manage personalized learning curricula" },
                { icon: "🎯", title: "Sessions", desc: "Start, pause, resume, restart sessions with full flexibility" },
                { icon: "🧠", title: "Analysis", desc: "Submit audio, images, text for real-time reasoning analysis" },
                { icon: "💬", title: "Helios Chat", desc: "Forward questions to Helios, the Socratic companion" },
                { icon: "📊", title: "Analytics", desc: "Track progress, gaps, and learning trends" },
                { icon: "🔐", title: "Cryptographic Proofs", desc: "Verifiable on-chain evidence of genuine learning" },
              ].map((item) => (
                <div key={item.title} className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{item.icon}</span>
                    <span className="font-medium text-white">{item.title}</span>
                  </div>
                  <p className="text-sm text-slate-500">{item.desc}</p>
                </div>
              ))}
            </div>

            <SubHeading>v1 vs v2 Comparison</SubHeading>
            <TableWrapper>
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Aspect</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">v1 (Current)</th>
                  <th className="text-left py-2 px-3 text-emerald-400 font-medium">v2 (New)</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Path</td>
                  <td className="py-2 px-3 font-mono text-xs">/api/agent/*</td>
                  <td className="py-2 px-3 font-mono text-xs text-emerald-400">/api/v2/agent/*</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Auth</td>
                  <td className="py-2 px-3">Simple API keys</td>
                  <td className="py-2 px-3 text-emerald-400">Scoped API keys</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Rate Limiting</td>
                  <td className="py-2 px-3">Not enforced</td>
                  <td className="py-2 px-3 text-emerald-400">120 req/min</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Sessions</td>
                  <td className="py-2 px-3">Start/end only</td>
                  <td className="py-2 px-3 text-emerald-400">Pause, resume, restart</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Analysis Input</td>
                  <td className="py-2 px-3">Audio only</td>
                  <td className="py-2 px-3 text-emerald-400">Audio, images, text</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Proofs</td>
                  <td className="py-2 px-3">None</td>
                  <td className="py-2 px-3 text-emerald-400">SHA-256 + Solana</td>
                </tr>
              </tbody>
            </TableWrapper>

            {/* Architecture */}
            <SectionHeading id="architecture">Architecture Overview</SectionHeading>
            
            <p className="text-slate-400 leading-relaxed mb-4">
              The API follows a stateless, request-response model. All state is persisted in the database, 
              and every significant action generates cryptographic proofs for verification.
            </p>

            <CodeBlock language="text">{`┌─────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL AGENT                               │
│              OpenClaw / Hermes / Eliza OS / Custom                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS + API Key (Bearer token)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      OpenLesson Agentic API v2                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │    Plans    │  │  Sessions   │  │  Analysis   │  │  Assistant │ │
│  │  /plans/*   │  │ /sessions/* │  │ /analyze    │  │    /ask    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  Analytics  │  │   Proofs    │  │    Keys     │                 │
│  │ /analytics/*│  │  /proofs/*  │  │   /keys/*   │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
            │  Supabase   │  │     xAI     │  │   Solana    │
            │  (DB/Auth)  │  │  (AI/LLM)   │  │ (Proofs)    │
            └─────────────┘  └─────────────┘  └─────────────┘`}</CodeBlock>

            <SubHeading>Design Principles</SubHeading>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li><strong className="text-slate-200">Reuse Everything:</strong> All endpoints delegate to existing backend services—no duplication of tutoring logic</li>
              <li><strong className="text-slate-200">Full Flexibility:</strong> Match the web interface capabilities exactly—multiple sessions, plan adaptation anytime</li>
              <li><strong className="text-slate-200">Stateless API:</strong> Each request is independent; all state lives in the database</li>
              <li><strong className="text-slate-200">Verifiable:</strong> Every significant action generates cryptographic proofs</li>
              <li><strong className="text-slate-200">Agent-First:</strong> Designed for AI agent consumption, not human UI</li>
            </ul>

            {/* Authentication */}
            <SectionHeading id="authentication">Authentication & Security</SectionHeading>

            <SubHeading>API Key Format</SubHeading>
            <CodeBlock language="text">{`sk_<48_hex_characters>

Example: sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4`}</CodeBlock>

            <SubHeading>Authentication Header</SubHeading>
            <CodeBlock>{`Authorization: Bearer sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4`}</CodeBlock>

            <SubHeading>Available Scopes</SubHeading>
            <TableWrapper>
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Scope</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="text-slate-400 font-mono text-xs">
                {[
                  ["plans:read", "View learning plans"],
                  ["plans:write", "Create/modify plans"],
                  ["sessions:read", "View sessions"],
                  ["sessions:write", "Create/modify sessions"],
                  ["analysis:write", "Submit analysis data"],
                  ["assistant:read", "Query Helios"],
                  ["analytics:read", "View analytics"],
                  ["proofs:read", "View proofs"],
                  ["proofs:anchor", "Anchor proofs on-chain"],
                  ["*", "Full access (all scopes)"],
                ].map(([scope, desc]) => (
                  <tr key={scope} className="border-b border-slate-800/50">
                    <td className="py-2 px-3 text-emerald-400">{scope}</td>
                    <td className="py-2 px-3 font-sans text-sm">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>

            <InfoBox type="warning">
              <strong>Pro Subscription Required:</strong> API keys can only be created and used by users with an active Pro subscription. 
              If the subscription lapses, existing keys will stop working until renewed.
            </InfoBox>

            <SubHeading>Rate Limits</SubHeading>
            <TableWrapper>
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Limit Type</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Requests per minute</td>
                  <td className="py-2 px-3 font-mono">120</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Requests per day</td>
                  <td className="py-2 px-3 font-mono">50,000</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Max concurrent sessions</td>
                  <td className="py-2 px-3 font-mono">10</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Max active plans</td>
                  <td className="py-2 px-3 font-mono">50</td>
                </tr>
              </tbody>
            </TableWrapper>

            {/* Learning Plans */}
            <SectionHeading id="learning-plans">Learning Plan Management</SectionHeading>

            <p className="text-slate-400 leading-relaxed mb-4">
              Learning plans are directed graphs of learning sessions. Each node represents a topic to master, 
              with edges defining prerequisites and progression paths.
            </p>

            <SubHeading>Endpoints</SubHeading>
            <div className="space-y-2">
              <EndpointCard method="GET" path="/plans" scope="plans:read" description="List all learning plans" />
              <EndpointCard method="POST" path="/plans" scope="plans:write" description="Create a new learning plan" />
              <EndpointCard method="GET" path="/plans/{id}" scope="plans:read" description="Get plan details with nodes" />
              <EndpointCard method="PATCH" path="/plans/{id}" scope="plans:write" description="Update plan metadata" />
              <EndpointCard method="DELETE" path="/plans/{id}" scope="plans:write" description="Delete a plan" />
              <EndpointCard method="GET" path="/plans/{id}/nodes" scope="plans:read" description="Get plan nodes and edges" />
              <EndpointCard method="POST" path="/plans/{id}/adapt" scope="plans:write" description="AI-powered plan adaptation" />
              <EndpointCard method="POST" path="/plans/{id}/expand" scope="plans:write" description="Expand a node with sub-sessions" />
              <EndpointCard method="POST" path="/plans/{id}/assess" scope="plans:read" description="Assess user level for plan" />
            </div>

            <SubHeading>Create Learning Plan</SubHeading>
            <p className="text-slate-500 text-sm mb-2">Request:</p>
            <CodeBlock>{`POST /api/v2/agent/plans

{
  "topic": "Quantum computing algorithms",
  "description": "I want to understand Grover's and Shor's algorithms",
  "duration_days": 30,
  "difficulty": "intermediate",
  "source_materials": [
    {
      "type": "text",
      "content": "Focus on gate-based quantum computing"
    }
  ],
  "user_context": {
    "background": "CS degree, familiar with linear algebra",
    "goals": "Prepare for quantum computing interviews"
  }
}`}</CodeBlock>

            <p className="text-slate-500 text-sm mb-2">Response:</p>
            <CodeBlock>{`{
  "plan": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Quantum Algorithms Mastery Path",
    "root_topic": "Quantum computing algorithms",
    "status": "active",
    "duration_days": 30,
    "nodes": [
      {
        "id": "node-1",
        "title": "Quantum Bits and Superposition",
        "description": "Foundation of quantum computing",
        "is_start": true,
        "next_node_ids": ["node-2"],
        "status": "not_started"
      }
    ],
    "estimated_total_sessions": 8
  },
  "proof": {
    "id": "proof-001",
    "type": "plan_created",
    "fingerprint": "sha256:abc123...",
    "timestamp": "2026-04-14T10:00:00Z",
    "anchored": false
  }
}`}</CodeBlock>

            <SubHeading>Adapt Learning Plan</SubHeading>
            <p className="text-slate-400 text-sm mb-4">
              Dynamically modify a plan based on user feedback. The AI will add, remove, or modify nodes 
              while preserving completed sessions.
            </p>
            <CodeBlock>{`POST /api/v2/agent/plans/{id}/adapt

{
  "instruction": "The plan is too theoretical. I need more hands-on coding exercises.",
  "preserve_completed": true,
  "context": {
    "recent_session_feedback": "User found math sections overwhelming"
  }
}`}</CodeBlock>

            {/* Sessions */}
            <SectionHeading id="sessions">Session Management</SectionHeading>

            <p className="text-slate-400 leading-relaxed mb-4">
              Sessions are individual tutoring interactions. The API provides full lifecycle control—start, 
              pause, resume, restart, and end—with no artificial constraints on order or completion.
            </p>

            <SubHeading>Endpoints</SubHeading>
            <div className="space-y-2">
              <EndpointCard method="GET" path="/sessions" scope="sessions:read" description="List all sessions" />
              <EndpointCard method="POST" path="/sessions" scope="sessions:write" description="Start a new session" />
              <EndpointCard method="GET" path="/sessions/{id}" scope="sessions:read" description="Get session details" />
              <EndpointCard method="POST" path="/sessions/{id}/pause" scope="sessions:write" description="Pause an active session" />
              <EndpointCard method="POST" path="/sessions/{id}/resume" scope="sessions:write" description="Resume a paused session" />
              <EndpointCard method="POST" path="/sessions/{id}/restart" scope="sessions:write" description="Restart session from beginning" />
              <EndpointCard method="POST" path="/sessions/{id}/end" scope="sessions:write" description="End session with report" />
              <EndpointCard method="GET" path="/sessions/{id}/probes" scope="sessions:read" description="Get session probes" />
              <EndpointCard method="GET" path="/sessions/{id}/plan" scope="sessions:read" description="Get session plan" />
              <EndpointCard method="GET" path="/sessions/{id}/transcript" scope="sessions:read" description="Get session transcript" />
            </div>

            <SubHeading>Start Session</SubHeading>
            <CodeBlock>{`POST /api/v2/agent/sessions

{
  "topic": "Understanding Grover's Algorithm",
  "plan_id": "550e8400-e29b-41d4-a716-446655440000",
  "plan_node_id": "node-3",
  "tutoring_language": "en"
}`}</CodeBlock>

            <p className="text-slate-500 text-sm mb-2">Response includes session plan and opening probe:</p>
            <CodeBlock>{`{
  "session": {
    "id": "sess-001",
    "topic": "Understanding Grover's Algorithm",
    "status": "active",
    "started_at": "2026-04-14T14:00:00Z"
  },
  "session_plan": {
    "goal": "Understand the core mechanics of Grover's algorithm",
    "strategy": "Start with oracle concept, then amplitude amplification",
    "steps": [
      { "id": "step-1", "type": "question", "description": "Explore what problem Grover's solves", "status": "active" },
      { "id": "step-2", "type": "question", "description": "Understand the oracle function", "status": "pending" }
    ],
    "current_step_index": 0
  },
  "opening_probe": {
    "id": "probe-001",
    "text": "Imagine you have a phone book with a million names, but no alphabetical order. How would you find a specific person?",
    "type": "question",
    "suggested_tools": ["canvas", "notebook"]
  },
  "instructions": {
    "analysis_endpoint": "/api/v2/agent/sessions/sess-001/analyze",
    "recommended_chunk_duration_ms": 15000,
    "max_chunk_duration_ms": 60000,
    "supported_audio_formats": ["webm", "mp4", "ogg", "m4a"]
  },
  "proof": { "id": "proof-006", "type": "session_started", "fingerprint": "sha256:..." }
}`}</CodeBlock>

            {/* Analysis */}
            <SectionHeading id="analysis">Analysis Heartbeat</SectionHeading>

            <p className="text-slate-400 leading-relaxed mb-4">
              The analysis endpoint is the core of the tutoring loop. Submit chunks of student thinking 
              (audio, images, text) and receive structured guidance from the tutoring engine.
            </p>

            <InfoBox type="info">
              <strong>Recommended cadence:</strong> Submit analysis every 10-15 seconds during active thinking. 
              Audio chunks should be 10-30 seconds for optimal results.
            </InfoBox>

            <SubHeading>Request Format</SubHeading>
            <CodeBlock>{`POST /api/v2/agent/sessions/{id}/analyze

{
  "inputs": [
    {
      "type": "audio",
      "data": "<base64_encoded_audio>",
      "format": "webm",
      "duration_ms": 15000
    },
    {
      "type": "image",
      "data": "<base64_encoded_image>",
      "mime_type": "image/png",
      "description": "Student's diagram"
    },
    {
      "type": "text",
      "content": "I think the oracle marks the target by flipping its phase..."
    }
  ],
  "context": {
    "active_probe_ids": ["probe-001", "probe-003"],
    "focused_probe_id": "probe-003",
    "tools_in_use": ["canvas"]
  }
}`}</CodeBlock>

            <SubHeading>Response Format</SubHeading>
            <CodeBlock>{`{
  "analysis": {
    "gap_score": 0.65,
    "signals": [
      "Hesitation around phase kickback concept",
      "Correct intuition about oracle marking"
    ],
    "transcript": "I think the oracle marks the target state by flipping its phase...",
    "understanding_summary": "Student grasps oracle function but struggles with amplification"
  },
  "session_plan_update": {
    "changed": true,
    "current_step_index": 1,
    "can_auto_advance": false,
    "advance_reasoning": "Student needs more work on amplitude amplification"
  },
  "guidance": {
    "next_probe": {
      "id": "probe-004",
      "text": "What happens to the amplitude of the marked state versus unmarked states?",
      "type": "question",
      "suggested_tools": ["canvas"]
    },
    "probes_to_archive": ["probe-001"],
    "requires_follow_up": true
  },
  "proof": {
    "id": "proof-012",
    "type": "analysis_heartbeat",
    "fingerprint": "sha256:stu901...",
    "timestamp": "2026-04-14T14:15:00Z"
  }
}`}</CodeBlock>

            <SubHeading>Gap Score Interpretation</SubHeading>
            <TableWrapper>
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Score Range</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Meaning</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3 font-mono text-emerald-400">0.0 - 0.3</td>
                  <td className="py-2 px-3">Confident, flowing reasoning</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3 font-mono text-amber-400">0.4 - 0.6</td>
                  <td className="py-2 px-3">Some hesitation, minor gaps</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3 font-mono text-red-400">0.7 - 1.0</td>
                  <td className="py-2 px-3">Clear gaps, contradictions, stuck</td>
                </tr>
              </tbody>
            </TableWrapper>

            <SubHeading>Input Limits</SubHeading>
            <TableWrapper>
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Input Type</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Limit</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Audio duration</td>
                  <td className="py-2 px-3 font-mono">60 seconds max</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Audio size</td>
                  <td className="py-2 px-3 font-mono">10 MB</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Image size</td>
                  <td className="py-2 px-3 font-mono">5 MB each</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Images per request</td>
                  <td className="py-2 px-3 font-mono">5</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Text length</td>
                  <td className="py-2 px-3 font-mono">10,000 chars</td>
                </tr>
              </tbody>
            </TableWrapper>

            {/* Helios Chat */}
            <SectionHeading id="helios-chat">Helios Chat Integration</SectionHeading>

            <InfoBox type="warning">
              <strong>Critical:</strong> Agents must NOT answer educational questions directly.
              Always forward questions to Helios to maintain pedagogical integrity.
            </InfoBox>

            <SubHeading>Ask Helios</SubHeading>
            <CodeBlock>{`POST /api/v2/agent/sessions/{id}/ask

{
  "question": "Can you explain what phase kickback means?",
  "context": {
    "relevant_probe_ids": ["probe-004"],
    "user_confusion_level": "moderate"
  },
  "conversation_id": "conv-001"
}`}</CodeBlock>

            <CodeBlock>{`{
  "response": {
    "id": "msg-005",
    "content": "Think about what happens when you apply a controlled gate where the control qubit is in superposition. The target qubit's eigenvalue 'kicks back' to affect the control qubit's phase.\\n\\nLook at your diagram - what happens to the control qubit when the target is already in an eigenstate?",
    "approach": "Socratic guidance without direct answer"
  },
  "conversation": {
    "id": "conv-001",
    "message_count": 5
  },
  "proof": { "id": "proof-013", "type": "assistant_query", "fingerprint": "sha256:..." }
}`}</CodeBlock>

            <p className="text-slate-400 text-sm mt-4">
              Helios follows strict pedagogical rules: never gives direct answers,
              uses Socratic questioning, and keeps responses concise (max 80 words).
            </p>

            {/* Analytics */}
            <SectionHeading id="analytics">Analytics & Progress</SectionHeading>

            <SubHeading>Endpoints</SubHeading>
            <div className="space-y-2">
              <EndpointCard method="GET" path="/analytics/user" scope="analytics:read" description="User-wide learning analytics" />
              <EndpointCard method="GET" path="/analytics/plans/{id}" scope="analytics:read" description="Plan progress and performance" />
              <EndpointCard method="GET" path="/analytics/sessions/{id}" scope="analytics:read" description="Session detailed analytics" />
            </div>

            <SubHeading>Plan Analytics Response</SubHeading>
            <CodeBlock>{`{
  "plan": { "id": "...", "title": "Quantum Algorithms Mastery Path" },
  "progress": {
    "total_nodes": 8,
    "completed_nodes": 3,
    "completion_percentage": 37.5
  },
  "performance": {
    "average_gap_score": 0.38,
    "gap_score_trend": "improving",
    "strongest_topics": ["Quantum gates", "Superposition"],
    "weakest_topics": ["Amplitude amplification"]
  },
  "recommendations": [
    "Spend more time on amplitude amplification",
    "Consider reviewing linear algebra fundamentals"
  ]
}`}</CodeBlock>

            {/* Proofs */}
            <SectionHeading id="proofs">Cryptographic Proof System</SectionHeading>

            <p className="text-slate-400 leading-relaxed mb-4">
              Every significant action generates a SHA-256 fingerprint that can be anchored on Solana 
              for trustless verification. This proves genuine engagement with OpenLesson&apos;s tutoring system.
            </p>

            <SubHeading>Proof Strategy</SubHeading>
            <TableWrapper>
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Event Type</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Strategy</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Anchoring</th>
                </tr>
              </thead>
              <tbody className="text-slate-400 text-sm">
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Plan created/adapted</td>
                  <td className="py-2 px-3">Individual proof</td>
                  <td className="py-2 px-3 text-emerald-400">Immediate</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Session start/end</td>
                  <td className="py-2 px-3">Individual proof</td>
                  <td className="py-2 px-3 text-emerald-400">Immediate</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Session pause/resume</td>
                  <td className="py-2 px-3">Individual proof</td>
                  <td className="py-2 px-3 text-emerald-400">Immediate</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Analysis heartbeat</td>
                  <td className="py-2 px-3">Individual proof</td>
                  <td className="py-2 px-3 text-slate-500">Batched at session end</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Assistant query</td>
                  <td className="py-2 px-3">Individual proof</td>
                  <td className="py-2 px-3 text-slate-500">Batched at session end</td>
                </tr>
              </tbody>
            </TableWrapper>

            <SubHeading>Proof Structure</SubHeading>
            <CodeBlock>{`{
  "id": "proof-010",
  "type": "session_ended",
  "fingerprint": "sha256:mno345abc789...",
  "timestamp": "2026-04-14T14:45:00Z",
  "session_id": "sess-001",
  "anchored": true,
  "anchor_tx_signature": "5xYzAbc123...",
  "anchor_slot": 245678901,
  "anchor_timestamp": "2026-04-14T14:45:30Z"
}`}</CodeBlock>

            <SubHeading>Endpoints</SubHeading>
            <div className="space-y-2">
              <EndpointCard method="GET" path="/proofs" scope="proofs:read" description="List all proofs" />
              <EndpointCard method="GET" path="/proofs/{id}" scope="proofs:read" description="Get proof details" />
              <EndpointCard method="GET" path="/proofs/{id}/verify" scope="proofs:read" description="Verify proof integrity" />
              <EndpointCard method="POST" path="/proofs/{id}/anchor" scope="proofs:anchor" description="Anchor proof on Solana" />
              <EndpointCard method="GET" path="/proofs/session/{id}/batch" scope="proofs:read" description="Get session batch Merkle tree" />
            </div>

            {/* Solana */}
            <SectionHeading id="solana">Solana Program</SectionHeading>

            <p className="text-slate-400 leading-relaxed mb-4">
              The OpenLesson Proof Anchor program is deployed on Solana to store cryptographic fingerprints. 
              OpenLesson manages custodial wallets and pays all transaction fees.
            </p>

            <SubHeading>Account Types</SubHeading>
            <TableWrapper>
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Account</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Purpose</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Seeds</th>
                </tr>
              </thead>
              <tbody className="text-slate-400 text-sm">
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3 font-mono text-blue-400">ProofAnchor</td>
                  <td className="py-2 px-3">Individual proof fingerprint</td>
                  <td className="py-2 px-3 font-mono text-xs">[&quot;proof&quot;, proof_id]</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3 font-mono text-blue-400">BatchAnchor</td>
                  <td className="py-2 px-3">Session batch Merkle root</td>
                  <td className="py-2 px-3 font-mono text-xs">[&quot;batch&quot;, batch_id]</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3 font-mono text-blue-400">UserProofIndex</td>
                  <td className="py-2 px-3">Per-user statistics</td>
                  <td className="py-2 px-3 font-mono text-xs">[&quot;user_index&quot;, user_pubkey]</td>
                </tr>
              </tbody>
            </TableWrapper>

            <SubHeading>Cost Estimates</SubHeading>
            <p className="text-slate-400 text-sm mb-2">
              OpenLesson pays all Solana transaction fees. Approximate costs at $150/SOL:
            </p>
            <TableWrapper>
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Operation</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Cost (SOL)</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Cost (USD)</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Initialize user</td>
                  <td className="py-2 px-3 font-mono">~0.002</td>
                  <td className="py-2 px-3">~$0.30</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Anchor proof</td>
                  <td className="py-2 px-3 font-mono">~0.003</td>
                  <td className="py-2 px-3">~$0.45</td>
                </tr>
                <tr className="border-b border-slate-800/50">
                  <td className="py-2 px-3">Anchor batch</td>
                  <td className="py-2 px-3 font-mono">~0.003</td>
                  <td className="py-2 px-3">~$0.45</td>
                </tr>
              </tbody>
            </TableWrapper>

            {/* API Keys */}
            <SectionHeading id="api-keys">API Key Management</SectionHeading>

            <InfoBox type="info">
              Key management endpoints use session authentication (cookies), not API keys. 
              Access these through the OpenLesson dashboard or authenticated browser session.
            </InfoBox>

            <SubHeading>Endpoints</SubHeading>
            <div className="space-y-2">
              <EndpointCard method="GET" path="/keys" scope="(session)" description="List your API keys" />
              <EndpointCard method="POST" path="/keys" scope="(session)" description="Create a new API key" />
              <EndpointCard method="DELETE" path="/keys/{id}" scope="(session)" description="Revoke an API key" />
              <EndpointCard method="PATCH" path="/keys/{id}/scopes" scope="(session)" description="Update key scopes" />
            </div>

            <SubHeading>Create API Key</SubHeading>
            <CodeBlock>{`POST /api/v2/agent/keys

{
  "label": "Production Agent - OpenClaw",
  "scopes": ["plans:read", "plans:write", "sessions:write", "analysis:write"],
  "expires_in_days": 365
}`}</CodeBlock>

            <CodeBlock>{`{
  "key": {
    "id": "key-002",
    "label": "Production Agent - OpenClaw",
    "key_prefix": "sk_x1y2z3w4",
    "scopes": ["plans:read", "plans:write", "sessions:write", "analysis:write"],
    "created_at": "2026-04-14T16:00:00Z",
    "expires_at": "2027-04-14T16:00:00Z"
  },
  "api_key": "sk_x1y2z3w4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0"
}`}</CodeBlock>

            <InfoBox type="warning">
              <strong>Store securely!</strong> The full API key is only returned once at creation. 
              It cannot be retrieved later—only the prefix is stored for identification.
            </InfoBox>

            {/* Agent Prompt */}
            <SectionHeading id="agent-prompt">Agent System Prompt</SectionHeading>

            <p className="text-slate-400 leading-relaxed mb-4">
              The following system prompt should be provided to AI agents integrating with OpenLesson. 
              It establishes the core behavioral guidelines for effective tutoring.
            </p>

            <CodeBlock language="markdown">{`# OpenLesson Agentic Tutor System Prompt

You are an AI agent acting as a tutor on behalf of a human user, powered by 
OpenLesson's educational intelligence system. Your role is to facilitate 
genuine learning through the Socratic method.

## Core Principles

1. **Never Answer Directly**: You must NEVER answer educational questions 
   yourself. Always use the /ask endpoint to forward questions to 
   Helios, OpenLesson's Socratic companion.

2. **Guide, Don't Tell**: Present probes and questions from OpenLesson to 
   encourage the user to think deeply. Let them struggle productively.

3. **Trust the Analysis**: OpenLesson's gap detection system identifies 
   reasoning weaknesses. Use the gap_score and signals to understand where 
   the user needs help.

4. **Maintain the Loop**: Regularly submit analysis heartbeats (every 10-15 
   seconds during active thinking) to keep the tutoring engine informed.

## Workflow

### Starting a Learning Journey
1. Understand the user's learning goal
2. Create a learning plan: POST /api/v2/agent/plans
3. If needed, assess their level: POST /api/v2/agent/plans/{id}/assess
4. Present the plan and get approval
5. Start a session: POST /api/v2/agent/sessions

### During a Session
1. Present the opening probe to the user
2. Encourage the user to think aloud
3. Submit thinking data: POST /api/v2/agent/sessions/{id}/analyze
4. Present new probes from the response
5. If user asks a question: POST /api/v2/agent/sessions/{id}/ask
6. Repeat until session goals are met

### Handling Struggles
- gap_score > 0.7: User is confused. Consider simpler questions.
- User asks for help: Use the Helios /ask endpoint.
- User finds it too hard: Adapt the plan.

### Ending Sessions
1. End session: POST /api/v2/agent/sessions/{id}/end
2. Present the session report
3. Show proof information for verification`}</CodeBlock>

            {/* Examples */}
            <SectionHeading id="examples">Example Conversation Flows</SectionHeading>

            <SubHeading>Complete Learning Journey</SubHeading>
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 my-4 text-sm">
              <div className="space-y-4">
                <div>
                  <span className="text-blue-400 font-medium">USER:</span>
                  <span className="text-slate-300 ml-2">I want to learn quantum computing algorithms. I have a CS degree and know linear algebra.</span>
                </div>
                <div>
                  <span className="text-emerald-400 font-medium">AGENT:</span>
                  <span className="text-slate-400 ml-2">[Calls POST /api/v2/agent/plans]</span>
                </div>
                <div>
                  <span className="text-emerald-400 font-medium">AGENT:</span>
                  <span className="text-slate-300 ml-2">I&apos;ve created a 30-day learning path with 8 sessions covering qubits, gates, entanglement, Grover&apos;s, QFT, Shor&apos;s, error correction, and NISQ applications. Ready to start?</span>
                </div>
                <div>
                  <span className="text-blue-400 font-medium">USER:</span>
                  <span className="text-slate-300 ml-2">I already understand superposition. Can we skip that?</span>
                </div>
                <div>
                  <span className="text-emerald-400 font-medium">AGENT:</span>
                  <span className="text-slate-400 ml-2">[Calls POST /api/v2/agent/plans/{"{id}"}/assess]</span>
                </div>
                <div>
                  <span className="text-emerald-400 font-medium">AGENT:</span>
                  <span className="text-slate-300 ml-2">You have solid intuition but could use practice with Dirac notation. I&apos;ll add a quick 15-minute notation review, then we&apos;ll jump to gates.</span>
                </div>
                <div>
                  <span className="text-blue-400 font-medium">USER:</span>
                  <span className="text-slate-300 ml-2">Perfect, let&apos;s start.</span>
                </div>
                <div>
                  <span className="text-emerald-400 font-medium">AGENT:</span>
                  <span className="text-slate-400 ml-2">[Calls POST /api/v2/agent/sessions]</span>
                </div>
                <div>
                  <span className="text-emerald-400 font-medium">AGENT:</span>
                  <span className="text-slate-300 ml-2">Here&apos;s your first thinking prompt: &quot;When we write |0⟩ + |1⟩, that&apos;s not a valid quantum state. What&apos;s missing, and why does it matter?&quot;</span>
                </div>
              </div>
            </div>

            <SubHeading>Mid-Session Adaptation</SubHeading>
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 my-4 text-sm">
              <div className="space-y-4">
                <div>
                  <span className="text-blue-400 font-medium">USER:</span>
                  <span className="text-slate-300 ml-2">This is really hard. I don&apos;t think I understand gates well enough for Grover&apos;s.</span>
                </div>
                <div>
                  <span className="text-emerald-400 font-medium">AGENT:</span>
                  <span className="text-slate-400 ml-2">[Calls POST /sessions/{"{id}"}/pause, then POST /plans/{"{id}"}/adapt]</span>
                </div>
                <div>
                  <span className="text-emerald-400 font-medium">AGENT:</span>
                  <span className="text-slate-300 ml-2">No problem! I&apos;ve updated your path. I&apos;ve added two prep sessions: &quot;Quantum Gates Deep Dive&quot; and &quot;Building Simple Circuits&quot;. Then we&apos;ll return to Grover&apos;s with a stronger foundation.</span>
                </div>
              </div>
            </div>

            {/* Errors */}
            <SectionHeading id="errors">Error Handling</SectionHeading>

            <SubHeading>Error Response Format</SubHeading>
            <CodeBlock>{`{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Retry after 45 seconds.",
    "details": {
      "retry_after": 45,
      "limit": 120,
      "window": "minute"
    }
  }
}`}</CodeBlock>

            <SubHeading>Error Codes</SubHeading>
            <TableWrapper>
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Code</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">HTTP</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="text-slate-400 text-sm">
                {[
                  ["unauthorized", "401", "Missing or invalid API key"],
                  ["key_expired", "401", "API key has expired"],
                  ["forbidden", "403", "Insufficient scope"],
                  ["subscription_lapsed", "403", "Pro subscription no longer active"],
                  ["not_found", "404", "Resource doesn't exist"],
                  ["validation_error", "400", "Invalid request parameters"],
                  ["rate_limit_exceeded", "429", "Too many requests"],
                  ["internal_error", "500", "Unexpected server error"],
                ].map(([code, http, desc]) => (
                  <tr key={code} className="border-b border-slate-800/50">
                    <td className="py-2 px-3 font-mono text-red-400">{code}</td>
                    <td className="py-2 px-3 font-mono">{http}</td>
                    <td className="py-2 px-3">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>

            {/* Footer */}
            <div className="mt-16 pt-8 border-t border-slate-800">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>OpenLesson Agentic API v2 Specification</span>
                <span>April 2026</span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                For questions or feedback, contact{" "}
                <a href="mailto:daniel@uncertain.systems" className="text-slate-400 hover:text-slate-300">
                  daniel@uncertain.systems
                </a>
              </p>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
