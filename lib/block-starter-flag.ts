/**
 * Pure mapping for author "starter block" flag → blocks.is_start.
 * Used by Edit / Add / geometry create payloads.
 */

/**
 * Normalize author UI control to a boolean starter flag.
 * Default false when unset / non-boolean.
 */
export function normalizeStarterFlag(raw: unknown): boolean {
  if (raw === true || raw === "true" || raw === 1 || raw === "1") return true;
  return false;
}

/**
 * Resolve is_start for a **new** block create.
 * - Author opt-in → true
 * - Empty map (no existing blocks) → true even if author left control off
 *   (preserve intentional first-block start behavior)
 * - Otherwise → false
 */
export function resolveCreateBlockIsStart(input: {
  authorStarter?: unknown;
  existingBlockCount: number;
}): boolean {
  if (normalizeStarterFlag(input.authorStarter)) return true;
  const n = Math.max(0, Math.floor(Number(input.existingBlockCount) || 0));
  return n === 0;
}

/**
 * Resolve is_start for **update_block**.
 * - When authorStarter is provided (including explicit false), use it.
 * - When omitted (undefined), keep the existing DB value.
 */
export function resolveUpdateBlockIsStart(input: {
  authorStarter?: unknown;
  existingIsStart?: boolean | null;
}): boolean {
  if (input.authorStarter !== undefined) {
    return normalizeStarterFlag(input.authorStarter);
  }
  return Boolean(input.existingIsStart);
}

/**
 * Build update_block fields including optional is_start.
 * Pure so tests pin payload assembly without React.
 */
export function buildUpdateBlockPayload(input: {
  blockId: string;
  title: string;
  description?: string | null;
  isStart?: boolean;
  includeIsStart?: boolean;
}): {
  blockId: string;
  title: string;
  description: string;
  is_start?: boolean;
} {
  const payload: {
    blockId: string;
    title: string;
    description: string;
    is_start?: boolean;
  } = {
    blockId: String(input.blockId || "").trim(),
    title: String(input.title || "").trim(),
    description: String(input.description ?? "").trim(),
  };
  if (input.includeIsStart !== false && input.isStart !== undefined) {
    payload.is_start = normalizeStarterFlag(input.isStart);
  }
  return payload;
}

/**
 * Build create payload is_start field for add-at-slot / generate_shape.
 */
export function buildCreateBlockIsStartField(input: {
  authorStarter?: unknown;
  existingBlockCount: number;
}): { is_start: boolean } {
  return {
    is_start: resolveCreateBlockIsStart(input),
  };
}
