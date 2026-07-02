export interface IntegrationSkillRequest {
  integration_name: string;
  partner_description?: string;
  block_id?: string | null;
  base_url?: string;
  include_sections?: string[];
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
  "evidence_payload",
  "performance",
  "checklist",
] as const;

export function parseIntegrationSkillRequest(body: Record<string, unknown>): IntegrationSkillRequest | null {
  const integrationName = typeof body.integration_name === "string" ? body.integration_name.trim() : "";
  if (!integrationName) return null;

  const partnerDescription =
    typeof body.partner_description === "string" ? body.partner_description.trim().slice(0, 8000) : undefined;
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

  return {
    integration_name: integrationName.slice(0, 120),
    partner_description: partnerDescription,
    block_id: blockId,
    base_url: baseUrl,
    include_sections,
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
  blockId?: string | null
): string {
  const sections = request.include_sections?.length ? request.include_sections : [...DEFAULT_SECTIONS];
  const skillName = deriveSkillName(request.integration_name);
  const sharePath = deriveSuggestedSharePath(request.integration_name);
  const scope = blockId ? "Focus the skill on one workspace block." : "Cover the full workspace.";

  const blockTable = blocks
    .map((block) => `- ${block.title || "Untitled"} (${block.id})${block.is_start ? " [start]" : ""}`)
    .join("\n");

  return `Generate a custom integration skill.md document for "${request.integration_name}" integrating with OpenLesson Agentic API v2.

${scope}

Follow the structure and tone of the PumaDoc evidence-performance skill (purpose, design principles, auth table, endpoints table, open evidence guidance, performance examples, integration checklist).

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

Blocks in this workspace:
${blockTable || "No blocks yet."}

Base URL for examples: ${request.base_url}
Suggested share path: ${sharePath}

Sections to include: ${sections.join(", ")}

Required content:
1. Purpose — what this partner agent verifies and how evidence + performance fit the workflow.
2. Design principles — checkpoint-agnostic timing, block-scoped vs workspace-global analysis, tool usage as core signal.
3. Authentication table (Bearer sk_ / gsk_, Teams tier, scopes).
4. Endpoints table covering: POST /workspaces, GET /blocks, POST /evidence-schema (optional pre-planning), POST /evidence, POST /performance, POST /integration-skill.
5. Workspace-specific block mapping guidance and example tool JSON payloads tailored to this workspace topic.
6. Performance report and chat-mode examples scoped to this workspace.
7. Quick integration checklist.

Canonical API reference links: ${request.base_url}/skill.md and ${request.base_url}/docs/agentic-v2

Return ONLY the markdown document. No JSON wrapper. No code fences around the entire document.`;
}

export function buildIntegrationSkillPrompt(workspaceTitle: string, integrationName: string): string {
  return `Write a complete skill.md integration guide for "${integrationName}" using OpenLesson workspace "${workspaceTitle}".`;
}