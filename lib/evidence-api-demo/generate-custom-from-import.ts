import { callXaiWithSchema, DEFAULT_MODEL, userMessage } from "@/lib/xai-client";
import {
  buildCustomDemoDefinition,
  type GeneratedSimulationSpec,
} from "./custom-demo";
import {
  formatImportHintsForPrompt,
  IMPORT_TEXT_MAX_LENGTH,
  IMPORT_TEXT_MIN_LENGTH,
  parseImportText,
  type ImportSource,
} from "./parse-import-text";
import { GENERATED_SIMULATION_SCHEMA } from "./simulation-generation-schema";

export interface ImportEventsSummary {
  source: ImportSource;
  integration_name: string;
  product_name: string;
  evidence_action_count: number;
  mcp_tools_discovered: number;
  endpoints_discovered: number;
}

export async function generateCustomDemoFromImport(
  importText: string,
  source: ImportSource
): Promise<{ demo: ReturnType<typeof buildCustomDemoDefinition>; summary: ImportEventsSummary }> {
  const trimmed = importText.trim();
  if (trimmed.length < IMPORT_TEXT_MIN_LENGTH) {
    throw new Error(`Import text must be at least ${IMPORT_TEXT_MIN_LENGTH} characters.`);
  }
  if (trimmed.length > IMPORT_TEXT_MAX_LENGTH) {
    throw new Error(`Import text must be ${IMPORT_TEXT_MAX_LENGTH} characters or fewer.`);
  }

  const hints = parseImportText(trimmed, source);
  const hintsBlock = formatImportHintsForPrompt(hints);

  const sourceInstructions =
    source === "mcp"
      ? `The operator pasted MCP server / tool catalog text. Explore every tool, resource, and capability described.
Map each meaningful MCP tool or workflow into one or more evidence events the partner agent could emit.
Include setup, discovery, successful calls, partial failures, retries, and edge cases where the MCP contract implies them.`
      : `The operator pasted an integration skill.md (or similar partner skill). Read endpoints, evidence contract, goals, and workflows.
Derive evidence events from API paths, tool actions, checkpoints, and serialized goals — not just happy-path clicks.
Include recovery, optional skips, and re-engagement events when the skill describes them.`;

  const result = await callXaiWithSchema<GeneratedSimulationSpec>(
    [
      userMessage(
        `Design a realistic SaaS learning-verification event simulator by importing an external integration document.

${sourceInstructions}

Structured hints extracted from the paste:
${hintsBlock}

Return JSON only.

Requirements:
- Infer product_name, integration_name, and tool_name from the document when present; otherwise invent plausible names aligned with the paste
- 3–7 category groups using ONLY: onboarding, integrations, projects, team, activation, support, edge_cases
- 2–6 evidence actions per category (15–30 total) modeling a NON-LINEAR learner journey grounded in the imported capabilities
- Each action: stable snake_case id (prefer verbs from the document), label, description, block_hint, cta, dimension, outcome (success|partial|struggle|failure), repeatable when retries make sense
- Cover the breadth of MCP tools / skill endpoints — do not collapse everything into 3 generic events
- Do NOT include calendar/time-gap actions — added automatically by the platform
- eval_definition: multi-bullet verification objective grounded in the imported integration purpose
- competency_rows: markdown table rows (no header) like "| dimension_key | What evidence should show |" for 6–10 dimensions
- scenario_intro: 2–3 sentences describing what workflow is being verified — production tone, no "demo" or "simulation"`
      ),
    ],
    GENERATED_SIMULATION_SCHEMA,
    {
      model: DEFAULT_MODEL,
      maxTokens: 6500,
      temperature: 0.3,
    }
  );

  if (!result.success || !result.data?.categories?.length) {
    throw new Error(result.error || "Failed to generate simulation events from import");
  }

  const demo = buildCustomDemoDefinition(
    result.data,
    `Imported from ${source} integration document (${hints.integrationName || hints.skillName || "external system"}).`
  );

  return {
    demo,
    summary: {
      source,
      integration_name: demo.integrationName,
      product_name: demo.productName,
      evidence_action_count: demo.actions.filter((action) => action.kind === "evidence").length,
      mcp_tools_discovered: hints.mcpTools.length,
      endpoints_discovered: hints.endpoints.length,
    },
  };
}