/**
 * Tools-required OpenRouter catalog for AI-use detection.
 * No row is default-checked. GET responses omit slugs.
 */

export const REGION_SIMULATION_DEFAULT_SAMPLES_PER_AI_USE = 6;
export const REGION_SIMULATION_MIN_SAMPLES_PER_AI_USE = 3;
export const REGION_SIMULATION_MAX_SAMPLES_PER_AI_USE = 12;

export type AiUseCatalogThinking =
  | { kind: "effort"; effort: "low" | "medium" | "high" }
  | { kind: "max_tokens"; maxTokens: number };

export type AiUseCatalogRow = {
  id: string;
  displayName: string;
  slug: string;
  thinking: AiUseCatalogThinking;
  thinkingLabel: string;
  toolsRequired: true;
  imageInput: boolean;
  dataCollection: "allow" | "deny";
};

export const AI_USE_CATALOG: readonly AiUseCatalogRow[] = [
  {
    id: "gpt-mini-low",
    displayName: "GPT Mini · low",
    slug: "openai/gpt-4o-mini",
    thinking: { kind: "effort", effort: "low" },
    thinkingLabel: "low",
    toolsRequired: true,
    imageInput: true,
    dataCollection: "deny",
  },
  {
    id: "gpt-mini-high",
    displayName: "GPT Mini · high",
    slug: "openai/gpt-4o-mini",
    thinking: { kind: "effort", effort: "high" },
    thinkingLabel: "high",
    toolsRequired: true,
    imageInput: true,
    dataCollection: "deny",
  },
  {
    id: "claude-sonnet-med",
    displayName: "Claude Sonnet · medium",
    slug: "anthropic/claude-sonnet-4.5",
    thinking: { kind: "max_tokens", maxTokens: 2048 },
    thinkingLabel: "medium",
    toolsRequired: true,
    imageInput: true,
    dataCollection: "deny",
  },
  {
    id: "gemini-flash",
    displayName: "Gemini Flash",
    slug: "google/gemini-2.5-flash",
    thinking: { kind: "effort", effort: "low" },
    thinkingLabel: "low",
    toolsRequired: true,
    imageInput: true,
    dataCollection: "deny",
  },
  {
    id: "grok-low",
    displayName: "Grok · low",
    slug: "x-ai/grok-4.5",
    thinking: { kind: "effort", effort: "low" },
    thinkingLabel: "low",
    toolsRequired: true,
    imageInput: false,
    dataCollection: "deny",
  },
];

export const AI_USE_DEFAULT_CHECKED: readonly string[] = [];

export function aiUseCatalogById(id: unknown): AiUseCatalogRow | null {
  const key = String(id || "").trim();
  return AI_USE_CATALOG.find((row) => row.id === key) ?? null;
}

export function parseAiUseCatalogIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const row = aiUseCatalogById(item);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row.id);
  }
  return out;
}

export function clampSamplesPerAiUse(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return REGION_SIMULATION_DEFAULT_SAMPLES_PER_AI_USE;
  return Math.max(
    REGION_SIMULATION_MIN_SAMPLES_PER_AI_USE,
    Math.min(REGION_SIMULATION_MAX_SAMPLES_PER_AI_USE, n),
  );
}

export function publicAiUseCatalog(): Array<{
  id: string;
  displayName: string;
  thinkingLabel: string;
  imageInput: boolean;
  training: "denied" | "allowed";
}> {
  return AI_USE_CATALOG.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    thinkingLabel: row.thinkingLabel,
    imageInput: row.imageInput,
    training: row.dataCollection === "allow" ? "allowed" : "denied",
  }));
}

export function aiUseSampleRunId(input: {
  catalogId: string;
  index: number;
  seed: string;
}): string {
  const catalogId = String(input.catalogId || "model").replace(/[^a-z0-9-]/gi, "-");
  const seed = String(input.seed || "s").replace(/[^a-z0-9._-]/gi, "").slice(0, 24);
  return `aiusim_${catalogId}_${input.index}_${seed}`;
}
