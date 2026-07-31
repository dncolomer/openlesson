/**
 * Shared workspace/block prompt context for TAP openings, starting topics,
 * Exercise TAP / ILE Project framing, and TAPBench exercises.
 *
 * Pure assembly — callers load files/notes/goal from DB and pass them in.
 * File bodies are size-capped so large workspaces do not blow prompt budgets.
 */

export const PROMPT_FILE_EXCERPT_MAX_CHARS = 2_400;
export const PROMPT_FILE_EXCERPT_MAX_FILES = 6;
export const PROMPT_NOTES_MAX_CHARS = 1_800;
export const PROMPT_DESCRIPTION_MAX_CHARS = 1_200;

export interface WorkspaceFileContextItem {
  name: string;
  /** Optional body/excerpt; omitted when only the name is known. */
  excerpt?: string | null;
  mime_type?: string | null;
}

export interface PromptWorkspaceContextInput {
  workspaceTitle?: string | null;
  rootTopic?: string | null;
  /** Workspace goal or description (learning outcome). */
  workspaceGoal?: string | null;
  workspaceDescription?: string | null;
  notes?: string | null;
  blockTitle?: string | null;
  blockDescription?: string | null;
  /** ILE chapter plan text / longer-horizon brief. */
  chapterDescription?: string | null;
  files?: WorkspaceFileContextItem[] | null;
  /** Extra free text already assembled by the caller. */
  extra?: string | null;
}

export interface PromptWorkspaceContext {
  workspaceTitle: string | null;
  rootTopic: string | null;
  workspaceGoal: string | null;
  workspaceDescription: string | null;
  notes: string | null;
  blockTitle: string | null;
  blockDescription: string | null;
  chapterDescription: string | null;
  fileNames: string[];
  fileExcerpts: Array<{ name: string; excerpt: string }>;
  /** True when description, notes, chapter, or file bodies provide domain substance beyond titles. */
  hasDomainSubstance: boolean;
  /** Human-readable block for LLM system/user prompts. */
  contextBlock: string;
  /** Compact domain cue string used by pure exercise framers. */
  domainSubstanceSummary: string;
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function normalizeOptional(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\s+/g, " ").trim();
  return t || null;
}

/**
 * Normalize workspace file rows into bounded name + excerpt list.
 * Empty bodies still keep file names so prompts know materials exist.
 */
export function normalizeWorkspaceFileContext(
  files: WorkspaceFileContextItem[] | null | undefined,
  options?: { maxFiles?: number; maxExcerptChars?: number },
): { fileNames: string[]; fileExcerpts: Array<{ name: string; excerpt: string }> } {
  const maxFiles = options?.maxFiles ?? PROMPT_FILE_EXCERPT_MAX_FILES;
  const maxExcerpt = options?.maxExcerptChars ?? PROMPT_FILE_EXCERPT_MAX_CHARS;
  const fileNames: string[] = [];
  const fileExcerpts: Array<{ name: string; excerpt: string }> = [];

  for (const f of files || []) {
    const name = typeof f?.name === "string" ? f.name.trim() : "";
    if (!name) continue;
    if (fileNames.length >= maxFiles) break;
    fileNames.push(name);
    const body =
      typeof f.excerpt === "string" ? f.excerpt.replace(/\u0000/g, "").trim() : "";
    if (body) {
      fileExcerpts.push({ name, excerpt: clip(body, maxExcerpt) });
    }
  }
  return { fileNames, fileExcerpts };
}

/**
 * Build the shared TAP/ILE prompt context object.
 */
export function assemblePromptWorkspaceContext(
  input: PromptWorkspaceContextInput,
): PromptWorkspaceContext {
  const workspaceTitle = normalizeOptional(input.workspaceTitle);
  const rootTopic = normalizeOptional(input.rootTopic);
  const workspaceGoal = normalizeOptional(input.workspaceGoal);
  const workspaceDescription = normalizeOptional(input.workspaceDescription);
  const notesRaw = normalizeOptional(input.notes);
  const notes = notesRaw ? clip(notesRaw, PROMPT_NOTES_MAX_CHARS) : null;
  const blockTitle = normalizeOptional(input.blockTitle);
  const blockDescriptionRaw = normalizeOptional(input.blockDescription);
  const blockDescription = blockDescriptionRaw
    ? clip(blockDescriptionRaw, PROMPT_DESCRIPTION_MAX_CHARS)
    : null;
  const chapterDescriptionRaw = normalizeOptional(input.chapterDescription);
  const chapterDescription = chapterDescriptionRaw
    ? clip(chapterDescriptionRaw, PROMPT_DESCRIPTION_MAX_CHARS)
    : null;
  const { fileNames, fileExcerpts } = normalizeWorkspaceFileContext(input.files);
  const extra = normalizeOptional(input.extra);

  const substanceParts = [
    chapterDescription,
    blockDescription,
    workspaceGoal,
    workspaceDescription,
    notes,
    ...fileExcerpts.map((f) => f.excerpt),
    extra,
  ].filter((p): p is string => Boolean(p && p.length > 12));

  const hasDomainSubstance = substanceParts.length > 0;

  const domainSubstanceSummary = substanceParts.slice(0, 4).join(" ").slice(0, 900);

  const lines: string[] = ["## Workspace / block context (use this domain — do not invent unrelated topics)"];
  if (workspaceTitle) lines.push(`Workspace title: ${workspaceTitle}`);
  if (rootTopic) lines.push(`Root topic: ${rootTopic}`);
  if (workspaceGoal) lines.push(`Workspace goal: ${workspaceGoal}`);
  if (workspaceDescription && workspaceDescription !== workspaceGoal) {
    lines.push(`Workspace description: ${workspaceDescription}`);
  }
  if (notes) lines.push(`Workspace notes:\n${notes}`);
  if (blockTitle) lines.push(`Focused block: ${blockTitle}`);
  if (blockDescription) lines.push(`Block description: ${blockDescription}`);
  if (chapterDescription) lines.push(`Chapter / plan text: ${chapterDescription}`);
  if (fileNames.length > 0) {
    lines.push(`Workspace files (names always in context):\n${fileNames.map((n) => `- ${n}`).join("\n")}`);
  } else {
    lines.push("Workspace files: none listed.");
  }
  if (fileExcerpts.length > 0) {
    lines.push("File excerpts (truncated):");
    for (const f of fileExcerpts) {
      lines.push(`### ${f.name}\n${f.excerpt}`);
    }
  }
  if (extra) lines.push(`Additional context:\n${extra}`);
  if (!hasDomainSubstance) {
    lines.push(
      "Note: domain substance is thin (mostly titles). Prefer concrete knowledge tasks from the title/topic; do not pad with stage directions.",
    );
  }

  return {
    workspaceTitle,
    rootTopic,
    workspaceGoal,
    workspaceDescription,
    notes,
    blockTitle,
    blockDescription,
    chapterDescription,
    fileNames,
    fileExcerpts,
    hasDomainSubstance,
    contextBlock: lines.join("\n"),
    domainSubstanceSummary,
  };
}

/**
 * Format context for injection into LLM task prompts (openings, topics, facilitators).
 */
export function formatPromptWorkspaceContextBlock(
  input: PromptWorkspaceContextInput | PromptWorkspaceContext,
): string {
  if ("contextBlock" in input && typeof input.contextBlock === "string") {
    return input.contextBlock;
  }
  return assemblePromptWorkspaceContext(input as PromptWorkspaceContextInput).contextBlock;
}

/** Stage-direction phrases banned in learner-facing exercise/dialog strings. */
const OUT_LOUD_STAGE_DIRECTION =
  /\b(out\s+loud|think\s+aloud|think-aloud|talk\s+through\s+what\s+you\s+learned\s+here\s+out\s+loud|say\s+[^.]{0,40}\s+out\s+loud|verbalize\s+out\s+loud|speak\s+out\s+loud)\b/i;

export function containsOutLoudStageDirection(text: string): boolean {
  return OUT_LOUD_STAGE_DIRECTION.test(String(text || ""));
}

/**
 * Strip common stage-direction clauses from an otherwise good domain sentence.
 */
export function stripOutLoudStageDirections(text: string): string {
  let t = String(text || "");
  t = t.replace(/\s*out\s+loud\b/gi, "");
  t = t.replace(/\bthink\s+aloud(?:\s+through)?\b/gi, "");
  t = t.replace(/\bon your own\b/gi, "");
  t = t.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
  return t;
}
