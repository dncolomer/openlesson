import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

const DOCS_BACKGROUND = "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg";

const sectionClass = "rounded-md border border-neutral-800 bg-neutral-950/75 p-5 sm:p-6";
const labelClass = "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";
const codeBlockClass = "mt-3 overflow-x-auto rounded-md border border-neutral-800 bg-black/60 p-4 font-mono text-xs text-neutral-300 sm:text-sm";

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
    path: "/api/v3/pow/workspaces",
    scope: "workspaces:write",
    summary:
      "Not available. Programmatic workspace creation is disabled; create workspaces manually in the product UI at /workspace/new.",
    status: "403 Forbidden",
    responseBody: [
      { name: "error.code", type: "string", description: "forbidden" },
      {
        name: "error.message",
        type: "string",
        description:
          "Workspace creation is not available via API or MCP. Create workspaces manually in the product UI at /workspace/new.",
      },
    ],
    responseExample: `{
  "error": {
    "code": "forbidden",
    "message": "Workspace creation is not available via API or MCP. Create workspaces manually in the product UI at /workspace/new."
  }
}`,
    notes: [
      "Workspace creation is UI-only (blank, template, or files+goal at /workspace/new).",
      "MCP tool create_workspace is not offered and hard-fails with the same message if called.",
      "Use list_workspaces / get_workspace / get_learning_progress against UI-created workspace IDs.",
    ],
  },
  {
    id: "lwm-snapshot",
    method: "POST",
    path: "/api/v3/snapshot/workspaces/{workspace_id}/lwm-snapshot",
    scope: "workspaces:read",
    summary:
      "LWM Snapshot score (0–100) + GHC + spider markers, analysis, and next actions. Sole product snapshot strategy. Manual Knowledge UI or Snapshot API/MCP (not auto on TAP/ILE end).",
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
    ],
    requestBody: [
      { name: "block_id", type: "uuid", description: "Optional: scope analysis to one block." },
      { name: "style_prompt", type: "string", description: "Optional voice/tone for narrative fields." },
      { name: "file_ids", type: "string[]", description: "Optional xAI file IDs from a prior score call. Empty → rebuild context bundle." },
    ],
    requestExample: `{ "block_id": "e57844a6-1b69-465c-9120-d0812d6339ae" }`,
    responseBody: [
      { name: "mode", type: '"score"', description: "Always score for this endpoint." },
      { name: "strategy", type: "string", description: "lwm_snapshot" },
      { name: "label", type: "string", description: "LWM Snapshot" },
      { name: "workspace_goal", type: "string", description: "Inferred or owner-set workspace goal." },
      { name: "report", type: "object", description: "LWM Snapshot score report payload." },
      { name: "report.score", type: "integer", description: "0–100 primary LWM Snapshot score." },
      { name: "report.lwm_snapshot_score", type: "integer", description: "Named primary field (equals score)." },
      { name: "report.ghc_score", type: "integer", description: "0–100 secondary GHC signal." },
      { name: "proof_of_work_summary", type: "object | null", description: "Counts used in context." },
      { name: "file_ids", type: "string[]", description: "xAI file IDs for follow-up calls." },
    ],
    responseExample: `{
  "mode": "score",
  "strategy": "lwm_snapshot",
  "label": "LWM Snapshot",
  "workspace_goal": "Trial-to-paid subscription activation",
  "report": {
    "score": 68,
    "lwm_snapshot_score": 68,
    "ghc_score": 40,
    "workspace_goal": "Trial-to-paid subscription activation",
    "marker_scores": [],
    "summary": "...",
    "confidence": "developing"
  },
  "proof_of_work_summary": {
    "blocks": 1,
    "proof_of_work_artifacts": 2,
    "linked_sessions": 0,
    "workspace_files": 0
  },
  "file_ids": ["file_814439bd-4894-4e11-852d-314e9f777a7f"]
}`,
    notes: [
      "Sole product score strategy — no verification/augmentation/optimization score routes.",
      "First call with empty file_ids uploads a workspace performance JSON summary + up to 19 artifact files to xAI.",
      "If no proof of work exists, returns 200 with an empty-data score template.",
    ],
  },
  {
    id: "create-tap-link",
    method: "POST",
    path: "/api/v3/pow/workspaces/{workspace_id}/tap-links",
    scope: "tap:write",
    summary: "Create a private Think Aloud Protocol (TAP) link for the workspace (or a block via body/path).",
    status: "201 Created",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
    ],
    requestBody: [
      { name: "block_id", type: "uuid", description: "Optional. When set, scopes the TAP session to that block. Omit for full-workspace scope." },
      { name: "minutes", type: "integer", description: "1–120; default 15." },
      { name: "guest_user_id", type: "uuid", description: "Org admin only: assign link to a guest by ID." },
      { name: "guest_email", type: "string", description: "Org admin only: assign link to a guest by email." },
      { name: "participant_type", type: "string", description: "anonymous | guest | user." },
      { name: "user_id", type: "uuid", description: "Member user id when participant_type=user." },
      { name: "post_session", type: "string", description: "redirect_workspace | show_results | redirect_url." },
      { name: "redirect_url", type: "string", description: "Required when post_session=redirect_url." },
    ],
    requestExample: `{
  "minutes": 15,
  "participant_type": "anonymous"
}`,
    responseBody: [
      { name: "tap_link.id", type: "uuid", description: "TAP link / session row ID." },
      { name: "tap_link.workspace_id", type: "uuid", description: "Workspace ID." },
      { name: "tap_link.block_id", type: "uuid | null", description: "Block ID when scoped; null for full workspace." },
      { name: "tap_link.status", type: "string", description: "pending | in_progress | completed" },
      { name: "tap_link.requested_duration_seconds", type: "integer", description: "Requested duration in seconds." },
      { name: "tap_link.focus_block_ids", type: "uuid[]", description: "Focused block IDs (empty = full workspace)." },
      { name: "tap_link.created_at", type: "ISO-8601", description: "Link creation time." },
      { name: "tap_link.private_url", type: "string", description: "Bearer URL: /tap/session/{token}. No login required." },
      { name: "interruption", type: "object | null", description: "TIM predictive interruption (see Predictive interruptions)." },
    ],
    responseExample: `{
  "tap_link": {
    "id": "ae0cc774-1832-4bb5-bc7d-bf119ddf759f",
    "workspace_id": "75b3b4ef-4e47-4f39-bb09-f61406603d75",
    "block_id": null,
    "status": "pending",
    "requested_duration_seconds": 900,
    "focus_block_ids": [],
    "created_at": "2026-06-23T01:29:03.861663+00:00",
    "private_url": "https://uncertain.systems/tap/session/E8-ouJ9lErgDEmteyKc4tJ39meJ91vzZFNUiuRauHvw"
  }
}`,
    notes: [
      "Also available as POST .../blocks/{block_id}/tap-links for block-scoped links (same body fields).",
      "Guest keys auto-attach the link to their guest identity.",
      "Org admins may set guest_user_id or guest_email to assign the link (404 guest_not_found if missing).",
      "Learner completes session at private_url without an API key.",
    ],
  },
  {
    id: "list-tap-links",
    method: "GET",
    path: "/api/v3/pow/workspaces/{workspace_id}/tap-links",
    scope: "tap:read",
    summary: "List TAP links for a workspace (filtered by caller role).",
    status: "200 OK",
    pathParams: [
      { name: "workspace_id", type: "uuid", required: true, description: "Workspace ID." },
    ],
    responseBody: [
      { name: "tap_links", type: "array", description: "Sessions ordered by created_at descending." },
      { name: "tap_links[].id", type: "uuid", description: "Link ID." },
      { name: "tap_links[].workspace_id", type: "uuid", description: "Workspace ID." },
      { name: "tap_links[].block_id", type: "uuid | null", description: "Block ID when scoped; null for full workspace." },
      { name: "tap_links[].status", type: "string", description: "pending | in_progress | completed" },
      { name: "tap_links[].requested_duration_seconds", type: "integer", description: "Requested duration." },
      { name: "tap_links[].duration_seconds", type: "integer", description: "Actual duration (0 until completed)." },
      { name: "tap_links[].focus_block_ids", type: "uuid[]", description: "Focused blocks." },
      { name: "tap_links[].score", type: "integer | null", description: "Score when completed." },
      { name: "tap_links[].created_at", type: "ISO-8601", description: "Created at." },
      { name: "tap_links[].started_at", type: "ISO-8601 | null", description: "Started at." },
      { name: "tap_links[].completed_at", type: "ISO-8601 | null", description: "Completed at." },
      { name: "interruption", type: "object | null", description: "TIM predictive interruption." },
    ],
    responseExample: `{
  "tap_links": [
    {
      "id": "ae0cc774-1832-4bb5-bc7d-bf119ddf759f",
      "workspace_id": "75b3b4ef-4e47-4f39-bb09-f61406603d75",
      "block_id": "88a43ad8-62f8-4252-a847-2cbc0b754a57",
      "status": "completed",
      "requested_duration_seconds": 900,
      "duration_seconds": 120,
      "focus_block_ids": ["88a43ad8-62f8-4252-a847-2cbc0b754a57"],
      "lwm_snapshot_score": 72,
      "created_at": "2026-06-23T01:29:03.861663+00:00",
      "started_at": "2026-06-23T01:30:00+00:00",
      "completed_at": "2026-06-23T01:32:21.492+00:00"
    }
  ]
}`,
    notes: [
      "Guests see only their own links.",
      "Non-admin members see only links they created.",
      "Org admins see all links on org workspaces.",

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
        <span className="rounded-sm border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[10px] uppercase tracking-[1.4px] text-neutral-300">
          {spec.method}
        </span>
        <code className="break-all text-sm text-neutral-200">{spec.path}</code>
        <span className="rounded-sm border border-neutral-800 bg-black/40 px-2 py-1 font-mono text-[10px] text-neutral-500">
          {spec.scope}
        </span>
        <span className="rounded-sm border border-cyan-400/20 bg-cyan-950/20 px-2 py-1 font-mono text-[10px] text-cyan-200/90">
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
      className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-white"
      style={{
        backgroundImage: `linear-gradient(rgba(10,10,10,0.88), rgba(10,10,10,0.92)), url(${DOCS_BACKGROUND})`,
      }}
    >
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <header className={`${sectionClass} mb-8`}>
          <p className={labelClass}>Uncertain Systems Proof-of-Work API</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
            Workspace API Reference
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-neutral-400 sm:text-base">
            Full request and response specifications for every Proof-of-Work API endpoint: workspaces, proof-of-work schema
            generation, integration skill generation, proof-of-work upload, performance analysis, TAP links, ILE practice, guest
            provisioning, and dashboard key management. Bearer endpoints use base path{" "}
            <code className="text-neutral-300">/api/v3/pow</code> and require active{" "}
            <code className="text-neutral-300">api_metered</code>.
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
              { name: "workspaces:read", type: "scope", description: "List blocks; generate proof-of-work schemas and integration skills; call lwm-snapshot (LWM Snapshot)." },
              { name: "workspaces:write", type: "scope", description: "Upload proof of work (workspace create is UI-only)." },
              { name: "tap:read", type: "scope", description: "List TAP links and poll completion status (score via POST .../lwm-snapshot)." },
              { name: "tap:write", type: "scope", description: "Create Think Aloud Protocol (TAP) links for blocks." },
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
          <h2 className="text-lg font-medium text-white">TAP session completion (learner-facing)</h2>
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
  );
}