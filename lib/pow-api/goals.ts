/**
 * Standalone multi-goals: workspace-scoped + block-scoped natural-language goals,
 * pure resolution for LWM Snapshot (default / adhoc / selected), and fingerprints
 * for PoW∪goals snapshot uniqueness.
 */

export const GOAL_TEXT_MAX_LENGTH = 500;

export type GoalScope = "workspace" | "block" | "adhoc";

/** Catalog row (persisted workspace or block goal). */
export type GoalCatalogEntry = {
  id: string;
  text: string;
  scope: "workspace" | "block";
  block_id?: string | null;
  sort_order?: number;
};

/** Frozen goal used at snapshot evaluation time. */
export type EvaluatedGoal = {
  /** Catalog id when selected from stored goals; null for adhoc. */
  id: string | null;
  text: string;
  scope: GoalScope;
  block_id?: string | null;
};

export type GoalSelectionMode = "default" | "adhoc" | "selected";

/**
 * Request-side goal selection for snapshot generation.
 * - default (omit or explicit): all workspace goals ∪ goals of PoW-related blocks
 * - adhoc: single natural-language goal from the LWM UI
 * - selected: explicit catalog goal ids (workspace and/or block)
 */
export type GoalSelectionInput = {
  mode?: GoalSelectionMode | null;
  /** Natural-language adhoc goal (mode=adhoc). */
  adhoc_goal?: string | null;
  /** Catalog ids when mode=selected (or when goal_ids provided without mode). */
  goal_ids?: string[] | null;
  /** Alias accepted on REST/MCP bodies. */
  selected_goal_ids?: string[] | null;
};

export function normalizeGoalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, GOAL_TEXT_MAX_LENGTH);
}

export function summarizeGoalsText(goals: readonly EvaluatedGoal[]): string {
  const parts = goals
    .map((g) => normalizeGoalText(g.text))
    .filter((t): t is string => Boolean(t));
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return parts.join("; ");
}

/** Stable hash fingerprint (FNV-1a 32-bit hex) for identity keys. */
export function fingerprintString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Fingerprint of an evaluated goal set.
 * Order-independent: sorts by scope, id, text.
 */
export function fingerprintGoals(goals: readonly EvaluatedGoal[]): string {
  const normalized = goals
    .map((g) => {
      const text = normalizeGoalText(g.text) || "";
      const id = g.id?.trim() || "";
      const scope = g.scope || "workspace";
      const block = g.block_id?.trim() || "";
      return `${scope}|${id}|${block}|${text}`;
    })
    .filter((line) => line.split("|").pop())
    .sort();
  return fingerprintString(normalized.join("\n"));
}

/**
 * Fingerprint of a PoW set (ids or stable content keys).
 * Order-independent.
 */
export function fingerprintPowSet(powKeys: readonly string[]): string {
  const keys = [...new Set(powKeys.map((k) => String(k).trim()).filter(Boolean))].sort();
  return fingerprintString(keys.join("\n"));
}

/**
 * Composite snapshot identity over PoW set + goals.
 * Distinct when either fingerprint differs.
 */
export function snapshotIdentityKey(input: {
  powFingerprint: string;
  goalsFingerprint: string;
}): string {
  return `${input.powFingerprint}:${input.goalsFingerprint}`;
}

export function parseGoalSelectionFromBody(
  body: Record<string, unknown> | null | undefined,
): GoalSelectionInput {
  if (!body || typeof body !== "object") return { mode: "default" };

  const rawMode = body.goal_mode ?? body.goals_mode ?? body.mode;
  let mode: GoalSelectionMode | null = null;
  if (rawMode === "default" || rawMode === "adhoc" || rawMode === "selected") {
    mode = rawMode;
  }

  const adhoc =
    typeof body.adhoc_goal === "string"
      ? body.adhoc_goal
      : typeof body.adhocGoal === "string"
        ? body.adhocGoal
        : null;

  const rawIds = body.goal_ids ?? body.selected_goal_ids ?? body.selectedGoalIds;
  let goal_ids: string[] | null = null;
  if (Array.isArray(rawIds)) {
    goal_ids = rawIds
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean);
  }

  // Infer mode when only adhoc or ids provided.
  if (!mode) {
    if (adhoc && normalizeGoalText(adhoc)) mode = "adhoc";
    else if (goal_ids && goal_ids.length > 0) mode = "selected";
    else mode = "default";
  }

  return {
    mode,
    adhoc_goal: adhoc,
    goal_ids,
    selected_goal_ids: goal_ids,
  };
}

/**
 * Resolve the evaluated goal set for a snapshot run.
 * Pure — no I/O.
 */
export function resolveEvaluatedGoals(input: {
  selection?: GoalSelectionInput | null;
  workspaceGoals: readonly GoalCatalogEntry[];
  blockGoals: readonly GoalCatalogEntry[];
  /** Block ids linked by the PoW rows under evaluation (default set). */
  powRelatedBlockIds?: readonly string[] | null;
}): EvaluatedGoal[] {
  const selection = input.selection ?? { mode: "default" };
  const mode: GoalSelectionMode =
    selection.mode === "adhoc" || selection.mode === "selected"
      ? selection.mode
      : "default";

  if (mode === "adhoc") {
    const text = normalizeGoalText(selection.adhoc_goal);
    if (!text) return [];
    return [{ id: null, text, scope: "adhoc", block_id: null }];
  }

  if (mode === "selected") {
    const ids = new Set(
      [
        ...(selection.goal_ids || []),
        ...(selection.selected_goal_ids || []),
      ]
        .map((id) => id.trim())
        .filter(Boolean),
    );
    if (ids.size === 0) return [];

    const byId = new Map<string, GoalCatalogEntry>();
    for (const g of input.workspaceGoals) byId.set(g.id, g);
    for (const g of input.blockGoals) byId.set(g.id, g);

    const out: EvaluatedGoal[] = [];
    for (const id of ids) {
      const hit = byId.get(id);
      if (!hit) continue;
      const text = normalizeGoalText(hit.text);
      if (!text) continue;
      out.push({
        id: hit.id,
        text,
        scope: hit.scope,
        block_id: hit.scope === "block" ? hit.block_id ?? null : null,
      });
    }
    return sortEvaluatedGoals(out);
  }

  // default: all workspace goals ∪ goals for blocks related to PoW
  const relatedBlocks = new Set(
    (input.powRelatedBlockIds || []).map((id) => id.trim()).filter(Boolean),
  );
  const out: EvaluatedGoal[] = [];

  for (const g of input.workspaceGoals) {
    const text = normalizeGoalText(g.text);
    if (!text) continue;
    out.push({
      id: g.id,
      text,
      scope: "workspace",
      block_id: null,
    });
  }

  for (const g of input.blockGoals) {
    const bid = g.block_id?.trim() || "";
    if (relatedBlocks.size > 0 && bid && !relatedBlocks.has(bid)) continue;
    // When no PoW block links, still include all block goals if catalog non-empty
    // only when relatedBlocks is empty → include none of block goals? Spec:
    // "all goals of blocks related to the PoW data". Empty related → no block goals.
    if (relatedBlocks.size === 0) continue;
    const text = normalizeGoalText(g.text);
    if (!text) continue;
    out.push({
      id: g.id,
      text,
      scope: "block",
      block_id: bid || null,
    });
  }

  return sortEvaluatedGoals(out);
}

function sortEvaluatedGoals(goals: EvaluatedGoal[]): EvaluatedGoal[] {
  return [...goals].sort((a, b) => {
    const sa = a.scope === "workspace" ? 0 : a.scope === "block" ? 1 : 2;
    const sb = b.scope === "workspace" ? 0 : b.scope === "block" ? 1 : 2;
    if (sa !== sb) return sa - sb;
    const ta = a.text.localeCompare(b.text);
    if (ta !== 0) return ta;
    return (a.id || "").localeCompare(b.id || "");
  });
}

/**
 * Collect block ids referenced by PoW rows (block_id field).
 */
export function blockIdsFromProofOfWork(
  rows: readonly { block_id?: string | null }[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const id = typeof row.block_id === "string" ? row.block_id.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Normalize evaluated goals from history/report JSON.
 */
export function normalizeEvaluatedGoals(raw: unknown): EvaluatedGoal[] {
  if (!Array.isArray(raw)) return [];
  const out: EvaluatedGoal[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const text = normalizeGoalText(rec.text);
    if (!text) continue;
    const scopeRaw = rec.scope;
    const scope: GoalScope =
      scopeRaw === "block" || scopeRaw === "adhoc" || scopeRaw === "workspace"
        ? scopeRaw
        : "workspace";
    const id =
      typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : null;
    const block_id =
      typeof rec.block_id === "string" && rec.block_id.trim()
        ? rec.block_id.trim()
        : null;
    out.push({ id, text, scope, block_id });
  }
  return sortEvaluatedGoals(out);
}

/**
 * Format goals for LLM scoring instructions (authoritative multi-goal block).
 */
export function formatGoalsForScoringPrompt(goals: readonly EvaluatedGoal[]): string {
  if (goals.length === 0) {
    return "";
  }
  if (goals.length === 1) {
    return `\nAuthoritative goal (use for workspace_goal summary; score the LWM Snapshot primary against this):\n"${goals[0].text}"\n`;
  }
  const lines = goals.map((g, i) => {
    const tag =
      g.scope === "workspace"
        ? "workspace"
        : g.scope === "block"
          ? `block${g.block_id ? `:${g.block_id.slice(0, 8)}` : ""}`
          : "adhoc";
    return `${i + 1}. [${tag}] ${g.text}`;
  });
  return `\nAuthoritative goals for this snapshot (score the LWM Snapshot primary against this set; set workspace_goal to a concise summary of them):\n${lines.join("\n")}\n`;
}

/**
 * Text for knowledge-config embedding bag-of-tokens (evaluated goals).
 */
export function goalsEmbeddingText(goals: readonly EvaluatedGoal[]): string {
  return goals
    .map((g) => normalizeGoalText(g.text))
    .filter((t): t is string => Boolean(t))
    .join(" ");
}
