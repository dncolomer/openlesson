/**
 * Workspace chapter-map types: built-in catalog projected into one record
 * shape, plus custom types persisted on the workspace. Picker catalog and
 * session-plan create both consume the same generator-context formatter.
 *
 * Types are generation context (spawn / no-spawn / blocked / optional DAG
 * hints), not 1:1 templates copied onto the session map.
 */

import {
  DEFAULT_INITIAL_CHAPTERS,
  INITIAL_CHAPTERS_LEVELS,
  canonicalizeInitialChapters,
  getInitialChaptersOption,
  isInitialChaptersLevel,
  type InitialChaptersLevel,
} from "@/lib/initial-chapters";
import { DUMMY_PATTERN_FRAME } from "@/lib/ile-chapter-mini-map";
import type { MiniMapCell } from "@/lib/ile-chapter-mini-map";

export const MAP_TYPE_CELL_MARKS = [
  "spawn",
  "no_spawn",
  "blocked",
  "dag_hint",
] as const;

export type MapTypeCellMark = (typeof MAP_TYPE_CELL_MARKS)[number];

export type MapTypeCell = {
  row: number;
  col: number;
  mark: MapTypeCellMark;
};

export type MapTypeBand = {
  min: number;
  max: number;
  target: number;
  audience: string;
};

export type WorkspaceMapTypeSource = "builtin" | "custom";

export type WorkspaceMapTypeRecord = {
  id: string;
  label: string;
  description: string;
  source: WorkspaceMapTypeSource;
  enabled: boolean;
  cells: MapTypeCell[];
  /** Workspace DAG ids used as optional generator hints (not a 1:1 copy). */
  dagHintIds: string[];
  layoutInstruction: string;
  band: MapTypeBand;
  /** i18n key suffixes for built-ins (session.* / planMode.*). */
  titleKey?: string;
  descKey?: string;
};

export type WorkspaceMapTypesState = {
  disabledBuiltinIds: string[];
  customTypes: WorkspaceMapTypeRecord[];
};

export type MapTypeGeneratorContext = {
  id: string;
  label: string;
  source: WorkspaceMapTypeSource;
  band: MapTypeBand;
  layoutInstruction: string;
  spawnInstruction: string;
  noSpawnInstruction: string;
  blockedInstruction: string;
  dagHintInstruction: string;
  /** Joined prompt fill for `{initial_chapters_instruction}`. */
  countInstruction: string;
};

export type MapTypePickerItem = {
  id: string;
  label: string;
  description: string;
  source: WorkspaceMapTypeSource;
  titleKey?: string;
  descKey?: string;
  cells: MiniMapCell[];
  band?: MapTypeBand;
};

export const MAP_TYPE_GRID = DUMMY_PATTERN_FRAME;

const DEFAULT_CUSTOM_BAND: MapTypeBand = {
  min: 10,
  max: 15,
  target: 12,
  audience: "a custom chapter-map layout authored on this workspace",
};

const CUSTOM_ID_PREFIX = "maptype_";

function cleanId(id: unknown): string {
  return String(id ?? "").trim();
}

function isoNow(now?: string): string {
  if (now && String(now).trim()) return String(now).trim();
  return new Date().toISOString();
}

function clampGridCoord(value: unknown, min: number, max: number): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^-?\d+$/.test(value.trim())
        ? Number(value.trim())
        : NaN;
  if (!Number.isInteger(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function isMapTypeCellMark(value: unknown): value is MapTypeCellMark {
  return (
    typeof value === "string" &&
    (MAP_TYPE_CELL_MARKS as readonly string[]).includes(value)
  );
}

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/** Normalize painted cells: in-grid, unique, last mark wins. */
export function normalizeMapTypeCells(raw: unknown): MapTypeCell[] {
  const list = Array.isArray(raw) ? raw : [];
  const byKey = new Map<string, MapTypeCell>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const row = clampGridCoord(o.row, MAP_TYPE_GRID.minRow, MAP_TYPE_GRID.maxRow);
    const col = clampGridCoord(o.col, MAP_TYPE_GRID.minCol, MAP_TYPE_GRID.maxCol);
    if (row === null || col === null) continue;
    const mark = isMapTypeCellMark(o.mark) ? o.mark : null;
    if (!mark) continue;
    byKey.set(cellKey(row, col), { row, col, mark });
  }
  return [...byKey.values()].sort((a, b) =>
    a.row === b.row ? a.col - b.col : a.row - b.row,
  );
}

function normalizeBand(raw: unknown, fallback: MapTypeBand): MapTypeBand {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const min = Number(o.min);
  const max = Number(o.max);
  const target = Number(o.target);
  const audience =
    typeof o.audience === "string" && o.audience.trim()
      ? o.audience.trim()
      : fallback.audience;
  const safeMin = Number.isFinite(min) && min > 0 ? Math.floor(min) : fallback.min;
  const safeMax =
    Number.isFinite(max) && max >= safeMin ? Math.floor(max) : Math.max(safeMin, fallback.max);
  let safeTarget =
    Number.isFinite(target) && target > 0 ? Math.floor(target) : fallback.target;
  if (safeTarget < safeMin) safeTarget = safeMin;
  if (safeTarget > safeMax) safeTarget = safeMax;
  return { min: safeMin, max: safeMax, target: safeTarget, audience };
}

function uniqIds(ids: readonly unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = cleanId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function emptyWorkspaceMapTypesState(): WorkspaceMapTypesState {
  return { disabledBuiltinIds: [], customTypes: [] };
}

export function newCustomMapTypeId(seed?: string | number): string {
  const s =
    seed !== undefined
      ? String(seed)
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const slug = s.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  return `${CUSTOM_ID_PREFIX}${slug || "new"}`;
}

export function isCustomMapTypeId(id: unknown): boolean {
  const raw = cleanId(id);
  return raw.startsWith(CUSTOM_ID_PREFIX) && !isInitialChaptersLevel(raw);
}

/** Project a frozen built-in catalog option into the shared record shape. */
export function mapTypeRecordFromBuiltin(
  level: InitialChaptersLevel | unknown,
  enabled = true,
): WorkspaceMapTypeRecord {
  const option = getInitialChaptersOption(level);
  const occupiedKeys = new Set(
    option.occupied.map((c) => cellKey(c.row, c.col)),
  );
  const cells: MapTypeCell[] = [];
  for (const cell of option.blocked) {
    cells.push({ row: cell.row, col: cell.col, mark: "blocked" });
  }
  const blockedKeys = new Set(option.blocked.map((c) => cellKey(c.row, c.col)));
  for (const cell of option.occupied) {
    const key = cellKey(cell.row, cell.col);
    if (blockedKeys.has(key)) continue;
    if (!occupiedKeys.has(key)) continue;
    cells.push({ row: cell.row, col: cell.col, mark: "spawn" });
  }
  return {
    id: option.id,
    label: option.label,
    description: option.description,
    source: "builtin",
    enabled,
    cells: normalizeMapTypeCells(cells),
    dagHintIds: [],
    layoutInstruction: option.layoutInstruction.trim(),
    band: {
      min: option.band.min,
      max: option.band.max,
      target: option.band.target,
      audience: option.band.audience,
    },
    titleKey: option.titleKey,
    descKey: option.descKey,
  };
}

export function blankCustomMapType(input?: {
  id?: string;
  label?: string;
  now?: string;
}): WorkspaceMapTypeRecord {
  const id = isCustomMapTypeId(input?.id)
    ? cleanId(input?.id)
    : newCustomMapTypeId(input?.now ?? isoNow());
  return {
    id,
    label: String(input?.label || "Custom map").trim() || "Custom map",
    description: "Custom chapter-map layout for this workspace.",
    source: "custom",
    enabled: true,
    cells: [],
    dagHintIds: [],
    layoutInstruction: "",
    band: { ...DEFAULT_CUSTOM_BAND },
  };
}

export function normalizeCustomMapTypeRecord(
  raw: unknown,
): WorkspaceMapTypeRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = cleanId(o.id);
  if (!id || isInitialChaptersLevel(id)) return null;
  const label = String(o.label || "").trim() || "Custom map";
  const description = String(o.description || "").trim();
  const enabled = o.enabled !== false;
  return {
    id,
    label,
    description:
      description || "Custom chapter-map layout for this workspace.",
    source: "custom",
    enabled,
    cells: normalizeMapTypeCells(o.cells),
    dagHintIds: uniqIds(Array.isArray(o.dagHintIds) ? o.dagHintIds : []),
    layoutInstruction: String(o.layoutInstruction || "").trim(),
    band: normalizeBand(o.band, DEFAULT_CUSTOM_BAND),
  };
}

/** Normalize jsonb / API payload into enable flags + custom records. */
export function normalizeWorkspaceMapTypes(raw: unknown): WorkspaceMapTypesState {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const disabledRaw = Array.isArray(o.disabledBuiltinIds)
    ? o.disabledBuiltinIds
    : Array.isArray(o.disabled_builtin_ids)
      ? o.disabled_builtin_ids
      : [];
  const disabledBuiltinIds = uniqIds(disabledRaw).filter((id) =>
    isInitialChaptersLevel(id),
  );
  const customRaw = Array.isArray(o.customTypes)
    ? o.customTypes
    : Array.isArray(o.custom_types)
      ? o.custom_types
      : Array.isArray(raw)
        ? raw
        : [];
  const customTypes: WorkspaceMapTypeRecord[] = [];
  const seen = new Set<string>();
  for (const item of customRaw) {
    const record = normalizeCustomMapTypeRecord(item);
    if (!record) continue;
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    customTypes.push(record);
  }
  return { disabledBuiltinIds, customTypes };
}

export function serializeWorkspaceMapTypes(
  state: unknown,
): WorkspaceMapTypesState {
  const normalized = normalizeWorkspaceMapTypes(state);
  return {
    disabledBuiltinIds: normalized.disabledBuiltinIds,
    customTypes: normalized.customTypes.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      source: "custom" as const,
      enabled: t.enabled,
      cells: t.cells,
      dagHintIds: t.dagHintIds,
      layoutInstruction: t.layoutInstruction,
      band: t.band,
    })),
  };
}

export function setBuiltinMapTypeEnabled(
  state: WorkspaceMapTypesState,
  builtinId: unknown,
  enabled: boolean,
): WorkspaceMapTypesState {
  const id = canonicalizeInitialChapters(builtinId);
  if (!id) return normalizeWorkspaceMapTypes(state);
  const current = normalizeWorkspaceMapTypes(state);
  const without = current.disabledBuiltinIds.filter((x) => x !== id);
  return {
    disabledBuiltinIds: enabled ? without : [...without, id],
    customTypes: current.customTypes,
  };
}

export function upsertCustomMapType(
  state: WorkspaceMapTypesState,
  record: unknown,
): WorkspaceMapTypesState {
  const current = normalizeWorkspaceMapTypes(state);
  const next = normalizeCustomMapTypeRecord(record);
  if (!next) return current;
  const idx = current.customTypes.findIndex((t) => t.id === next.id);
  const customTypes = [...current.customTypes];
  if (idx >= 0) customTypes[idx] = next;
  else customTypes.push(next);
  return { disabledBuiltinIds: current.disabledBuiltinIds, customTypes };
}

export function removeCustomMapType(
  state: WorkspaceMapTypesState,
  id: unknown,
): WorkspaceMapTypesState {
  const current = normalizeWorkspaceMapTypes(state);
  const target = cleanId(id);
  return {
    disabledBuiltinIds: current.disabledBuiltinIds,
    customTypes: current.customTypes.filter((t) => t.id !== target),
  };
}

function builtinEnabled(
  state: WorkspaceMapTypesState,
  id: InitialChaptersLevel,
): boolean {
  return !state.disabledBuiltinIds.includes(id);
}

/**
 * Picker catalog: enabled built-ins (frozen eight-id list, in catalog order)
 * plus enabled custom types. If that would be empty, fall back to islands.
 */
export function resolveWorkspaceMapTypeCatalog(
  state?: WorkspaceMapTypesState | null,
): WorkspaceMapTypeRecord[] {
  const normalized = normalizeWorkspaceMapTypes(state ?? emptyWorkspaceMapTypesState());
  const builtins = INITIAL_CHAPTERS_LEVELS.filter((id) =>
    builtinEnabled(normalized, id),
  ).map((id) => mapTypeRecordFromBuiltin(id, true));
  const customs = normalized.customTypes.filter((t) => t.enabled);
  const catalog = [...builtins, ...customs];
  if (catalog.length > 0) return catalog;
  return [mapTypeRecordFromBuiltin(DEFAULT_INITIAL_CHAPTERS, true)];
}

export function findMapTypeInState(
  state: WorkspaceMapTypesState | null | undefined,
  id: unknown,
): WorkspaceMapTypeRecord | null {
  const raw = cleanId(id);
  if (!raw) return null;
  const canonical = canonicalizeInitialChapters(raw);
  const normalized = normalizeWorkspaceMapTypes(state ?? emptyWorkspaceMapTypesState());
  if (canonical) {
    return mapTypeRecordFromBuiltin(
      canonical,
      builtinEnabled(normalized, canonical),
    );
  }
  return normalized.customTypes.find((t) => t.id === raw) ?? null;
}

/**
 * Resolve a chosen type id against workspace state. Unknown values fall back
 * to the first picker catalog entry (islands when the catalog is empty).
 */
export function resolveMapTypeRecord(
  id: unknown,
  state?: WorkspaceMapTypesState | null,
): WorkspaceMapTypeRecord {
  const found = findMapTypeInState(state, id);
  if (found) return found;
  const catalog = resolveWorkspaceMapTypeCatalog(state);
  return catalog[0] ?? mapTypeRecordFromBuiltin(DEFAULT_INITIAL_CHAPTERS, true);
}

/**
 * Body resolver for session-plan create: `initial_chapters` / aliases plus
 * `map_type` / `mapType`. Accepts built-in ids, legacy aliases, and custom
 * type ids present on the workspace. Unknown → catalog fallback (islands).
 */
export function resolveMapTypeIdFromBody(
  body: Record<string, unknown> | null | undefined,
  state?: WorkspaceMapTypesState | null,
): string {
  const catalog = resolveWorkspaceMapTypeCatalog(state);
  const fallback = catalog[0]?.id ?? DEFAULT_INITIAL_CHAPTERS;
  if (!body || typeof body !== "object") return fallback;
  const candidates = [
    body.initial_chapters,
    body.initialChapters,
    body.map_type,
    body.mapType,
    body.map_size,
    body.mapSize,
  ];
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const raw = value.trim();
    if (!raw) continue;
    const found = findMapTypeInState(state, raw);
    if (found) return found.id;
  }
  return fallback;
}

export function cellsWithMark(
  record: Pick<WorkspaceMapTypeRecord, "cells">,
  mark: MapTypeCellMark,
): Array<{ row: number; col: number }> {
  return record.cells
    .filter((c) => c.mark === mark)
    .map((c) => ({ row: c.row, col: c.col }));
}

export function blockedCellsFromMapType(
  record: Pick<WorkspaceMapTypeRecord, "cells">,
): Array<{ row: number; col: number }> {
  return cellsWithMark(record, "blocked");
}

function formatCellList(cells: Array<{ row: number; col: number }>): string {
  return cells
    .map((cell) => `(position_x=${cell.col}, position_y=${cell.row})`)
    .join(", ");
}

/**
 * Single generator-context formatter for built-in and custom map types.
 * Spawn / no-spawn / blocked / DAG-hint text is hints, not a tile-for-tile
 * template. Used by session-plan create (`{initial_chapters_instruction}`).
 */
export function formatMapTypeGeneratorContext(
  record: WorkspaceMapTypeRecord,
): MapTypeGeneratorContext {
  const spawn = cellsWithMark(record, "spawn");
  const noSpawn = cellsWithMark(record, "no_spawn");
  const blocked = cellsWithMark(record, "blocked");
  const dagHintCells = cellsWithMark(record, "dag_hint");
  const layoutInstruction = String(record.layoutInstruction || "").trim();
  const spawnInstruction =
    spawn.length > 0
      ? `SPAWN CELLS (preferred chapter locations — hints, not a 1:1 template): ${formatCellList(spawn)}.`
      : "";
  const noSpawnInstruction =
    noSpawn.length > 0
      ? `NO-SPAWN CELLS (avoid placing chapters here): ${formatCellList(noSpawn)}.`
      : "";
  const blockedInstruction =
    blocked.length > 0
      ? `BLOCKED CHAPTER SLOTS (non-placeable ground): do not place any chapter or block on these cells: ${formatCellList(blocked)}. Persist them as blocked/unusable so corridors stay empty for later bridges.`
      : "";
  const dagParts: string[] = [];
  if (dagHintCells.length > 0) {
    dagParts.push(`hint cells ${formatCellList(dagHintCells)}`);
  }
  if (record.dagHintIds.length > 0) {
    dagParts.push(`workspace DAG ids ${record.dagHintIds.join(", ")}`);
  }
  const dagHintInstruction =
    dagParts.length > 0
      ? `DAG HINTS (optional structure hints, not a 1:1 copy of a workspace DAG): ${dagParts.join("; ")}.`
      : "";
  const countInstruction = [
    `Generate about ${record.band.target} initial chapters/blocks (acceptable range ${record.band.min}-${record.band.max}). Initial chapters level is "${record.id}" — ${record.label} (${record.band.audience}).`,
    layoutInstruction,
    spawnInstruction,
    noSpawnInstruction,
    blockedInstruction,
    dagHintInstruction,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    id: record.id,
    label: record.label,
    source: record.source,
    band: record.band,
    layoutInstruction,
    spawnInstruction,
    noSpawnInstruction,
    blockedInstruction,
    dagHintInstruction,
    countInstruction,
  };
}

export function mapTypeCellsToMiniMap(
  record: Pick<WorkspaceMapTypeRecord, "cells">,
): MiniMapCell[] {
  return record.cells.map((cell) => ({
    row: cell.row,
    col: cell.col,
    kind:
      cell.mark === "blocked"
        ? "blocked"
        : cell.mark === "no_spawn"
          ? "no_spawn"
          : cell.mark === "dag_hint"
            ? "dag_hint"
            : "occupied",
  }));
}

export function mapTypeToPickerItem(
  record: WorkspaceMapTypeRecord,
): MapTypePickerItem {
  return {
    id: record.id,
    label: record.label,
    description: record.description,
    source: record.source,
    titleKey: record.titleKey,
    descKey: record.descKey,
    cells: mapTypeCellsToMiniMap(record),
    band: record.band,
  };
}

export function mapTypePickerCatalog(
  state?: WorkspaceMapTypesState | null,
): MapTypePickerItem[] {
  return resolveWorkspaceMapTypeCatalog(state).map(mapTypeToPickerItem);
}

/** Default picker catalog (all built-ins enabled, no customs). */
export function defaultMapTypePickerCatalog(): MapTypePickerItem[] {
  return mapTypePickerCatalog(emptyWorkspaceMapTypesState());
}

export function stepMapTypeCatalog(
  catalogIds: readonly string[],
  current: unknown,
  delta: number,
): string {
  const ids = catalogIds.filter((id) => cleanId(id).length > 0);
  if (ids.length === 0) return DEFAULT_INITIAL_CHAPTERS;
  const raw = cleanId(current);
  const idx = ids.indexOf(raw);
  const from = idx < 0 ? 0 : idx;
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  const n = ids.length;
  const next = ((from + step) % n + n) % n;
  return ids[next] ?? DEFAULT_INITIAL_CHAPTERS;
}

export function pickRandomMapType(
  catalogIds: readonly string[],
  rand: () => number = Math.random,
): string {
  const ids = catalogIds.filter((id) => cleanId(id).length > 0);
  if (ids.length === 0) return DEFAULT_INITIAL_CHAPTERS;
  const raw = rand();
  const roll = Number.isFinite(raw) ? raw : Math.random();
  const i = Math.min(ids.length - 1, Math.max(0, Math.floor(roll * ids.length)));
  return ids[i] ?? DEFAULT_INITIAL_CHAPTERS;
}

export function setMapTypeCellMark(
  cells: readonly MapTypeCell[],
  row: number,
  col: number,
  mark: MapTypeCellMark | null,
): MapTypeCell[] {
  const next = cells.filter(
    (c) => !(c.row === row && c.col === col),
  );
  if (mark) next.push({ row, col, mark });
  return normalizeMapTypeCells(next);
}
