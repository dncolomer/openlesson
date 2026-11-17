/**
 * Single inventory of public agent tools (MCP tools/list + REST twins).
 * Families: independent Solve / Calibration / Verification flow management
 * and knowledge-region candidate render. Learning Maps, workspaces, Helios
 * map tools, headless proof-of-work, Snapshot, and Stash are not public.
 */

import {
  FLOW_API_BASE,
  FLOW_FILES_API_PATH,
  FLOW_UNSYS_SEED_API_PATH,
  KNOWLEDGE_REGION_API_BASE,
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
    name: "upload_flow_file",
    family: "flow",
    scope: "workspaces:write",
    summary:
      "Upload a Problem-context file (PDF, text, image) and get an artifact pointer for create_flow / update_flow.",
    rest: {
      method: "POST",
      path: FLOW_FILES_API_PATH,
    },
  },
  {
    name: "generate_flow_unsys_seed",
    family: "flow",
    scope: "workspaces:write",
    summary:
      "Generate the Unsys model for a flow from the Problem, artifacts, and optional guidance (wizard model step).",
    rest: {
      method: "POST",
      path: FLOW_UNSYS_SEED_API_PATH,
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
  {
    name: "get_knowledge_region_candidate",
    family: "knowledge_region",
    scope: "workspaces:read",
    summary:
      "Render metrics for one candidate in a knowledge region: unsys distance, cluster L2, path and pairwise L2.",
    rest: {
      method: "GET",
      path: `${KNOWLEDGE_REGION_API_BASE}/{knowledge_region_id}/candidates/{candidate_id}`,
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
