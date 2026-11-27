/**
 * Per-endpoint request examples for the Protocol API docs index.
 * Languages: curl, JavaScript (fetch), Python (requests).
 */

import type { AgentToolSurfaceEntry } from "./agent-tool-surface";

export const AGENT_API_EXAMPLE_ORIGIN = "https://uncertain.systems";
export const AGENT_API_EXAMPLE_ORG_ID = "00000000-0000-0000-0000-000000000000";
export const AGENT_API_EXAMPLE_PROTOCOL_ID = "11111111-1111-1111-1111-111111111111";
export const AGENT_API_EXAMPLE_REGION_ID = "22222222-2222-2222-2222-222222222222";
export const AGENT_API_EXAMPLE_JOB_ID = "33333333-3333-3333-3333-333333333333";
export const AGENT_API_EXAMPLE_RUN_ID = "44444444-4444-4444-4444-444444444444";
export const AGENT_API_EXAMPLE_CANDIDATE_ID = "learner-42";
export const AGENT_API_EXAMPLE_IDENTITY = "learner-42";

export type AgentApiExampleLanguage = "curl" | "javascript" | "python";

export type AgentApiExampleSnippet = {
  language: AgentApiExampleLanguage;
  label: string;
  code: string;
};

export type AgentApiRequestExample = {
  method: string;
  path: string;
  url: string;
  query: Record<string, string>;
  body: Record<string, unknown> | null;
};

const PATH_SAMPLES: Record<string, string> = {
  protocol_id: AGENT_API_EXAMPLE_PROTOCOL_ID,
  knowledge_region_id: AGENT_API_EXAMPLE_REGION_ID,
  job_id: AGENT_API_EXAMPLE_JOB_ID,
  run_id: AGENT_API_EXAMPLE_RUN_ID,
  candidate_id: AGENT_API_EXAMPLE_CANDIDATE_ID,
};

function interpolatePath(path: string): string {
  return path.replace(/\{([a-z_]+)\}/g, (_, key: string) => PATH_SAMPLES[key] || key);
}

function withOrgQuery(extra: Record<string, string> = {}): Record<string, string> {
  return { organization_id: AGENT_API_EXAMPLE_ORG_ID, ...extra };
}

function withOrgBody(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { organization_id: AGENT_API_EXAMPLE_ORG_ID, ...extra };
}

function exampleQueryAndBody(name: string): {
  query: Record<string, string>;
  body: Record<string, unknown> | null;
} {
  switch (name) {
    case "list_protocols":
    case "get_protocol":
    case "delete_protocol":
    case "list_knowledge_regions":
    case "get_knowledge_region_options":
    case "get_knowledge_region":
    case "delete_knowledge_region":
    case "get_knowledge_region_job":
    case "get_knowledge_region_run":
    case "get_knowledge_region_uncertainty_model":
      return { query: withOrgQuery(), body: null };
    case "get_protocol_url":
      return { query: withOrgQuery({ identity: AGENT_API_EXAMPLE_IDENTITY }), body: null };
    case "get_knowledge_region_candidate":
      return { query: withOrgQuery({ space: "path" }), body: null };
    case "create_protocol":
      return {
        query: withOrgQuery(),
        body: withOrgBody({
          name: "Linear systems",
          challenge: "Solve Ax = b",
          exact_problem_on_canvas: true,
          enforced_channels: {
            audio: true,
            muse: false,
            video: false,
            screenshots: false,
          },
        }),
      };
    case "upload_protocol_file":
      return {
        query: withOrgQuery(),
        body: withOrgBody({
          name: "brief.pdf",
          mime_type: "application/pdf",
          data: "<base64>",
        }),
      };
    case "generate_protocol_unsys_seed":
      return {
        query: withOrgQuery(),
        body: withOrgBody({
          name: "Linear systems",
          challenge: "Solve Ax = b",
        }),
      };
    case "update_protocol":
      return {
        query: withOrgQuery(),
        body: withOrgBody({ name: "Linear systems (revised)" }),
      };
    case "create_knowledge_region":
      return {
        query: withOrgQuery(),
        body: withOrgBody({
          name: "Linear systems region",
          protocol_ids: [AGENT_API_EXAMPLE_PROTOCOL_ID],
          strategy_ids: ["exploit-heavy", "information-seeking"],
          custom_strategies: [
            {
              prompt: "Ask more questions before you commit to an answer.",
            },
          ],
          samples_per_strategy: 12,
        }),
      };
    case "update_knowledge_region":
      return {
        query: withOrgQuery(),
        body: withOrgBody({ name: "Linear systems region (revised)" }),
      };
    case "simulate_knowledge_region":
      return {
        query: withOrgQuery(),
        body: withOrgBody({
          strategy_ids: ["novelty-seeking"],
          custom_strategies: [
            "Stay on substitution and do not switch methods.",
          ],
          samples_per_strategy: 12,
        }),
      };
    default:
      return { query: withOrgQuery(), body: null };
  }
}

function appendQuery(url: string, query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  const encoded = params.toString();
  return encoded ? `${url}?${encoded}` : url;
}

export function agentApiRequestExample(
  tool: AgentToolSurfaceEntry,
  origin = AGENT_API_EXAMPLE_ORIGIN,
): AgentApiRequestExample {
  const path = interpolatePath(tool.rest.path);
  const { query, body } = exampleQueryAndBody(tool.name);
  const base = String(origin || "").replace(/\/$/, "");
  const url = appendQuery(`${base}${path}`, query);
  return {
    method: tool.rest.method,
    path,
    url,
    query,
    body,
  };
}

function curlSnippet(req: AgentApiRequestExample): string {
  const lines = [
    `curl -sS -X ${req.method} '${req.url}' \\`,
    `  -H 'Authorization: Bearer sk_…' \\`,
    `  -H 'Content-Type: application/json'`,
  ];
  if (req.body) {
    lines[lines.length - 1] += " \\";
    lines.push(`  -d '${JSON.stringify(req.body, null, 2).replace(/\n/g, "\n  ")}'`);
  }
  return lines.join("\n");
}

function javascriptSnippet(req: AgentApiRequestExample): string {
  const bodyLine = req.body
    ? `,\n  body: JSON.stringify(${JSON.stringify(req.body, null, 2).replace(/\n/g, "\n  ")})`
    : "";
  return `const response = await fetch("${req.url}", {
  method: "${req.method}",
  headers: {
    Authorization: "Bearer sk_…",
    "Content-Type": "application/json",
  }${bodyLine},
});
const data = await response.json();`;
}

function pythonSnippet(req: AgentApiRequestExample): string {
  const lines = [
    "import requests",
    "",
    `response = requests.request(`,
    `    "${req.method}",`,
    `    "${req.url}",`,
    `    headers={`,
    `        "Authorization": "Bearer sk_…",`,
    `        "Content-Type": "application/json",`,
    `    },`,
  ];
  if (req.body) {
    lines.push(`    json=${JSON.stringify(req.body, null, 4).replace(/\n/g, "\n    ")},`);
  }
  lines.push(")");
  lines.push("print(response.json())");
  return lines.join("\n");
}

export function agentApiExampleSnippets(
  tool: AgentToolSurfaceEntry,
  origin = AGENT_API_EXAMPLE_ORIGIN,
): AgentApiExampleSnippet[] {
  const req = agentApiRequestExample(tool, origin);
  return [
    { language: "curl", label: "curl", code: curlSnippet(req) },
    { language: "javascript", label: "JavaScript", code: javascriptSnippet(req) },
    { language: "python", label: "Python", code: pythonSnippet(req) },
  ];
}
