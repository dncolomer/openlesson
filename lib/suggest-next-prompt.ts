/**
 * Pick exactly one author prompt from a suggest payload.
 * A repeat call with that prompt as the current field text advances to a
 * different candidate, or returns null when no other candidate exists.
 */

import {
  normalizeSuggestFromKnowledgeResponse,
  type KnowledgePromptSuggestion,
} from "@/lib/suggest-from-knowledge";

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniquePrompts(suggestions: readonly KnowledgePromptSuggestion[]): string[] {
  const prompts: string[] = [];
  const seen = new Set<string>();
  for (const suggestion of suggestions) {
    const prompt = clean(suggestion.prompt);
    const key = prompt.toLowerCase();
    if (!prompt || seen.has(key)) continue;
    seen.add(key);
    prompts.push(prompt);
  }
  return prompts;
}

/**
 * Resolve a suggestions payload + the current field text to one prompt.
 * Walks candidates in order and returns the next one that differs from the
 * field. Returns null when the payload is empty or every candidate matches
 * the field.
 */
export function pickNextDistinctAuthorPrompt(
  raw: unknown,
  currentFieldText?: string | null,
): string | null {
  const prompts = uniquePrompts(
    normalizeSuggestFromKnowledgeResponse(raw, { limit: 12 }),
  );
  if (prompts.length === 0) return null;

  const current = clean(currentFieldText).toLowerCase();
  if (!current) return prompts[0] ?? null;

  const idx = prompts.findIndex((prompt) => prompt.toLowerCase() === current);
  if (idx === -1) return prompts[0] ?? null;

  for (let step = 1; step < prompts.length; step++) {
    const candidate = prompts[(idx + step) % prompts.length];
    if (candidate && candidate.toLowerCase() !== current) return candidate;
  }
  return null;
}
