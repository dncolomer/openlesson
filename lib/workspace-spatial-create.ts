/**
 * Pure helpers for workspace skill-grid create: prompt assembly and block
 * normalization (signed coords, branching next links, initial-chapters bands).
 */

import {
  formatInitialChaptersForPrompt,
  parseInitialChaptersLevel,
  SPATIAL_MAP_LAYOUT_RULES,
  type InitialChaptersLevel,
} from "@/lib/initial-chapters";
import {
  BLOCK_MAP_GLYPH_JSON_SHAPE,
  blockMapGlyphDbFields,
  composeBlockMapGlyphJsonInstruction,
} from "@/lib/block-map-glyph";

/** Reasonable grid extent so a bad LLM value cannot explode layout. */
const POSITION_CLAMP = 24;

export interface WorkspaceBlockRef {
  id: string;
  title: string;
  description: string;
  is_start?: boolean;
  next?: string[];
  position_x?: number;
  position_y?: number;
  map_keyword?: string;
  map_icon?: string;
}

export interface RawWorkspaceBlock {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  is_start?: unknown;
  next?: unknown;
  position_x?: unknown;
  position_y?: unknown;
  keyword?: unknown;
  icon?: unknown;
  map_keyword?: unknown;
  map_icon?: unknown;
}

export interface WorkspaceSpatialPromptVars {
  topicOrPrompt: string;
  initialChapters?: InitialChaptersLevel | string | null;
  fileContext?: string;
  /** Optional soft timeframe (days) for narrative only — count comes from initial chapters. */
  daysHint?: number | null;
  extraRules?: string;
}

function parseGridCoord(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (Math.abs(value) > POSITION_CLAMP) return undefined;
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    if (!Number.isInteger(n) || Math.abs(n) > POSITION_CLAMP) return undefined;
    return n;
  }
  return undefined;
}

/**
 * Build the semantic workspace / plan-generate prompt body with spatial +
 * initial-chapters instructions. Does not call the model.
 */
export function composeWorkspaceSpatialGeneratePrompt(
  vars: WorkspaceSpatialPromptVars,
): string {
  const mapInfo = formatInitialChaptersForPrompt(vars.initialChapters);
  const fileContext = vars.fileContext || "";
  const daysLine =
    typeof vars.daysHint === "number" && Number.isFinite(vars.daysHint)
      ? `\nApproximate learning span context: about ${vars.daysHint} days (count is still driven by initial chapters, not this span alone).`
      : "";
  const extra = vars.extraRules ? `\n${vars.extraRules}` : "";

  return `Create a performance learning map from this prompt. Break it into assessable blocks for learning verification and proof-of-work-based gap analysis.

Prompt:
${vars.topicOrPrompt || "Untitled"}${fileContext}${daysLine}

${mapInfo.countInstruction}

${SPATIAL_MAP_LAYOUT_RULES}

Return ONLY JSON:
{
  "title": "concise workspace title",
  "workspace_goal": "concise success outcome for this workspace",
  "blocks": [
    {
      "id": "a",
      "title": "Block title",
      "description": "What the learner should demonstrate",
      "keyword": "Foundations",
      "is_start": true,
      "next": ["b", "c"],
      "position_x": 0,
      "position_y": 0
    }
  ]
}

Rules:
- Create ${mapInfo.band.min} to ${mapInfo.band.max} blocks (prefer about ${mapInfo.band.target}).
- Blocks are assessable learning/performance units.
- Use short stable ids only for linking within this response (e.g. "a", "b", "c").
- Exactly one start block with is_start=true at (0, 0).
- next: array of child block ids (0–3). Prefer branching: at least one block with 2+ next when count allows; explore some arms deeper.
- Include at least one block with a negative position_x or position_y (multi-quadrant).
- Sparse paths are preferred over a filled rectangle.
- ${composeBlockMapGlyphJsonInstruction()}${extra}`;
}

/**
 * Same spatial + count rules phrased for the in-app workspace/generate plan
 * shape (`nodes` instead of `blocks`, catchy title).
 */
export function composeWorkspacePlanGeneratePrompt(vars: {
  topic: string;
  initialChapters?: InitialChaptersLevel | string | null;
  imageContext?: string;
  fileContext?: string;
  daysHint?: number | null;
}): string {
  const mapInfo = formatInitialChaptersForPrompt(vars.initialChapters);
  const daysLine =
    typeof vars.daysHint === "number" && Number.isFinite(vars.daysHint)
      ? `\nApproximate span context: about ${vars.daysHint} days (node count is driven by initial chapters).`
      : "";

  return `Generate a learning plan for "${vars.topic}" as a directed graph on a 2D skill grid where each node is a session.${vars.imageContext || ""}${vars.fileContext || ""}${daysLine}

${mapInfo.countInstruction}

${SPATIAL_MAP_LAYOUT_RULES}

Return JSON with this structure:
{
  "title": "A short, catchy, social-media-friendly title for this plan (max 6 words, creative and engaging — NOT just the topic name)",
  "nodes": [
    {
      "id": "a",
      "title": "Node Title",
      "description": "Why this matters",
      "keyword": "Foundations",
      "is_start": true,
      "next": ["b", "c"],
      "position_x": 0,
      "position_y": 0
    }
  ]
}

Rules:
- Include ${mapInfo.band.min} to ${mapInfo.band.max} nodes total (prefer about ${mapInfo.band.target}).
- Each node must include a keyword (${BLOCK_MAP_GLYPH_JSON_SHAPE} fields). ${composeBlockMapGlyphJsonInstruction()}
- The top-level "title" must be a catchy, memorable name for the plan (like a course name or book title). NOT just "Learning X". Be creative.
- Each node is a distinct learning session
- Use single-letter or short IDs for referencing
- Exactly one is_start: true node, at (0, 0)
- next: array of node IDs that follow this node (can be empty or have 1-3 entries)
- Create branching paths (1-to-many connections); explore some arms deeper
- Place nodes in multiple quadrants (positive and negative coordinates); sparse layout OK
- Keep titles concise (3-8 words)
- Descriptions: 1 sentence explaining the concept`;
}

/**
 * Normalize LLM workspace blocks: unique cells, origin start preference,
 * stable ids, cleaned next links that only reference known ids.
 */
export function normalizeGeneratedWorkspaceBlocks(
  rawBlocks: RawWorkspaceBlock[] | undefined | null,
  options?: { idSeed?: number },
): WorkspaceBlockRef[] {
  const seed = options?.idSeed ?? Date.now();
  const occupied = new Set<string>();

  const preliminary = (rawBlocks || []).map((block, idx) => {
    const rawId = typeof block.id === "string" && block.id.trim() ? block.id.trim() : "";
    const id = rawId || `n${idx + 1}_${seed}`;
    const title = typeof block.title === "string" ? block.title.trim() : "";
    const description = typeof block.description === "string" ? block.description : "";
    const is_start = block.is_start === true;

    let position_x = parseGridCoord(block.position_x);
    let position_y = parseGridCoord(block.position_y);

    if (position_x != null && position_y != null) {
      const key = `${position_x}:${position_y}`;
      if (occupied.has(key)) {
        position_x = undefined;
        position_y = undefined;
      } else {
        occupied.add(key);
      }
    } else {
      position_x = undefined;
      position_y = undefined;
    }

    const nextRaw = Array.isArray(block.next) ? block.next : [];
    const next = nextRaw
      .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
      .map((n) => n.trim());

    const glyph = blockMapGlyphDbFields(block, title || `Block ${idx + 1}`);
    const result: WorkspaceBlockRef = {
      id,
      title: title || `Block ${idx + 1}`,
      description,
      is_start,
      next,
      map_keyword: glyph.map_keyword,
      map_icon: glyph.map_icon,
    };
    if (position_x != null && position_y != null) {
      result.position_x = position_x;
      result.position_y = position_y;
    }
    return result;
  });

  const valid = preliminary.filter((b) => b.title.trim().length > 0);
  if (valid.length === 0) return [];

  const knownIds = new Set(valid.map((b) => b.id));
  const withLinks = valid.map((b) => ({
    ...b,
    next: (b.next || []).filter((id) => knownIds.has(id) && id !== b.id),
  }));

  // Ensure exactly one start: prefer is_start at origin, else first with (0,0), else first.
  const origin = withLinks.find((b) => b.position_x === 0 && b.position_y === 0);
  const markedStart = withLinks.find((b) => b.is_start);
  const startId = (origin ?? markedStart ?? withLinks[0]).id;

  return withLinks.map((b) => {
    const isStart = b.id === startId;
    if (isStart) {
      // Force origin on the start block when it had no coords or wrong ones if free.
      if (b.position_x === 0 && b.position_y === 0) {
        return { ...b, is_start: true };
      }
      const originKey = "0:0";
      const originTakenByOther =
        occupied.has(originKey) &&
        !(b.position_x === 0 && b.position_y === 0);
      // If start lacks origin and origin free, assign it.
      if (b.position_x == null || b.position_y == null) {
        if (!originTakenByOther) {
          // Clear if someone else had 0,0 already in this set — handled below.
          const otherAtOrigin = withLinks.some(
            (o) => o.id !== b.id && o.position_x === 0 && o.position_y === 0,
          );
          if (!otherAtOrigin) {
            return { ...b, is_start: true, position_x: 0, position_y: 0 };
          }
        }
        return { ...b, is_start: true };
      }
      return { ...b, is_start: true };
    }
    return { ...b, is_start: false };
  });
}

/** Alias for plan-generate path that uses `nodes` in the LLM JSON. */
export function normalizeGeneratedPlanNodes(
  rawNodes: RawWorkspaceBlock[] | undefined | null,
  options?: { idSeed?: number },
): WorkspaceBlockRef[] {
  return normalizeGeneratedWorkspaceBlocks(rawNodes, options);
}

export function resolveWorkspaceInitialChapters(
  value: unknown,
): InitialChaptersLevel {
  return parseInitialChaptersLevel(value);
}
