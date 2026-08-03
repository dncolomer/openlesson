/**
 * Learner-mode map post-it notes: personal, block-agnostic sticky notes.
 * Stored at map/grid coordinates (same space as blocks); no block id coupling.
 * Free of React so unit tests drive CRUD, collapse, and placement math.
 */

import {
  SKILL_GRID_CELL_SIZE,
  SKILL_GRID_PITCH,
} from "@/lib/block-skill-grid";

/** Max short body length for a learner post-it. */
export const LEARNER_NOTE_BODY_MAX = 280;

export type LearnerMapNoteCoords = {
  /** Grid column (same space as block position_x). */
  col: number;
  /** Grid row (same space as block position_y). */
  row: number;
};

export type LearnerMapNote = {
  id: string;
  body: string;
  /** Map/grid coordinates — not linked to any block id. */
  col: number;
  row: number;
  collapsed: boolean;
  createdAt: number;
  updatedAt: number;
};

export type LearnerMapNoteCreateInput = {
  body?: string | null;
  col: number;
  row: number;
  collapsed?: boolean;
  id?: string;
  now?: number;
};

export type LearnerMapNoteUpdateInput = {
  body?: string | null;
  col?: number;
  row?: number;
  collapsed?: boolean;
  now?: number;
};

/** Scope key: workspace + learner identity (user / aycl / guest). */
export function learnerMapNotesStorageKey(input: {
  workspaceId: string;
  /** Signed-in user id, aycl token, or guest scope. */
  learnerScopeId: string;
}): string {
  const ws = String(input.workspaceId || "").trim() || "unknown-workspace";
  const who = String(input.learnerScopeId || "").trim() || "anonymous";
  return `openlesson.learnerMapNotes.v1:${ws}:${who}`;
}

/** Finite grid coordinate (allows fractional placement within a cell). */
export function normalizeLearnerNoteCoord(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  // Clamp extreme values so localStorage stays sane
  return Math.max(-10_000, Math.min(10_000, n));
}

/** Short note body: trim + hard cap. Empty allowed. */
export function normalizeLearnerNoteBody(value: unknown): string {
  const raw = typeof value === "string" ? value : String(value ?? "");
  // Normalize newlines lightly; cap length
  const trimmed = raw.replace(/\r\n/g, "\n").slice(0, LEARNER_NOTE_BODY_MAX);
  return trimmed;
}

export function createLearnerMapNoteId(seed?: string | number): string {
  if (seed != null && String(seed).trim()) {
    return `lnote-${String(seed).trim()}`;
  }
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `lnote-${crypto.randomUUID()}`;
  }
  return `lnote-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Create a new note at map coords (no block id). */
export function createLearnerMapNote(
  input: LearnerMapNoteCreateInput,
): LearnerMapNote {
  const now =
    typeof input.now === "number" && Number.isFinite(input.now)
      ? Math.floor(input.now)
      : Date.now();
  return {
    id: createLearnerMapNoteId(input.id),
    body: normalizeLearnerNoteBody(input.body ?? ""),
    col: normalizeLearnerNoteCoord(input.col),
    row: normalizeLearnerNoteCoord(input.row),
    collapsed: Boolean(input.collapsed),
    createdAt: now,
    updatedAt: now,
  };
}

/** Immutable update; missing fields keep previous. */
export function updateLearnerMapNote(
  note: LearnerMapNote,
  patch: LearnerMapNoteUpdateInput,
): LearnerMapNote {
  const now =
    typeof patch.now === "number" && Number.isFinite(patch.now)
      ? Math.floor(patch.now)
      : Date.now();
  return {
    ...note,
    body:
      patch.body !== undefined
        ? normalizeLearnerNoteBody(patch.body)
        : note.body,
    col:
      patch.col !== undefined
        ? normalizeLearnerNoteCoord(patch.col, note.col)
        : note.col,
    row:
      patch.row !== undefined
        ? normalizeLearnerNoteCoord(patch.row, note.row)
        : note.row,
    collapsed:
      patch.collapsed !== undefined ? Boolean(patch.collapsed) : note.collapsed,
    updatedAt: now,
  };
}

/** Toggle collapsed ↔ expanded. */
export function toggleLearnerMapNoteCollapsed(
  note: LearnerMapNote,
  now?: number,
): LearnerMapNote {
  return updateLearnerMapNote(note, {
    collapsed: !note.collapsed,
    now,
  });
}

/** Remove note by id; returns new list (no mutation). */
export function deleteLearnerMapNote(
  notes: readonly LearnerMapNote[],
  noteId: string,
): LearnerMapNote[] {
  const id = String(noteId || "").trim();
  if (!id) return notes.map((n) => ({ ...n }));
  return (notes || []).filter((n) => n.id !== id);
}

/** Upsert note into list by id (replace or append). */
export function upsertLearnerMapNote(
  notes: readonly LearnerMapNote[],
  note: LearnerMapNote,
): LearnerMapNote[] {
  const id = String(note.id || "").trim();
  if (!id) return notes.map((n) => ({ ...n }));
  let found = false;
  const out = (notes || []).map((n) => {
    if (n.id !== id) return n;
    found = true;
    return note;
  });
  if (!found) out.push(note);
  return out;
}

/**
 * Parse raw JSON/list into valid notes. Drops malformed entries.
 * Guarantees no `blockId` coupling — only map coords + body.
 */
export function parseLearnerMapNotes(raw: unknown): LearnerMapNote[] {
  if (!Array.isArray(raw)) return [];
  const out: LearnerMapNote[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = String(rec.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    // Explicitly ignore any accidental block linkage fields
    const col = normalizeLearnerNoteCoord(rec.col ?? rec.position_x ?? rec.x);
    const row = normalizeLearnerNoteCoord(rec.row ?? rec.position_y ?? rec.y);
    const note: LearnerMapNote = {
      id,
      body: normalizeLearnerNoteBody(rec.body ?? rec.text ?? rec.content ?? ""),
      col,
      row,
      collapsed: Boolean(rec.collapsed),
      createdAt:
        typeof rec.createdAt === "number" && Number.isFinite(rec.createdAt)
          ? Math.floor(rec.createdAt)
          : Date.now(),
      updatedAt:
        typeof rec.updatedAt === "number" && Number.isFinite(rec.updatedAt)
          ? Math.floor(rec.updatedAt)
          : Date.now(),
    };
    // Safety: never retain blockId if present on input
    seen.add(id);
    out.push(note);
  }
  return out;
}

/** Assert note is block-agnostic (no block linkage fields on the model). */
export function learnerMapNoteIsBlockAgnostic(note: LearnerMapNote): boolean {
  const rec = note as LearnerMapNote & {
    blockId?: unknown;
    block_id?: unknown;
    next_block_ids?: unknown;
  };
  return (
    rec.blockId == null &&
    rec.block_id == null &&
    rec.next_block_ids == null &&
    Number.isFinite(note.col) &&
    Number.isFinite(note.row)
  );
}

// ---------------------------------------------------------------------------
// Shared map placement (same world space as blocks)
// ---------------------------------------------------------------------------

/**
 * World pixel origin of a grid cell (top-left of the cell tile).
 * Matches BlockSkillGrid: left = col * PITCH, top = row * PITCH.
 */
export function learnerNoteWorldOrigin(
  coords: LearnerMapNoteCoords,
  pitch: number = SKILL_GRID_PITCH,
): { x: number; y: number } {
  const col = normalizeLearnerNoteCoord(coords.col);
  const row = normalizeLearnerNoteCoord(coords.row);
  return {
    x: col * pitch,
    y: row * pitch,
  };
}

/**
 * Screen position of a note given pan/zoom (viewport CSS pixels).
 * Same transform as blocks: screen = world * zoom + pan.
 */
export function learnerNoteScreenPosition(input: {
  col: number;
  row: number;
  panX: number;
  panY: number;
  zoom: number;
  pitch?: number;
}): { left: number; top: number } {
  const pitch = input.pitch ?? SKILL_GRID_PITCH;
  const world = learnerNoteWorldOrigin(
    { col: input.col, row: input.row },
    pitch,
  );
  const zoom =
    Number.isFinite(input.zoom) && input.zoom > 0 ? input.zoom : 1;
  return {
    left: world.x * zoom + input.panX,
    top: world.y * zoom + input.panY,
  };
}

/**
 * Inverse: viewport-local pointer → map coords (fractional allowed).
 * Aligns with clientPointToGridPoint / block map transform.
 */
export function pointerLocalToLearnerNoteCoords(input: {
  localX: number;
  localY: number;
  panX: number;
  panY: number;
  zoom: number;
  pitch?: number;
}): LearnerMapNoteCoords {
  const pitch = input.pitch ?? SKILL_GRID_PITCH;
  const zoom =
    Number.isFinite(input.zoom) && input.zoom > 0 ? input.zoom : 1;
  const worldX = (input.localX - input.panX) / zoom;
  const worldY = (input.localY - input.panY) / zoom;
  return {
    col: normalizeLearnerNoteCoord(worldX / pitch),
    row: normalizeLearnerNoteCoord(worldY / pitch),
  };
}

/** Convenience: full client point → note coords via viewport rect. */
export function clientPointToLearnerNoteCoords(input: {
  clientX: number;
  clientY: number;
  viewportLeft: number;
  viewportTop: number;
  panX: number;
  panY: number;
  zoom: number;
  pitch?: number;
}): LearnerMapNoteCoords {
  return pointerLocalToLearnerNoteCoords({
    localX: input.clientX - input.viewportLeft,
    localY: input.clientY - input.viewportTop,
    panX: input.panX,
    panY: input.panY,
    zoom: input.zoom,
    pitch: input.pitch,
  });
}

/** Style left/top for notes rendered inside the pan/zoom world layer (pre-transform). */
export function learnerNoteLayerStyle(
  note: Pick<LearnerMapNote, "col" | "row">,
  pitch: number = SKILL_GRID_PITCH,
  cellSize: number = SKILL_GRID_CELL_SIZE,
): { left: number; top: number; width: number } {
  const origin = learnerNoteWorldOrigin(note, pitch);
  return {
    left: origin.x,
    top: origin.y,
    // Slightly smaller than a full cell so post-its read as stickies on the map
    width: Math.max(64, Math.round(cellSize * 0.92)),
  };
}

// ---------------------------------------------------------------------------
// Client store (localStorage) — pure wrappers for tests with injectable storage
// ---------------------------------------------------------------------------

export type LearnerNotesStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

function memoryStorage(): LearnerNotesStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

export function defaultLearnerNotesStorage(): LearnerNotesStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadLearnerMapNotes(input: {
  workspaceId: string;
  learnerScopeId: string;
  storage?: LearnerNotesStorage | null;
}): LearnerMapNote[] {
  const storage = input.storage ?? defaultLearnerNotesStorage();
  if (!storage) return [];
  const key = learnerMapNotesStorageKey(input);
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    return parseLearnerMapNotes(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveLearnerMapNotes(input: {
  workspaceId: string;
  learnerScopeId: string;
  notes: readonly LearnerMapNote[];
  storage?: LearnerNotesStorage | null;
}): void {
  const storage = input.storage ?? defaultLearnerNotesStorage();
  if (!storage) return;
  const key = learnerMapNotesStorageKey(input);
  try {
    // Persist only block-agnostic fields
    const payload = (input.notes || []).map((n) => ({
      id: n.id,
      body: n.body,
      col: n.col,
      row: n.row,
      collapsed: n.collapsed,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }));
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

/** Full CRUD store operations for a scope (pure over injectable storage). */
export function learnerMapNotesStoreOps(input: {
  workspaceId: string;
  learnerScopeId: string;
  storage?: LearnerNotesStorage | null;
}) {
  const storage = input.storage ?? defaultLearnerNotesStorage() ?? memoryStorage();
  const scope = {
    workspaceId: input.workspaceId,
    learnerScopeId: input.learnerScopeId,
    storage,
  };
  return {
    list(): LearnerMapNote[] {
      return loadLearnerMapNotes(scope);
    },
    create(createInput: LearnerMapNoteCreateInput): LearnerMapNote {
      const note = createLearnerMapNote(createInput);
      const next = upsertLearnerMapNote(loadLearnerMapNotes(scope), note);
      saveLearnerMapNotes({ ...scope, notes: next });
      return note;
    },
    update(noteId: string, patch: LearnerMapNoteUpdateInput): LearnerMapNote | null {
      const list = loadLearnerMapNotes(scope);
      const existing = list.find((n) => n.id === noteId);
      if (!existing) return null;
      const updated = updateLearnerMapNote(existing, patch);
      saveLearnerMapNotes({
        ...scope,
        notes: upsertLearnerMapNote(list, updated),
      });
      return updated;
    },
    remove(noteId: string): LearnerMapNote[] {
      const next = deleteLearnerMapNote(loadLearnerMapNotes(scope), noteId);
      saveLearnerMapNotes({ ...scope, notes: next });
      return next;
    },
    replaceAll(notes: readonly LearnerMapNote[]): void {
      saveLearnerMapNotes({ ...scope, notes });
    },
  };
}

/** Whether learner-note chrome should mount (learner mode only). */
export function shouldMountLearnerMapNotes(input: {
  learnerMode?: boolean;
}): boolean {
  return Boolean(input.learnerMode);
}
