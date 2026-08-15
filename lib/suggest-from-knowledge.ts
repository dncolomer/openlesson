/**
 * Suggest from Knowledge — pure helpers for xAI-backed author-prompt generation.
 *
 * Snapshots / eval reports + map geometry / block inventory are **context for the
 * model**, not the product. The product is one or more author prompts suitable
 * for expand / bridge / add-block / map-spot guidance fields.
 *
 * No network I/O here — unit tests drive fixtures; the route calls xAI.
 */

export type KnowledgeSnapshotSuggestInput = {
  /** Snapshot / eval run id */
  id?: string | null;
  /** ISO timestamp */
  ran_at?: string | null;
  /** Overall score 0–100 */
  score?: number | null;
  /** Workspace goal frozen at snapshot time */
  workspace_goal?: string | null;
  /** Block title or id when scoped */
  block_title?: string | null;
  block_id?: string | null;
  /** Vertical name (e.g. verification, tap, ile) */
  vertical?: string | null;
  /** Source tag (tap, ile, tapbench, web, api, …) */
  source?: string | null;
  /** Subject label for cross-user rows */
  subject_label?: string | null;
  /** Gap / strength themes from report */
  gap_themes?: string[] | null;
  strength_themes?: string[] | null;
  /** Free-text excerpts (transcript snippets, notes) */
  excerpts?: string[] | null;
  /** True when this snapshot is TAPBench / agent related */
  is_tapbench?: boolean | null;
};

/**
 * Themes extracted from a real VerticalScoreReport (or compatible) payload.
 * Production reports use gap_analysis.gaps[].title, strengths, growth_areas, summary —
 * NOT gap_themes / themes.gaps.
 */
export type EvalReportThemeExtract = {
  gap_themes: string[];
  strength_themes: string[];
  excerpts: string[];
  workspace_goal: string | null;
};

/**
 * Pure mapper: VerticalScoreReport-shaped (or sparse) report → theme lists for context.
 * Drives the route history→context path so real eval_run_history.report substance is kept.
 */
export function extractThemesFromEvalReport(
  report: unknown,
): EvalReportThemeExtract {
  const empty: EvalReportThemeExtract = {
    gap_themes: [],
    strength_themes: [],
    excerpts: [],
    workspace_goal: null,
  };
  if (!report || typeof report !== "object") return empty;
  const rec = report as Record<string, unknown>;

  const pushUnique = (into: string[], raw: unknown, max = 12) => {
    const t = clean(raw);
    if (t.length < 2) return;
    if (into.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    if (into.length >= max) return;
    into.push(t);
  };

  const gap_themes: string[] = [];
  const strength_themes: string[] = [];
  const excerpts: string[] = [];

  // --- Real VerticalScoreReport shape ---
  const gapAnalysis =
    rec.gap_analysis && typeof rec.gap_analysis === "object"
      ? (rec.gap_analysis as Record<string, unknown>)
      : null;
  if (Array.isArray(gapAnalysis?.gaps)) {
    for (const g of gapAnalysis!.gaps as unknown[]) {
      if (!g || typeof g !== "object") continue;
      const gr = g as Record<string, unknown>;
      pushUnique(gap_themes, gr.title || gr.name || gr.gap);
      // proof_of_work can be a short context line
      if (gap_themes.length < 8) {
        const pow = clean(gr.proof_of_work);
        if (pow.length >= 8 && pow.length <= 120) pushUnique(gap_themes, pow, 10);
      }
    }
  }
  if (Array.isArray(rec.growth_areas)) {
    for (const g of rec.growth_areas) pushUnique(gap_themes, g);
  }
  if (Array.isArray(rec.strengths)) {
    for (const s of rec.strengths) pushUnique(strength_themes, s);
  }
  const summary = clean(rec.summary);
  if (summary.length >= 12) pushUnique(excerpts, summary, 2);

  // --- Legacy / alternate shapes (pre-normalized fixtures) ---
  if (Array.isArray(rec.gap_themes)) {
    for (const g of rec.gap_themes) pushUnique(gap_themes, g);
  }
  if (Array.isArray(rec.strength_themes)) {
    for (const s of rec.strength_themes) pushUnique(strength_themes, s);
  }
  const themes =
    rec.themes && typeof rec.themes === "object"
      ? (rec.themes as Record<string, unknown>)
      : null;
  if (Array.isArray(themes?.gaps)) {
    for (const g of themes!.gaps) pushUnique(gap_themes, g);
  }
  if (Array.isArray(themes?.strengths)) {
    for (const s of themes!.strengths) pushUnique(strength_themes, s);
  }

  const workspace_goal = clean(rec.workspace_goal) || null;

  return { gap_themes, strength_themes, excerpts, workspace_goal };
}

/**
 * Map a listEvalRunHistory-shaped row (+ optional report) into Suggest input.
 * Pure — unit-tested with realistic VerticalScoreReport fixtures.
 */
export function mapEvalRunHistoryRowToSuggestInput(row: {
  id?: string | null;
  ran_at?: string | null;
  score?: number | null;
  workspace_goal?: string | null;
  block_id?: string | null;
  vertical?: string | null;
  source?: string | null;
  subject_user_id?: string | null;
  subject_guest_user_id?: string | null;
  report?: unknown;
  block_title?: string | null;
}): KnowledgeSnapshotSuggestInput {
  const themes = extractThemesFromEvalReport(row.report);
  const source = String(row.source || "");
  return {
    id: row.id ?? null,
    ran_at: row.ran_at ?? null,
    score: typeof row.score === "number" ? row.score : null,
    workspace_goal: clean(row.workspace_goal) || themes.workspace_goal,
    block_id: row.block_id ?? null,
    block_title: row.block_title ?? null,
    vertical: row.vertical ?? null,
    source,
    subject_label: row.subject_user_id || row.subject_guest_user_id || null,
    gap_themes: themes.gap_themes,
    strength_themes: themes.strength_themes,
    excerpts: themes.excerpts,
    is_tapbench: /tapbench/i.test(source),
  };
}

/** Map block inventory for authoring context (geometry + substance). */
export type KnowledgeMapBlockRef = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  is_start?: boolean | null;
  next_block_ids?: string[] | null;
  lock_until_block_ids?: string[] | null;
};

export type SuggestFromKnowledgeContext = {
  /** Authoring surface (add block, expand, bridge, map spot, …) */
  surface?: string | null;
  /** Current draft prompt / topic on the surface */
  draftPrompt?: string | null;
  /** Workspace title / root topic */
  workspaceTitle?: string | null;
  workspaceGoal?: string | null;
  workspaceNotes?: string | null;
  /** Map / block inventory */
  blocks?: readonly KnowledgeMapBlockRef[] | null;
  /** How many prompt suggestions to ask the model for */
  limit?: number;
};

export type KnowledgePromptSuggestion = {
  id: string;
  /** Short label for the chip / list */
  label: string;
  /** Full guidance text to inject into the generative prompt */
  prompt: string;
  /** Snapshot ids that grounded this suggestion (context provenance) */
  sourceSnapshotIds: string[];
  /** Why this was suggested (for UI hint) */
  rationale: string;
};

export type SuggestFromKnowledgeXaiMessages = {
  systemPrompt: string;
  userPrompt: string;
  /** Snapshot ids included in the context window (for provenance). */
  sourceSnapshotIds: string[];
  /** Truncated block count included in context. */
  blockCount: number;
  /** Truncated snapshot count included in context. */
  snapshotCount: number;
};

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Rank / filter snapshot rows for the **context window** (not as suggestions).
 * Prefer gap themes, low scores, TAPBench-tagged rows, recency.
 */
export function rankKnowledgeSnapshotsForSuggest(
  snapshots: readonly KnowledgeSnapshotSuggestInput[] | null | undefined,
): KnowledgeSnapshotSuggestInput[] {
  const rows = [...(snapshots || [])].filter((r) => r && typeof r === "object");
  return rows.sort((a, b) => {
    const aTap = a.is_tapbench || /tapbench/i.test(String(a.source || "")) ? 1 : 0;
    const bTap = b.is_tapbench || /tapbench/i.test(String(b.source || "")) ? 1 : 0;
    if (aTap !== bTap) return bTap - aTap;
    const aGaps = (a.gap_themes || []).length;
    const bGaps = (b.gap_themes || []).length;
    if (aGaps !== bGaps) return bGaps - aGaps;
    const aScore = typeof a.score === "number" ? a.score : 50;
    const bScore = typeof b.score === "number" ? b.score : 50;
    if (aScore !== bScore) return aScore - bScore;
    const aT = Date.parse(String(a.ran_at || "")) || 0;
    const bT = Date.parse(String(b.ran_at || "")) || 0;
    return bT - aT;
  });
}

/** Serialize a snapshot slice for the xAI user message (compact). */
export function serializeKnowledgeSnapshotsForContext(
  snapshots: readonly KnowledgeSnapshotSuggestInput[] | null | undefined,
  maxRows = 16,
): { text: string; ids: string[] } {
  const ranked = rankKnowledgeSnapshotsForSuggest(snapshots).slice(
    0,
    Math.max(1, maxRows),
  );
  const ids: string[] = [];
  const lines: string[] = [];
  for (const s of ranked) {
    if (s.id) ids.push(String(s.id));
    const isTap =
      Boolean(s.is_tapbench) || /tapbench/i.test(String(s.source || ""));
    const bits = [
      s.id ? `id=${s.id}` : null,
      isTap ? "TAPBench" : clean(s.source) || clean(s.vertical) || "snapshot",
      typeof s.score === "number" ? `score=${Math.round(s.score)}` : null,
      clean(s.block_title) ? `block=${clip(clean(s.block_title), 40)}` : null,
      clean(s.subject_label)
        ? `subject=${clip(clean(s.subject_label), 24)}`
        : null,
      clean(s.ran_at) ? `at=${clean(s.ran_at).slice(0, 10)}` : null,
    ].filter(Boolean);
    lines.push(`- ${bits.join(" · ")}`);
    const gaps = (s.gap_themes || []).map(clean).filter(Boolean).slice(0, 6);
    const strengths = (s.strength_themes || [])
      .map(clean)
      .filter(Boolean)
      .slice(0, 4);
    if (gaps.length) lines.push(`  gaps: ${gaps.join("; ")}`);
    if (strengths.length) lines.push(`  strengths: ${strengths.join("; ")}`);
    const goal = clean(s.workspace_goal);
    if (goal) lines.push(`  goal: ${clip(goal, 120)}`);
    for (const ex of (s.excerpts || []).slice(0, 1)) {
      const t = clean(ex);
      if (t) lines.push(`  excerpt: ${clip(t, 160)}`);
    }
  }
  if (!lines.length) {
    return { text: "(no snapshot / eval history available)", ids: [] };
  }
  return { text: lines.join("\n"), ids };
}

/** Serialize map block inventory for the xAI user message. */
export function serializeKnowledgeMapBlocksForContext(
  blocks: readonly KnowledgeMapBlockRef[] | null | undefined,
  maxBlocks = 40,
): { text: string; count: number } {
  const list = [...(blocks || [])]
    .filter((b) => b && (clean(b.id) || clean(b.title)))
    .slice(0, Math.max(1, maxBlocks));
  if (!list.length) {
    return { text: "(map empty — no blocks yet)", count: 0 };
  }
  const lines = list.map((b) => {
    const id = clean(b.id) || "?";
    const title = clip(clean(b.title) || "Untitled", 60);
    const desc = clip(clean(b.description), 100);
    const x = b.position_x != null ? Number(b.position_x) : null;
    const y = b.position_y != null ? Number(b.position_y) : null;
    const pos =
      x != null && y != null && Number.isFinite(x) && Number.isFinite(y)
        ? `@(${Math.round(x)},${Math.round(y)})`
        : "";
    const start = b.is_start ? " [start]" : "";
    const next = Array.isArray(b.next_block_ids) && b.next_block_ids.length
      ? ` next→${b.next_block_ids.length}`
      : "";
    const lock =
      Array.isArray(b.lock_until_block_ids) && b.lock_until_block_ids.length
        ? ` lock←${b.lock_until_block_ids.length}`
        : "";
    return `- ${id} ${title}${pos}${start}${next}${lock}${desc ? ` — ${desc}` : ""}`;
  });
  return { text: lines.join("\n"), count: list.length };
}

/**
 * Frame the authoring surface so the model writes guidance for the right action.
 */
export function surfaceFramingForSuggestKnowledge(surface: string): string {
  const s = clean(surface).toLowerCase();
  if (s.includes("bridge")) {
    return (
      "Surface: **bridge blocks**. Write author prompts that guide generation of " +
      "a knowledge bridge between selected blocks (shared vocabulary, causal link, " +
      "transition exercise)."
    );
  }
  if (s.includes("expand") && s.includes("map")) {
    return (
      "Surface: **Expand Map / suggest best spot**. Write author prompts that name " +
      "a concrete topic/theme for placing new empty-cell content on the map."
    );
  }
  if (s.includes("expand")) {
    return (
      "Surface: **expand block**. Write author prompts that steer multi-slot expansion " +
      "from a source block (applications, depth, prerequisites, related topics)."
    );
  }
  if (s.includes("shape") || s.includes("geometry") || s.includes("generate")) {
    return (
      "Surface: **generate in geometry / shape**. Write author prompts for a multi-cell " +
      "lecture block that fits the selected footprint."
    );
  }
  if (s.includes("add")) {
    return (
      "Surface: **add block**. Write author prompts for creating a new 1×1 (or multi) " +
      "map block topic with clear assessable scope."
    );
  }
  return (
    `Surface: **${clip(clean(surface) || "map build", 48)}**. Write author prompts ` +
    "that fill the free-text guidance field for map authoring generation."
  );
}

/**
 * Assemble system + user messages for the suggest-from-knowledge xAI call.
 * Snapshots and map blocks are context only — the model must output author prompts.
 */
export function assembleSuggestFromKnowledgeXaiMessages(
  snapshots: readonly KnowledgeSnapshotSuggestInput[] | null | undefined,
  context: SuggestFromKnowledgeContext = {},
): SuggestFromKnowledgeXaiMessages {
  const limit = Math.max(1, Math.min(context.limit ?? 4, 8));
  const surface = clean(context.surface) || "map build";
  const draft = clean(context.draftPrompt);
  const wsTitle = clean(context.workspaceTitle) || "Workspace";
  const wsGoal = clean(context.workspaceGoal);
  const notes = clean(context.workspaceNotes);

  const snap = serializeKnowledgeSnapshotsForContext(snapshots, 16);
  const map = serializeKnowledgeMapBlocksForContext(context.blocks, 40);

  const systemPrompt = [
    "You are an authoring assistant for a knowledge-map workspace.",
    "Your job is to propose **author prompts** (guidance text) the map builder will paste into generation fields.",
    "Use learner snapshot/eval history and the current map inventory as **context only**.",
    "Do NOT list or recommend snapshot IDs as the product. Do NOT invent fake snapshot rows.",
    "Each suggestion must be a concrete, actionable generation prompt (topic + angle + constraints).",
    "Prefer closing observed gaps and unknowns while fitting open map space and existing block coverage.",
    "Return JSON only:",
    `{ "suggestions": [ { "label": "short chip label", "prompt": "full author prompt text", "rationale": "one-line why" } ] }`,
    `Return ${limit} high-quality suggestions (or fewer if context is sparse).`,
    surfaceFramingForSuggestKnowledge(surface),
  ].join("\n");

  const userPrompt = [
    `Workspace: ${wsTitle}`,
    wsGoal ? `Workspace goal: ${clip(wsGoal, 240)}` : null,
    notes ? `Workspace notes: ${clip(notes, 200)}` : null,
    draft ? `Author draft / current field text: ${clip(draft, 400)}` : null,
    "",
    "## Learner snapshot / eval report context (use as signal, not as output)",
    snap.text,
    "",
    "## Map blocks / geometry (current inventory)",
    map.text,
    "",
    `Produce ${limit} author prompts for surface "${surface}".`,
  ]
    .filter((line) => line != null)
    .join("\n");

  return {
    systemPrompt,
    userPrompt,
    sourceSnapshotIds: snap.ids,
    blockCount: map.count,
    snapshotCount: rankedSnapshotCount(snapshots, 16),
  };
}

function rankedSnapshotCount(
  snapshots: readonly KnowledgeSnapshotSuggestInput[] | null | undefined,
  maxRows: number,
): number {
  return rankKnowledgeSnapshotsForSuggest(snapshots).slice(0, maxRows).length;
}

/**
 * Normalize xAI / API payload into author-prompt suggestions.
 * Empty or invalid payloads → empty list (no pure-template snapshot padding).
 */
export function normalizeSuggestFromKnowledgeResponse(
  raw: unknown,
  opts?: {
    sourceSnapshotIds?: string[] | null;
    limit?: number;
  },
): KnowledgePromptSuggestion[] {
  const limit = Math.max(1, Math.min(opts?.limit ?? 8, 12));
  const sourceIds = (opts?.sourceSnapshotIds || []).map(String).filter(Boolean);

  if (!raw || typeof raw !== "object") return [];
  const rec = raw as Record<string, unknown>;

  const list = Array.isArray(rec.suggestions)
    ? rec.suggestions
    : Array.isArray(rec.prompts)
      ? rec.prompts
      : Array.isArray(raw)
        ? (raw as unknown[])
        : [];

  const out: KnowledgePromptSuggestion[] = [];
  list.forEach((item, i) => {
    if (out.length >= limit) return;
    if (typeof item === "string") {
      const prompt = clean(item);
      if (prompt.length < 8) return;
      out.push({
        id: `knowledge-xai-${i}`,
        label: clip(prompt, 48),
        prompt,
        sourceSnapshotIds: sourceIds.slice(0, 8),
        rationale: "xAI suggestion from snapshot + map context",
      });
      return;
    }
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const prompt = clean(row.prompt || row.text || row.guidance || row.suggestion);
    if (prompt.length < 8) return;
    const label = clean(row.label || row.title) || clip(prompt, 48);
    const rationale =
      clean(row.rationale || row.reason || row.why) ||
      "xAI suggestion from snapshot + map context";
    out.push({
      id: clean(row.id) || `knowledge-xai-${i}`,
      label: clip(label, 64),
      prompt,
      sourceSnapshotIds: sourceIds.slice(0, 8),
      rationale: clip(rationale, 160),
    });
  });

  return out;
}

/**
 * @deprecated Offline template path — not the success product.
 * Prefer assembleSuggestFromKnowledgeXaiMessages + normalize after xAI.
 * Kept only so accidental imports compile; returns empty (no template theater).
 */
export function buildSuggestFromKnowledge(
  _snapshots: readonly KnowledgeSnapshotSuggestInput[] | null | undefined,
  _context: SuggestFromKnowledgeContext = {},
): KnowledgePromptSuggestion[] {
  void _snapshots;
  void _context;
  // Pure offline templates are not the product — route must call xAI.
  return [];
}
