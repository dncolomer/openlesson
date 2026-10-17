/**
 * Domain-exercise prompt helper plus historical PoW provenance.
 * TAPBench product surfaces (pages, keys, mint, stash tokens) are gone.
 * TAP / TAP Learning still compose exercise text here.
 * Stored PoW rows may still carry tapbench provenance; they are classified, not rewritten.
 */

import { buildExercisePromptText } from "@/lib/exercise-tap";

/** Metadata keys used on flushed PoW and region-builder provenance. */
export const TAPBENCH_POW_SOURCE = "tapbench" as const;
export const HUMAN_POW_SOURCE = "human" as const;

export type PowSourceKind = typeof TAPBENCH_POW_SOURCE | typeof HUMAN_POW_SOURCE;

/**
 * Build exercise text from **explicit** exercise body only (model/stored).
 * Does not invent pure shells from title/goal. Empty if no explicit text.
 */
export function buildTapbenchExercise(input: {
  exerciseText?: string | null;
  workspaceTitle?: string | null;
  workspaceGoal?: string | null;
  rootTopic?: string | null;
  blockTitle?: string | null;
  blockDescription?: string | null;
  notes?: string | null;
  files?: import("@/lib/prompt-workspace-context").WorkspaceFileContextItem[] | null;
  blocks?: import("@/lib/prompt-workspace-context").PromptBlockInventoryItem[] | null;
  focusedBlockId?: string | null;
  blockLocalContext?: import("@/lib/prompt-workspace-context").BlockLocalContextInput | null;
  unusableCells?: Array<{ row: number; col: number }> | null;
}): string {
  const explicit =
    typeof input.exerciseText === "string" ? input.exerciseText.trim() : "";
  if (!explicit) return "";
  return buildExercisePromptText({
    exerciseText: explicit,
    blockTitle: input.blockTitle,
    blockDescription: input.blockDescription,
    workspaceTitle: input.workspaceTitle || input.rootTopic || "this workspace",
    workspaceGoal: input.workspaceGoal,
    rootTopic: input.rootTopic,
    notes: input.notes,
    files: input.files,
    blocks: input.blocks,
    focusedBlockId: input.focusedBlockId,
    blockLocalContext: input.blockLocalContext,
    unusableCells: input.unusableCells,
  }).trim();
}

/**
 * Classify PoW metadata as human vs historical tapbench provenance.
 */
export function classifyPowSource(
  metadata: Record<string, unknown> | null | undefined,
): PowSourceKind {
  if (!metadata || typeof metadata !== "object") return HUMAN_POW_SOURCE;
  if (metadata.tapbench === true) return TAPBENCH_POW_SOURCE;
  if (metadata.pow_source === TAPBENCH_POW_SOURCE) return TAPBENCH_POW_SOURCE;
  if (metadata.source === TAPBENCH_POW_SOURCE) return TAPBENCH_POW_SOURCE;
  if (metadata.source_link_kind === TAPBENCH_POW_SOURCE) return TAPBENCH_POW_SOURCE;
  return HUMAN_POW_SOURCE;
}

export function isTapbenchPowMetadata(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return classifyPowSource(metadata) === TAPBENCH_POW_SOURCE;
}

export function sourceLinkIdFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  if (typeof metadata.source_link_id === "string" && metadata.source_link_id.trim()) {
    return metadata.source_link_id.trim();
  }
  if (typeof metadata.tapbench_link_id === "string" && metadata.tapbench_link_id.trim()) {
    return metadata.tapbench_link_id.trim();
  }
  if (typeof metadata.tap_session_id === "string" && metadata.tap_session_id.trim()) {
    return metadata.tap_session_id.trim();
  }
  if (typeof metadata.ile_link_id === "string" && metadata.ile_link_id.trim()) {
    return metadata.ile_link_id.trim();
  }
  return null;
}
