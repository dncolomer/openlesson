/**
 * Single inventory of public agent tools (MCP tools/list + REST twins).
 * Two families: workspace management and headless proof-of-work.
 * Snapshot and Stash are not public agent APIs.
 */

import {
  ACCOUNT_API_BASE,
  POW_API_BASE,
  WORKSPACE_API_BASE,
  type PublicAgentApiFamily,
} from "@/lib/api/agent-api-paths";
import {
  agentToolFeature,
  workspaceSupportsFeature,
} from "@/lib/workspace-capabilities";
import { powModelAgentSimulationContract } from "./pow-model-agent-contract";
import type { ApiKeyScope } from "./types";

export type AgentToolSurfaceEntry = {
  name: string;
  family: PublicAgentApiFamily;
  scope: ApiKeyScope;
  summary: string;
  /** REST twin — method + path pattern with {workspace_id} placeholder */
  rest: { method: "GET" | "POST" | "PATCH"; path: string };
};

/** Canonical agent workspace ops — every entry has REST + MCP parity. */
export const AGENT_TOOL_SURFACE = [
  {
    name: "list_workspaces",
    family: "workspace",
    scope: "workspaces:read",
    summary: "List Learning and Verification workspaces accessible to this key.",
    rest: { method: "GET", path: WORKSPACE_API_BASE },
  },
  {
    name: "get_workspace",
    family: "workspace",
    scope: "workspaces:read",
    summary: "Read workspace metadata, kind, map summary, and workspace settings.",
    rest: { method: "GET", path: `${WORKSPACE_API_BASE}/{workspace_id}` },
  },
  {
    name: "create_workspace",
    family: "workspace",
    scope: "workspaces:write",
    summary:
      "Create a Learning or Verification workspace (kind/product), including an optional map and settings.",
    rest: { method: "POST", path: WORKSPACE_API_BASE },
  },
  {
    name: "update_workspace",
    family: "workspace",
    scope: "workspaces:write",
    summary:
      "Edit workspace settings, contents, and map blocks for a Learning or Verification workspace.",
    rest: { method: "PATCH", path: `${WORKSPACE_API_BASE}/{workspace_id}` },
  },
  {
    name: "list_blocks",
    family: "workspace",
    scope: "workspaces:read",
    summary: "List map blocks / contents for a workspace.",
    rest: {
      method: "GET",
      path: `${WORKSPACE_API_BASE}/{workspace_id}/blocks`,
    },
  },
  {
    name: "update_blocks",
    family: "workspace",
    scope: "workspaces:write",
    summary: "Replace or patch the workspace map (blocks and links).",
    rest: {
      method: "PATCH",
      path: `${WORKSPACE_API_BASE}/{workspace_id}/blocks`,
    },
  },
  {
    name: "get_workspace_settings",
    family: "workspace",
    scope: "workspaces:read",
    summary: "Read workspace settings (title, goal, catalog size, visibility).",
    rest: {
      method: "GET",
      path: `${WORKSPACE_API_BASE}/{workspace_id}/settings`,
    },
  },
  {
    name: "update_workspace_settings",
    family: "workspace",
    scope: "workspaces:write",
    summary: "Patch workspace settings.",
    rest: {
      method: "PATCH",
      path: `${WORKSPACE_API_BASE}/{workspace_id}/settings`,
    },
  },
  {
    name: "get_account_settings",
    family: "workspace",
    scope: "workspaces:read",
    summary: "Read account settings for this API key (identity, org, scopes).",
    rest: { method: "GET", path: ACCOUNT_API_BASE },
  },
  {
    name: "update_account_settings",
    family: "workspace",
    scope: "workspaces:write",
    summary: "Patch account settings (username / display name).",
    rest: { method: "PATCH", path: ACCOUNT_API_BASE },
  },
  {
    name: "generate_integration_skill",
    family: "workspace",
    scope: "workspaces:read",
    summary:
      "Generate partner skill.md so ChatGPT, Claude, or another agent can authorize and run the two APIs.",
    rest: {
      method: "POST",
      path: `${WORKSPACE_API_BASE}/{workspace_id}/integration-skill`,
    },
  },
  {
    name: "start_session",
    family: "pow",
    scope: "workspaces:write",
    summary:
      "Start a headless Calibrate, Learn, or Verify session: prepare the answers-model tree, start the clock.",
    rest: {
      method: "POST",
      path: `${POW_API_BASE}/workspaces/{workspace_id}/sessions`,
    },
  },
  {
    name: "get_session",
    family: "pow",
    scope: "workspaces:read",
    summary: "Read a headless session: remaining time, inferred path, current focus, answers model.",
    rest: {
      method: "GET",
      path: `${POW_API_BASE}/workspaces/{workspace_id}/sessions/{session_id}`,
    },
  },
  {
    name: "upload_proof_of_work",
    family: "pow",
    scope: "workspaces:write",
    summary: `Submit proof of work into a live headless session. Infers the path on the prepared tree. Expired sessions reject further work. ${powModelAgentSimulationContract()}`,
    rest: {
      method: "POST",
      path: `${POW_API_BASE}/workspaces/{workspace_id}/sessions/{session_id}/proof-of-work`,
    },
  },
  {
    name: "end_session",
    family: "pow",
    scope: "workspaces:write",
    summary:
      "End a headless session: score the inferred path against the prepared tree and persist the flow embedding.",
    rest: {
      method: "POST",
      path: `${POW_API_BASE}/workspaces/{workspace_id}/sessions/{session_id}/end`,
    },
  },
  {
    name: "list_flow_embeddings",
    family: "pow",
    scope: "workspaces:read",
    summary:
      "List Calibrate, Learn, and Verify embeddings (flowcfg-v1-d96): answers model, projected policy, and proof of work.",
    rest: {
      method: "GET",
      path: `${POW_API_BASE}/workspaces/{workspace_id}/flow-embeddings`,
    },
  },
  {
    name: "get_flow_embedding",
    family: "pow",
    scope: "workspaces:read",
    summary: "Recover one flow embedding by id, including the raw payload used to embed.",
    rest: {
      method: "GET",
      path: `${POW_API_BASE}/workspaces/{workspace_id}/flow-embeddings`,
    },
  },
] as const satisfies readonly AgentToolSurfaceEntry[];

export type AgentToolName = (typeof AGENT_TOOL_SURFACE)[number]["name"];

export function agentToolNames(): AgentToolName[] {
  return AGENT_TOOL_SURFACE.map((t) => t.name);
}

export function agentToolsByFamily(family: PublicAgentApiFamily): AgentToolSurfaceEntry[] {
  return AGENT_TOOL_SURFACE.filter((tool) => tool.family === family);
}

/** Historical guest-link mint — not public agent tools. */
export const KNOWLEDGE_LINK_MINT_TOOL_NAMES = [
  "create_tap_link",
  "list_tap_links",
] as const;

export const KNOWLEDGE_LINK_MINT_PATH_FRAGMENTS = [
  "tap-links",
  "ile-links",
] as const;

export const STANDARD_SKILL_DOCUMENTED_TOOL_NAMES = AGENT_TOOL_SURFACE.map(
  (tool) => tool.name,
) as readonly AgentToolName[];

export function isKnowledgeLinkMintToolName(name: string): boolean {
  return (KNOWLEDGE_LINK_MINT_TOOL_NAMES as readonly string[]).includes(name);
}

export function agentToolSurfaceForWorkspace(kind: unknown): AgentToolSurfaceEntry[] {
  return AGENT_TOOL_SURFACE.filter((tool) => {
    const feature = agentToolFeature(tool.name);
    if (!feature) return true;
    return workspaceSupportsFeature(kind, feature);
  });
}

export function skillDocumentedToolsForWorkspace(kind: unknown): AgentToolSurfaceEntry[] {
  return agentToolSurfaceForWorkspace(kind);
}

export function formatSkillMcpToolList(kind: unknown): string {
  return skillDocumentedToolsForWorkspace(kind)
    .map((t) => t.name)
    .join(", ");
}

export function textExposesKnowledgeLinkMint(text: string): boolean {
  const hay = text.toLowerCase();
  return (
    KNOWLEDGE_LINK_MINT_TOOL_NAMES.some((n) => hay.includes(n.toLowerCase())) ||
    KNOWLEDGE_LINK_MINT_PATH_FRAGMENTS.some((p) => hay.includes(p.toLowerCase()))
  );
}

/** Canonical plan-gate error code for Teams/API plan requirements. */
export const PLAN_GATE_ERROR_CODE = "api_plan_required" as const;
