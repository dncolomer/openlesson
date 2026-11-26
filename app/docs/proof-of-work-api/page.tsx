import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { PublicConsoleWash, PublicPageField } from "@/components/ui/console-frame";
import { AGENT_TOOL_SURFACE } from "@/lib/pow-api/agent-tool-surface";

const sectionClass = "console-copy p-5 sm:p-6";
const labelClass = "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";
const codeBlockClass =
  "mt-3 overflow-x-auto border border-white/20 bg-black p-4 font-mono text-xs text-neutral-300 sm:text-sm";

export default function ProtocolApiPage() {
  return (
    <div className="relative min-h-screen">
      <PublicPageField />
      <PublicConsoleWash />
      <Navbar />
      <main className="relative z-10 mx-auto max-w-[96rem] px-4 py-10 sm:px-6 lg:px-8">
        <header className={`${sectionClass} mb-6`}>
          <p className={labelClass}>Public agent API v3</p>
          <h1 className="mt-2 text-3xl font-medium text-white">Protocol API</h1>
          <p className="mt-3 max-w-3xl text-sm text-neutral-400">
            Agents and humans create knowledge verification protocols with a Bearer API key.
            Proof of work is recorded in the product UI. Headless session upload is not a public
            agent API.
          </p>
        </header>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">Authentication</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Mint a key in the dashboard Integrations tab. Bearer endpoints require an active API Metered
            plan. Cookie dashboard and in-app sessions do not.
          </p>
          <pre className={codeBlockClass}>{`Authorization: Bearer sk_…
Content-Type: application/json`}</pre>
          <p className="mt-3 text-sm text-neutral-500">
            Each key is a single full-access token. MCP uses the same key on{" "}
            <code className="text-neutral-300">POST /api/mcp</code>.
          </p>
        </section>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">Rate limits</h2>
          <p className="mt-2 text-sm text-neutral-400">
            120 requests per minute per key. Exceeded returns{" "}
            <code className="text-neutral-300">429</code>{" "}
            <code className="text-neutral-300">rate_limit_exceeded</code>.
          </p>
        </section>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">What you can create</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-400">
            <li>
              <strong className="font-medium text-neutral-200">Protocols</strong> — knowledge
              verification protocols at{" "}
              <code className="text-neutral-300">/api/v3/protocols</code>. MCP tools{" "}
              <code className="text-neutral-300">list_protocols</code>,{" "}
              <code className="text-neutral-300">create_protocol</code>,{" "}
              <code className="text-neutral-300">upload_protocol_file</code>,{" "}
              <code className="text-neutral-300">generate_protocol_unsys_seed</code>,{" "}
              <code className="text-neutral-300">get_protocol</code>,{" "}
              <code className="text-neutral-300">update_protocol</code>, and{" "}
              <code className="text-neutral-300">delete_protocol</code> are 1:1 with these REST twins.
              Create/update take one Author source: written Protocol Challenge, files, or a prepared
              board. Do not send <code className="text-neutral-300">kind</code>.
            </li>
          </ul>
          <p className="mt-4 text-sm text-neutral-400">
            Choose one source. <code className="text-neutral-300">exact_problem_on_canvas</code> is
            valid only with a written <code className="text-neutral-300">challenge</code>. Files as the
            challenge source generate a new statement when a learner opens.{" "}
            <code className="text-neutral-300">opening_canvas_scene</code> ignores exact problem.
            Prepared board wins if more than one source is sent.
          </p>
          <pre className={codeBlockClass}>{`POST /api/v3/protocols
{
  "name": "Linear systems",
  "challenge": "Solve Ax = b",
  "exact_problem_on_canvas": true,
  "enforced_channels": { "audio": true, "muse": false, "video": false, "screenshots": false }
}

POST /api/v3/protocols
{
  "name": "Decoder",
  "artifacts": [{ "name": "brief.pdf", "xai_file_id": "file_…" }],
  "generate_problem_on_open": true
}

POST /api/v3/protocols
{
  "name": "Board protocol",
  "opening_canvas_scene": { "elements": [], "appState": {}, "files": {} }
}`}</pre>
        </section>

        <section className={`${sectionClass} mb-6`} id="endpoint-index">
          <h2 className="text-lg font-medium text-white">Endpoint index</h2>
          <p className="mt-2 text-sm text-neutral-400">
            MCP <code className="text-neutral-300">tools/list</code> is 1:1 with these REST twins.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {AGENT_TOOL_SURFACE.map((tool) => (
              <li key={tool.name}>
                <span className="font-mono text-neutral-300">{tool.rest.method}</span>{" "}
                <span className="text-neutral-400">{tool.rest.path}</span>
                <span className="ml-2 font-mono text-neutral-500">{tool.name}</span>
                <p className="mt-0.5 text-neutral-500">{tool.summary}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">MCP</h2>
          <pre className={codeBlockClass}>{`POST /api/mcp
Authorization: Bearer sk_…
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }`}</pre>
          <p className="mt-3 text-sm text-neutral-400">
            Partner loop: <code className="text-neutral-300">list_protocols</code>, then{" "}
            <code className="text-neutral-300">upload_protocol_file</code> →{" "}
            <code className="text-neutral-300">generate_protocol_unsys_seed</code> →{" "}
            <code className="text-neutral-300">create_protocol</code> →{" "}
            <code className="text-neutral-300">get_protocol</code> →{" "}
            <code className="text-neutral-300">update_protocol</code>. REST lives at{" "}
            <code className="text-neutral-300">/api/v3/protocols</code>.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Do not call <code className="text-neutral-400">start_session</code>,{" "}
            <code className="text-neutral-400">upload_proof_of_work</code>, or{" "}
            <code className="text-neutral-400">end_session</code>. Those tools are not on the public catalog.
            Static skill: <Link href="/skill.md" className="underline">/skill.md</Link>.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
