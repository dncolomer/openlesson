/**
 * Map post-it notes on a continuous plane (not grid-cell snap).
 * Free world x/y + width/height; pan/zoom with the block map; block-agnostic.
 *
 * - Creator notes: workspace-scoped, visible in creator + learner modes.
 *   Learners can view them but cannot delete (or edit/move) them.
 * - Learner notes: personal (workspace + learner scope), only in learner mode.
 *
 * Pure helpers so unit tests drive CRUD, center-drop, drag, and resize.
 */

import { SKILL_GRID_PITCH } from "@/lib/block-skill-grid";

/** Max short body length for a map post-it. */
export const LEARNER_NOTE_BODY_MAX = 280;

/** Default size in world pixels (map layer units, pre-zoom). */
export const LEARNER_NOTE_DEFAULT_WIDTH = 168;
export const LEARNER_NOTE_DEFAULT_HEIGHT = 120;
export const LEARNER_NOTE_MIN_WIDTH = 96;
export const LEARNER_NOTE_MIN_HEIGHT = 56;
export const LEARNER_NOTE_MAX_WIDTH = 420;
export const LEARNER_NOTE_MAX_HEIGHT = 360;

/** Who authored the note — drives visibility + delete/edit permissions. */
export type MapNoteSource = "creator" | "learner";

/** Continuous world-plane position (same transform space as block tiles). */
export type LearnerMapNote = {
  id: string;
  body: string;
  /** World X (pixels on the map plane; left of post-it). */
  x: number;
  /** World Y (pixels on the map plane; top of post-it). */
  y: number;
  /** World width (pre-zoom). */
  width: number;
  /** World height (pre-zoom). Collapsed notes may render shorter in UI. */
  height: number;
  collapsed: boolean;
  /** Authoring source; defaults to "learner" when missing (legacy). */
  source: MapNoteSource;
  createdAt: number;
  updatedAt: number;
};

export type LearnerMapNoteCreateInput = {
  body?: string | null;
  x: number;
  y: number;
  width?: number;
  height?: number;
  collapsed?: boolean;
  source?: MapNoteSource;
  id?: string;
  now?: number;
};

export type LearnerMapNoteUpdateInput = {
  body?: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  collapsed?: boolean;
  now?: number;
};

/** Normalize note authorship; missing → learner (legacy personal notes). */
export function normalizeMapNoteSource(value: unknown): MapNoteSource {
  return value === "creator" ? "creator" : "learner";
}

export function mapNoteSourceOf(
  note: Pick<LearnerMapNote, "source"> | { source?: MapNoteSource },
): MapNoteSource {
  return normalizeMapNoteSource(note.source);
}

/**
 * Learner cannot delete creator-authored notes (always visible, author-owned).
 * Creator may delete creator notes; learner may delete personal notes.
 */
export function canDeleteMapNote(
  note: Pick<LearnerMapNote, "source"> | { source?: MapNoteSource },
  ctx: { learnerMode: boolean },
): boolean {
  if (mapNoteSourceOf(note) === "creator" && ctx.learnerMode) return false;
  return true;
}

/**
 * Learners may only edit body/geometry of their own notes.
 * Creator notes are read-only for learners (collapse still allowed).
 */
export function canEditMapNoteContent(
  note: Pick<LearnerMapNote, "source"> | { source?: MapNoteSource },
  ctx: { learnerMode: boolean },
): boolean {
  if (mapNoteSourceOf(note) === "creator" && ctx.learnerMode) return false;
  return true;
}

export function canMutateMapNoteGeometry(
  note: Pick<LearnerMapNote, "source"> | { source?: MapNoteSource },
  ctx: { learnerMode: boolean },
): boolean {
  return canEditMapNoteContent(note, ctx);
}

/** Personal learner notes: workspace + learner identity. */
export function learnerMapNotesStorageKey(input: {
  workspaceId: string;
  learnerScopeId: string;
}): string {
  const ws = String(input.workspaceId || "").trim() || "unknown-workspace";
  const who = String(input.learnerScopeId || "").trim() || "anonymous";
  // v2: continuous plane x/y/width/height
  return `openlesson.learnerMapNotes.v2:${ws}:${who}`;
}

/** Also try v1 key when loading (migrate col/row → world x/y). */
export function learnerMapNotesStorageKeyV1(input: {
  workspaceId: string;
  learnerScopeId: string;
}): string {
  const ws = String(input.workspaceId || "").trim() || "unknown-workspace";
  const who = String(input.learnerScopeId || "").trim() || "anonymous";
  return `openlesson.learnerMapNotes.v1:${ws}:${who}`;
}

/** Creator-authored notes: workspace-scoped (visible to all learners). */
export function creatorMapNotesStorageKey(input: {
  workspaceId: string;
}): string {
  const ws = String(input.workspaceId || "").trim() || "unknown-workspace";
  return `openlesson.creatorMapNotes.v2:${ws}`;
}

/** Finite continuous world coordinate. */
export function normalizeLearnerNoteWorld(
  value: unknown,
  fallback = 0,
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-1_000_000, Math.min(1_000_000, n));
}

export function normalizeLearnerNoteWidth(
  value: unknown,
  fallback = LEARNER_NOTE_DEFAULT_WIDTH,
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(
    LEARNER_NOTE_MIN_WIDTH,
    Math.min(LEARNER_NOTE_MAX_WIDTH, Math.round(n)),
  );
}

export function normalizeLearnerNoteHeight(
  value: unknown,
  fallback = LEARNER_NOTE_DEFAULT_HEIGHT,
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(
    LEARNER_NOTE_MIN_HEIGHT,
    Math.min(LEARNER_NOTE_MAX_HEIGHT, Math.round(n)),
  );
}

/** @deprecated alias for world coords (tests/back-compat). */
export function normalizeLearnerNoteCoord(
  value: unknown,
  fallback = 0,
): number {
  return normalizeLearnerNoteWorld(value, fallback);
}

/** Short note body: trim + hard cap. Empty allowed. */
export function normalizeLearnerNoteBody(value: unknown): string {
  const raw = typeof value === "string" ? value : String(value ?? "");
  return raw.replace(/\r\n/g, "\n").slice(0, LEARNER_NOTE_BODY_MAX);
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

/** Create a new note on the continuous plane (no block id). */
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
    x: normalizeLearnerNoteWorld(input.x),
    y: normalizeLearnerNoteWorld(input.y),
    width: normalizeLearnerNoteWidth(input.width),
    height: normalizeLearnerNoteHeight(input.height),
    collapsed: Boolean(input.collapsed),
    source: normalizeMapNoteSource(input.source ?? "learner"),
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
    x:
      patch.x !== undefined
        ? normalizeLearnerNoteWorld(patch.x, note.x)
        : note.x,
    y:
      patch.y !== undefined
        ? normalizeLearnerNoteWorld(patch.y, note.y)
        : note.y,
    width:
      patch.width !== undefined
        ? normalizeLearnerNoteWidth(patch.width, note.width)
        : note.width,
    height:
      patch.height !== undefined
        ? normalizeLearnerNoteHeight(patch.height, note.height)
        : note.height,
    collapsed:
      patch.collapsed !== undefined ? Boolean(patch.collapsed) : note.collapsed,
    updatedAt: now,
  };
}

export function toggleLearnerMapNoteCollapsed(
  note: LearnerMapNote,
  now?: number,
): LearnerMapNote {
  return updateLearnerMapNote(note, {
    collapsed: !note.collapsed,
    now,
  });
}

export function deleteLearnerMapNote(
  notes: readonly LearnerMapNote[],
  noteId: string,
): LearnerMapNote[] {
  const id = String(noteId || "").trim();
  if (!id) return notes.map((n) => ({ ...n }));
  return (notes || []).filter((n) => n.id !== id);
}

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
 * Parse raw JSON/list into valid notes.
 * Supports v2 {x,y,width,height} and v1 {col,row} (converted via pitch).
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

    let x: number;
    let y: number;
    if (rec.x != null || rec.y != null) {
      x = normalizeLearnerNoteWorld(rec.x);
      y = normalizeLearnerNoteWorld(rec.y);
    } else if (rec.col != null || rec.row != null) {
      // v1 grid coords → world plane
      const col = normalizeLearnerNoteWorld(rec.col);
      const row = normalizeLearnerNoteWorld(rec.row);
      x = col * SKILL_GRID_PITCH;
      y = row * SKILL_GRID_PITCH;
    } else {
      x = 0;
      y = 0;
    }

    const note: LearnerMapNote = {
      id,
      body: normalizeLearnerNoteBody(rec.body ?? rec.text ?? rec.content ?? ""),
      x,
      y,
      width: normalizeLearnerNoteWidth(rec.width),
      height: normalizeLearnerNoteHeight(rec.height),
      collapsed: Boolean(rec.collapsed),
      source: normalizeMapNoteSource(rec.source),
      createdAt:
        typeof rec.createdAt === "number" && Number.isFinite(rec.createdAt)
          ? Math.floor(rec.createdAt)
          : Date.now(),
      updatedAt:
        typeof rec.updatedAt === "number" && Number.isFinite(rec.updatedAt)
          ? Math.floor(rec.updatedAt)
          : Date.now(),
    };
    seen.add(id);
    out.push(note);
  }
  return out;
}

/** Assert note is block-agnostic (no block linkage; free plane position). */
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
    Number.isFinite(note.x) &&
    Number.isFinite(note.y) &&
    Number.isFinite(note.width) &&
    Number.isFinite(note.height)
  );
}

// ---------------------------------------------------------------------------
// Continuous plane ↔ viewport (same pan/zoom as blocks)
// ---------------------------------------------------------------------------

/**
 * Viewport center (CSS px) → continuous world plane coords.
 * Inverse of screen = world * zoom + pan.
 */
export function viewportCenterToWorldPlane(input: {
  viewportWidth: number;
  viewportHeight: number;
  panX: number;
  panY: number;
  zoom: number;
}): { x: number; y: number } {
  const zoom =
    Number.isFinite(input.zoom) && input.zoom > 0 ? input.zoom : 1;
  const vw = Math.max(0, Number(input.viewportWidth) || 0);
  const vh = Math.max(0, Number(input.viewportHeight) || 0);
  const cx = vw / 2;
  const cy = vh / 2;
  return {
    x: normalizeLearnerNoteWorld((cx - input.panX) / zoom),
    y: normalizeLearnerNoteWorld((cy - input.panY) / zoom),
  };
}

/**
 * Create a note centered on the current viewport (middle of the screen).
 * Position is top-left of the post-it so the note is roughly centered.
 */
export function createLearnerMapNoteAtViewportCenter(input: {
  viewportWidth: number;
  viewportHeight: number;
  panX: number;
  panY: number;
  zoom: number;
  body?: string | null;
  id?: string;
  now?: number;
  width?: number;
  height?: number;
  source?: MapNoteSource;
}): LearnerMapNote {
  const w = normalizeLearnerNoteWidth(input.width);
  const h = normalizeLearnerNoteHeight(input.height);
  const center = viewportCenterToWorldPlane(input);
  return createLearnerMapNote({
    id: input.id,
    body: input.body,
    x: center.x - w / 2,
    y: center.y - h / 2,
    width: w,
    height: h,
    collapsed: false,
    source: input.source,
    now: input.now,
  });
}

/**
 * Apply a screen-space drag delta to world position (accounts for zoom).
 */
export function applyLearnerNoteDragDelta(
  note: LearnerMapNote,
  input: {
    /** Screen/CSS pixel delta */
    dxScreen: number;
    dyScreen: number;
    zoom: number;
    now?: number;
  },
): LearnerMapNote {
  const zoom =
    Number.isFinite(input.zoom) && input.zoom > 0 ? input.zoom : 1;
  const dx = (Number(input.dxScreen) || 0) / zoom;
  const dy = (Number(input.dyScreen) || 0) / zoom;
  return updateLearnerMapNote(note, {
    x: note.x + dx,
    y: note.y + dy,
    now: input.now,
  });
}

/**
 * Resize note in world pixels (clamped). Optional screen deltas / zoom.
 */
export function applyLearnerNoteResize(
  note: LearnerMapNote,
  input: {
    width?: number;
    height?: number;
    /** Screen-space size deltas (converted via zoom when width/height omitted). */
    dWidthScreen?: number;
    dHeightScreen?: number;
    zoom?: number;
    now?: number;
  },
): LearnerMapNote {
  const zoom =
    Number.isFinite(input.zoom) && (input.zoom as number) > 0
      ? (input.zoom as number)
      : 1;
  let width = note.width;
  let height = note.height;
  if (input.width !== undefined) {
    width = normalizeLearnerNoteWidth(input.width, note.width);
  } else if (input.dWidthScreen !== undefined) {
    width = normalizeLearnerNoteWidth(
      note.width + (Number(input.dWidthScreen) || 0) / zoom,
      note.width,
    );
  }
  if (input.height !== undefined) {
    height = normalizeLearnerNoteHeight(input.height, note.height);
  } else if (input.dHeightScreen !== undefined) {
    height = normalizeLearnerNoteHeight(
      note.height + (Number(input.dHeightScreen) || 0) / zoom,
      note.height,
    );
  }
  return updateLearnerMapNote(note, { width, height, now: input.now });
}

/** Screen position of note top-left (CSS px). */
export function learnerNoteScreenPosition(input: {
  x: number;
  y: number;
  panX: number;
  panY: number;
  zoom: number;
}): { left: number; top: number } {
  const zoom =
    Number.isFinite(input.zoom) && input.zoom > 0 ? input.zoom : 1;
  return {
    left: normalizeLearnerNoteWorld(input.x) * zoom + input.panX,
    top: normalizeLearnerNoteWorld(input.y) * zoom + input.panY,
  };
}

/**
 * Style for notes inside the pan/zoom world layer (pre-transform).
 * left/top/width/height are world pixels.
 */
export function learnerNoteLayerStyle(
  note: Pick<LearnerMapNote, "x" | "y" | "width" | "height" | "collapsed">,
): { left: number; top: number; width: number; height: number } {
  return {
    left: note.x,
    top: note.y,
    width: note.width,
    height: note.collapsed
      ? Math.min(note.height, 36)
      : note.height,
  };
}

/** @deprecated grid helpers kept for migration tests */
export function learnerNoteWorldOrigin(
  coords: { col: number; row: number },
  pitch: number = SKILL_GRID_PITCH,
): { x: number; y: number } {
  return {
    x: normalizeLearnerNoteWorld(coords.col) * pitch,
    y: normalizeLearnerNoteWorld(coords.row) * pitch,
  };
}

export function pointerLocalToWorldPlane(input: {
  localX: number;
  localY: number;
  panX: number;
  panY: number;
  zoom: number;
}): { x: number; y: number } {
  const zoom =
    Number.isFinite(input.zoom) && input.zoom > 0 ? input.zoom : 1;
  return {
    x: normalizeLearnerNoteWorld((input.localX - input.panX) / zoom),
    y: normalizeLearnerNoteWorld((input.localY - input.panY) / zoom),
  };
}

// ---------------------------------------------------------------------------
// Client store (localStorage) — pure wrappers with injectable storage
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

function serializeMapNotesPayload(
  notes: readonly LearnerMapNote[],
): Array<Record<string, unknown>> {
  return (notes || []).map((n) => ({
    id: n.id,
    body: n.body,
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
    collapsed: n.collapsed,
    source: mapNoteSourceOf(n),
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }));
}

/** Load personal learner notes for a workspace + learner scope. */
export function loadLearnerMapNotes(input: {
  workspaceId: string;
  learnerScopeId: string;
  storage?: LearnerNotesStorage | null;
}): LearnerMapNote[] {
  const storage = input.storage ?? defaultLearnerNotesStorage();
  if (!storage) return [];
  const keyV2 = learnerMapNotesStorageKey(input);
  try {
    const rawV2 = storage.getItem(keyV2);
    if (rawV2) {
      return parseLearnerMapNotes(JSON.parse(rawV2) as unknown).map((n) => ({
        ...n,
        source: "learner" as const,
      }));
    }
    // Migrate v1 if present
    const keyV1 = learnerMapNotesStorageKeyV1(input);
    const rawV1 = storage.getItem(keyV1);
    if (rawV1) {
      const migrated = parseLearnerMapNotes(JSON.parse(rawV1) as unknown).map(
        (n) => ({ ...n, source: "learner" as const }),
      );
      if (migrated.length > 0) {
        saveLearnerMapNotes({ ...input, notes: migrated, storage });
      }
      return migrated;
    }
    return [];
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
    // Personal store only holds learner-sourced notes
    const personal = (input.notes || []).map((n) => ({
      ...n,
      source: "learner" as const,
    }));
    storage.setItem(key, JSON.stringify(serializeMapNotesPayload(personal)));
  } catch {
    // ignore quota / private mode
  }
}

/** Load workspace creator notes (shared, visible in learner mode). */
export function loadCreatorMapNotes(input: {
  workspaceId: string;
  storage?: LearnerNotesStorage | null;
}): LearnerMapNote[] {
  const storage = input.storage ?? defaultLearnerNotesStorage();
  if (!storage) return [];
  const key = creatorMapNotesStorageKey(input);
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    return parseLearnerMapNotes(JSON.parse(raw) as unknown).map((n) => ({
      ...n,
      source: "creator" as const,
    }));
  } catch {
    return [];
  }
}

export function saveCreatorMapNotes(input: {
  workspaceId: string;
  notes: readonly LearnerMapNote[];
  storage?: LearnerNotesStorage | null;
}): void {
  const storage = input.storage ?? defaultLearnerNotesStorage();
  if (!storage) return;
  const key = creatorMapNotesStorageKey(input);
  try {
    const creatorOnly = (input.notes || []).map((n) => ({
      ...n,
      source: "creator" as const,
    }));
    storage.setItem(key, JSON.stringify(serializeMapNotesPayload(creatorOnly)));
  } catch {
    // ignore
  }
}

/**
 * Notes visible for the current map mode.
 * - Creator mode: creator notes only
 * - Learner mode: creator notes + personal learner notes (creator first)
 */
export function listVisibleMapNotes(input: {
  workspaceId: string;
  learnerMode: boolean;
  learnerScopeId?: string | null;
  storage?: LearnerNotesStorage | null;
}): LearnerMapNote[] {
  const storage = input.storage ?? defaultLearnerNotesStorage();
  const creator = loadCreatorMapNotes({
    workspaceId: input.workspaceId,
    storage,
  });
  if (!input.learnerMode) return creator;
  const personal = loadLearnerMapNotes({
    workspaceId: input.workspaceId,
    learnerScopeId: String(input.learnerScopeId || "local").trim() || "local",
    storage,
  });
  // Creator notes first so they sit under personal notes in z-order when ids collide
  // (ids should not collide across stores, but merge is stable).
  const seen = new Set(creator.map((n) => n.id));
  const merged = [...creator];
  for (const n of personal) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    merged.push(n);
  }
  return merged;
}

/**
 * UI default: map post-its are drawn when notes mount (creator + learner).
 * Session-only preference — independent of annotation layer visibility.
 */
export function defaultMapNotesPlaneVisible(): boolean {
  return true;
}

/** Whether post-its should paint on the continuous plane. */
export function shouldRenderMapNotesOnPlane(planeVisible: unknown): boolean {
  return planeVisible === true || planeVisible === "true" || planeVisible === 1;
}

/**
 * Gate the post-it render list without mutating storage collections.
 * When plane is hidden, returns [] so notes stay in memory/localStorage intact.
 */
export function mapNotesForPlaneRender(
  notes: readonly LearnerMapNote[] | null | undefined,
  planeVisible: unknown,
): LearnerMapNote[] {
  if (!shouldRenderMapNotesOnPlane(planeVisible)) return [];
  return Array.isArray(notes) ? [...notes] : [];
}

/** Flip hide/show for the notes plane eye toggle. */
export function toggleMapNotesPlaneVisible(planeVisible: unknown): boolean {
  return !shouldRenderMapNotesOnPlane(planeVisible);
}

export function learnerMapNotesStoreOps(input: {
  workspaceId: string;
  learnerScopeId: string;
  storage?: LearnerNotesStorage | null;
}) {
  const storage =
    input.storage ?? defaultLearnerNotesStorage() ?? memoryStorage();
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
      const note = createLearnerMapNote({
        ...createInput,
        source: createInput.source ?? "learner",
      });
      const next = upsertLearnerMapNote(loadLearnerMapNotes(scope), note);
      saveLearnerMapNotes({ ...scope, notes: next });
      return note;
    },
    createAtViewportCenter(
      viewport: {
        viewportWidth: number;
        viewportHeight: number;
        panX: number;
        panY: number;
        zoom: number;
      },
      extra?: {
        body?: string;
        id?: string;
        now?: number;
        source?: MapNoteSource;
      },
    ): LearnerMapNote {
      const note = createLearnerMapNoteAtViewportCenter({
        ...viewport,
        ...extra,
        source: extra?.source ?? "learner",
      });
      const next = upsertLearnerMapNote(loadLearnerMapNotes(scope), note);
      saveLearnerMapNotes({ ...scope, notes: next });
      return note;
    },
    update(
      noteId: string,
      patch: LearnerMapNoteUpdateInput,
    ): LearnerMapNote | null {
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

export function creatorMapNotesStoreOps(input: {
  workspaceId: string;
  storage?: LearnerNotesStorage | null;
}) {
  const storage =
    input.storage ?? defaultLearnerNotesStorage() ?? memoryStorage();
  const scope = { workspaceId: input.workspaceId, storage };
  return {
    list(): LearnerMapNote[] {
      return loadCreatorMapNotes(scope);
    },
    createAtViewportCenter(
      viewport: {
        viewportWidth: number;
        viewportHeight: number;
        panX: number;
        panY: number;
        zoom: number;
      },
      extra?: { body?: string; id?: string; now?: number },
    ): LearnerMapNote {
      const note = createLearnerMapNoteAtViewportCenter({
        ...viewport,
        ...extra,
        source: "creator",
      });
      const next = upsertLearnerMapNote(loadCreatorMapNotes(scope), note);
      saveCreatorMapNotes({ ...scope, notes: next });
      return note;
    },
    update(
      noteId: string,
      patch: LearnerMapNoteUpdateInput,
    ): LearnerMapNote | null {
      const list = loadCreatorMapNotes(scope);
      const existing = list.find((n) => n.id === noteId);
      if (!existing) return null;
      const updated = updateLearnerMapNote(existing, patch);
      saveCreatorMapNotes({
        ...scope,
        notes: upsertLearnerMapNote(list, updated),
      });
      return updated;
    },
    remove(noteId: string): LearnerMapNote[] {
      const next = deleteLearnerMapNote(loadCreatorMapNotes(scope), noteId);
      saveCreatorMapNotes({ ...scope, notes: next });
      return next;
    },
  };
}

/**
 * Notes chrome mounts whenever a workspace map is shown (creator + learner).
 * Prefer passing workspaceId; `learnerMode` alone is accepted for older callers
 * and still mounts (both modes support notes).
 */
export function shouldMountMapNotes(input: {
  workspaceId?: string | null;
  learnerMode?: boolean;
}): boolean {
  if (input.workspaceId !== undefined && input.workspaceId !== null) {
    return Boolean(String(input.workspaceId).trim());
  }
  // Both modes support notes when host wires workspaceId; without it, mount
  // whenever the map is in a known mode context (true for both flags).
  return input.learnerMode === true || input.learnerMode === false
    ? true
    : true;
}

/** @deprecated use shouldMountMapNotes — notes mount in creator and learner. */
export function shouldMountLearnerMapNotes(input: {
  learnerMode?: boolean;
  workspaceId?: string | null;
}): boolean {
  return shouldMountMapNotes(input);
}

/**
 * Minimal EventTarget-like node for pure drag-start gate tests (no DOM required).
 * Mirrors Element.closest() semantics used by the post-it pointer handlers.
 */
export type LearnerNotePointerTargetLike = {
  closest: (selector: string) => LearnerNotePointerTargetLike | null;
};

/**
 * Whether pointerdown on `target` should start a **move** drag.
 * Requires being inside `[data-learner-note-drag-handle]` and **not** inside an
 * interactive control (button, input, etc.). The shipped post-it keeps collapse/
 * delete as separate buttons outside the drag surface so this returns true for
 * normal header drags.
 */
export function learnerNotePointerAllowsDragStart(
  target: LearnerNotePointerTargetLike | null | undefined,
): boolean {
  if (!target || typeof target.closest !== "function") return false;
  const handle = target.closest("[data-learner-note-drag-handle]");
  if (!handle) return false;
  const control = target.closest(
    "button, a, input, textarea, select, [data-learner-note-no-drag]",
  );
  if (control) return false;
  return true;
}

/** Live box while dragging/resizing (screen/world layer units). */
export type LearnerNoteGestureBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Pure pointer-move → live box for move/resize gestures (same math as post-it UI).
 * Callers store the result on a drag ref and commit from that ref on pointerup
 * (not from React state, which can lag).
 */
export function learnerNoteLiveBoxFromPointerMove(input: {
  kind: "move" | "resize";
  originLeft: number;
  originTop: number;
  originWidth: number;
  originHeight: number;
  startClientX: number;
  startClientY: number;
  clientX: number;
  clientY: number;
  zoom: number;
}): LearnerNoteGestureBox {
  const zoom =
    Number.isFinite(input.zoom) && input.zoom > 0 ? input.zoom : 1;
  const dx = (input.clientX - input.startClientX) / zoom;
  const dy = (input.clientY - input.startClientY) / zoom;
  if (input.kind === "move") {
    return {
      left: input.originLeft + dx,
      top: input.originTop + dy,
      width: input.originWidth,
      height: input.originHeight,
    };
  }
  return {
    left: input.originLeft,
    top: input.originTop,
    width: Math.max(LEARNER_NOTE_MIN_WIDTH, input.originWidth + dx),
    height: Math.max(LEARNER_NOTE_MIN_HEIGHT, input.originHeight + dy),
  };
}

/**
 * Commit payload from the last gesture box stored on the drag ref (pointerup).
 */
export function learnerNoteCommitFromGestureBox(
  kind: "move" | "resize",
  box: LearnerNoteGestureBox,
):
  | { kind: "move"; x: number; y: number }
  | { kind: "resize"; width: number; height: number } {
  if (kind === "move") {
    return { kind: "move", x: box.left, y: box.top };
  }
  return {
    kind: "resize",
    width: normalizeLearnerNoteWidth(box.width),
    height: normalizeLearnerNoteHeight(box.height),
  };
}
