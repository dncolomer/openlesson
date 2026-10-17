import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { PublicConsoleWash } from "@/components/ui/console-frame";

const DOCS_BACKGROUND = "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg";

const sectionClass = "console-copy p-5 sm:p-6";
const labelClass = "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";
const codeBlockClass = "mt-3 overflow-x-auto border border-white/20 bg-black p-4 font-mono text-xs text-neutral-300 sm:text-sm";

type FieldSpec = {
  name: string;
  type: string;
  required?: boolean;
  description: string;
};

type EndpointSpec = {
  id: string;
  method: string;
  path: string;
  scope: string;
  summary: string;
  status: string;
  pathParams?: FieldSpec[];
  queryParams?: FieldSpec[];
  requestBody?: FieldSpec[];
  requestExample?: string;
  responseBody?: FieldSpec[];
  responseExample?: string;
  notes?: string[];
};

const ENDPOINT_SPECS: EndpointSpec[] = [
  {
    id: "create-workspace",
    method: "POST",
    path: "/api/v3/workspaces",
    scope: "workspaces:write",
    summary:
      "Create a Learning or Verification workspace, including an optional map and settings. MCP: create_workspace.",
    status: "201 Created",
    requestBody: [
      { name: "kind", type: "string", description: "learning | verification" },
      { name: "title", type: "string", description: "Workspace title." },
      { name: "workspace_goal", type: "string", description: "What success looks like." },
      { name: "learning_model_size", type: "number", description: "Action catalog 4 | 8 | 16." },
      { name: "blocks", type: "array", description: "Optional map blocks." },
      { name: "initial_prompt", type: "string", description: "Optional generation prompt." },
    ],
    requestExample: `{
  "kind": "verification",
  "title": "Discovery mastery",
  "blocks": [{ "title": "Chapter", "description": "Priced field", "is_start": true }]
}`,
    notes: [
      "Same core as /workspace/new.",
      "Then run Calibrate, Learn, or Verify via start_session.",
    ],
  },
  {
    id: "start-session",
    method: "POST",
    path: "/api/v3/pow/workspaces/{workspace_id}/sessions",
    scope: "workspaces:write",
    summary:
      "Start a headless Calibrate, Learn, or Verify session. Prepares the answers-model tree and starts the clock. MCP: start_session.",
    status: "201 Created",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
    ],
    requestBody: [
      { name: "flow_kind", type: "string", required: true, description: "calibrate | learn | verify" },
      { name: "catalog_size", type: "number", description: "4 | 8 | 16" },
      { name: "duration_minutes", type: "integer", description: "1–120; default 15." },
      { name: "block_id", type: "uuid", description: "Optional map block to focus." },
      { name: "chapter_title", type: "string", description: "Optional chapter title." },
      { name: "chapter_brief", type: "string", description: "Optional chapter brief." },
    ],
    requestExample: `{
  "flow_kind": "calibrate",
  "catalog_size": 8,
  "duration_minutes": 15
}`,
    responseBody: [
      { name: "session_id", type: "uuid", description: "Headless session id." },
      { name: "remaining_ms", type: "integer", description: "Time left on the clock." },
      { name: "answers_model", type: "object", description: "Prepared tree (catalog_size, focus, branch_count)." },
      { name: "status", type: "string", description: "in_progress | ended | expired" },
    ],
    notes: ["flow_kind is calibrate, learn, or verify."],
  },
  {
    id: "upload-proof-of-work",
    method: "POST",
    path: "/api/v3/pow/workspaces/{workspace_id}/sessions/{session_id}/proof-of-work",
    scope: "workspaces:write",
    summary:
      "Submit proof of work into a live headless session. The server infers the path on the prepared tree. Expired sessions reject further work. MCP: upload_proof_of_work.",
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
      { name: "session_id", type: "uuid", required: true, description: "Session ID from start_session." },
    ],
    requestBody: [
      { name: "events", type: "array", description: "Proof events (tool_action + metadata)." },
    ],
    requestExample: `{
  "events": [
    { "tool_action": "board_prompt", "metadata": { "prompt": "I close this observation." } }
  ]
}`,
    notes: ["401 session_expired when the clock has run out."],
  },
  {
    id: "end-session",
    method: "POST",
    path: "/api/v3/pow/workspaces/{workspace_id}/sessions/{session_id}/end",
    scope: "workspaces:write",
    summary:
      "End the session: score the inferred path against the prepared tree and persist the flow embedding. MCP: end_session.",
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
      { name: "session_id", type: "uuid", required: true, description: "Session ID." },
    ],
  },
  {
    id: "create-guest",
    method: "POST",
    path: "/api/v3/pow/org/guests",
    scope: "org:write",
    summary: "Create or look up a guest by email and issue a new guest API key (gsk_).",
    status: "201 Created (new guest) or 200 OK (existing guest)",
    requestBody: [
      { name: "email", type: "string", required: true, description: "Guest email address (normalized to lowercase)." },
    ],
    requestExample: `{ "email": "learner@example.com" }`,
    responseBody: [
      { name: "guest_user.id", type: "uuid", description: "organization_guest_users.id" },
      { name: "guest_user.organization_id", type: "uuid", description: "Org the guest belongs to." },
      { name: "guest_user.email", type: "string", description: "Guest email." },
      { name: "guest_user.status", type: "string", description: "active | claimed | revoked" },
      { name: "guest_user.claimed_by_user_id", type: "uuid | null", description: "Set when guest signs up with same email." },
      { name: "guest_user.claimed_at", type: "ISO-8601 | null", description: "Claim timestamp." },
      { name: "guest_user.created_at", type: "ISO-8601", description: "Guest record created at." },
      { name: "api_key", type: "string", description: "Raw gsk_ key — shown once; store securely." },
      { name: "key.id", type: "uuid", description: "agent_api_keys.id" },
      { name: "key.key_prefix", type: "string", description: "First 13 chars of key for identification." },
      { name: "key.scopes", type: "string[]", description: "workspaces:read, workspaces:write, tap:read, tap:write" },
      { name: "key.rate_limit", type: "integer", description: "Requests per minute (default 120)." },
      { name: "key.created_at", type: "ISO-8601", description: "Key creation time." },
    ],
    responseExample: `{
  "guest_user": {
    "id": "f8b2c1d0-1234-5678-9abc-def012345678",
    "organization_id": "64cc093b-31c1-4a7e-aead-e2e9378ecaf4",
    "email": "learner@example.com",
    "status": "active",
    "claimed_by_user_id": null,
    "claimed_at": null,
    "created_at": "2026-06-23T13:00:00+00:00"
  },
  "api_key": "gsk_a1b2c3d4e5f6789012345678abcdef",
  "key": {
    "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "key_prefix": "gsk_a1b2c3d4",
    "scopes": ["workspaces:read", "workspaces:write", "tap:read", "tap:write"],
    "rate_limit": 120,
    "created_at": "2026-06-23T13:00:01+00:00"
  }
}`,
    notes: [
      "Caller must be organization admin with org:write on their sk_ key.",
      "Re-calling for the same email mints another key; prior keys may remain active.",
      "409 if email belongs to a real user in another organization.",
    ],
  },
  {
    id: "list-keys",
    method: "GET",
    path: "/api/v3/pow/keys",
    scope: "browser session",
    summary: "List API keys for the signed-in dashboard user. Uses Supabase session cookies — not Bearer API key auth.",
    status: "200 OK",
    responseBody: [
      { name: "keys", type: "array", description: "All agent_api_keys for the authenticated user, newest first." },
      { name: "keys[].id", type: "uuid", description: "Key ID." },
      { name: "keys[].label", type: "string | null", description: "Optional label set at creation." },
      { name: "keys[].key_prefix", type: "string", description: "First 12 characters of sk_ key (identification only)." },
      { name: "keys[].scopes", type: "string[]", description: "Assigned scopes." },
      { name: "keys[].rate_limit", type: "integer", description: "Requests per minute (default 120)." },
      { name: "keys[].is_active", type: "boolean", description: "False after revocation." },
      { name: "keys[].created_at", type: "ISO-8601", description: "Creation timestamp." },
      { name: "keys[].last_used_at", type: "ISO-8601 | null", description: "Last successful API call." },
      { name: "keys[].expires_at", type: "ISO-8601 | null", description: "Expiry if set at creation." },
    ],
    responseExample: `{
  "keys": [
    {
      "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "label": "Production agent",
      "key_prefix": "sk_a1b2c3d4e5",
      "scopes": ["workspaces:read", "workspaces:write", "tap:read", "tap:write"],
      "rate_limit": 120,
      "is_active": true,
      "created_at": "2026-06-23T12:00:00+00:00",
      "last_used_at": "2026-06-23T13:05:00+00:00",
      "expires_at": null
    }
  ]
}`,
    notes: ["Also available from Dashboard → Usage & API. Max 10 active keys per user."],
  },
  {
    id: "create-key",
    method: "POST",
    path: "/api/v3/pow/keys",
    scope: "browser session",
    summary: "Create a new sk_ API key for the signed-in user. Raw key returned once.",
    status: "201 Created",
    requestBody: [
      { name: "label", type: "string", description: "Optional label, max 128 characters." },
      {
        name: "scopes",
        type: "string[]",
        description: "Optional. Default: workspaces:read, workspaces:write, tap:read, tap:write. org:read/org:write require org admin.",
      },
      { name: "expires_in_days", type: "integer", description: "Optional expiry: 1–365 days." },
    ],
    requestExample: `{
  "label": "CI pipeline",
  "scopes": ["workspaces:read", "workspaces:write", "tap:read", "tap:write", "org:write"],
  "expires_in_days": 90
}`,
    responseBody: [
      { name: "key.id", type: "uuid", description: "agent_api_keys.id" },
      { name: "key.label", type: "string | null", description: "Label if provided." },
      { name: "key.key_prefix", type: "string", description: "First 12 chars of sk_ key." },
      { name: "key.scopes", type: "string[]", description: "Assigned scopes." },
      { name: "key.rate_limit", type: "integer", description: "Default 120." },
      { name: "key.created_at", type: "ISO-8601", description: "Creation time." },
      { name: "key.expires_at", type: "ISO-8601 | null", description: "Expiry if set." },
      { name: "api_key", type: "string", description: "Full sk_ key — shown once; store securely." },
    ],
    responseExample: `{
  "key": {
    "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "label": "CI pipeline",
    "key_prefix": "sk_a1b2c3d4e5",
    "scopes": ["workspaces:read", "workspaces:write", "tap:read", "tap:write", "org:write"],
    "rate_limit": 120,
    "created_at": "2026-06-23T12:00:00+00:00",
    "expires_at": "2026-09-21T12:00:00+00:00"
  },
  "api_key": "sk_7f3a9b2c1d4e5f6789012345678abcdef"
}`,
    notes: [
      "Requires Teams tier (403 api_plan_required).",
      "Valid scopes: *, workspaces:read, workspaces:write, tap:read, tap:write, org:read, org:write.",
      "403 if more than 10 active keys or if non-admin requests org scopes.",
    ],
  },
  {
    id: "revoke-key",
    method: "DELETE",
    path: "/api/v3/pow/keys/{key_id}",
    scope: "browser session",
    summary: "Revoke (soft-delete) an API key owned by the signed-in user.",
    status: "200 OK",
    pathParams: [
      { name: "key_id", type: "uuid", required: true, description: "agent_api_keys.id from list or create." },
    ],
    responseBody: [
      { name: "deleted", type: "boolean", description: "True on success." },
      { name: "key_id", type: "uuid", description: "Revoked key ID." },
    ],
    responseExample: `{
  "deleted": true,
  "key_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
}`,
    notes: ["404 not_found if key does not belong to user. 400 if already revoked."],
  },
  {
    id: "update-key-scopes",
    method: "PATCH",
    path: "/api/v3/pow/keys/{key_id}/scopes",
    scope: "browser session",
    summary: "Replace scopes on an active API key.",
    status: "200 OK",
    pathParams: [
      { name: "key_id", type: "uuid", required: true, description: "agent_api_keys.id." },
    ],
    requestBody: [
      { name: "scopes", type: "string[]", required: true, description: "Non-empty array of valid scope strings." },
    ],
    requestExample: `{
  "scopes": ["workspaces:read", "tap:read"]
}`,
    responseBody: [
      { name: "key.id", type: "uuid", description: "Updated key ID." },
      { name: "key.scopes", type: "string[]", description: "New scope list." },
      { name: "key.updated_at", type: "ISO-8601", description: "Update timestamp." },
    ],
    responseExample: `{
  "key": {
    "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "scopes": ["workspaces:read", "tap:read"],
    "updated_at": "2026-06-23T13:10:00+00:00"
  }
}`,
    notes: ["Cannot update revoked keys. org:read/org:write require organization admin."],
  },
];

function FieldTable({ title, fields }: { title: string; fields: FieldSpec[] }) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-neutral-300">{title}</h4>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-500">
              <th className="py-2 pr-4 font-medium">Field</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Required</th>
              <th className="py-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.name} className="border-b border-neutral-800/60 align-top">
                <td className="py-2 pr-4 font-mono text-neutral-200">{field.name}</td>
                <td className="py-2 pr-4 text-neutral-400">{field.type}</td>
                <td className="py-2 pr-4 text-neutral-500">{field.required ? "yes" : "—"}</td>
                <td className="py-2 text-neutral-400">{field.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EndpointDoc({ spec }: { spec: EndpointSpec }) {
  return (
    <section id={spec.id} className={`${sectionClass} scroll-mt-24`}>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="rounded-none border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[10px] uppercase tracking-[1.4px] text-neutral-300">
          {spec.method}
        </span>
        <code className="break-all text-sm text-neutral-200">{spec.path}</code>
        <span className="console-chip px-2 py-1 font-mono text-[10px] text-neutral-500">
          {spec.scope}
        </span>
        <span className="console-chip px-2 py-1 font-mono text-[10px] text-neutral-300/90">
          {spec.status}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-neutral-400">{spec.summary}</p>

      {spec.pathParams && <FieldTable title="Path parameters" fields={spec.pathParams} />}
      {spec.queryParams && <FieldTable title="Query parameters" fields={spec.queryParams} />}
      {spec.requestBody && <FieldTable title="Request body (JSON)" fields={spec.requestBody} />}

      {spec.requestExample && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-neutral-300">Request example</h4>
          <pre className={codeBlockClass}>
            <code>{spec.requestExample}</code>
          </pre>
        </div>
      )}

      {spec.responseBody && <FieldTable title="Response body" fields={spec.responseBody} />}

      {spec.responseExample && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-neutral-300">Response example</h4>
          <pre className={codeBlockClass}>
            <code>{spec.responseExample}</code>
          </pre>
        </div>
      )}

      {spec.notes && spec.notes.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-neutral-500">
          {spec.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AgenticV2DocsPage() {
  return (
    <div
      className="relative min-h-screen overflow-hidden border border-white/40 bg-black bg-cover bg-fixed bg-center text-white"
      style={{
        backgroundImage: `linear-gradient(rgba(10,10,10,0.88), rgba(10,10,10,0.92)), url(${DOCS_BACKGROUND})`,
      }}
    >
      <PublicConsoleWash />
      <div className="relative z-10">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <header className={`${sectionClass} mb-8`}>
          <p className={labelClass}>Uncertain Systems Proof-of-Work API</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
            Workspace API Reference
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-neutral-400 sm:text-base">
            Two public agent APIs: workspace management (<code className="text-neutral-300">/api/v3/workspaces</code>) and
            headless proof-of-work (<code className="text-neutral-300">/api/v3/pow</code>). Create Learning or Verification
            workspaces, then start, run, and end Calibrate, Learn, and Verify sessions headless. Snapshot and Stash are
            product-UI routes. Bearer endpoints require active{" "}
            <code className="text-neutral-300">api_metered</code>.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/skill.md"
              className="inline-flex h-10 items-center justify-center rounded-none bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200"
            >
              Agent skill file →
            </Link>
            <Link
              href="/dashboard?tab=usage"
              className="inline-flex h-10 items-center justify-center rounded-none border border-neutral-700 px-4 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white"
            >
              Get API key
            </Link>
          </div>
        </header>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">Authentication</h2>
          <pre className={codeBlockClass}>
            <code>{`Authorization: Bearer <api_key>
Content-Type: application/json`}</code>
          </pre>
          <FieldTable
            title="Key types"
            fields={[
              { name: "sk_", type: "string prefix", description: "Organization member key from dashboard or POST /api/v3/pow/keys (browser session)." },
              { name: "gsk_", type: "string prefix", description: "Guest key from POST /api/v3/pow/org/guests." },
            ]}
          />
          <div className="mt-4">
            <h4 className="text-sm font-medium text-neutral-300">Error response</h4>
            <pre className={codeBlockClass}>
              <code>{`{
  "error": {
    "code": "forbidden",
    "message": "Human-readable explanation",
    "details": {}
  }
}`}</code>
            </pre>
            <p className="mt-2 text-sm text-neutral-500">
              Common codes: unauthorized, key_revoked, key_expired, forbidden, api_plan_required, validation_error,
              workspace_not_found, block_not_found, tap_link_not_found, guest_not_found, not_found, rate_limit_exceeded
              (429).
            </p>
          </div>
        </section>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">Evaluation modes</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Workspaces use <code className="text-neutral-300">evaluation_mode</code> to choose between full semantic
            verification and privacy-preserving opaque protocol verification.
          </p>
          <FieldTable
            title="Modes"
            fields={[
              {
                name: "semantic",
                type: "default",
                description:
                  "Create with initial_prompt. Schema uses definition. Performance returns semantic gap_analysis.",
              },
              {
                name: "opaque",
                type: "privacy mode",
                description:
                  "Create with protocol (protocol_id, goal_ref). Schema uses definition_ref + contract.event_verbs. Performance returns protocol_report; partner refs are stored but not semantically inferred.",
              },
            ]}
          />
          <p className="mt-4 text-sm text-neutral-500">
            Canonical opaque protocol <code className="text-neutral-400">agent-trace-v3</code>: enumerate → fingerprint →
            aggregate → emit → validate. Upload metadata is allowlisted; tool payloads are plaintext-linted in opaque mode.
          </p>
        </section>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">Scopes</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Each Bearer-authenticated endpoint requires one scope. The wildcard <code className="text-neutral-300">*</code>{" "}
            grants all scopes.
          </p>
          <FieldTable
            title="Scope reference"
            fields={[
              { name: "workspaces:read", type: "scope", description: "List workspaces, map, settings, sessions, and flow embeddings; generate integration skills." },
              { name: "workspaces:write", type: "scope", description: "Create and edit workspaces; start, upload, and end headless sessions." },
              { name: "tap:read", type: "scope", description: "Read session-related workspace access (headless sessions use workspaces:read)." },
              { name: "tap:write", type: "scope", description: "Write session-related workspace access (headless sessions use workspaces:write)." },
              { name: "org:read", type: "scope", description: "Reserved for org admin keys (future org read endpoints)." },
              { name: "org:write", type: "scope", description: "Create guest users and issue gsk_ keys." },
              { name: "*", type: "scope", description: "All scopes. Org admins only when assigning to sk_ keys." },
            ]}
          />
          <p className="mt-3 text-sm text-neutral-500">
            Default sk_ key scopes: workspaces:read, workspaces:write, tap:read, tap:write. Guest gsk_ keys receive the
            same four scopes automatically.
          </p>
        </section>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">Rate limits</h2>
          <p className="mt-2 text-sm text-neutral-400">
            API keys default to <strong className="font-medium text-neutral-300">120 requests per minute</strong> per key.
            Exceeding the limit returns 429 with code <code className="text-neutral-300">rate_limit_exceeded</code>.
          </p>
        </section>

        <section className={`${sectionClass} mb-6`}>
          <h2 className="text-lg font-medium text-white">Endpoint index</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {ENDPOINT_SPECS.map((spec) => (
              <li key={spec.id}>
                <a href={`#${spec.id}`} className="text-neutral-400 underline decoration-neutral-700 underline-offset-4 hover:text-white">
                  <span className="font-mono text-neutral-300">{spec.method}</span> {spec.path}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          {ENDPOINT_SPECS.map((spec) => (
            <EndpointDoc key={spec.id} spec={spec} />
          ))}
        </div>

        <section className={`${sectionClass} mt-6`}>
          <h2 className="text-lg font-medium text-white">Session completion (learner-facing)</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Learners open <code className="text-neutral-300">private_url</code> without an API key. Completion uses web
            APIs (not Proof-of-Work API):
          </p>
          <FieldTable
            title="POST /api/workspace-tap-score/chat"
            fields={[
              { name: "privateToken", type: "string", required: true, description: "Token from private_url path." },
              { name: "thought", type: "string", required: true, description: "Learner thought fragment." },
              { name: "messages", type: "array", description: "Optional prior chat messages." },
            ]}
          />
          <FieldTable
            title="POST /api/workspace-tap-score/complete"
            fields={[
              { name: "privateToken", type: "string", required: true, description: "Token from private_url path." },
              { name: "transcript", type: "array", required: true, description: "Session transcript entries with role and text." },
              { name: "durationSeconds", type: "integer", description: "Elapsed session seconds." },
            ]}
          />
        </section>

        <section className={`${sectionClass} mt-6 border-white/10`}>
          <p className={labelClass}>For agents</p>
          <h2 className="mt-2 text-lg font-medium text-white">Machine-readable spec</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            Agents should also load{" "}
            <Link href="/skill.md" className="text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white">
              /skill.md
            </Link>{" "}
            for integration checklists, guest responsibilities, and MCP transport. Generate a custom skill per
            workspace via{" "}
            <code className="text-neutral-300">POST .../integration-skill</code>, or add the PumaDoc policy snippets:{" "}
            <Link
              href="/customer-agent-uncertain-systems-policy.md"
              className="text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white"
            >
              Customer Agent policy
            </Link>
            ,{" "}
            <Link
              href="/pumaclaw-mentor-uncertain-systems-policy.md"
              className="text-neutral-200 underline decoration-neutral-600 underline-offset-4 hover:text-white"
            >
              PumaClaw Mentor policy
            </Link>
            .
          </p>
        </section>
      </main>
      <Footer />
      </div>
    </div>
  );
}