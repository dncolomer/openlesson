import type { EvidenceEvalSchemaResult, EvidenceSchemaIntegrationHints } from "./evidence-schema";
import { buildEvidenceSchemaApiPath, buildEvidenceUploadApiPath, formatEvidenceSpecForSkillPrompt } from "./evidence-integration";

export interface IntegrationSkillRequest {
  integration_name: string;
  partner_description?: string;
  eval_definition?: string;
  block_id?: string | null;
  base_url?: string;
  include_sections?: string[];
  integration_hints?: EvidenceSchemaIntegrationHints;
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

  return {
    integration_name: integrationName.slice(0, 120),
    partner_description: partnerDescription,
    eval_definition: evalDefinition,
    block_id: blockId,
    base_url: baseUrl,
    include_sections,
    integration_hints,
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
  const evidenceSchemaPath = buildEvidenceSchemaApiPath(workspace.id, request.base_url || "https://openlesson.academy");
  const evidenceUploadPath = buildEvidenceUploadApiPath(workspace.id, request.base_url || "https://openlesson.academy");

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

  return `Generate a custom integration skill.md document for "${request.integration_name}" integrating with OpenLesson Agentic API v2.

${scope}

This skill.md must treat the evidence specification as a formal contract. Integrators fetch the live schema dynamically; do not tell them to invent ad-hoc JSON.

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
${request.partner_description || "Not provided — infer reasonable integration goals from the workspace."}

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

Sections to include: ${sections.join(", ")}
${evidenceSpecSection}

Required content:
1. Purpose — what this partner agent verifies and how evidence + performance fit the workflow.
2. Design principles — checkpoint-agnostic timing, block-scoped vs workspace-global analysis, tool usage as core signal, always fetch the live evidence spec before uploading.
3. Authentication table (Bearer sk_ / gsk_, Teams tier, scopes).
4. Endpoints table covering: POST /workspaces, GET /blocks, POST /evidence-schema, POST /evidence, POST /performance, POST /integration-skill.
5. **Evidence specification (required section)** — explain that payloads are defined by the formal evidence spec returned from POST ${evidenceSchemaPath}. Include:
   - When to call the evidence spec endpoint (before first upload, when eval definition or blocks change)
   - Example request body with definition, optional block_id, and integration_hints
   - That the response includes tool_submissions (per-tool JSON Schemas), evidence_upload_contract, schema_name, example_payload, and collection_guidance
   - Instruction to validate tool payloads against the fetched schema before upload
   - Do NOT embed a static schema as the source of truth; reference the API path above
6. Workspace-specific block mapping guidance and example tool JSON payloads that match the evidence spec (illustrative only).
7. Performance report and chat-mode examples scoped to this workspace.
8. Quick integration checklist: fetch evidence spec → upload evidence per contract → request performance.

Canonical API reference links: ${request.base_url}/skill.md and ${request.base_url}/docs/agentic-v2

Return ONLY the markdown document. No JSON wrapper. No code fences around the entire document.`;
}

export function buildIntegrationSkillPrompt(workspaceTitle: string, integrationName: string): string {
  return `Write a complete skill.md integration guide for "${integrationName}" using OpenLesson workspace "${workspaceTitle}". The guide must reference the dynamic evidence spec API for formal tool payload schemas.`;
}