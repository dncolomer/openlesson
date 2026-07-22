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
    summary: "List accessible Verification Workspaces.",
    rest: { method: "GET", path: `${POW_API_BASE}/workspaces` },
  },
  {
    name: "get_learning_progress",
    scope: "workspaces:read",
    summary:
      "Progress snapshot: workspace_goal, blocks, counts, recommended_next_actions (REST + MCP).",
    rest: {
      method: "GET",
      path: `${POW_API_BASE}/workspaces/{workspace_id}/learning-progress`,
    },
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
    summary: "Upload tool/screen/video/EEG proof of work.",
    rest: {
      method: "POST",
      path: `${POW_API_BASE}/workspaces/{workspace_id}/proof-of-work`,
    },
  },
  {
    name: "lwm_snapshot",
    scope: "workspaces:read",
    summary:
      "LWM Snapshot (Learning World Model Snapshot) score (0–100) + GHC + spider markers, analysis, next actions. REST: POST .../lwm-snapshot. Sole product snapshot strategy; run via Knowledge UI or this Snapshot API/MCP tool (not auto on TAP/ILE end).",
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
    summary:
      "Buffer a PoW unit in Stash API temporary memory (alaTAP) until stash or submit.",
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

/** Canonical plan-gate error code for Teams/API plan requirements. */
export const PLAN_GATE_ERROR_CODE = "api_plan_required" as const;
