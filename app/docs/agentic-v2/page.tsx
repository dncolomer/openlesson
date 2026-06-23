import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

const DOCS_BACKGROUND = "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg";

const ENDPOINTS = [
  ["POST", "/api/v2/agent/workspaces", "workspaces:write", "Create a Performance Workspace from an initial prompt and optional files."],
  ["GET", "/api/v2/agent/workspaces/{workspace_id}/blocks", "workspaces:read", "List available blocks in the workspace."],
  ["POST", "/api/v2/agent/workspaces/{workspace_id}/evidence", "workspaces:write", "Upload tool usage, screenshots, video, or EEG to xAI and link to workspace/block."],
  ["POST", "/api/v2/agent/workspaces/{workspace_id}/performance", "workspaces:read", "Structured gap report or free-form Q&A over workspace evidence."],
  ["POST", "/api/v2/agent/workspaces/{workspace_id}/blocks/{block_id}/ghl-links", "ghl:write", "Request a private GHL link for a block."],
  ["GET", "/api/v2/agent/workspaces/{workspace_id}/ghl-links", "ghl:read", "List existing GHL links and completion status."],
  ["GET", "/api/v2/agent/workspaces/{workspace_id}/ghl-links/{link_id}/results", "ghl:read", "Read completed GHL link results."],
  ["POST", "/api/v2/agent/org/guests", "org:write", "Create an organization guest by email and issue a guest API key."],
] as const;

const sectionClass = "rounded-md border border-neutral-800 bg-neutral-950/75 p-5 sm:p-6";
const labelClass = "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";
const codeBlockClass = "mt-4 overflow-x-auto rounded-md border border-neutral-800 bg-black/60 p-4 font-mono text-sm text-neutral-300";

export default function AgenticV2DocsPage() {
  return (
    <div
      className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-white"
      style={{
        backgroundImage: `linear-gradient(rgba(10,10,10,0.88), rgba(10,10,10,0.92)), url(${DOCS_BACKGROUND})`,
      }}
    >
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <header className={`${sectionClass} mb-8`}>
          <p className={labelClass}>OpenLesson Agentic API</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
            Performance Workspace and GHL Link API
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-neutral-400 sm:text-base">
            The Agentic API covers the workspace-to-readiness workflow: create Performance Workspaces, upload evidence,
            analyze learning gaps, list blocks, issue private GHL Score links, and read completion results. Requires an active{" "}
            <code className="text-neutral-300">pro_teams</code> subscription.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/skill.md"
              className="inline-flex h-10 items-center justify-center rounded-sm bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200"
            >
              Agent skill file →
            </Link>
            <Link
              href="/dashboard?tab=usage"
              className="inline-flex h-10 items-center justify-center rounded-sm border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
            >
              Get API key
            </Link>
          </div>
          <p className="mt-4 text-xs text-neutral-600">
            Canonical agent reference:{" "}
            <Link href="/skill.md" className="text-neutral-400 underline decoration-neutral-700 underline-offset-4 hover:text-white">
              /skill.md
            </Link>
            {" · "}
            MCP transport: <code className="text-neutral-500">POST /api/mcp/&#123;key&#125;</code>
          </p>
        </header>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">Authentication</h2>
          <p className="mt-2 text-sm text-neutral-400">Send your Agentic API key on every request.</p>
          <pre className={codeBlockClass}>
            <code>Authorization: Bearer &lt;api_key&gt;</code>
          </pre>
          <ul className="mt-4 space-y-2 text-sm text-neutral-400">
            <li>
              <span className="text-neutral-300">Member keys</span> — prefix <code className="text-neutral-300">sk_</code>, created from the dashboard or{" "}
              <code className="text-neutral-500">POST /api/v2/agent/keys</code>
            </li>
            <li>
              <span className="text-neutral-300">Guest keys</span> — prefix <code className="text-neutral-300">gsk_</code>, issued via{" "}
              <code className="text-neutral-500">POST /api/v2/agent/org/guests</code>
            </li>
            <li>
              Default scopes for member and guest keys: <code className="text-neutral-500">workspaces:read</code>,{" "}
              <code className="text-neutral-500">workspaces:write</code>, <code className="text-neutral-500">ghl:read</code>,{" "}
              <code className="text-neutral-500">ghl:write</code>
            </li>
            <li>
              <code className="text-neutral-500">org:write</code> is org-admin only (provision guests)
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <p className={labelClass}>Reference</p>
          <h2 className="mt-2 text-lg font-medium text-white">Endpoints</h2>
          <div className="mt-4 space-y-3">
            {ENDPOINTS.map(([method, path, scope, description]) => (
              <div key={`${method}-${path}`} className={sectionClass}>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="rounded-sm border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[10px] uppercase tracking-[1.4px] text-neutral-300">
                    {method}
                  </span>
                  <code className="break-all text-sm text-neutral-200">{path}</code>
                  <span className="rounded-sm border border-neutral-800 bg-black/40 px-2 py-1 font-mono text-[10px] text-neutral-500">
                    {scope}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">Create workspace response</h2>
          <p className="mt-2 text-sm text-neutral-400">Returns the workspace record plus generated blocks in one response (HTTP 201).</p>
          <pre className={codeBlockClass}>
            <code>{`{
  "workspace": { "id": "...", "title": "...", "status": "active" },
  "blocks": [{ "id": "...", "title": "...", "is_start": true }],
  "files": []
}`}</code>
          </pre>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className={sectionClass}>
            <h2 className="text-lg font-medium text-white">Create workspace</h2>
            <pre className={codeBlockClass}>
              <code>{`{
  "initial_prompt": "Prepare me to explain vector databases.",
  "files": [
    {
      "name": "notes.md",
      "mime_type": "text/markdown",
      "data": "base64-encoded-file"
    }
  ]
}`}</code>
            </pre>
          </div>
          <div className={sectionClass}>
            <h2 className="text-lg font-medium text-white">Upload evidence</h2>
            <pre className={codeBlockClass}>
              <code>{`{
  "type": "tool",
  "mime_type": "application/json",
  "data": "base64-encoded-bytes",
  "block_id": "optional-block-uuid",
  "tool_name": "canvas",
  "tool_action": "draw"
}`}</code>
            </pre>
          </div>
          <div className={sectionClass}>
            <h2 className="text-lg font-medium text-white">Performance analysis</h2>
            <pre className={codeBlockClass}>
              <code>{`{
  "prompt": "Optional free-form question",
  "block_id": "optional-block-uuid"
}`}</code>
            </pre>
            <p className="mt-4 text-sm leading-relaxed text-neutral-500">
              Omit <code className="text-neutral-400">prompt</code> for a structured gap report with strengths, growth areas, and next practice.
            </p>
          </div>
          <div className={sectionClass}>
            <h2 className="text-lg font-medium text-white">Request GHL link</h2>
            <pre className={codeBlockClass}>
              <code>{`{
  "minutes": 15,
  "guest_email": "learner@example.com"
}`}</code>
            </pre>
            <p className="mt-4 text-sm leading-relaxed text-neutral-500">
              The returned private URL opens the GHL Score session for the selected block. Results include marker scores and gap analysis.
            </p>
          </div>
        </section>

        <section className={`${sectionClass} mt-6 border-white/10`}>
          <p className={labelClass}>For agents</p>
          <h2 className="mt-2 text-lg font-medium text-white">Full integration spec</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            Use the skill file for complete endpoint details, scope rules, guest vs member responsibilities, error codes,
            and integration checklists. This page is a quick reference; agents should load{" "}
            <Link href="/skill.md" className="text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white">
              skill.md
            </Link>{" "}
            as their canonical source.
          </p>
          <Link
            href="/skill.md"
            className="mt-4 inline-flex text-sm text-neutral-300 underline decoration-neutral-600 underline-offset-4 transition hover:text-white"
          >
            Open /skill.md →
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}