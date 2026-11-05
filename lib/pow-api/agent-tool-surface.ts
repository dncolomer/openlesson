/**
 * Single inventory of public agent tools (MCP tools/list + REST twins).
 * One family: Learning Map + Solve / Calibration / Verification flow management.
 * Headless proof-of-work, Snapshot, and Stash are not public agent APIs.
 */

import {
  FLOW_API_BASE,
  WORKSPACE_API_BASE,
  type PublicAgentApiFamily,
} from "@/lib/api/agent-api-paths";
import {
  agentToolFeature,
  workspaceSupportsFeature,
} from "@/lib/workspace-capabilities";
import type { ApiKeyScope } from "./types";

export type AgentToolSurfaceEntry = {
  name: string;
  family: PublicAgentApiFamily;
  scope: ApiKeyScope;
  summary: string;
  /** REST twin — method + path pattern with {workspace_id} placeholder */
  rest: { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string };
};

/** Canonical agent workspace ops — every entry has REST + MCP parity. */
export const AGENT_TOOL_SURFACE = [
  {
    name: "list_workspaces",
    family: "workspace",
    scope: "workspaces:read",
    summary: "List Learning workspaces accessible to this key.",
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
      "Create a Learning Map only, including an optional map and settings. Solve, Calibration, and Verification use create_flow.",
    rest: { method: "POST", path: WORKSPACE_API_BASE },
  },
  {
    name: "update_workspace",
    family: "workspace",
    scope: "workspaces:write",
    summary:
      "Edit workspace settings, contents, and map blocks for a Learning workspace.",
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
    name: "list_map_tools",
    family: "workspace",
    scope: "workspaces:read",
    summary:
      "List Helios Learning Map builder tools (topologies, unusable ground, generative effects, DAG, edit/delete, overlay notes and drawing layers) and the current map snapshot.",
    rest: {
      method: "GET",
      path: `${WORKSPACE_API_BASE}/{workspace_id}/map-tools`,
    },
  },
  {
    name: "apply_map_tool",
    family: "workspace",
    scope: "workspaces:write",
    summary:
      "Apply one or more Helios Learning Map builder tools atomically (same catalog as in-app Helios). Learning workspaces only.",
    rest: {
      method: "POST",
      path: `${WORKSPACE_API_BASE}/{workspace_id}/map-tools`,
    },
  },
  {
    name: "get_workspace_settings",
    family: "workspace",
    scope: "workspaces:read",
    summary: "Read Learning Map settings (title, visibility).",
    rest: {
      method: "GET",
      path: `${WORKSPACE_API_BASE}/{workspace_id}/settings`,
    },
  },
  {
    name: "update_workspace_settings",
    family: "workspace",
    scope: "workspaces:write",
    summary: "Patch Learning Map settings.",
    rest: {
      method: "PATCH",
      path: `${WORKSPACE_API_BASE}/{workspace_id}/settings`,
    },
  },
  {
    name: "list_flows",
    family: "workspace",
    scope: "workspaces:read",
    summary:
      "List Solve, Calibration, and Verification flows owned by this key. Optional workspace_id filters to one Learning Map.",
    rest: {
      method: "GET",
      path: FLOW_API_BASE,
    },
  },
  {
    name: "create_flow",
    family: "workspace",
    scope: "workspaces:write",
    summary:
      "Create a Solve, Calibration, or Verification flow. Independent unless workspace_id is set.",
    rest: {
      method: "POST",
      path: FLOW_API_BASE,
    },
  },
  {
    name: "get_flow",
    family: "workspace",
    scope: "workspaces:read",
    summary: "Read one Solve, Calibration, or Verification flow.",
    rest: {
      method: "GET",
      path: `${FLOW_API_BASE}/{flow_id}`,
    },
  },
  {
    name: "update_flow",
    family: "workspace",
    scope: "workspaces:write",
    summary: "Update a Solve, Calibration, or Verification flow.",
    rest: {
      method: "PATCH",
      path: `${FLOW_API_BASE}/{flow_id}`,
    },
  },
  {
    name: "delete_flow",
    family: "workspace",
    scope: "workspaces:write",
    summary: "Delete a Solve, Calibration, or Verification flow.",
    rest: {
      method: "DELETE",
      path: `${FLOW_API_BASE}/{flow_id}`,
    },
  },
  {
    name: "link_flow",
    family: "workspace",
    scope: "workspaces:write",
    summary:
      "Place or link a Solve, Calibration, or Verification flow onto a Learning Map tile.",
    rest: {
      method: "POST",
      path: `${FLOW_API_BASE}/{flow_id}/link`,
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
