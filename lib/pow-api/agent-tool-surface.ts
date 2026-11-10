/**
 * Single inventory of public agent tools (MCP tools/list + REST twins).
 * One family: independent Solve / Calibration / Verification flow management.
 * Learning Maps, workspaces, Helios map tools, headless proof-of-work,
 * Snapshot, and Stash are not public agent APIs.
 */

import {
  FLOW_API_BASE,
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
  /** REST twin — method + path pattern with {flow_id} placeholder */
  rest: { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string };
};

/** Canonical agent flow ops — every entry has REST + MCP parity. */
export const AGENT_TOOL_SURFACE = [
  {
    name: "list_flows",
    family: "flow",
    scope: "workspaces:read",
    summary: "List Solve, Calibration, and Verification flows owned by this key.",
    rest: {
      method: "GET",
      path: FLOW_API_BASE,
    },
  },
  {
    name: "create_flow",
    family: "flow",
    scope: "workspaces:write",
    summary: "Create a Solve, Calibration, or Verification flow.",
    rest: {
      method: "POST",
      path: FLOW_API_BASE,
    },
  },
  {
    name: "get_flow",
    family: "flow",
    scope: "workspaces:read",
    summary: "Read one Solve, Calibration, or Verification flow.",
    rest: {
      method: "GET",
      path: `${FLOW_API_BASE}/{flow_id}`,
    },
  },
  {
    name: "update_flow",
    family: "flow",
    scope: "workspaces:write",
    summary: "Update a Solve, Calibration, or Verification flow.",
    rest: {
      method: "PATCH",
      path: `${FLOW_API_BASE}/{flow_id}`,
    },
  },
  {
    name: "delete_flow",
    family: "flow",
    scope: "workspaces:write",
    summary: "Delete a Solve, Calibration, or Verification flow.",
    rest: {
      method: "DELETE",
      path: `${FLOW_API_BASE}/{flow_id}`,
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
    KNOWLEDGE_LINK_MINT_PATH_FRAGMENTS.some((p) => hay.includes(p))
  );
}

/** Canonical plan-gate error code for Teams/API plan requirements. */
export const PLAN_GATE_ERROR_CODE = "api_plan_required" as const;
