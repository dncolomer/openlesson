/**
 * Planner / command language that xAI copies into learner-facing text.
 * Strip it at display time; also forbid it in generation prompts.
 */
const SESSION_FORMAT_WRAPPER =
  /^(in (one|this|a) (multi-turn )?guided (conversation|dialogue)[,:.]?\s+|through (a |one )?(multi-turn )?guided (conversation|dialogue)[,:.]?\s+)/i;

const COMMAND_META_WRAPPERS = [
  /^your (question|reply|answer|prompt) sits in the right place(?:\s*\([^)]+\))?[.!]?\s*/i,
  /^\(after\s+(?:check\/?\s*ask|simplify|split|refactor|declutter)\)[.!]?\s*/i,
  /^after\s+(?:check\/?\s*ask|simplify|split|refactor|declutter)[,:.]?\s*/i,
];

export function isSessionFormatWrapper(text: string | null | undefined): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return SESSION_FORMAT_WRAPPER.test(t);
}

function capitalizeIfStripped(original: string, stripped: string): string {
  if (!stripped) return "";
  if (stripped === original) return original;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/**
 * Strip leaked planner preambles from learner-facing openings.
 * Leaves the rest of the sentence; capitalizes the first remaining letter.
 */
export function stripSessionFormatWrapper(text: string | null | undefined): string {
  const original = String(text || "").trim();
  if (!original) return "";
  let t = original;
  for (let i = 0; i < 3; i += 1) {
    const next = t.replace(SESSION_FORMAT_WRAPPER, "").trim();
    if (next === t) break;
    t = next;
  }
  return capitalizeIfStripped(original, t);
}

/** Strip Check/ask placement chatter from canvas replies. */
export function stripCommandMetaWrapper(text: string | null | undefined): string {
  const original = String(text || "").trim();
  if (!original) return "";
  let t = original;
  for (let i = 0; i < 4; i += 1) {
    let next = t;
    for (const re of COMMAND_META_WRAPPERS) {
      next = next.replace(re, "").trim();
    }
    if (next === t) break;
    t = next;
  }
  return capitalizeIfStripped(original, t);
}

export function stripLearnerFacingWrappers(text: string | null | undefined): string {
  const original = String(text || "").trim();
  if (!original) return "";
  return stripCommandMetaWrapper(stripSessionFormatWrapper(original));
}
