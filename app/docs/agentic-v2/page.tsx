import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

const ENDPOINTS = [
  ["POST", "/api/v2/agent/workspaces", "workspaces:write", "Create a Performance Workspace from an initial prompt and optional files."],
  ["GET", "/api/v2/agent/workspaces/{workspace_id}/blocks", "workspaces:read", "List available blocks in the workspace."],
  ["POST", "/api/v2/agent/workspaces/{workspace_id}/blocks/{block_id}/ghl-links", "ghl:write", "Request a private GHL link for a block."],
  ["GET", "/api/v2/agent/workspaces/{workspace_id}/ghl-links", "ghl:read", "List existing GHL links and completion status."],
  ["GET", "/api/v2/agent/workspaces/{workspace_id}/ghl-links/{link_id}/results", "ghl:read", "Read completed GHL link results."],
  ["POST", "/api/v2/agent/org/guests", "org:write", "Create an organization guest by email and issue a guest API key."],
];

export default function AgenticV2DocsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">OpenLesson Agentic API</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Performance Workspace and GHL Link API
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-400">
          The Agentic API has been reduced to the workspace-to-GHL workflow. It no longer exposes blockchain tracking,
          proof anchoring, tool-usage tracking, live session controls, analytics, or plan adaptation.
        </p>

        <section className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-xl font-semibold text-white">Authentication</h2>
          <p className="mt-3 text-slate-400">Use an Agentic API key in the `Authorization` header.</p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-800 bg-black/40 p-4 text-sm text-slate-300">
            <code>{"Authorization: Bearer <api_key>"}</code>
          </pre>
          <p className="mt-3 text-slate-400">Valid scopes: `workspaces:read`, `workspaces:write`, `ghl:read`, `ghl:write`, `org:read`, `org:write`, `*`. Organization and guest APIs require Teams tier.</p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white">Endpoints</h2>
          <div className="mt-4 space-y-3">
            {ENDPOINTS.map(([method, path, scope, description]) => (
              <div key={`${method}-${path}`} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 font-mono text-xs font-semibold text-cyan-300">
                    {method}
                  </span>
                  <code className="break-all text-sm text-slate-100">{path}</code>
                  <span className="rounded bg-slate-800 px-2 py-1 font-mono text-xs text-slate-400">{scope}</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-xl font-semibold text-white">Create Workspace</h2>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-800 bg-black/40 p-4 text-sm text-slate-300">
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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h2 className="text-xl font-semibold text-white">Request GHL Link</h2>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-800 bg-black/40 p-4 text-sm text-slate-300">
              <code>{`{
  "minutes": 15,
  "guest_email": "learner@example.com"
}`}</code>
            </pre>
            <p className="mt-4 text-sm text-slate-400">
              The returned private URL opens the GHL Score session for the selected block. Results include marker scores and gap analysis.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
