import type { ProofOfWorkEvalSchemaResult, ProofOfWorkSchemaIntegrationHints } from "./proof-of-work-schema";
import type { PerformanceContextPayload } from "./performance-context";
import {
  buildProofOfWorkSchemaApiPath,
  buildProofOfWorkUploadApiPath,
  buildIntegrationSkillApiPath,
  buildPerformanceApiPath,
  formatProofOfWorkSpecForSkillPrompt,
} from "./proof-of-work-integration";
import { POW_API_BASE, WORKSPACE_API_BASE } from "@/lib/api/agent-api-paths";
import { isNoMapWorkspace } from "@/lib/workspace-kind";
import { workspaceSupportsFeature } from "@/lib/workspace-capabilities";
import { formatSkillMcpToolList } from "./agent-tool-surface";
import { CANVAS_TAP_SIMULATION_HEADING } from "./pow-model-agent-contract";
import { POW_MODEL_VERSION } from "./workspace-proof-of-work";

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
- workspace_goal: ${status.workspace.workspace_goal || "not set"}
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
      "Download a skill.md for this Verification flow. Agents use workspace management (/api/v3/workspaces) and the headless proof-of-work API (/api/v3/pow) to create, edit, and run Calibrate, Learn, and Verify sessions.",
    mcpNote:
      "MCP JSON-RPC at POST /api/mcp with Bearer auth. Two APIs: workspace management and headless proof-of-work. ChatGPT or Claude authorizes and runs flows for the user.",
  };
}

export function learningWorkspaceIntegrationCopy(): {
  skillDescription: string;
  mcpNote: string;
} {
  return {
    skillDescription:
      "Download a skill.md for this Learning workspace. Agents create and edit the map through workspace management, then run Calibrate, Learn, or Verify headless through the proof-of-work API.",
    mcpNote:
      "MCP JSON-RPC at POST /api/mcp with Bearer auth. Two APIs: workspace management and headless proof-of-work. ChatGPT or Claude authorizes and runs flows for the user.",
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
  return `REST: workspace management GET/POST ${WORKSPACE_API_BASE}, GET/PATCH ${WORKSPACE_API_BASE}/{id}, GET/PATCH .../blocks${mapTools}, GET/PATCH .../settings, GET/PATCH /api/v3/account, POST .../integration-skill; headless proof-of-work POST ${POW_API_BASE}/workspaces/{id}/sessions, GET .../sessions/{session_id}, POST .../proof-of-work, POST .../end, GET .../flow-embeddings. Snapshot and Stash are not public agent APIs.`;
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
  proofOfWorkSpec?: ProofOfWorkEvalSchemaResult | null,
  /** Live performance context so skill.md reflects current workspace status. */
  status?: PerformanceContextPayload | null
): string {
  const sections = request.include_sections?.length ? request.include_sections : [...DEFAULT_SECTIONS];
  const skillName = deriveSkillName(request.integration_name);
  const sharePath = deriveSuggestedSharePath(request.integration_name);
  const scope = blockId ? "Focus the skill on one workspace block." : "Cover the full workspace.";
  const baseUrl = request.base_url || "https://uncertain.systems";
  const proofOfWorkSchemaPath = buildProofOfWorkSchemaApiPath(workspace.id, baseUrl);
  const evidenceUploadPath = buildProofOfWorkUploadApiPath(workspace.id, baseUrl);
  const integrationSkillPath = buildIntegrationSkillApiPath(workspace.id, baseUrl);
  const performancePath = buildPerformanceApiPath(workspace.id, baseUrl);

  const evalDefinition =
    request.eval_definition?.trim() ||
    request.partner_description?.trim() ||
    status?.workspace.notes?.trim() ||
    workspace.notes?.trim() ||
    workspace.description?.trim() ||
    status?.workspace.workspace_goal?.trim() ||
    workspace.workspace_goal?.trim() ||
    "Verify learning for this workspace with proof-of-work-backed gap analysis.";

  const statusSection = formatSkillWorkspaceStatus(status, blocks);

  const proofOfWorkSpecSection = proofOfWorkSpec
    ? `\n\nWorkspace proof-of-work specification (use as reference; skill.md must still point to the dynamic API):\n${formatProofOfWorkSpecForSkillPrompt(proofOfWorkSpec)}`
    : "";

  const workspaceKind = workspace.workspace_kind ?? status?.workspace.workspace_kind;
  const knowledgeRegion = isNoMapWorkspace(workspaceKind);
  if (!knowledgeRegion) {
    const mcpToolList = formatSkillMcpToolList(workspaceKind);
    const restEndpointsLine = formatSkillRestEndpointsLine(workspaceKind);
    return `Generate a custom integration skill.md document for "${request.integration_name}" integrating with a Learning workspace on Uncertain Systems.

${scope}

This workspace is a Learning workspace: a map of blocks plus Learn. Agents manage the workspace and run that flow headless. Snapshot and Stash are not public agent APIs.

YAML frontmatter (required):
---
name: ${skillName}
description: ${request.integration_name} integration skill for managing a Learning workspace and running headless Calibrate, Learn, and Verify.
---

Workspace:
- id: ${workspace.id}
- title: ${workspace.title || workspace.root_topic || "Untitled"}
- root_topic: ${workspace.root_topic || "n/a"}
- description: ${workspace.description || status?.workspace.description || "n/a"}

Base URL for examples: ${baseUrl}
Integration skill regeneration API: POST ${integrationSkillPath}

Required content:
1. Purpose — manage this Learning workspace map and run Calibrate, Learn, or Verify through the headless proof-of-work API. ChatGPT or Claude authorizes with a Bearer key and runs the flow for the user.
2. Authentication table (Bearer sk_ / gsk_, scopes workspaces:read and workspaces:write).
3. Endpoints table:
   - ${restEndpointsLine}
   - MCP (JSON-RPC at POST /api/mcp with Bearer auth): ${mcpToolList}
4. Workspace-specific block list from the current status.
5. Quick checklist: create_workspace or get_workspace → list_map_tools / apply_map_tool (or update_blocks) → start_session → upload_proof_of_work → end_session.

${statusSection}

Return ONLY the markdown document. No JSON wrapper. No code fences around the entire document.`;
  }
  const restEndpointsLine = formatSkillRestEndpointsLine(workspaceKind);
  const mcpToolList = formatSkillMcpToolList(workspaceKind);
  const krStashSection = knowledgeRegion
    ? `
   - Headless proof-of-work: start_session (calibrate | learn | verify) → upload_proof_of_work → end_session
   - Do not document Snapshot or Stash as public agent APIs.`
    : "";
  const canonicalRefs = knowledgeRegion
    ? `${request.base_url}/docs/proof-of-work-api`
    : `${request.base_url}/skill.md and ${request.base_url}/docs/proof-of-work-api`;
  const checklist = knowledgeRegion
    ? "create or get workspace → start_session → upload_proof_of_work through the clock → end_session → regenerate skill."
    : "create or get workspace → edit map/settings → start_session → upload_proof_of_work → end_session → regenerate skill.";
  const purposeLine = knowledgeRegion
    ? "1. Purpose — what this partner agent verifies **given the current Verification flow status** and how workspace management + headless Calibrate/Learn/Verify fit the workflow."
    : "1. Purpose — what this partner agent verifies **given the current Learning workspace status** and how workspace management + headless Calibrate/Learn/Verify fit the workflow.";

  return `Generate a custom integration skill.md document for "${request.integration_name}" integrating with Uncertain Systems Proof-of-Work API.

${scope}

This skill.md is a **snapshot tailored to the workspace's current status** (blocks, goal, notes, proof-of-work volume, known tools). It must treat the proof of work specification as a formal contract and **must be regenerated** as workspace proof of work grows. Integrators fetch the live schema dynamically; do not tell them to invent ad-hoc JSON. This document is not static.

YAML frontmatter (required):
---
name: ${skillName}
description: ${request.integration_name} integration skill for Uncertain Systems workspace proof of work upload and performance analysis (current workspace snapshot).
---

Workspace:
- id: ${workspace.id}
- title: ${workspace.title || workspace.root_topic || "Untitled"}
- root_topic: ${workspace.root_topic || "n/a"}
- description: ${workspace.description || status?.workspace.description || "n/a"}
- workspace_goal: ${workspace.workspace_goal || status?.workspace.workspace_goal || "n/a"}

Partner description from API caller:
${request.partner_description || "Not provided: infer reasonable integration goals from the current workspace status."}

Evaluation definition (derived from workspace notes/goal when not supplied):
"""
${evalDefinition}
"""

${statusSection}

Base URL for examples: ${request.base_url}
Suggested share path: ${sharePath}
Workspace management API: ${WORKSPACE_API_BASE}
Headless proof-of-work API: ${POW_API_BASE} (start_session, upload_proof_of_work, end_session)
Integration skill regeneration API (self-update — MUST document prominently): POST ${integrationSkillPath}

Sections to include: ${sections.join(", ")}
${proofOfWorkSpecSection}

Required content:
The downloaded skill.md always ends with "${CANVAS_TAP_SIMULATION_HEADING}". That section is the tool_name and tool_action catalog for simulating a human session as ${POW_MODEL_VERSION}. Do not rename those values or fold them into one generic event.
${purposeLine}
2. Design principles — checkpoint-agnostic timing, block-scoped vs workspace-global analysis, tool usage as core signal, always fetch the live proof-of-work spec before uploading, **more proof of work improves evaluation quality**.
3. **Continuous evaluation and regeneration (required section)** — this is a must-have operating model, not optional maintenance. Include:
   - Principle: evaluation is continuous; the more data and proof of work submitted, the better Uncertain Systems can learn and snapshot
   - This skill.md is a snapshot; partner agents must **regenerate** it via POST ${integrationSkillPath} as proof of work accumulates
   - Re-fetch the proof of work spec via POST ${proofOfWorkSchemaPath} on a recurring basis (e.g. after every 5-10 new uploads, when blocks change, or when scores feel stale)
   - Explicit warning: treating the initial skill.md as permanent will degrade quality over time
   - Recommended loop: start_session → upload_proof_of_work → end_session → regenerate skill → repeat
   - Reference the \`continuous_evaluation\` object returned by the proof of work spec API for machine-readable self-update triggers
4. **Predictive interruptions (required section)** — expected-free-energy interruption on every Proof-of-Work API response:
   - Every REST and MCP success response includes top-level \`interruption\` (object or null).
   - When non-null: schedule \`intervention\` after \`delay_ms\` unless a later Proof-of-Work API response supersedes it.
   - When null: no interruption predicted — do not schedule from that response.
   - Document consumer obligations: read interruption every call, supersede pending timers, never stack duplicate timers.
   - Reference \`interruption_contract\` from the proof of work spec API for the machine-readable interruption contract and intervention types.
   - Include JSON examples for active interruption and null (empty).
5. Authentication table (Bearer sk_ / gsk_, Teams tier, scopes).
6. Endpoints table covering REST and MCP with **dual documentation** (never hide REST behind MCP):
   - ${restEndpointsLine}
   - MCP (JSON-RPC at POST /api/mcp with Bearer auth): ${mcpToolList}
   - State that MCP tools have parity with REST for the two public APIs (workspace management and headless proof-of-work). Agents create and edit workspaces.
   - Recommend create_workspace or get_workspace, then start_session${krStashSection}
7. **Proof-of-work specification (required section)** — explain that payloads are defined by the formal proof-of-work spec returned from POST ${proofOfWorkSchemaPath}. Include:
   - When to call the proof of work spec endpoint (before first upload, after proof-of-work milestones, when eval definition or blocks change)
   - Example request body with definition, optional block_id, and integration_hints
   - That the response includes tool_submissions, proof_of_work_upload_contract, interruption_contract, continuous_evaluation, schema_name, example_payload, collection_guidance, and top-level interruption
   - Instruction to validate tool payloads against the fetched schema before upload
   - Do NOT embed a static schema as the source of truth; reference the API path above
8. Workspace-specific block mapping guidance and example tool JSON payloads that match the proof of work spec (illustrative only).
9. **Headless session outcomes (required section)** — after end_session the observable is the answers-model tree, the inferred path, remaining time, and the flow embedding. Do not document Snapshot or Stash flush.
10. Quick integration checklist: ${checklist}

Canonical API reference links: ${canonicalRefs}

Return ONLY the markdown document. No JSON wrapper. No code fences around the entire document.`;
}

export function buildIntegrationSkillPrompt(workspaceTitle: string, integrationName: string): string {
  return `Write a complete skill.md integration guide for "${integrationName}" tailored to the **current status** of Uncertain Systems workspace "${workspaceTitle}" (blocks, goal, notes, existing proof of work). The guide must reference dynamic self-updating APIs for proof-of-work spec and skill regeneration, and treat continuous evaluation (more proof of work = better learning) as a must-have operating model.`;
}