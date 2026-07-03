import { callXaiWithSchema, DEFAULT_MODEL, userMessage } from "@/lib/xai-client";
import {
  buildCustomDemoDefinition,
  type GeneratedSimulationSpec,
} from "./custom-demo";
import { GENERATED_SIMULATION_SCHEMA } from "./simulation-generation-schema";

export async function generateCustomDemoFromPrompt(userPrompt: string) {
  const trimmed = userPrompt.trim();
  if (trimmed.length < 40) {
    throw new Error("Custom prompt must be at least 40 characters.");
  }
  if (trimmed.length > 8000) {
    throw new Error("Custom prompt must be 8000 characters or fewer.");
  }

  const result = await callXaiWithSchema<GeneratedSimulationSpec>(
    [
      userMessage(
        `Design a realistic SaaS learning-verification event simulator from this operator prompt.

Operator prompt:
"""
${trimmed}
"""

Return JSON only. Invent a plausible product name and integration if the prompt does not specify one.

Requirements:
- 3–7 category groups using ONLY these category keys: onboarding, integrations, projects, team, activation, support, edge_cases
- 2–6 evidence actions per category (15–30 total) modeling a NON-LINEAR learner journey
- Each action needs: stable snake_case id, label, description, block_hint, cta, dimension, outcome (success|partial|struggle|failure), repeatable when re-try makes sense
- Include mistakes, recovery paths, optional skips, and re-engagement-friendly events where appropriate
- Do NOT include calendar/time-gap actions — those are added automatically by the platform
- eval_definition: multi-bullet verification objective grounded in the prompt
- competency_rows: markdown table rows (no header) like "| dimension_key | What evidence should show |" for 6–10 dimensions
- integration_name and tool_name: lowercase snake_case partner identifiers
- scenario_intro: 2–3 sentences, production tone — no "demo", "simulation", or "fictional"`
      ),
    ],
    GENERATED_SIMULATION_SCHEMA,
    {
      model: DEFAULT_MODEL,
      maxTokens: 6000,
      temperature: 0.35,
    }
  );

  if (!result.success || !result.data?.categories?.length) {
    throw new Error(result.error || "Failed to generate custom simulation events");
  }

  return buildCustomDemoDefinition(result.data, trimmed);
}