/**
 * Extra authoring prompt context: journey graph (leads-to + lock-until)
 * so new blocks respect existing DAGs, not only spatial neighbors.
 */

function cleanId(id: unknown): string {
  return String(id ?? "").trim();
}

function titleOf(
  byId: Map<string, { title?: string | null }>,
  id: string,
): string {
  const t = String(byId.get(id)?.title || "").trim();
  return t || id;
}

export type JourneyGraphBlockRef = {
  id: string;
  title?: string | null;
  next_block_ids?: readonly string[] | null;
  lock_until_block_ids?: readonly string[] | null;
};

/**
 * Pure text snippet for LLM user prompts: existing leads-to and lock-until
 * among workspace blocks (optionally filtered to a focus set + their peers).
 */
export function composeJourneyGraphPromptSnippet(
  blocks: readonly JourneyGraphBlockRef[],
  options?: {
    /** Prefer edges touching these block ids (and 1-hop peers). */
    focusBlockIds?: readonly string[];
    maxLines?: number;
  },
): string {
  const byId = new Map(
    blocks
      .map((b) => [cleanId(b.id), b] as const)
      .filter(([id]) => Boolean(id)),
  );
  if (byId.size === 0) return "";

  const focus = new Set(
    (options?.focusBlockIds || []).map(cleanId).filter(Boolean),
  );
  const maxLines = Math.max(4, Math.min(40, options?.maxLines ?? 24));

  const leads: string[] = [];
  const locks: string[] = [];

  for (const [id, b] of byId) {
    for (const raw of b.next_block_ids || []) {
      const to = cleanId(raw);
      if (!to || to === id || !byId.has(to)) continue;
      if (
        focus.size > 0 &&
        !focus.has(id) &&
        !focus.has(to)
      ) {
        continue;
      }
      leads.push(
        `- "${titleOf(byId, id)}" leads to "${titleOf(byId, to)}"`,
      );
    }
    for (const raw of b.lock_until_block_ids || []) {
      const pre = cleanId(raw);
      if (!pre || pre === id || !byId.has(pre)) continue;
      if (focus.size > 0 && !focus.has(id) && !focus.has(pre)) continue;
      locks.push(
        `- "${titleOf(byId, id)}" is locked until "${titleOf(byId, pre)}" is done`,
      );
    }
  }

  const lines: string[] = [];
  if (leads.length) {
    lines.push("Existing journey (leads-to) edges:");
    lines.push(...leads.slice(0, Math.ceil(maxLines / 2)));
  }
  if (locks.length) {
    lines.push("Existing lock-until (prerequisite) edges:");
    lines.push(...locks.slice(0, Math.floor(maxLines / 2)));
  }
  if (lines.length === 0) return "";

  return [
    "Journey / DAG structure on this map (respect these when inventing topics — do not contradict unlock order or invent unrelated islands):",
    ...lines,
  ].join("\n");
}

/** System message for single-slot create. Bridge uses stronger linking language. */
export function composeAddBlockAtSlotSystemMessage(
  intent?: "default" | "bridge" | string | null,
): string {
  if (String(intent || "").toLowerCase() === "bridge") {
    return [
      "You create a single knowledge-bridge learning block for a workspace skill grid slot.",
      "This block sits on a straight bridge path between selected topics — frame it as a connecting idea, transition, prerequisite link, shared foundation, or comparison that helps a learner move between those concepts.",
      "Do not invent an isolated unrelated topic.",
      'Return JSON only: { "title": "...", "description": "..." }.',
      "Title: 4-14 words. Description: 1-3 sentences.",
    ].join(" ");
  }
  return [
    "You create a single learning block for a workspace skill grid slot.",
    "Return JSON only: { \"title\": \"...\", \"description\": \"...\" }.",
    "Title: 4-14 words. Description: 1-3 sentences.",
    "Honor spatial neighbors and any journey/DAG edges provided in the user message.",
  ].join(" ");
}
