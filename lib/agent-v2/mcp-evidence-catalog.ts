/** Client-safe catalog for workspace integration UI (no server imports). */

export const MCP_EVIDENCE_TOOL_CATALOG = [
  { name: "list_workspaces", scope: "workspaces:read", summary: "List accessible Verification Workspaces." },
  {
    name: "get_learning_progress",
    scope: "workspaces:read",
    summary: "Progress snapshot: goal, blocks, counts, recommended_next_actions (REST + MCP).",
  },
  { name: "get_workspace", scope: "workspaces:read", summary: "Read workspace metadata and conversion_goal." },
  { name: "create_workspace", scope: "workspaces:write", summary: "Create a workspace from initial_prompt." },
  { name: "list_blocks", scope: "workspaces:read", summary: "List assessable blocks." },
  {
    name: "generate_evidence_schema",
    scope: "workspaces:read",
    summary: "Generate formal evidence spec (tool JSON schemas + upload contract).",
  },
  {
    name: "generate_integration_skill",
    scope: "workspaces:read",
    summary: "Generate partner skill.md with dynamic API references.",
  },
  { name: "upload_evidence", scope: "workspaces:write", summary: "Upload tool/screen/video/EEG evidence." },
  {
    name: "analyze_performance",
    scope: "workspaces:read",
    summary: "Scorecard report (no prompt) or chat Q&A (with prompt).",
  },
  { name: "list_tap_links", scope: "tap:read", summary: "List TAP session links and status." },
  { name: "get_tap_results", scope: "tap:read", summary: "Read completed TAP results." },
  { name: "create_tap_link", scope: "tap:write", summary: "Create a private TAP link for a block." },
] as const;

export function buildMcpEndpointUrl(origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/api/mcp`;
}

export function buildMcpAuthHeader(apiKeyPlaceholder = "YOUR_API_KEY"): string {
  return `Bearer ${apiKeyPlaceholder}`;
}

export function buildMcpClientConfig(origin: string, apiKeyPlaceholder = "YOUR_API_KEY"): string {
  return JSON.stringify(
    {
      mcpServers: {
        openlesson: {
          type: "streamable-http",
          url: buildMcpEndpointUrl(origin),
          headers: {
            Authorization: buildMcpAuthHeader(apiKeyPlaceholder),
          },
        },
      },
    },
    null,
    2
  );
}

export function buildMcpOAuthDiscovery(origin: string) {
  const base = origin.replace(/\/$/, "");
  return {
    resource: `${base}/api/mcp`,
    protected_resource_metadata: `${base}/.well-known/oauth-protected-resource/api/mcp`,
    authorization_server_metadata: `${base}/.well-known/oauth-authorization-server`,
    authorization_endpoint: `${base}/api/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
  };
}

export function buildSkillFileUrl(origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/skill.md`;
}

export function buildMcpOAuthClientConfig(origin: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        openlesson: {
          type: "streamable-http",
          url: buildMcpEndpointUrl(origin),
        },
      },
    },
    null,
    2
  );
}