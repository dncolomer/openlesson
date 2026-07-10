import type { EvidenceEvalSchemaResult, EvidenceSchemaIntegrationHints } from "./evidence-schema";
import {
  buildEvidenceSchemaApiPath,
  buildEvidenceUploadApiPath,
  buildIntegrationSkillApiPath,
  buildPerformanceApiPath,
  formatEvidenceSpecForSkillPrompt,
} from "./evidence-integration";

export interface IntegrationSkillRequest {
  integration_name: string;
  partner_description?: string;
  eval_definition?: string;
  block_id?: string | null;
  base_url?: string;
  include_sections?: string[];
  integration_hints?: EvidenceSchemaIntegrationHints;
  /** When true, generates evidence spec inline (slower; may timeout). Default false — fetch spec via evidence-schema API separately. */
  prefetch_evidence_spec?: boolean;
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
  "auth",
  "endpoints",
  "evidence_specification",
  "evidence_payload",
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
      : "https://openlesson.academy";

  let include_sections: string[] | undefined;
  if (Array.isArray(body.include_sections)) {
    include_sections = body.include_sections
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  let integration_hints: EvidenceSchemaIntegrationHints | undefined;
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

  const prefetchEvidenceSpec = body.prefetch_evidence_spec === true;

  return {
    integration_name: integrationName.slice(0, 120),
    partner_description: partnerDescription,
    eval_definition: evalDefinition,
    block_id: blockId,
    base_url: baseUrl,
    include_sections,
    integration_hints,
    prefetch_evidence_spec: prefetchEvidenceSpec,
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
  return `${slug}-openlesson-evidence-performance`;
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

export function buildIntegrationSkillInstructions(
  request: IntegrationSkillRequest,
  workspace: { id: string; title: string | null; root_topic: string | null; description?: string | null },
  blocks: Array<{ id: string; title: string | null; description: string | null; is_start?: boolean | null }>,
  blockId?: string | null,
  evidenceSpec?: EvidenceEvalSchemaResult | null
): string {
  const sections = request.include_sections?.length ? request.include_sections : [...DEFAULT_SECTIONS];
  const skillName = deriveSkillName(request.integration_name);
  const sharePath = deriveSuggestedSharePath(request.integration_name);
  const scope = blockId ? "Focus the skill on one workspace block." : "Cover the full workspace.";
  const baseUrl = request.base_url || "https://openlesson.academy";
  const evidenceSchemaPath = buildEvidenceSchemaApiPath(workspace.id, baseUrl);
  const evidenceUploadPath = buildEvidenceUploadApiPath(workspace.id, baseUrl);
  const integrationSkillPath = buildIntegrationSkillApiPath(workspace.id, baseUrl);
  const performancePath = buildPerformanceApiPath(workspace.id, baseUrl);

  const blockTable = blocks
    .map((block) => `- ${block.title || "Untitled"} (${block.id})${block.is_start ? " [start]" : ""}`)
    .join("\n");

  const evalDefinition =
    request.eval_definition?.trim() ||
    request.partner_description?.trim() ||
    workspace.description?.trim() ||
    "Verify learning for this workspace with evidence-backed gap analysis.";

  const evidenceSpecSection = evidenceSpec
    ? `\n\nWorkspace evidence specification (use as reference; skill.md must still point to the dynamic API):\n${formatEvidenceSpecForSkillPrompt(evidenceSpec)}`
    : "";

  return `Generate a custom integration skill.md document for "${request.integration_name}" integrating with OpenLesson Evidence API.

${scope}

This skill.md must treat the evidence specification as a formal contract and **must be regenerated** as workspace evidence grows. Integrators fetch the live schema dynamically; do not tell them to invent ad-hoc JSON. This document is not static.

YAML frontmatter (required):
---
name: ${skillName}
description: ${request.integration_name} integration skill for OpenLesson workspace evidence upload and performance analysis.
---

Workspace:
- id: ${workspace.id}
- title: ${workspace.title || workspace.root_topic || "Untitled"}
- root_topic: ${workspace.root_topic || "n/a"}
- description: ${workspace.description || "n/a"}

Partner description from API caller:
${request.partner_description || "Not provided: infer reasonable integration goals from the workspace."}

Evaluation definition (shared with evidence spec generation):
"""
${evalDefinition}
"""

Blocks in this workspace:
${blockTable || "No blocks yet."}

Base URL for examples: ${request.base_url}
Suggested share path: ${sharePath}
Evidence spec API (dynamic — MUST document prominently): POST ${evidenceSchemaPath}
Evidence upload API: POST ${evidenceUploadPath}
Integration skill regeneration API (self-update — MUST document prominently): POST ${integrationSkillPath}
Performance API (re-run as evidence grows): POST ${performancePath}

Sections to include: ${sections.join(", ")}
${evidenceSpecSection}

Required content:
1. Purpose — what this partner agent verifies and how evidence + performance fit the workflow.
2. Design principles — checkpoint-agnostic timing, block-scoped vs workspace-global analysis, tool usage as core signal, always fetch the live evidence spec before uploading, **more evidence improves evaluation quality**.
3. **Continuous evaluation and regeneration (required section)** — this is a must-have operating model, not optional maintenance. Include:
   - Principle: verification is continuous; the more data and evidence submitted, the better OpenLesson can learn and evaluate
   - This skill.md is a snapshot; partner agents must **regenerate** it via POST ${integrationSkillPath} as evidence accumulates
   - Re-fetch the evidence spec via POST ${evidenceSchemaPath} on a recurring basis (e.g. after every 5-10 new uploads, when blocks change, or when scores feel stale)
   - Re-request performance via POST ${performancePath} after meaningful evidence batches
   - Explicit warning: treating the initial skill.md or spec as permanent will degrade evaluation quality over time
   - Recommended loop: upload evidence → re-fetch spec → regenerate skill → request performance → repeat
   - Reference the \`continuous_evaluation\` object returned by the evidence spec API for machine-readable self-update triggers
4. Authentication table (Bearer sk_ / gsk_, Teams tier, scopes).
5. Endpoints table covering REST and MCP with **dual documentation** (never hide REST behind MCP):
   - REST: POST /workspaces, GET /blocks, POST /evidence-schema, POST /evidence, POST /performance, POST /integration-skill
   - MCP (JSON-RPC at POST /api/mcp with Bearer auth): list_workspaces, get_workspace, get_learning_progress, list_blocks, generate_evidence_schema, upload_evidence, analyze_performance, generate_integration_skill, create_tap_link, list_tap_links, get_tap_results
   - State that MCP tools have full parity with REST; evidence spec responses include both continuous_evaluation (REST paths) and continuous_evaluation_mcp (tool names)
   - Recommend get_learning_progress / generate_evidence_schema first for progress orientation
6. **Evidence specification (required section)** — explain that payloads are defined by the formal evidence spec returned from POST ${evidenceSchemaPath}. Include:
   - When to call the evidence spec endpoint (before first upload, after evidence milestones, when eval definition or blocks change)
   - Example request body with definition, optional block_id, and integration_hints
   - That the response includes tool_submissions, evidence_upload_contract, performance_report_contract, continuous_evaluation, schema_name, example_payload, and collection_guidance
   - Instruction to validate tool payloads against the fetched schema before upload
   - Do NOT embed a static schema as the source of truth; reference the API path above
7. Workspace-specific block mapping guidance and example tool JSON payloads that match the evidence spec (illustrative only).
8. **Performance (required section)** — document POST ${performancePath} report mode. Every report MUST include:
   - overall_score (0-100 integer readiness score)
   - marker_scores (4-8 competency axes for spider/radar visualization: id, label, score, rationale, optional block_id)
   - gap_analysis with gaps[] (title, evidence, severity low|medium|high, suggested_repair) and next_steps { directions[], events[] } — remediation must be product/workflow-specific; never TAP, block completion, ILE, or OpenLesson platform tasks
   - summary, strengths, growth_areas, suggestions, confidence
   - Reference performance_report_contract from the evidence spec API for the machine-readable contract and example_report
   - Include a full JSON example response with overall_score, marker_scores, and at least one gap
   - Chat mode example with prompt + conversation_history
9. Quick integration checklist: fetch evidence spec → upload evidence per contract → regenerate skill → request performance → repeat as evidence grows.

Canonical API reference links: ${request.base_url}/skill.md and ${request.base_url}/docs/agentic-v2

Return ONLY the markdown document. No JSON wrapper. No code fences around the entire document.`;
}

export function buildIntegrationSkillPrompt(workspaceTitle: string, integrationName: string): string {
  return `Write a complete skill.md integration guide for "${integrationName}" using OpenLesson workspace "${workspaceTitle}". The guide must reference dynamic self-updating APIs for evidence spec and skill regeneration, and treat continuous evaluation (more evidence = better learning) as a must-have operating model.`;
}