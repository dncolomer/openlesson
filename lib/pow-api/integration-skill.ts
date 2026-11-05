import type { ProofOfWorkEvalSchemaResult, ProofOfWorkSchemaIntegrationHints } from "./proof-of-work-schema";
import type { PerformanceContextPayload } from "./performance-context";
import { buildIntegrationSkillApiPath } from "./proof-of-work-integration";
import { FLOW_API_BASE, WORKSPACE_API_BASE } from "@/lib/api/agent-api-paths";
import { isNoMapWorkspace } from "@/lib/workspace-kind";
import { workspaceSupportsFeature } from "@/lib/workspace-capabilities";
import { formatSkillMcpToolList } from "./agent-tool-surface";

export interface IntegrationSkillRequest {
  integration_name: string;
  partner_description?: string;
  eval_definition?: string;
  block_id?: string | null;
  base_url?: string;
  include_sections?: string[];
  integration_hints?: ProofOfWorkSchemaIntegrationHints;
  /** When true, generates proof-of-work spec inline (slower; may timeout). Default false — fetch spec via proof-of-work-schema API separately. */
  prefetch_proof_of_work_spec?: boolean;
}

export interface IntegrationSkillResult {
  skill_md: string;
  skill_name: string;
  suggested_share_path: string;
  workspace_summary: {
    id: string;
    title: string;
    root_topic: string;
    block_count: number;
  };
}

const DEFAULT_SECTIONS = [
  "purpose",
  "design_principles",
  "continuous_evaluation",
  "predictive_interruptions",
  "auth",
  "endpoints",
  "proof_of_work_specification",
  "proof_of_work_payload",
  "performance",
  "checklist",
] as const;

export function parseIntegrationSkillRequest(body: Record<string, unknown>): IntegrationSkillRequest | null {
  const integrationName = typeof body.integration_name === "string" ? body.integration_name.trim() : "";
  if (!integrationName) return null;

  const partnerDescription =
    typeof body.partner_description === "string" ? body.partner_description.trim().slice(0, 8000) : undefined;
  const evalDefinition =
    typeof body.eval_definition === "string" ? body.eval_definition.trim().slice(0, 12000) : undefined;
  const blockId = typeof body.block_id === "string" ? body.block_id : null;
  const baseUrl =
    typeof body.base_url === "string" && body.base_url.trim()
      ? body.base_url.trim().replace(/\/$/, "")
      : "https://uncertain.systems";

  let include_sections: string[] | undefined;
  if (Array.isArray(body.include_sections)) {
    include_sections = body.include_sections
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  let integration_hints: ProofOfWorkSchemaIntegrationHints | undefined;
  const hintsRaw = body.integration_hints;
  if (hintsRaw && typeof hintsRaw === "object" && !Array.isArray(hintsRaw)) {
    const hints = hintsRaw as Record<string, unknown>;
    integration_hints = {
      tool_name: typeof hints.tool_name === "string" ? hints.tool_name.trim() : undefined,
      partner_agent: typeof hints.partner_agent === "string" ? hints.partner_agent.trim() : undefined,
      event_verbs: Array.isArray(hints.event_verbs)
        ? hints.event_verbs.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
        : undefined,
      goals: Array.isArray(hints.goals)
        ? hints.goals.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
        : undefined,
    };
  }

  const prefetchEvidenceSpec = body.prefetch_proof_of_work_spec === true;

  return {
    integration_name: integrationName.slice(0, 120),
    partner_description: partnerDescription,
    eval_definition: evalDefinition,
    block_id: blockId,
    base_url: baseUrl,
    include_sections,
    integration_hints,
    prefetch_proof_of_work_spec: prefetchEvidenceSpec,
  };
}

export function slugifyIntegrationName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function deriveSkillName(integrationName: string): string {
  const slug = slugifyIntegrationName(integrationName);
  return `${slug}-uncertain-systems-proof-of-work-performance`;
}

export function deriveSuggestedSharePath(integrationName: string): string {
  return `/${slugifyIntegrationName(integrationName)}-skill.md`;
}

export function parseSkillFrontmatter(skillMd: string): { name?: string; description?: string } | null {
  const match = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const frontmatter = match[1];
  const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  return { name, description };
}

/** Snapshot of live workspace state for skill.md generation. */
export function formatSkillWorkspaceStatus(
  status?: PerformanceContextPayload | null,
  blocks?: Array<{
    id: string;
    title: string | null;
    description: string | null;
    is_start?: boolean | null;
    status?: string | null;
  }>
): string {
  if (status) {
    const blockLines = status.blocks
      .map((block) => {
        const flags = [
          block.is_start ? "start" : null,
          block.status ? `status=${block.status}` : null,
        ]
          .filter(Boolean)
          .join(", ");
        const desc = block.description ? ` — ${block.description}` : "";
        return `- ${block.title || "Untitled"} (${block.id})${flags ? ` [${flags}]` : ""}${desc}`;
      })
      .join("\n");

    const evidenceTools = Array.from(
      new Set(
        status.proof_of_work
          .map((row) => row.tool_name)
          .filter((name): name is string => !!name)
      )
    );
    const fileNames = status.workspace_files
      .slice(0, 12)
      .map((f) => f.file_name)
      .filter(Boolean);

    return `Current workspace status (snapshot — skill.md must reflect this state):
- workspace_goal: ${status.workspace.workspace_goal || status.workspace.description || status.workspace.notes || "not set"}
- evaluation_mode: ${status.workspace.evaluation_mode || "semantic"}
- notes: ${status.workspace.notes || "n/a"}
- generated_at: ${status.generated_at}
- counts: blocks=${status.counts.blocks}, proof_of_work_artifacts=${status.counts.proof_of_work_artifacts}, linked_sessions=${status.counts.linked_sessions}, workspace_files=${status.counts.workspace_files}
- known tool names in prior proof of work: ${evidenceTools.length ? evidenceTools.join(", ") : "none yet"}
- workspace files (sample): ${fileNames.length ? fileNames.join(", ") : "none"}
- blocks:
${blockLines || "  none"}`;
  }

  const blockTable = (blocks || [])
    .map((block) => {
      const flags = [
        block.is_start ? "start" : null,
        block.status ? `status=${block.status}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `- ${block.title || "Untitled"} (${block.id})${flags ? ` [${flags}]` : ""}`;
    })
    .join("\n");

  return `Current workspace status (limited — full context may be attached as files):
- blocks:
${blockTable || "  No blocks yet."}`;
}

/** Integration UI copy for a Verification flow. */
export function knowledgeRegionIntegrationCopy(): {
  skillDescription: string;
  mcpNote: string;
} {
  return {
    skillDescription:
      "Download a skill.md for this Learning Map. Agents manage the map and Solve, Calibration, and Verification flows through workspace management (/api/v3/workspaces) and MCP.",
    mcpNote:
      "MCP JSON-RPC at POST /api/mcp with Bearer auth. Public tools manage Learning Maps and Solve, Calibration, and Verification flows. ChatGPT or Claude authorizes and edits the map for the user.",
  };
}

export function learningWorkspaceIntegrationCopy(): {
  skillDescription: string;
  mcpNote: string;
} {
  return {
    skillDescription:
      "Download a skill.md for this Learning Map. Agents create and edit the map and place Solve, Calibration, and Verification flows through workspace management.",
    mcpNote:
      "MCP JSON-RPC at POST /api/mcp with Bearer auth. Public tools manage Learning Maps and Solve, Calibration, and Verification flows. ChatGPT or Claude authorizes and edits the map for the user.",
  };
}

/** Verification and Calibration share the no-map Integrations copy. */
export function workspaceSettingsIntegrationCopy(kind: unknown): {
  skillDescription: string;
  mcpNote: string;
} {
  return isNoMapWorkspace(kind)
    ? knowledgeRegionIntegrationCopy()
    : learningWorkspaceIntegrationCopy();
}

export function formatSkillRestEndpointsLine(kind: unknown): string {
  const mapTools = workspaceSupportsFeature(kind, "map")
    ? ", GET/POST .../map-tools"
    : "";
  return `REST: Learning Map management GET/POST ${WORKSPACE_API_BASE}, GET/PATCH ${WORKSPACE_API_BASE}/{id}, GET/PATCH .../blocks${mapTools}, GET/POST ${FLOW_API_BASE}, GET/PATCH/DELETE ${FLOW_API_BASE}/{flow_id}, POST ${FLOW_API_BASE}/{flow_id}/link, GET/PATCH .../settings. Proof of work is recorded in the product UI.`;
}

export function buildIntegrationSkillInstructions(
  request: IntegrationSkillRequest,
  workspace: {
    id: string;
    title: string | null;
    root_topic: string | null;
    description?: string | null;
    notes?: string | null;
    workspace_goal?: string | null;
    workspace_kind?: unknown;
  },
  blocks: Array<{
    id: string;
    title: string | null;
    description: string | null;
    is_start?: boolean | null;
    status?: string | null;
  }>,
  blockId?: string | null,
  _proofOfWorkSpec?: ProofOfWorkEvalSchemaResult | null,
  /** Live performance context so skill.md reflects current workspace status. */
  status?: PerformanceContextPayload | null
): string {
  const sections = request.include_sections?.length ? request.include_sections : [...DEFAULT_SECTIONS];
  const skillName = deriveSkillName(request.integration_name);
  const scope = blockId ? "Focus the skill on one map tile." : "Cover the full Learning Map.";
  const baseUrl = request.base_url || "https://uncertain.systems";
  const integrationSkillPath = buildIntegrationSkillApiPath(workspace.id, baseUrl);
  const statusSection = formatSkillWorkspaceStatus(status, blocks);
  const workspaceKind = workspace.workspace_kind ?? status?.workspace.workspace_kind;
  const mcpToolList = formatSkillMcpToolList(workspaceKind);
  const restEndpointsLine = formatSkillRestEndpointsLine(workspaceKind);

  return `Generate a custom integration skill.md document for "${request.integration_name}" integrating with a Learning Map on Uncertain Systems.

${scope}

This workspace is a Learning Map: tiles are Solve, Calibration, Verification, or Content. Agents manage the map and those three flow types. Proof of work is recorded in the product UI. Headless start_session / upload_proof_of_work / end_session are not public agent APIs.

YAML frontmatter (required):
---
name: ${skillName}
description: ${request.integration_name} integration skill for managing a Learning Map and Solve, Calibration, and Verification flows.
---

Workspace:
- id: ${workspace.id}
- title: ${workspace.title || workspace.root_topic || "Untitled"}
- root_topic: ${workspace.root_topic || "n/a"}
- description: ${workspace.description || status?.workspace.description || "n/a"}

Base URL for examples: ${baseUrl}
Integration skill regeneration API: POST ${integrationSkillPath}

Required content:
1. Purpose — manage this Learning Map and create, list, update, and link Solve, Calibration, and Verification flows. ChatGPT or Claude authorizes with a Bearer key.
2. Authentication table (Bearer sk_ keys, scopes workspaces:read and workspaces:write).
3. Endpoints table:
   - ${restEndpointsLine}
   - MCP (JSON-RPC at POST /api/mcp with Bearer auth): ${mcpToolList}
4. Workspace-specific block list from the current status.
5. Quick checklist: create_workspace or get_workspace → list_map_tools / apply_map_tool (or update_blocks) → create_flow → link_flow.

${statusSection}

Return ONLY the markdown document. No JSON wrapper. No code fences around the entire document.`;
}

export function buildIntegrationSkillPrompt(workspaceTitle: string, integrationName: string): string {
  return `Write a complete skill.md integration guide for "${integrationName}" tailored to the current Learning Map "${workspaceTitle}". Cover map tools and Solve, Calibration, and Verification flow create/list/update/link. Do not document a public proof-of-work session loop.`;
}