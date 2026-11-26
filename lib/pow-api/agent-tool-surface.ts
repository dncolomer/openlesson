/**
 * Single inventory of public agent tools (MCP tools/list + REST twins).
 * Families: Embeddable Knowledge Verification Protocols and
 * knowledge-region candidate render. Learning Maps, workspaces, Helios
 * map tools, headless proof-of-work, Snapshot, and Stash are not public.
 */

import {
  FLOW_FILES_API_PATH,
  FLOW_UNSYS_SEED_API_PATH,
  KNOWLEDGE_REGION_API_BASE,
  PROTOCOL_API_BASE,
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
  /** REST twin — method + path pattern with {protocol_id} placeholder */
  rest: { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string };
};

/** Canonical agent protocol ops — every entry has REST + MCP parity. */
export const AGENT_TOOL_SURFACE = [
  {
    name: "list_protocols",
    family: "protocol",
    scope: "workspaces:read",
    summary: "List knowledge verification protocols owned by this key.",
    rest: {
      method: "GET",
      path: PROTOCOL_API_BASE,
    },
  },
  {
    name: "create_protocol",
    family: "protocol",
    scope: "workspaces:write",
    summary: "Create a knowledge verification protocol.",
    rest: {
      method: "POST",
      path: PROTOCOL_API_BASE,
    },
  },
  {
    name: "upload_protocol_file",
    family: "protocol",
    scope: "workspaces:write",
    summary:
      "Upload a Protocol Challenge context file (PDF, text, image) and get an artifact pointer for create_protocol / update_protocol.",
    rest: {
      method: "POST",
      path: FLOW_FILES_API_PATH,
    },
  },
  {
    name: "generate_protocol_unsys_seed",
    family: "protocol",
    scope: "workspaces:write",
    summary:
      "Generate the Unsys model for a protocol from The Protocol Challenge, artifacts, and optional guidance.",
    rest: {
      method: "POST",
      path: FLOW_UNSYS_SEED_API_PATH,
    },
  },
  {
    name: "get_protocol",
    family: "protocol",
    scope: "workspaces:read",
    summary: "Read one knowledge verification protocol.",
    rest: {
      method: "GET",
      path: `${PROTOCOL_API_BASE}/{protocol_id}`,
    },
  },
  {
    name: "update_protocol",
    family: "protocol",
    scope: "workspaces:write",
    summary: "Update a knowledge verification protocol.",
    rest: {
      method: "PATCH",
      path: `${PROTOCOL_API_BASE}/{protocol_id}`,
    },
  },
  {
    name: "delete_protocol",
    family: "protocol",
    scope: "workspaces:write",
    summary: "Delete a knowledge verification protocol.",
    rest: {
      method: "DELETE",
      path: `${PROTOCOL_API_BASE}/{protocol_id}`,
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
