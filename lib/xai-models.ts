// ============================================
// xAI model constants (client-safe)
//
// Pure constants with no Node/server dependencies.
// Client components MUST import from here (or a client-safe module),
// not from lib/xai-client.ts, which pulls in server-only context.
// ============================================

export const DEFAULT_MODEL = "grok-4.5";

/** Open-ended canvas questions (ask / answer / draw). */
export const CANVAS_ASK_MODEL = "grok-4.7";

/** Structured canvas commands (concepts, define, simplify, …). No reasoning loop. */
export const CANVAS_COMMAND_MODEL = "grok-4.20-0309-non-reasoning";

/** Grok Imagine stills for org sidebar style. */
export const IMAGINE_IMAGE_MODEL = "grok-imagine-image-2.0";

/**
 * Grok 4.5 reasoning depth. API default is "high" (slow); we default to "low"
 * for interactive latency. Reasoning cannot be fully disabled on grok-4.5.
 * @see https://docs.x.ai/developers/model-capabilities/text/reasoning
 */
export type ReasoningEffort = "low" | "medium" | "high";

/** Prefer low for chat/UX; override to medium/high for hard analysis jobs. */
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "low";

/** True when this model id accepts Chat Completions `reasoning_effort`. */
export function modelSendsReasoningEffort(model: string | null | undefined): boolean {
  const id = String(model || "").toLowerCase();
  if (!id || id.includes("non-reasoning")) return false;
  if (/^grok-4\.(5|6|7)/.test(id)) return true;
  if (id.includes("grok-4.20") && id.includes("reasoning")) return true;
  return false;
}

export interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export const AVAILABLE_MODELS: readonly ModelOption[] = [
  { id: "grok-4.5", label: "Grok 4.5", description: "Newest xAI flagship model" },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"] | string;
