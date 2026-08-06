/**
 * Shared workspace/block prompt context for TAP openings, starting topics,
 * Exercise TAP / ILE Project framing, and TAPBench exercises.
 *
 * Pure assembly — callers load files/notes/goal/blocks from DB and pass them in.
 * Layers: workspace-global materials, map topology/inventory, focused block,
 * and optional block-local materials (files + refs into global).
 * File bodies are size-capped so large workspaces do not blow prompt budgets.
 */

import { buildExternalUrlJitBiasSnippet } from "@/lib/workspace-external-resources";

export const PROMPT_FILE_EXCERPT_MAX_CHARS = 2_400;
export const PROMPT_FILE_EXCERPT_MAX_FILES = 6;
export const PROMPT_NOTES_MAX_CHARS = 1_800;
export const PROMPT_DESCRIPTION_MAX_CHARS = 1_200;
export const PROMPT_BLOCK_INVENTORY_MAX = 24;
export const PROMPT_TOPOLOGY_MAX_LINES = 32;
export const PROMPT_LOCAL_NOTES_MAX_CHARS = 1_200;

export interface WorkspaceFileContextItem {
  name: string;
  /** Optional body/excerpt; omitted when only the name is known. */
  excerpt?: string | null;
  mime_type?: string | null;
}

/** One block on the workspace map (inventory + layout). */
export interface PromptBlockInventoryItem {
  id?: string | null;
  title: string;
  description?: string | null;
  status?: string | null;
  /** Role on the map: start | checkpoint | etc. */
  role?: string | null;
  is_start?: boolean | null;
  /** Grid placement (anchor). */
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  /** Freeform mask relative to anchor when present. */
  shape_cells?: Array<{ dr: number; dc: number }> | null;
  /** Outgoing next-block links (ids or titles). */
  next_block_ids?: string[] | null;
  /** Next-block titles when ids are resolved by the caller. */
  next_block_titles?: string[] | null;
  /** Prerequisite lock-until block ids. */
  lock_until_block_ids?: string[] | null;
  /** Block-local materials (optional). */
  local_context?: BlockLocalContextInput | null;
}

/**
 * Block-local context: local notes/files and/or references into workspace-global materials.
 * Prefer global_file_refs over duplicating workspace file blobs.
 */
export interface BlockLocalContextInput {
  notes?: string | null;
  /** Materials attached only to this block (name + optional excerpt). */
  local_files?: WorkspaceFileContextItem[] | null;
  /** Names of workspace-global files this block explicitly references. */
  global_file_refs?: string[] | null;
  /**
   * Ids of workspace_external_resources this block references
   * (generate-in-shape / local context attach).
   */
  external_resource_ids?: string[] | null;
}

/** External resource / link row for prompt grounding (title/url/description). */
export type PromptExternalResourceItem = {
  id?: string | null;
  title?: string | null;
  url?: string | null;
  description?: string | null;
};

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
  /**
   * Workspace (and block-referenced) external links — titles/URLs/descriptions.
   * Included in the context block so simulation/practice is not title-only.
   */
  externalResources?: PromptExternalResourceItem[] | null;
  /** Full map inventory (kinds/roles + layout). When set, topology is assembled. */
  blocks?: PromptBlockInventoryItem[] | null;
  /** Focused block id — used to attach local context and mark inventory focus. */
  focusedBlockId?: string | null;
  /** Explicit block-local materials (overrides focused block.local_context when set). */
  blockLocalContext?: BlockLocalContextInput | null;
  /** Unusable ground cells that shape paths (topology cue). */
  unusableCells?: Array<{ row: number; col: number }> | null;
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
  /** Map inventory lines included in the context block. */
  blockInventoryLines: string[];
  /** Layout/topology cue lines (placement, spans, next links, unusable ground). */
  topologyLines: string[];
  /** Distinct local-context section lines when local materials exist. */
  localContextLines: string[];
  /** True when local materials (notes/files/refs) are present for the focused block. */
  hasLocalContext: boolean;
  /** True when description, notes, chapter, files, or topology provide domain substance beyond titles. */
  hasDomainSubstance: boolean;
  /** Human-readable block for LLM system/user prompts. */
  contextBlock: string;
  /** Compact domain cue string used by pure exercise framers. */
  domainSubstanceSummary: string;
  /** Creator/consumer-facing layers for prompt-impact UI. */
  promptImpactLayers: PromptImpactLayer[];
}

/** One layer shown in the Context / prompt-impact readout. */
export interface PromptImpactLayer {
  id:
    | "workspace_identity"
    | "workspace_notes"
    | "workspace_files"
    | "block_inventory"
    | "map_topology"
    | "focused_block"
    | "local_context"
    | "surfaces";
  label: string;
  summary: string;
  /** Which product prompts this layer feeds. */
  feeds: Array<"TAP" | "ILE" | "TAPBench">;
  present: boolean;
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
 * Normalize block-local context from DB/JSON or authoring form.
 */
export function normalizeBlockLocalContext(
  raw: BlockLocalContextInput | null | undefined,
): {
  notes: string | null;
  localFiles: WorkspaceFileContextItem[];
  globalFileRefs: string[];
  externalResourceIds: string[];
  hasLocalMaterials: boolean;
} {
  if (!raw || typeof raw !== "object") {
    return {
      notes: null,
      localFiles: [],
      globalFileRefs: [],
      externalResourceIds: [],
      hasLocalMaterials: false,
    };
  }
  const notesRaw = normalizeOptional(raw.notes);
  const notes = notesRaw ? clip(notesRaw, PROMPT_LOCAL_NOTES_MAX_CHARS) : null;
  const localFiles: WorkspaceFileContextItem[] = [];
  for (const f of raw.local_files || []) {
    const name = typeof f?.name === "string" ? f.name.trim() : "";
    if (!name) continue;
    localFiles.push({
      name,
      excerpt: typeof f.excerpt === "string" ? f.excerpt : null,
      mime_type: f.mime_type ?? null,
    });
    if (localFiles.length >= PROMPT_FILE_EXCERPT_MAX_FILES) break;
  }
  const globalFileRefs: string[] = [];
  const seen = new Set<string>();
  for (const ref of raw.global_file_refs || []) {
    const name = typeof ref === "string" ? ref.trim() : "";
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    globalFileRefs.push(name);
    if (globalFileRefs.length >= PROMPT_FILE_EXCERPT_MAX_FILES) break;
  }
  const externalResourceIds: string[] = [];
  const seenExt = new Set<string>();
  for (const id of raw.external_resource_ids || []) {
    const t = typeof id === "string" ? id.trim() : "";
    if (!t || seenExt.has(t)) continue;
    seenExt.add(t);
    externalResourceIds.push(t);
    if (externalResourceIds.length >= 24) break;
  }
  const hasLocalMaterials = Boolean(
    notes || localFiles.length > 0 || globalFileRefs.length > 0 || externalResourceIds.length > 0,
  );
  return { notes, localFiles, globalFileRefs, externalResourceIds, hasLocalMaterials };
}

/** Parse local_context JSON column from blocks. */
export function parseBlockLocalContext(raw: unknown): BlockLocalContextInput | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return parseBlockLocalContext(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const local_files = Array.isArray(rec.local_files)
    ? (rec.local_files as WorkspaceFileContextItem[])
    : Array.isArray(rec.localFiles)
      ? (rec.localFiles as WorkspaceFileContextItem[])
      : null;
  const global_file_refs = Array.isArray(rec.global_file_refs)
    ? (rec.global_file_refs as string[])
    : Array.isArray(rec.globalFileRefs)
      ? (rec.globalFileRefs as string[])
      : null;
  const external_resource_ids = Array.isArray(rec.external_resource_ids)
    ? (rec.external_resource_ids as string[])
    : Array.isArray(rec.externalResourceIds)
      ? (rec.externalResourceIds as string[])
      : null;
  const notes =
    typeof rec.notes === "string"
      ? rec.notes
      : typeof rec.local_notes === "string"
        ? rec.local_notes
        : null;
  if (
    !notes &&
    !local_files?.length &&
    !global_file_refs?.length &&
    !external_resource_ids?.length
  ) {
    return null;
  }
  return { notes, local_files, global_file_refs, external_resource_ids };
}

function roleForBlock(b: PromptBlockInventoryItem): string {
  if (b.role && String(b.role).trim()) return String(b.role).trim();
  if (b.is_start) return "start";
  return "block";
}

function formatBlockInventoryLine(b: PromptBlockInventoryItem, focused: boolean): string {
  const role = roleForBlock(b);
  const status = b.status ? ` [${b.status}]` : "";
  const focus = focused ? " ★ focused" : "";
  const desc = b.description?.trim()
    ? ` — ${clip(b.description, 120)}`
    : "";
  return `- "${b.title}" (${role})${status}${focus}${desc}`;
}

function formatTopologyLine(b: PromptBlockInventoryItem, titleById: Map<string, string>): string | null {
  const hasPos = b.position_x != null && b.position_y != null;
  const spanW = Math.max(1, Math.floor(Number(b.span_w) || 1));
  const spanH = Math.max(1, Math.floor(Number(b.span_h) || 1));
  const shapeCount = Array.isArray(b.shape_cells) ? b.shape_cells.length : 0;
  const nextTitles =
    (b.next_block_titles && b.next_block_titles.length > 0
      ? b.next_block_titles
      : (b.next_block_ids || [])
          .map((id) => titleById.get(id) || id)
          .filter(Boolean)) || [];
  const lockIds = b.lock_until_block_ids || [];
  const lockTitles = lockIds.map((id) => titleById.get(id) || id);

  if (!hasPos && nextTitles.length === 0 && lockTitles.length === 0 && shapeCount === 0) {
    return null;
  }

  const parts: string[] = [`"${b.title}"`];
  if (hasPos) {
    parts.push(`at (${b.position_y},${b.position_x})`);
    parts.push(`span ${spanW}×${spanH}`);
    if (shapeCount > 0) parts.push(`shape ${shapeCount} cells`);
  }
  if (nextTitles.length > 0) {
    parts.push(`next → ${nextTitles.slice(0, 4).map((t) => `"${t}"`).join(", ")}`);
  }
  if (lockTitles.length > 0) {
    parts.push(`locked until ${lockTitles.slice(0, 4).map((t) => `"${t}"`).join(", ")}`);
  }
  return `- ${parts.join("; ")}`;
}

/**
 * Resolve which local materials apply for a focused block.
 * Explicit blockLocalContext wins; else focused inventory item's local_context.
 */
export function resolveFocusedLocalContext(
  input: PromptWorkspaceContextInput,
): BlockLocalContextInput | null {
  if (input.blockLocalContext) return input.blockLocalContext;
  const focusedId = normalizeOptional(input.focusedBlockId);
  const focusedTitle = normalizeOptional(input.blockTitle);
  for (const b of input.blocks || []) {
    if (focusedId && b.id === focusedId) {
      return b.local_context || null;
    }
  }
  if (focusedTitle) {
    for (const b of input.blocks || []) {
      if (b.title === focusedTitle) return b.local_context || null;
    }
  }
  return null;
}

/**
 * Merge workspace-global files with block-local materials for a focused block.
 * Global refs pull excerpts from the workspace file list when available.
 */
export function mergeGlobalAndLocalFiles(input: {
  workspaceFiles?: WorkspaceFileContextItem[] | null;
  local?: BlockLocalContextInput | null;
}): {
  files: WorkspaceFileContextItem[];
  localSection: {
    notes: string | null;
    localFileNames: string[];
    globalRefs: string[];
    hasLocal: boolean;
  };
} {
  const local = normalizeBlockLocalContext(input.local);
  const workspace = input.workspaceFiles || [];
  const byName = new Map(
    workspace
      .map((f) => [String(f.name || "").trim().toLowerCase(), f] as const)
      .filter(([n]) => n),
  );

  const merged: WorkspaceFileContextItem[] = [];
  const seen = new Set<string>();

  const push = (f: WorkspaceFileContextItem) => {
    const key = f.name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(f);
  };

  for (const f of workspace) push(f);
  for (const f of local.localFiles) push(f);
  for (const ref of local.globalFileRefs) {
    const existing = byName.get(ref.toLowerCase());
    if (existing) push(existing);
    else push({ name: ref });
  }

  return {
    files: merged,
    localSection: {
      notes: local.notes,
      localFileNames: local.localFiles.map((f) => f.name),
      globalRefs: local.globalFileRefs,
      hasLocal: local.hasLocalMaterials,
    },
  };
}

/**
 * Build the shared TAP/ILE/TAPBench prompt context object.
 * Includes workspace notes/files, block inventory, layout/topology, and local materials.
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

  const focusedLocal = resolveFocusedLocalContext(input);
  const { files: mergedFiles, localSection } = mergeGlobalAndLocalFiles({
    workspaceFiles: input.files,
    local: focusedLocal,
  });

  const { fileNames, fileExcerpts } = normalizeWorkspaceFileContext(mergedFiles);
  const extra = normalizeOptional(input.extra);

  // --- Inventory + topology ---
  const blocks = (input.blocks || []).slice(0, PROMPT_BLOCK_INVENTORY_MAX);
  const titleById = new Map<string, string>();
  for (const b of blocks) {
    if (b.id) titleById.set(b.id, b.title);
  }
  const focusedId = normalizeOptional(input.focusedBlockId);
  const blockInventoryLines: string[] = [];
  for (const b of blocks) {
    const focused =
      (focusedId != null && b.id === focusedId) ||
      (blockTitle != null && b.title === blockTitle);
    blockInventoryLines.push(formatBlockInventoryLine(b, focused));
  }

  const topologyLines: string[] = [];
  for (const b of blocks) {
    const line = formatTopologyLine(b, titleById);
    if (line) topologyLines.push(line);
    if (topologyLines.length >= PROMPT_TOPOLOGY_MAX_LINES) break;
  }
  const unusable = Array.isArray(input.unusableCells) ? input.unusableCells : [];
  if (unusable.length > 0) {
    const sample = unusable
      .slice(0, 8)
      .map((c) => `(${c.row},${c.col})`)
      .join(", ");
    topologyLines.push(
      `- Unusable ground (${unusable.length} cell${unusable.length === 1 ? "" : "s"}): ${sample}${unusable.length > 8 ? "…" : ""} — shapes paths; not placeable open ground.`,
    );
  }

  // --- Local context section ---
  const localContextLines: string[] = [];
  if (localSection.hasLocal) {
    if (localSection.notes) {
      localContextLines.push(`Local block notes:\n${localSection.notes}`);
    }
    if (localSection.localFileNames.length > 0) {
      localContextLines.push(
        `Local block files:\n${localSection.localFileNames.map((n) => `- ${n}`).join("\n")}`,
      );
    }
    if (localSection.globalRefs.length > 0) {
      localContextLines.push(
        `References into workspace materials:\n${localSection.globalRefs.map((n) => `- ${n}`).join("\n")}`,
      );
    }
    // Include local-only excerpts that are not already in global list
    const globalNameSet = new Set(
      (input.files || []).map((f) => String(f.name || "").trim().toLowerCase()).filter(Boolean),
    );
    for (const f of normalizeWorkspaceFileContext(localSection.localFileNames.map((name) => {
      const full = (focusedLocal?.local_files || []).find((x) => x.name === name);
      return full || { name };
    })).fileExcerpts) {
      if (!globalNameSet.has(f.name.toLowerCase())) {
        localContextLines.push(`### Local: ${f.name}\n${f.excerpt}`);
      }
    }
  }
  const hasLocalContext = localSection.hasLocal;

  const externalResourceLines: string[] = [];
  for (const er of input.externalResources || []) {
    const title =
      typeof er?.title === "string" ? er.title.replace(/\s+/g, " ").trim() : "";
    const url =
      typeof er?.url === "string" ? er.url.replace(/\s+/g, " ").trim() : "";
    const desc =
      typeof er?.description === "string"
        ? er.description.replace(/\s+/g, " ").trim()
        : "";
    if (!title && !url && !desc) continue;
    const head = title || url || "source";
    const tail = [
      title && url ? `<${clip(url, 80)}>` : !title && url ? clip(url, 80) : "",
      desc ? clip(desc, 140) : "",
    ]
      .filter(Boolean)
      .join(" — ");
    externalResourceLines.push(`- ${head}${tail ? ` ${tail}` : ""}`);
    if (externalResourceLines.length >= 12) break;
  }

  const substanceParts = [
    chapterDescription,
    blockDescription,
    workspaceGoal,
    workspaceDescription,
    notes,
    localSection.notes,
    ...fileExcerpts.map((f) => f.excerpt),
    ...externalResourceLines,
    extra,
    // Topology/inventory with descriptions count as light substance
    ...blockInventoryLines.filter((l) => l.includes(" — ")),
  ].filter((p): p is string => Boolean(p && p.length > 12));

  const hasDomainSubstance = substanceParts.length > 0;

  const domainSubstanceSummary = substanceParts.slice(0, 4).join(" ").slice(0, 900);

  const lines: string[] = [
    "## Workspace / block context (use this domain — do not invent unrelated topics)",
  ];
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
    lines.push(
      `Workspace files (names always in context):\n${fileNames.map((n) => `- ${n}`).join("\n")}`,
    );
  } else {
    lines.push("Workspace files: none listed.");
  }
  if (fileExcerpts.length > 0) {
    lines.push("File excerpts (truncated):");
    for (const f of fileExcerpts) {
      lines.push(`### ${f.name}\n${f.excerpt}`);
    }
  }

  if (externalResourceLines.length > 0) {
    lines.push("External links / sources:");
    lines.push(...externalResourceLines);
  }

  // JIT bias: instruct the model to consult provided URLs when substance is needed.
  const jitBias = buildExternalUrlJitBiasSnippet(
    (input.externalResources || []).map((er) => ({
      title: er?.title,
      url: er?.url,
      description: er?.description,
      id: er?.id,
    })),
  );
  if (jitBias) {
    lines.push(jitBias);
  }

  if (blockInventoryLines.length > 0) {
    lines.push("Block inventory (map roles / kinds):");
    lines.push(...blockInventoryLines);
  }

  if (topologyLines.length > 0) {
    lines.push("Map layout / topology:");
    lines.push(...topologyLines);
  }

  if (hasLocalContext) {
    lines.push("## Local block context (focused block materials)");
    lines.push(...localContextLines);
  }

  if (extra) lines.push(`Additional context:\n${extra}`);
  if (!hasDomainSubstance) {
    lines.push(
      "Note: domain substance is thin (mostly titles). Prefer concrete knowledge tasks from the title/topic; do not pad with stage directions.",
    );
  }

  const promptImpactLayers = buildPromptImpactLayers({
    workspaceTitle,
    rootTopic,
    workspaceGoal,
    workspaceDescription,
    notes,
    blockTitle,
    blockDescription,
    fileNames,
    fileExcerpts,
    blockInventoryLines,
    topologyLines,
    hasLocalContext,
    localContextLines,
  });

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
    blockInventoryLines,
    topologyLines,
    localContextLines,
    hasLocalContext,
    hasDomainSubstance,
    contextBlock: lines.join("\n"),
    domainSubstanceSummary,
    promptImpactLayers,
  };
}

/**
 * Layers for the creator/consumer prompt-impact readout.
 * Plain language — no jargon about assemblers or tokens.
 */
export function buildPromptImpactLayers(input: {
  workspaceTitle: string | null;
  rootTopic: string | null;
  workspaceGoal: string | null;
  workspaceDescription: string | null;
  notes: string | null;
  blockTitle: string | null;
  blockDescription: string | null;
  fileNames: string[];
  fileExcerpts: Array<{ name: string; excerpt: string }>;
  blockInventoryLines: string[];
  topologyLines: string[];
  hasLocalContext: boolean;
  localContextLines: string[];
}): PromptImpactLayer[] {
  const identityBits = [
    input.workspaceTitle,
    input.rootTopic,
    input.workspaceGoal,
    input.workspaceDescription,
  ].filter(Boolean);
  return [
    {
      id: "workspace_identity",
      label: "Workspace goal & topic",
      summary: identityBits.length
        ? identityBits.slice(0, 2).join(" · ")
        : "No workspace title or goal yet.",
      feeds: ["TAP", "ILE", "TAPBench"],
      present: identityBits.length > 0,
    },
    {
      id: "workspace_notes",
      label: "Workspace notes",
      summary: input.notes
        ? clip(input.notes, 140)
        : "No workspace notes attached.",
      feeds: ["TAP", "ILE", "TAPBench"],
      present: Boolean(input.notes),
    },
    {
      id: "workspace_files",
      label: "Attached files",
      summary:
        input.fileNames.length > 0
          ? `${input.fileNames.length} file${input.fileNames.length === 1 ? "" : "s"}: ${input.fileNames.slice(0, 4).join(", ")}${input.fileNames.length > 4 ? "…" : ""}${input.fileExcerpts.length ? ` (${input.fileExcerpts.length} with excerpts)` : ""}`
          : "No files attached.",
      feeds: ["TAP", "ILE", "TAPBench"],
      present: input.fileNames.length > 0,
    },
    {
      id: "block_inventory",
      label: "Blocks on the map",
      summary:
        input.blockInventoryLines.length > 0
          ? `${input.blockInventoryLines.length} block${input.blockInventoryLines.length === 1 ? "" : "s"} listed with roles.`
          : "No block inventory yet.",
      feeds: ["TAP", "ILE", "TAPBench"],
      present: input.blockInventoryLines.length > 0,
    },
    {
      id: "map_topology",
      label: "Map layout & paths",
      summary:
        input.topologyLines.length > 0
          ? `${input.topologyLines.length} layout cue${input.topologyLines.length === 1 ? "" : "s"} (placement, links, locks, unusable ground).`
          : "No placement or link layout yet.",
      feeds: ["TAP", "ILE", "TAPBench"],
      present: input.topologyLines.length > 0,
    },
    {
      id: "focused_block",
      label: "Focused block",
      summary: input.blockTitle
        ? `${input.blockTitle}${input.blockDescription ? ` — ${clip(input.blockDescription, 100)}` : ""}`
        : "No block focused — prompts use the whole workspace.",
      feeds: ["TAP", "ILE", "TAPBench"],
      present: Boolean(input.blockTitle),
    },
    {
      id: "local_context",
      label: "Local block knowledge",
      summary: input.hasLocalContext
        ? clip(input.localContextLines.join(" · "), 160)
        : "No block-local files or notes. Only workspace-wide materials apply.",
      feeds: ["TAP", "ILE", "TAPBench"],
      present: input.hasLocalContext,
    },
    {
      id: "surfaces",
      label: "Where this shows up",
      summary:
        "TAP dialogs & exercises, ILE learning/project chapters, and TAPBench agent exercises all read this same context.",
      feeds: ["TAP", "ILE", "TAPBench"],
      present: true,
    },
  ];
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

/**
 * Focused-block assembly entry point: global workspace materials + local block materials.
 * Unit-testable pure path for builders and consumers inspecting block knowledge.
 */
export function assembleFocusedBlockPromptContext(
  input: PromptWorkspaceContextInput,
): PromptWorkspaceContext {
  return assemblePromptWorkspaceContext(input);
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
