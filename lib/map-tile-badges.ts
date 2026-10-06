/**
 * Empty-cell marker for workspace block maps.
 * Occupied tiles show keyword + catalog icon only.
 */

/** Empty-cell glyph: plus when the grid can add, otherwise none. */
export type EmptyCellMarker = "plus" | "none";

export function resolveEmptyCellMarker(input: {
  canEdit?: boolean;
  learnerMode?: boolean;
  isUnusable?: boolean;
  isGeneratorSpark?: boolean;
  /** Chapter and workspace empty cells share the plus when the grid can add. */
  surface?: "block" | "chapter" | string | null;
}): EmptyCellMarker {
  if (input.isUnusable || input.isGeneratorSpark) return "none";
  if (input.canEdit && !input.learnerMode) return "plus";
  return "none";
}
