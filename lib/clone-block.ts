/**
 * Pure helpers for creator-mode single-block Clone (copy → paste on empty cell).
 * Arm with a source block id; resolve a placeable empty target; disarm after paste/cancel.
 * Free of React so unit tests drive the real decision path.
 */

export type CloneCell = { row: number; col: number };

/** Disarmed or armed-with-source clone-paste mode. */
export type CloneArmState =
  | { armed: false; sourceBlockId: null }
  | { armed: true; sourceBlockId: string };

export type ClonePasteRejectReason =
  | "not_armed"
  | "missing_source"
  | "invalid_target"
  | "occupied"
  | "unusable";

export type ClonePasteResolve =
  | { ok: true; sourceBlockId: string; target: CloneCell }
  | { ok: false; reason: ClonePasteRejectReason };

function cellKey(c: CloneCell): string {
  return `${Math.trunc(c.row)}:${Math.trunc(c.col)}`;
}

function toKeySet(
  keys?: ReadonlySet<string> | readonly string[] | null,
): Set<string> {
  if (keys instanceof Set) return keys;
  return new Set(keys || []);
}

function cleanId(id: unknown): string {
  return String(id ?? "").trim();
}

function isFiniteCell(cell: CloneCell | null | undefined): cell is CloneCell {
  return (
    !!cell &&
    Number.isFinite(cell.row) &&
    Number.isFinite(cell.col)
  );
}

/** Idle (disarmed) clone state. */
export function createDisarmedCloneState(): CloneArmState {
  return { armed: false, sourceBlockId: null };
}

/**
 * Arm clone-paste for a single filled source block.
 * Empty/invalid ids → disarmed.
 */
export function armClone(sourceBlockId: unknown): CloneArmState {
  const id = cleanId(sourceBlockId);
  if (!id) return createDisarmedCloneState();
  return { armed: true, sourceBlockId: id };
}

/** Clear arm (cancel / deselect / after successful paste). */
export function disarmClone(): CloneArmState {
  return createDisarmedCloneState();
}

export function isCloneArmed(
  state: CloneArmState | null | undefined,
): state is { armed: true; sourceBlockId: string } {
  return Boolean(state?.armed && cleanId(state.sourceBlockId));
}

/**
 * When selection leaves the source block (deselect / multi / empty create),
 * clone arm must clear.
 */
export function cloneArmAfterSelectionChange(input: {
  state: CloneArmState | null | undefined;
  /** Currently selected sole filled block id, or null. */
  soleSelectedBlockId: string | null | undefined;
}): CloneArmState {
  const state = input.state;
  if (!isCloneArmed(state)) return createDisarmedCloneState();
  const sole = cleanId(input.soleSelectedBlockId);
  if (!sole || sole !== state.sourceBlockId) {
    return createDisarmedCloneState();
  }
  return state;
}

/**
 * Resolve whether a clicked/selected empty cell is a valid paste target.
 * Only placeable empties succeed; occupied and unusable reject without paste.
 */
export function resolveClonePasteTarget(input: {
  state: CloneArmState | null | undefined;
  target: CloneCell | null | undefined;
  occupiedKeys?: ReadonlySet<string> | readonly string[] | null;
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
}): ClonePasteResolve {
  if (!isCloneArmed(input.state)) {
    return { ok: false, reason: "not_armed" };
  }
  const sourceBlockId = cleanId(input.state.sourceBlockId);
  if (!sourceBlockId) {
    return { ok: false, reason: "missing_source" };
  }
  if (!isFiniteCell(input.target)) {
    return { ok: false, reason: "invalid_target" };
  }
  const target: CloneCell = {
    row: Math.trunc(input.target.row),
    col: Math.trunc(input.target.col),
  };
  const occupied = toKeySet(input.occupiedKeys);
  const unusable = toKeySet(input.unusableKeys);
  const k = cellKey(target);
  if (unusable.has(k)) {
    return { ok: false, reason: "unusable" };
  }
  if (occupied.has(k)) {
    return { ok: false, reason: "occupied" };
  }
  return { ok: true, sourceBlockId, target };
}

/**
 * After a successful paste: always disarm (one-shot arm).
 */
export function afterClonePaste(
  _state?: CloneArmState | null,
): CloneArmState {
  return createDisarmedCloneState();
}

/**
 * Cancel arm without pasting (explicit cancel button / Esc).
 */
export function cancelCloneArm(
  _state?: CloneArmState | null,
): CloneArmState {
  return createDisarmedCloneState();
}

/**
 * Fields copied from source into a new 1×1 block at target.
 * Content payload only — no graph edges (next/lock-until) rewiring.
 */
export type CloneSourceFields = {
  title?: string | null;
  description?: string | null;
  planning_prompt?: string | null;
  local_context?: unknown;
  map_keyword?: string | null;
  map_icon?: string | null;
  /** Copied only when explicitly requested; default false on clone. */
  is_start?: boolean | null;
};

export type CloneInsertPayload = {
  title: string;
  description: string;
  planning_prompt: string | null;
  local_context: unknown | null;
  is_start: boolean;
  next_block_ids: string[];
  lock_until_block_ids: string[];
  status: string;
  position_x: number;
  position_y: number;
  span_w: number;
  span_h: number;
  shape_cells: null;
  map_keyword: string | null;
  map_icon: string | null;
};

/**
 * Build insert payload for a content clone at a single empty cell (1×1).
 * Does not invent new AI content — copies source title/description/etc.
 */
export function buildCloneInsertPayload(input: {
  source: CloneSourceFields;
  target: CloneCell;
  /** Optional title suffix to distinguish clones (default: none). */
  titleSuffix?: string | null;
}): CloneInsertPayload {
  const row = Math.trunc(input.target.row);
  const col = Math.trunc(input.target.col);
  const baseTitle = String(input.source.title ?? "").trim() || "Untitled";
  const suffix =
    typeof input.titleSuffix === "string" ? input.titleSuffix.trim() : "";
  const title = suffix ? `${baseTitle}${suffix}` : baseTitle;
  const description =
    typeof input.source.description === "string"
      ? input.source.description
      : "";
  const planning =
    typeof input.source.planning_prompt === "string"
      ? input.source.planning_prompt.trim() || null
      : null;
  const local =
    input.source.local_context != null ? input.source.local_context : null;

  const mapKeyword =
    typeof input.source.map_keyword === "string"
      ? input.source.map_keyword.trim() || null
      : null;
  const mapIcon =
    typeof input.source.map_icon === "string"
      ? input.source.map_icon.trim() || null
      : null;

  return {
    title,
    description,
    planning_prompt: planning,
    local_context: local,
    // Clones are never auto-starters — author can flag later.
    is_start: false,
    next_block_ids: [],
    lock_until_block_ids: [],
    status: "available",
    position_x: col,
    position_y: row,
    span_w: 1,
    span_h: 1,
    shape_cells: null,
    map_keyword: mapKeyword,
    map_icon: mapIcon,
  };
}

/**
 * Whether an empty-cell click should be intercepted for clone paste
 * (host should not open Add pane while armed).
 */
export function shouldInterceptEmptyClickForClone(
  state: CloneArmState | null | undefined,
): boolean {
  return isCloneArmed(state);
}
