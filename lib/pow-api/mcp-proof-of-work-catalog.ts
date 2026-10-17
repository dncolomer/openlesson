/**
 * Client-safe catalog for workspace integration UI (no server imports).
 * Tool names/summaries come from AGENT_TOOL_SURFACE (single source of truth).
 *
 * Two public families: workspace management (/api/v3/workspaces, /api/v3/account)
 * and headless proof-of-work (/api/v3/pow). Snapshot, Stash, and TAPBench are
 * not public agent APIs. TAPBench is start_session with flow_kind=tapbench.
 */

import { AGENT_TOOL_SURFACE, agentToolSurfaceForWorkspace } from "./agent-tool-surface";

export const MCP_PROOF_OF_WORK_TOOL_CATALOG = AGENT_TOOL_SURFACE.map((tool) => ({
  name: tool.name,
  scope: tool.scope,
  summary: tool.summary,
  rest: tool.rest,
})) as ReadonlyArray<{
  name: (typeof AGENT_TOOL_SURFACE)[number]["name"];
  scope: (typeof AGENT_TOOL_SURFACE)[number]["scope"];
  summary: string;
  rest: (typeof AGENT_TOOL_SURFACE)[number]["rest"];
}>;

/** Workspace-kind catalog for Integration skill/MCP copy. Global tools/list stays unfiltered. */
export function mcpProofOfWorkCatalogForWorkspace(kind: unknown) {
  return agentToolSurfaceForWorkspace(kind).map((tool) => ({
    name: tool.name,
    scope: tool.scope,
    summary: tool.summary,
    rest: tool.rest,
  }));
}

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
        "uncertain-systems": {
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
        "uncertain-systems": {
          type: "streamable-http",
          url: buildMcpEndpointUrl(origin),
        },
      },
    },
    null,
    2
  );
}
