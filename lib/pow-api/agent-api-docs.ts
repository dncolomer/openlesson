/**
 * Shared Protocol API / Knowledge Regions API documentation catalog.
 * Docs UI, public /skill.md, and generated partner skills all read this.
 */

import {
  EXPLORATION_STRATEGIES,
  EXPLORATION_STRATEGY_IDS,
} from "@/lib/region-simulation";
import { AGENT_TOOL_SURFACE, type AgentToolSurfaceEntry } from "./agent-tool-surface";
import {
  AGENT_API_EXAMPLE_JOB_ID,
  AGENT_API_EXAMPLE_ORG_ID,
  AGENT_API_EXAMPLE_PROTOCOL_ID,
  AGENT_API_EXAMPLE_REGION_ID,
  agentApiExampleSnippets,
  type AgentApiExampleLanguage,
} from "./agent-api-examples";

export type AgentApiErrorDoc = {
  id: string;
  code: string;
  status: number;
  message: string;
  details?: Record<string, unknown>;
  summary: string;
  tools: "all" | readonly string[];
};

export type AgentApiSchemaDoc = {
  id: string;
  title: string;
  kind: "request" | "response";
  summary: string;
  example: Record<string, unknown> | unknown[];
  tools: readonly string[];
};

export const AGENT_API_PUBLIC_ERRORS: readonly AgentApiErrorDoc[] = [
  {
    id: "unauthorized",
    code: "unauthorized",
    status: 401,
    message: "Missing or invalid Authorization header",
    summary: "Bearer key missing or invalid.",
    tools: "all",
  },
  {
    id: "key_revoked",
    code: "key_revoked",
    status: 401,
    message: "API key has been revoked",
    summary: "Key is inactive.",
    tools: "all",
  },
  {
    id: "key_expired",
    code: "key_expired",
    status: 401,
    message: "API key has expired",
    summary: "Key past expires_at.",
    tools: "all",
  },
  {
    id: "api_plan_required",
    code: "api_plan_required",
    status: 403,
    message: "API Metered plan required",
    summary: "Bearer endpoints require an active API Metered plan.",
    tools: "all",
  },
  {
    id: "forbidden",
    code: "forbidden",
    status: 403,
    message: "Forbidden",
    summary: "Caller is not a member of the requested organization.",
    tools: "all",
  },
  {
    id: "organization_id_required",
    code: "organization_id_required",
    status: 400,
    message: "organization_id is required",
    summary: "Pass organization_id in JSON, query, or X-Organization-Id.",
    tools: "all",
  },
  {
    id: "rate_limit_exceeded",
    code: "rate_limit_exceeded",
    status: 429,
    message: "API rate limit exceeded",
    details: { limit: 120, remaining: 0 },
    summary: "120 requests per minute per key.",
    tools: "all",
  },
  {
    id: "not_found",
    code: "not_found",
    status: 404,
    message: "Protocol not found",
    summary: "Unknown protocol_id, knowledge_region_id, job_id, run_id, or candidate_id.",
    tools: [
      "get_protocol",
      "get_protocol_url",
      "update_protocol",
      "delete_protocol",
      "get_knowledge_region",
      "update_knowledge_region",
      "delete_knowledge_region",
      "simulate_knowledge_region",
      "get_knowledge_region_job",
      "get_knowledge_region_run",
      "get_knowledge_region_candidate",
      "get_knowledge_region_uncertainty_model",
    ],
  },
  {
    id: "validation_error",
    code: "validation_error",
    status: 400,
    message: "challenge is required",
    summary: "Write bodies that fail authoring or wizard validation.",
    tools: [
      "create_protocol",
      "update_protocol",
      "upload_protocol_file",
      "generate_protocol_unsys_seed",
      "create_knowledge_region",
      "update_knowledge_region",
      "simulate_knowledge_region",
    ],
  },
];

export const AGENT_API_SCHEMAS: readonly AgentApiSchemaDoc[] = [
  {
    id: "enforced_channels",
    title: "enforced_channels",
    kind: "request",
    summary: "Channels the protocol run requires. Audio default on for written protocols.",
    example: { audio: true, muse: false, video: false, screenshots: false },
    tools: ["create_protocol", "update_protocol"],
  },
  {
    id: "canvas_capture",
    title: "canvas_capture",
    kind: "request",
    summary: "Store mermaid documents of the Work canvas every N actions. Default off.",
    example: { enabled: true, every_actions: 8 },
    tools: ["create_protocol", "update_protocol"],
  },
  {
    id: "answers_model_seed",
    title: "answers_model_seed",
    kind: "request",
    summary:
      "Uncertainty model. Canonical { model } with priced parent→child edges, or nested { title, children, weight }. Aliases uncertainty_model, unsys_model. JSON string accepted.",
    example: {
      model: {
        rootId: "linear-systems",
        branches: [
          {
            id: "linear-systems",
            title: "Linear systems",
            parentId: null,
            observation: "Ax = b",
            children: [
              { id: "row-reduce", title: "Row reduce", weight: 0.3 },
              { id: "inverse", title: "Inverse", weight: 0.8 },
            ],
          },
        ],
      },
    },
    tools: ["create_protocol", "update_protocol", "generate_protocol_unsys_seed"],
  },
  {
    id: "opening_canvas_scene",
    title: "opening_canvas_scene",
    kind: "request",
    summary: "Prepared board source. The Work canvas is the challenge.",
    example: { elements: [], appState: {}, files: {} },
    tools: ["create_protocol", "update_protocol"],
  },
  {
    id: "artifacts",
    title: "artifacts",
    kind: "request",
    summary:
      "From files source, or Unsys context on a written challenge. Pass file_id from upload_protocol_file (opaque BlobStore id), or inline base64 data.",
    example: [{ name: "brief.pdf", mime_type: "application/pdf", file_id: "file_…" }],
    tools: ["create_protocol", "update_protocol", "generate_protocol_unsys_seed"],
  },
  {
    id: "protocol",
    title: "protocol",
    kind: "response",
    summary: "Presented knowledge verification protocol.",
    example: {
      id: AGENT_API_EXAMPLE_PROTOCOL_ID,
      name: "Linear systems",
      challenge: "Solve Ax = b",
      questions: ["Solve Ax = b"],
      artifacts: [],
      duration_minutes: null,
      authoring_source: "problem",
      exact_problem_on_canvas: true,
      generate_problem_on_open: false,
      opening_canvas_scene: null,
      answers_model_seed: null,
      enforced_channels: { audio: true, muse: false, video: false, screenshots: false },
      canvas_capture: { enabled: false, everyActions: 8 },
      public_token: "vf_…",
      workspace_id: null,
      owner_user_id: "user_…",
      organization_id: AGENT_API_EXAMPLE_ORG_ID,
      protocol_setting_id: null,
      created_at: "2026-11-27T00:00:00.000Z",
      updated_at: "2026-11-27T00:00:00.000Z",
    },
    tools: ["create_protocol", "get_protocol", "update_protocol", "list_protocols"],
  },
  {
    id: "protocol_url",
    title: "protocol_url",
    kind: "response",
    summary: "Public launch URL. identity is null when the learner will be asked for an ID.",
    example: {
      protocol_id: AGENT_API_EXAMPLE_PROTOCOL_ID,
      url: "https://uncertain.systems/v/vf_…?identity=learner-42",
      path: "/v/vf_…?identity=learner-42",
      identity: "learner-42",
    },
    tools: ["get_protocol_url"],
  },
  {
    id: "custom_strategies",
    title: "custom_strategies",
    kind: "request",
    summary:
      "Custom exploration strategies for create_knowledge_region and simulate_knowledge_region. A prompt string, { prompt }, or { name, prompt } is enough. Included even when strategy_ids omits the generated custom id.",
    example: [
      { prompt: "Ask more questions before you commit to an answer." },
      { name: "Stay on substitution", prompt: "Pick substitution and stay with it." },
      "Stay on substitution and do not switch methods.",
    ],
    tools: ["create_knowledge_region", "simulate_knowledge_region"],
  },
  {
    id: "knowledge_region_create",
    title: "create_knowledge_region",
    kind: "request",
    summary:
      "Simulation wizard body. strategy_ids are built-in catalog ids. custom_strategies add prompt-defined walks.",
    example: {
      organization_id: AGENT_API_EXAMPLE_ORG_ID,
      name: "Linear systems region",
      protocol_ids: [AGENT_API_EXAMPLE_PROTOCOL_ID],
      strategy_ids: ["exploit-heavy", "information-seeking"],
      custom_strategies: [{ prompt: "Ask more questions before you commit to an answer." }],
      samples_per_strategy: 12,
      include_human_data: false,
      ai_use_catalog_ids: [],
      samples_per_ai_use: 6,
    },
    tools: ["create_knowledge_region", "simulate_knowledge_region"],
  },
  {
    id: "knowledge_region_options",
    title: "knowledge_region_options",
    kind: "response",
    summary: "Wizard options: protocols, built-in strategies, AI-use catalog, sample bounds.",
    example: {
      wizard_steps: ["name", "protocols", "explore", "ai-use", "run"],
      strategies: EXPLORATION_STRATEGIES.map((strategy) => ({
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
      })),
      default_samples_per_strategy: 12,
      min_samples_per_strategy: 3,
      max_samples_per_strategy: 48,
      ai_use_catalog: [],
      default_checked: [],
      default_samples_per_ai_use: 6,
      min_samples_per_ai_use: 3,
      max_samples_per_ai_use: 12,
      protocols: [
        {
          id: AGENT_API_EXAMPLE_PROTOCOL_ID,
          name: "Linear systems",
          challenge: "Solve Ax = b",
          question_count: 1,
          real_session_count: 0,
        },
      ],
    },
    tools: ["get_knowledge_region_options"],
  },
  {
    id: "simulation_job",
    title: "simulation_job",
    kind: "response",
    summary: "202 body from create_knowledge_region / simulate_knowledge_region. Poll get_knowledge_region_job.",
    example: {
      type: "job",
      job_id: AGENT_API_EXAMPLE_JOB_ID,
      family: "exploration",
      status: "queued",
      knowledge_region_id: AGENT_API_EXAMPLE_REGION_ID,
      follow_up_job_id: null,
      progress: [],
      cost_usd: 0,
      error: null,
      plan_cursor: 0,
      plan_length: 24,
    },
    tools: ["create_knowledge_region", "simulate_knowledge_region", "get_knowledge_region_job"],
  },
  {
    id: "knowledge_region",
    title: "knowledge_region",
    kind: "response",
    summary: "Region with clusters, strategies, and samples. No vectors.",
    example: {
      id: AGENT_API_EXAMPLE_REGION_ID,
      name: "Linear systems region",
      description: "region-simulation: 1 flows · Exploit-heavy · 12/strategy · 0 real",
      created_at: "2026-11-27T00:00:00.000Z",
      subject_count: 1,
      workspace_id: "ws_…",
      protocols: [{ id: AGENT_API_EXAMPLE_PROTOCOL_ID, name: "Linear systems" }],
      strategies: [{ id: "exploit-heavy", name: "Exploit-heavy" }],
      samples_per_strategy: 12,
      simulated_count: 12,
      cohort_count: 0,
      analysis_count: 0,
      real_session_count: 0,
      clusters: [
        {
          id: "cluster_…",
          name: "Linear systems region · Exploit-heavy",
          strategy_id: "exploit-heavy",
          strategy_name: "Exploit-heavy",
          sample_count: 12,
        },
      ],
      ai_use_clusters: [],
      samples: [
        {
          id: "emb_…",
          identity: "Simulated · Exploit-heavy",
          origin: "simulated",
          point_kind: "simulated",
          flow_id: AGENT_API_EXAMPLE_PROTOCOL_ID,
          run_id: "44444444-4444-4444-4444-444444444444",
          workspace_id: "ws_…",
          source: "simulated",
          cluster_id: "cluster_…",
          strategy_id: "exploit-heavy",
          strategy_name: "Exploit-heavy",
        },
      ],
    },
    tools: ["get_knowledge_region", "list_knowledge_regions"],
  },
  {
    id: "candidate",
    title: "knowledge_region_candidate",
    kind: "response",
    summary: "Closed metrics for one candidate in a named embedding space (default path).",
    example: {
      knowledge_region_id: AGENT_API_EXAMPLE_REGION_ID,
      candidate_id: "learner-42",
      embedding_model_id: "flowcfg-v1-d96",
      space: "path",
      dim: 96,
      clusters: [{ id: "cluster_…", strategy_id: "exploit-heavy", strategy_name: "Exploit-heavy" }],
      observations: [
        {
          id: "emb_…",
          created_at: "2026-11-27T00:00:00.000Z",
          flow_id: AGENT_API_EXAMPLE_PROTOCOL_ID,
          run_id: "44444444-4444-4444-4444-444444444444",
          nearest_cluster_id: "cluster_…",
          unsys: { distance: 0.4, excess: 0.1, steps: 3 },
          cluster_distances: [
            { cluster_id: "cluster_…", l2: 0.12, nearest: true, in_cluster: true },
          ],
        },
      ],
      unsys: { average: 0.4, observation_count: 1, scored_count: 1, flows: [] },
      path: { segments: [], span: null },
      pairwise: { observation_ids: ["emb_…"], matrix: [[0]] },
    },
    tools: ["get_knowledge_region_candidate"],
  },
  {
    id: "uncertainty_model",
    title: "uncertainty_model",
    kind: "response",
    summary: "Reference hidden-state tree plus the candidate walk overlay.",
    example: {
      knowledge_region_id: AGENT_API_EXAMPLE_REGION_ID,
      candidate_id: "learner-42",
      observation_id: "emb_…",
      run_id: "44444444-4444-4444-4444-444444444444",
      identity: "learner-42",
      reference: {
        root_id: "linear-systems",
        hidden_states: [{ id: "linear-systems", title: "Linear systems", parent_id: null }],
      },
      mapped: { sequence: ["linear-systems", "row-reduce"], hidden_states: [] },
      overlay: { walk: ["linear-systems", "row-reduce"] },
    },
    tools: ["get_knowledge_region_uncertainty_model"],
  },
];

export function agentApiErrorEnvelope(error: AgentApiErrorDoc): {
  error: { code: string; message: string; details?: Record<string, unknown> };
} {
  return {
    error: error.details
      ? { code: error.code, message: error.message, details: error.details }
      : { code: error.code, message: error.message },
  };
}

export function errorsForTool(name: string): AgentApiErrorDoc[] {
  return AGENT_API_PUBLIC_ERRORS.filter(
    (error) => error.tools === "all" || error.tools.includes(name),
  );
}

export function schemasForTool(name: string): AgentApiSchemaDoc[] {
  return AGENT_API_SCHEMAS.filter((schema) => schema.tools.includes(name));
}

export function agentApiErrorSnippets(error: AgentApiErrorDoc): Array<{
  language: AgentApiExampleLanguage;
  label: string;
  code: string;
}> {
  const body = JSON.stringify(agentApiErrorEnvelope(error), null, 2);
  return [
    {
      language: "curl",
      label: "curl",
      code: `# HTTP ${error.status}\n${body}`,
    },
    {
      language: "javascript",
      label: "JavaScript",
      code: `if (!response.ok) {
  const payload = await response.json();
  // HTTP ${error.status}
  // payload.error.code === "${error.code}"
  console.error(payload);
  // ${body.replace(/\n/g, "\n  // ")}
}`,
    },
    {
      language: "python",
      label: "Python",
      code: `if not response.ok:
    payload = response.json()
    # HTTP ${error.status}
    # payload["error"]["code"] == "${error.code}"
    print(payload)
    # ${body.replace(/\n/g, "\n    # ")}`,
    },
  ];
}

export const AGENT_API_STRATEGY_CATALOG = EXPLORATION_STRATEGIES.map((strategy) => ({
  id: strategy.id,
  name: strategy.name,
  description: strategy.description,
  instructions: strategy.instructions,
}));

export const AGENT_API_STRATEGY_IDS = [...EXPLORATION_STRATEGY_IDS];

function fence(language: string, code: string): string {
  return `\`\`\`${language}\n${code}\n\`\`\``;
}

export function agentApiErrorsMarkdown(): string {
  const lines = [
    "## Error responses",
    "",
    "Nested envelope `{ error: { code, message, details? } }` on every Protocol API and Knowledge Regions API failure.",
    "",
  ];
  for (const error of AGENT_API_PUBLIC_ERRORS) {
    lines.push(`### \`${error.code}\` (HTTP ${error.status})`);
    lines.push("");
    lines.push(error.summary);
    lines.push("");
    lines.push(fence("json", JSON.stringify(agentApiErrorEnvelope(error), null, 2)));
    lines.push("");
    for (const snippet of agentApiErrorSnippets(error)) {
      lines.push(`#### ${snippet.label}`);
      lines.push("");
      lines.push(fence(snippet.language === "javascript" ? "javascript" : snippet.language, snippet.code));
      lines.push("");
    }
  }
  return lines.join("\n").trimEnd();
}

export function agentApiSchemasMarkdown(): string {
  const lines = ["## Schemas", ""];
  for (const schema of AGENT_API_SCHEMAS) {
    lines.push(`### ${schema.title} (${schema.kind})`);
    lines.push("");
    lines.push(schema.summary);
    lines.push("");
    lines.push(`Used by: ${schema.tools.map((name) => `\`${name}\``).join(", ")}`);
    lines.push("");
    lines.push(fence("json", JSON.stringify(schema.example, null, 2)));
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

export function agentApiStrategiesMarkdown(): string {
  const lines = [
    "## Exploration strategies",
    "",
    "`create_knowledge_region` and `simulate_knowledge_region` take `strategy_ids` from this catalog. Call `get_knowledge_region_options` for the live list.",
    "",
  ];
  for (const strategy of AGENT_API_STRATEGY_CATALOG) {
    lines.push(`- \`${strategy.id}\` · **${strategy.name}**. ${strategy.description}`);
  }
  lines.push("");
  lines.push("### Custom strategies");
  lines.push("");
  lines.push(
    "Pass `custom_strategies` as a prompt string, `{ prompt }`, or `{ name, prompt }`. `instructions` is an alias of `prompt`. Custom walks are included even when `strategy_ids` omits the generated `custom-<slug>-<tag>` id.",
  );
  lines.push("");
  lines.push(
    fence(
      "json",
      JSON.stringify(
        {
          strategy_ids: ["exploit-heavy"],
          custom_strategies: [
            { prompt: "Ask more questions before you commit to an answer." },
            "Stay on substitution and do not switch methods.",
          ],
        },
        null,
        2,
      ),
    ),
  );
  return lines.join("\n").trimEnd();
}

export function agentApiEndpointExamplesMarkdown(
  tools: readonly AgentToolSurfaceEntry[] = AGENT_TOOL_SURFACE,
): string {
  const lines = [
    "## Endpoint examples",
    "",
    "Each endpoint is curl, JavaScript (`fetch`), and Python (`requests`).",
    "",
  ];
  for (const tool of tools) {
    lines.push(`### \`${tool.rest.method} ${tool.rest.path}\` — ${tool.name}`);
    lines.push("");
    lines.push(tool.summary);
    lines.push("");
    const schemas = schemasForTool(tool.name);
    if (schemas.length) {
      lines.push(`Schemas: ${schemas.map((schema) => `\`${schema.title}\``).join(", ")}`);
      lines.push("");
    }
    const errors = errorsForTool(tool.name);
    if (errors.length) {
      lines.push(`Errors: ${errors.map((error) => `\`${error.code}\``).join(", ")}`);
      lines.push("");
    }
    for (const snippet of agentApiExampleSnippets(tool)) {
      lines.push(`#### ${snippet.label}`);
      lines.push("");
      const lang =
        snippet.language === "javascript"
          ? "javascript"
          : snippet.language === "python"
            ? "python"
            : "bash";
      lines.push(fence(lang, snippet.code));
      lines.push("");
    }
  }
  return lines.join("\n").trimEnd();
}

export function protocolApiSkillMarkdown(): string {
  const tools = AGENT_TOOL_SURFACE.map((tool) => `\`${tool.name}\``).join(", ");
  return `---
name: protocol-api
description: Create, list, update, and delete Uncertain Systems knowledge verification protocols and knowledge regions over REST (/api/v3/protocols, /api/v3/knowledge-regions) and MCP (POST /api/mcp).
---

# Uncertain Systems Protocol API skill

Use this skill when ChatGPT, Claude, or another agent should authorize against Uncertain Systems and **manage knowledge verification protocols** or **knowledge regions**.

Public agent families:

1. **Protocol API** — \`GET/POST /api/v3/protocols\`, \`GET/PATCH/DELETE /api/v3/protocols/{protocol_id}\`, \`GET /api/v3/protocols/{protocol_id}/url\`, \`POST /api/v3/protocols/files\`, \`POST /api/v3/protocols/unsys-seed\`. Create with \`create_protocol\` using one Author source: written \`challenge\` (The Protocol Challenge; optional \`exact_problem_on_canvas\`), files (challenge generated when a learner opens), or \`opening_canvas_scene\`. Protocols are independent. Do not send \`kind\`. \`get_protocol_url\` returns the public \`/v/{token}\` launch URL. Pass \`identity\` (or \`id\`) to prepopulate the participant ID so the protocol does not ask for it.
2. **Knowledge Regions API** — \`GET/POST /api/v3/knowledge-regions\`, \`GET /api/v3/knowledge-regions/options\`, \`GET/PATCH/DELETE /api/v3/knowledge-regions/{knowledge_region_id}\`, \`POST /api/v3/knowledge-regions/{knowledge_region_id}/simulation\`, \`GET /api/v3/knowledge-regions/jobs/{job_id}\`, \`GET /api/v3/knowledge-regions/{knowledge_region_id}/runs/{run_id}\`, \`GET /api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}\`, \`GET /api/v3/knowledge-regions/{knowledge_region_id}/candidates/{candidate_id}/uncertainty-model\`. Create matches the dashboard wizard: protocols, exploration strategies, optional AI-use simulation.

**Human-readable spec:** \`/docs/proof-of-work-api\`
**Coding agents:** \`/coding-agents.md\`
**Knowledge Regions spec:** see \`/docs/proof-of-work-api\` endpoint index
**Base URL:** \`https://uncertain.systems\` (or your self-hosted origin)
**MCP:** \`POST /api/mcp\` with \`Authorization: Bearer <api_key>\`

Proof of work is recorded in the product UI (knowledge verification protocols). Headless \`start_session\` → \`upload_proof_of_work\` → \`end_session\` is **not** a public agent API. Snapshot and Stash are retired.

**API Metered plan required.** Plan-gate failures return **\`403\` with \`error.code = "api_plan_required"\`**.

**\`organization_id\` is required** on every protocol and knowledge-region call (users belong to multiple orgs). REST: body, query, or header \`X-Organization-Id\`. MCP: tool argument \`organization_id\`. Missing → \`400\` \`organization_id_required\`.

---

## Authentication

\`\`\`http
Authorization: Bearer <api_key>
Content-Type: application/json
\`\`\`

| Key type | Prefix | Created via |
|----------|--------|-------------|
| Organization member | \`sk_\` | Dashboard Integrations |

Each key is a single full-access token.

**Rate limit:** 120 requests per minute per key. Exceeded → \`429\` with \`error.code = "rate_limit_exceeded"\`.

---

## MCP

\`\`\`http
POST /api/mcp (Authorization: Bearer <api_key>)
Content-Type: application/json
\`\`\`

\`\`\`json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
\`\`\`

**Tools (parity with REST):**

${tools}

**Partner agents:** \`list_protocols\`, then \`upload_protocol_file\` (optional) → \`generate_protocol_unsys_seed\` (optional) → \`create_protocol\` → \`get_protocol\` → \`get_protocol_url\` → \`update_protocol\`. Use \`delete_protocol\` when a protocol should be removed. Regions: \`get_knowledge_region_options\` → \`create_knowledge_region\` → \`get_knowledge_region_job\` → \`get_knowledge_region\`. Render a learner with \`get_knowledge_region_candidate\`.

---

## Checklist

1. \`list_protocols\` — knowledge verification protocols owned by this key
2. \`upload_protocol_file\` for Protocol Challenge context files (PDF, text, image)
3. \`generate_protocol_unsys_seed\` from The Protocol Challenge and artifacts (or pass \`answers_model_seed\` / \`generate_unsys\` on create)
4. \`create_protocol\` with \`challenge\`. Choose one Author source: \`challenge\` (optional \`exact_problem_on_canvas\`), \`artifacts\` (\`generate_problem_on_open\` — a new challenge when a learner opens), or \`opening_canvas_scene\`. Also \`enforced_channels\`, \`answers_model_seed\`, \`duration_minutes\`. Do not send \`kind\`.
5. \`get_protocol\`
6. \`get_protocol_url\` — public launch URL. Query \`identity\` (aliases \`id\`, \`candidate_id\`) to skip Identify yourself
7. \`update_protocol\`
8. \`delete_protocol\` when a protocol should be removed
9. \`get_knowledge_region_options\` — protocols, exploration strategies, AI-use catalog, sample bounds
10. \`create_knowledge_region\` with \`name\`, \`protocol_ids\`, \`strategy_ids\` (${AGENT_API_STRATEGY_IDS.join(", ")}). Optional \`custom_strategies\` as a prompt string or \`{ prompt }\`, \`samples_per_strategy\`, \`include_human_data\`, \`ai_use_catalog_ids\`, \`samples_per_ai_use\`
11. \`get_knowledge_region_job\` while status is \`queued\` or \`running\`
12. \`get_knowledge_region\` — clusters, strategies, AI-use clusters, samples
13. \`get_knowledge_region_run\` with \`run_id\` from a sample
14. \`get_knowledge_region_candidate\` with \`knowledge_region_id\` and \`candidate_id\` (optional \`space\`)
15. \`get_knowledge_region_uncertainty_model\` for the hidden-state walk overlay

Do not call \`start_session\`, \`upload_proof_of_work\`, or \`end_session\`. Those tools are not on the public catalog.

${agentApiErrorsMarkdown()}

${agentApiSchemasMarkdown()}

${agentApiStrategiesMarkdown()}

${agentApiEndpointExamplesMarkdown()}
`;
}

export function protocolApiSkillCatalogForGenerators(): string {
  return [
    "Include these catalog sections verbatim in the skill.md:",
    agentApiErrorsMarkdown(),
    agentApiSchemasMarkdown(),
    agentApiStrategiesMarkdown(),
  ].join("\n\n");
}
