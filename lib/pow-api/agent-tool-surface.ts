/**
 * Single inventory of public agent tools (MCP tools/list + REST twins).
 * Workspace create is intentionally absent — UI-only at /workspace/new.
 * Key CRUD (/api/v3/pow/keys) is browser-session only and excluded.
 */

import {
  POW_API_BASE,
  SNAPSHOT_API_BASE,
  STASH_API_BASE,
} from "@/lib/api/agent-api-paths";
import {
  agentToolFeature,
  workspaceSupportsFeature,
} from "@/lib/workspace-capabilities";
import { powModelAgentSimulationContract } from "./pow-model-agent-contract";
import type { ApiKeyScope } from "./types";

export type AgentToolSurfaceEntry = {
  name: string;
  scope: ApiKeyScope;
  summary: string;
  /** REST twin — method + path pattern with {workspace_id} placeholder */
  rest: { method: "GET" | "POST" | "PATCH"; path: string };
};

/** Canonical agent workspace ops — every entry has REST + MCP parity. */
export const AGENT_TOOL_SURFACE = [
  {
    name: "list_workspaces",
    scope: "workspaces:read",
    summary: "List accessible workspaces.",
    rest: { method: "GET", path: `${POW_API_BASE}/workspaces` },
  },
  {
    name: "get_workspace",
    scope: "workspaces:read",
    summary: "Read workspace metadata and workspace_goal.",
    rest: { method: "GET", path: `${POW_API_BASE}/workspaces/{workspace_id}` },
  },
  {
    name: "list_blocks",
    scope: "workspaces:read",
    summary: "List assessable blocks.",
    rest: {
      method: "GET",
      path: `${POW_API_BASE}/workspaces/{workspace_id}/blocks`,
    },
  },
  {
    name: "generate_proof_of_work_schema",
    scope: "workspaces:read",
    summary:
      "Generate formal proof-of-work spec (tool JSON schemas, interruption_contract, TIM interruption).",
    rest: {
      method: "POST",
      path: `${POW_API_BASE}/workspaces/{workspace_id}/proof-of-work-schema`,
    },
  },
  {
    name: "generate_integration_skill",
    scope: "workspaces:read",
    summary: "Generate partner skill.md with dynamic API references.",
    rest: {
      method: "POST",
      path: `${POW_API_BASE}/workspaces/{workspace_id}/integration-skill`,
    },
  },
  {
    name: "upload_proof_of_work",
    scope: "workspaces:write",
    summary: `Upload tool/screen/video/EEG proof of work. ${powModelAgentSimulationContract()}`,
    rest: {
      method: "POST",
      path: `${POW_API_BASE}/workspaces/{workspace_id}/proof-of-work`,
    },
  },
  {
    name: "lwm_snapshot",
    scope: "workspaces:read",
    summary:
      "LWM Snapshot (Learning World Model Snapshot) score (0–100) + GHC + spider markers, analysis, next actions. REST: POST .../lwm-snapshot. Sole product snapshot strategy; run via Knowledge UI or this Snapshot API/MCP tool (not auto on TAP/TAP Learning end).",
    rest: {
      method: "POST",
      path: `${SNAPSHOT_API_BASE}/workspaces/{workspace_id}/lwm-snapshot`,
    },
  },
  {
    name: "list_tap_links",
    scope: "tap:read",
    summary: "List TAP session links and status.",
    rest: {
      method: "GET",
      path: `${POW_API_BASE}/workspaces/{workspace_id}/tap-links`,
    },
  },
  {
    name: "create_tap_link",
    scope: "tap:write",
    summary: "Create a private TAP link for a workspace or block.",
    rest: {
      method: "POST",
      path: `${POW_API_BASE}/workspaces/{workspace_id}/tap-links`,
    },
  },
  {
    name: "get_world_model",
    scope: "workspaces:read",
    summary: "Durable learning world model for a workspace × subject.",
    rest: {
      method: "GET",
      path: `${SNAPSHOT_API_BASE}/workspaces/{workspace_id}/world-model`,
    },
  },
  {
    name: "get_knowledge_config",
    scope: "workspaces:read",
    summary: "Latest knowledge configuration embedding (knowledgecfg-v1-d64).",
    rest: {
      method: "GET",
      path: `${SNAPSHOT_API_BASE}/workspaces/{workspace_id}/knowledge-config`,
    },
  },
  {
    name: "get_knowledge_config_trajectory",
    scope: "workspaces:read",
    summary: "Knowledge config trajectory + optional 2D projection.",
    rest: {
      method: "GET",
      path: `${SNAPSHOT_API_BASE}/workspaces/{workspace_id}/knowledge-config/trajectory`,
    },
  },
  {
    name: "knowledge_distance",
    scope: "workspaces:read",
    summary:
      "Knowledge distance (user ↔ region) in knowledgecfg space — not an LWM Snapshot scorecard.",
    rest: {
      method: "POST",
      path: `${SNAPSHOT_API_BASE}/workspaces/{workspace_id}/knowledge-distance`,
    },
  },
  {
    name: "list_snapshot_history",
    scope: "workspaces:read",
    summary: "Prior LWM Snapshot scorecards for a workspace / subject / cohort.",
    rest: {
      method: "GET",
      path: `${SNAPSHOT_API_BASE}/workspaces/{workspace_id}/snapshot-history`,
    },
  },
  {
    name: "list_custom_knowledge_regions",
    scope: "workspaces:read",
    summary: "List custom knowledge regions and subjects with knowledge config.",
    rest: {
      method: "GET",
      path: `${SNAPSHOT_API_BASE}/workspaces/{workspace_id}/custom-knowledge-regions`,
    },
  },
  {
    name: "create_custom_knowledge_region",
    scope: "workspaces:write",
    summary: "Create a custom knowledge region from subject embeddings.",
    rest: {
      method: "POST",
      path: `${SNAPSHOT_API_BASE}/workspaces/{workspace_id}/custom-knowledge-regions`,
    },
  },
  {
    name: "eval_custom_knowledge_region",
    scope: "workspaces:write",
    summary: "Score a subject against a custom knowledge region.",
    rest: {
      method: "POST",
      path: `${SNAPSHOT_API_BASE}/workspaces/{workspace_id}/custom-knowledge-regions`,
    },
  },
  {
    name: "buffer_proof_of_work",
    scope: "workspaces:write",
    summary: `Buffer a PoW unit in Stash API temporary memory (TAP) until stash or submit. ${powModelAgentSimulationContract()}`,
    rest: {
      method: "POST",
      path: `${STASH_API_BASE}/workspaces/{workspace_id}/proof-of-work`,
    },
  },
  {
    name: "stash_proof_of_work",
    scope: "workspaces:write",
    summary: "Flush buffered PoW as System 1 (stash) into the regular PoW stack.",
    rest: {
      method: "POST",
      path: `${STASH_API_BASE}/workspaces/{workspace_id}/stash`,
    },
  },
  {
    name: "submit_stashed_proof_of_work",
    scope: "workspaces:write",
    summary: "Flush buffered PoW as System 2 (submit) into the regular PoW stack.",
    rest: {
      method: "POST",
      path: `${STASH_API_BASE}/workspaces/{workspace_id}/submit`,
    },
  },
] as const satisfies readonly AgentToolSurfaceEntry[];

export type AgentToolName = (typeof AGENT_TOOL_SURFACE)[number]["name"];

export function agentToolNames(): AgentToolName[] {
  return AGENT_TOOL_SURFACE.map((t) => t.name);
}

/** TAP / TAP Learning / TAPBench guest-link mint — omitted from Knowledge Region skill/MCP copy. */
export const KNOWLEDGE_LINK_MINT_TOOL_NAMES = [
  "create_tap_link",
  "list_tap_links",
] as const satisfies readonly AgentToolName[];

export const KNOWLEDGE_LINK_MINT_PATH_FRAGMENTS = [
  "tap-links",
  "tapbench-links",
  "ile-links",
] as const;

/**
 * Documented MCP tool names in generated skill.md for a Learning workspace.
 * Order is part of the skill prompt; keep this list stable.
 */
export const STANDARD_SKILL_DOCUMENTED_TOOL_NAMES = [
  "list_workspaces",
  "get_workspace",
  "list_blocks",
  "generate_integration_skill",
] as const satisfies readonly AgentToolName[];

export function isKnowledgeLinkMintToolName(name: string): boolean {
  return (KNOWLEDGE_LINK_MINT_TOOL_NAMES as readonly string[]).includes(name);
}

/** Full agent catalog filtered by workspace product. Calls for the other product are omitted. */
export function agentToolSurfaceForWorkspace(kind: unknown): AgentToolSurfaceEntry[] {
  return AGENT_TOOL_SURFACE.filter((tool) => {
    const feature = agentToolFeature(tool.name);
    if (!feature) return true;
    return workspaceSupportsFeature(kind, feature);
  });
}

/**
 * Tools listed in workspace-generated skill.md.
 * Learning: map read + skill regeneration.
 * Verification: proof of work, snapshots, regions, and stash.
 */
export function skillDocumentedToolsForWorkspace(kind: unknown): AgentToolSurfaceEntry[] {
  return agentToolSurfaceForWorkspace(kind);
}

export function formatSkillMcpToolList(kind: unknown): string {
  return skillDocumentedToolsForWorkspace(kind)
    .map((t) => (t.name === "lwm_snapshot" ? "lwm_snapshot (LWM Snapshot)" : t.name))
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
