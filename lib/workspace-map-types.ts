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
  SPATIAL_MAP_LAYOUT_RULES,
  canonicalizeInitialChapters,
  getInitialChaptersOption,
  isInitialChaptersLevel,
  type InitialChaptersLevel,
} from "@/lib/initial-chapters";
import {
  DEFAULT_SELECTED_LIBRARY_IDS,
  MAP_TYPE_LIBRARY_BY_ID,
  isMapTypeLibraryId,
  type MapTypeLibraryEntry,
} from "@/lib/map-type-library";
import { DUMMY_PATTERN_FRAME } from "@/lib/ile-chapter-mini-map";
import type { MiniMapCell } from "@/lib/ile-chapter-mini-map";
import { getCellKey } from "@/lib/block-skill-grid";
import { nextFreeChapterCell } from "@/lib/ile-chapter-blocked";

export const MAP_TYPE_CELL_MARKS = ["spawn", "blocked"] as const;

export type MapTypeCellMark = (typeof MAP_TYPE_CELL_MARKS)[number];

export type MapTypeCell = {
  row: number;
  col: number;
  mark: MapTypeCellMark;
};

export const MAX_MAP_TYPE_ORDER_STEPS = 8;

export type MapTypeOrderStep = {
  step: number;
  cells: Array<{ row: number; col: number }>;
};

export type MapTypePaintTool =
  | { kind: "spawn" }
  | { kind: "blocked" }
  | { kind: "clear" }
  | { kind: "order"; step: number };

export type MapTypeBand = {
  min: number;
  max: number;
  target: number;
  audience: string;
};

export type WorkspaceMapTypeSource = "builtin" | "custom" | "library";
export type MapTypeTopologyMode = "shaped" | "scatter";

export type WorkspaceMapTypeRecord = {
  id: string;
  label: string;
  description: string;
  source: WorkspaceMapTypeSource;
  enabled: boolean;
  cells: MapTypeCell[];
  /** @deprecated Optional leftover workspace DAG ids; order steps replace this. */
  dagHintIds: string[];
  /** How many recommended-order areas the author can paint (0–8). */
  orderStepCount: number;
  /** Painted areas 1…N for a loose recommended chapter DAG. */
  orderSteps: MapTypeOrderStep[];
  layoutInstruction: string;
  band: MapTypeBand;
  /**
   * shaped = painted skeleton should dominate (~80% resemblance).
   * scatter = count/band only; generic four-quadrant spatial rules apply.
   */
  topologyMode?: MapTypeTopologyMode;
  /** i18n key suffixes for built-ins (session.* / planMode.*). */
  titleKey?: string;
  descKey?: string;
  /** Official or published library id when this record was imported. */
  libraryId?: string;
  authorUsername?: string | null;
  category?: string;
};

export type WorkspaceMapTypesState = {
  /** Official library ids currently on this workspace (core defaults + extras). */
  selectedLibraryIds?: string[];
  /**
   * @deprecated Accepted on read; derived from selectedLibraryIds on write.
   * Core ids not present in selectedLibraryIds.
   */
  disabledBuiltinIds: string[];
  /**
   * @deprecated Accepted on read; derived from selectedLibraryIds on write.
   * Extra official ids present in selectedLibraryIds.
   */
  importedLibraryIds?: string[];
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
  orderInstruction: string;
  topologyInstruction: string;
  spatialInstruction: string;
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
    const rawMark = typeof o.mark === "string" ? o.mark : "";
    if (rawMark === "no_spawn" || rawMark === "dag_hint" || rawMark === "order") {
      continue;
    }
    const mark = isMapTypeCellMark(rawMark) ? rawMark : null;
    if (!mark) continue;
    byKey.set(cellKey(row, col), { row, col, mark });
  }
  return [...byKey.values()].sort((a, b) =>
    a.row === b.row ? a.col - b.col : a.row - b.row,
  );
}

function clampOrderStepCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_MAP_TYPE_ORDER_STEPS, Math.floor(n)));
}

function collectOrderCellsFromLegacy(rawCells: unknown): Array<{ row: number; col: number }> {
  const list = Array.isArray(rawCells) ? rawCells : [];
  const out: Array<{ row: number; col: number }> = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.mark !== "dag_hint" && o.mark !== "order") continue;
    const row = clampGridCoord(o.row, MAP_TYPE_GRID.minRow, MAP_TYPE_GRID.maxRow);
    const col = clampGridCoord(o.col, MAP_TYPE_GRID.minCol, MAP_TYPE_GRID.maxCol);
    if (row === null || col === null) continue;
    const key = cellKey(row, col);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ row, col });
  }
  return out;
}

export function normalizeMapTypeOrderSteps(
  raw: unknown,
  count: number,
  legacyCells?: unknown,
): MapTypeOrderStep[] {
  const n = clampOrderStepCount(count);
  const list = Array.isArray(raw) ? raw : [];
  const byStep = new Map<number, Array<{ row: number; col: number }>>();
  for (let step = 1; step <= n; step += 1) byStep.set(step, []);
  const claimed = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const step = clampOrderStepCount(o.step);
    if (step < 1 || step > n) continue;
    const cellsRaw = Array.isArray(o.cells) ? o.cells : [];
    const cells: Array<{ row: number; col: number }> = [];
    for (const cell of cellsRaw) {
      if (!cell || typeof cell !== "object") continue;
      const c = cell as Record<string, unknown>;
      const row = clampGridCoord(c.row, MAP_TYPE_GRID.minRow, MAP_TYPE_GRID.maxRow);
      const col = clampGridCoord(c.col, MAP_TYPE_GRID.minCol, MAP_TYPE_GRID.maxCol);
      if (row === null || col === null) continue;
      const key = cellKey(row, col);
      if (claimed.has(key)) continue;
      claimed.add(key);
      cells.push({ row, col });
    }
    byStep.set(step, cells);
  }
  if (n >= 1) {
    const legacy = collectOrderCellsFromLegacy(legacyCells);
    const step1 = byStep.get(1) || [];
    for (const cell of legacy) {
      const key = cellKey(cell.row, cell.col);
      if (claimed.has(key)) continue;
      claimed.add(key);
      step1.push(cell);
    }
    byStep.set(1, step1);
  }
  return [...byStep.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, cells]) => ({ step, cells }));
}

export function occupancyAt(
  cells: readonly MapTypeCell[],
  row: number,
  col: number,
): MapTypeCellMark | null {
  return cells.find((c) => c.row === row && c.col === col)?.mark ?? null;
}

export function orderStepAt(
  orderSteps: readonly MapTypeOrderStep[],
  row: number,
  col: number,
): number | null {
  for (const area of orderSteps) {
    if (area.cells.some((c) => c.row === row && c.col === col)) return area.step;
  }
  return null;
}

export function setMapTypeOrderStepCount(
  record: WorkspaceMapTypeRecord,
  count: unknown,
): WorkspaceMapTypeRecord {
  const orderStepCount = clampOrderStepCount(count);
  return {
    ...record,
    orderStepCount,
    orderSteps: normalizeMapTypeOrderSteps(record.orderSteps, orderStepCount),
  };
}

/** Apply a paint tool to one cell. Clear always erases occupancy and order. */
export function applyMapTypePaint(
  record: WorkspaceMapTypeRecord,
  row: number,
  col: number,
  tool: MapTypePaintTool,
): WorkspaceMapTypeRecord {
  const r = clampGridCoord(row, MAP_TYPE_GRID.minRow, MAP_TYPE_GRID.maxRow);
  const c = clampGridCoord(col, MAP_TYPE_GRID.minCol, MAP_TYPE_GRID.maxCol);
  if (r === null || c === null) return record;
  const orderStepCount = clampOrderStepCount(record.orderStepCount);
  let cells = normalizeMapTypeCells(record.cells);
  let orderSteps = normalizeMapTypeOrderSteps(
    record.orderSteps,
    orderStepCount,
  );
  const stripOrder = () => {
    orderSteps = orderSteps.map((area) => ({
      ...area,
      cells: area.cells.filter((cell) => !(cell.row === r && cell.col === c)),
    }));
  };
  const setOccupancy = (mark: MapTypeCellMark | null) => {
    cells = cells.filter((cell) => !(cell.row === r && cell.col === c));
    if (mark) cells.push({ row: r, col: c, mark });
    cells = normalizeMapTypeCells(cells);
  };

  if (tool.kind === "clear") {
    setOccupancy(null);
    stripOrder();
  } else if (tool.kind === "spawn") {
    setOccupancy("spawn");
  } else if (tool.kind === "blocked") {
    setOccupancy("blocked");
    stripOrder();
  } else if (tool.kind === "order") {
    const step = clampOrderStepCount(tool.step);
    if (step < 1 || step > orderStepCount) return record;
    if (occupancyAt(cells, r, c) === "blocked") setOccupancy(null);
    stripOrder();
    orderSteps = orderSteps.map((area) =>
      area.step === step
        ? { ...area, cells: [...area.cells, { row: r, col: c }] }
        : area,
    );
    orderSteps = normalizeMapTypeOrderSteps(orderSteps, orderStepCount);
  }
  return { ...record, cells, orderStepCount, orderSteps };
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
  return {
    selectedLibraryIds: [...DEFAULT_SELECTED_LIBRARY_IDS],
    disabledBuiltinIds: [],
    importedLibraryIds: [],
    customTypes: [],
  };
}

function orderSelectedLibraryIds(ids: readonly string[]): string[] {
  const uniq = uniqIds(ids).filter((id) => isMapTypeLibraryId(id));
  const cores = DEFAULT_SELECTED_LIBRARY_IDS.filter((id) => uniq.includes(id));
  const rest = uniq.filter((id) => !isInitialChaptersLevel(id));
  return [...cores, ...rest];
}

function migrateSelectedLibraryIds(o: Record<string, unknown>): string[] {
  const selectedRaw = Array.isArray(o.selectedLibraryIds)
    ? o.selectedLibraryIds
    : Array.isArray(o.selected_library_ids)
      ? o.selected_library_ids
      : null;
  if (selectedRaw) {
    return orderSelectedLibraryIds(selectedRaw);
  }
  const disabledRaw = Array.isArray(o.disabledBuiltinIds)
    ? o.disabledBuiltinIds
    : Array.isArray(o.disabled_builtin_ids)
      ? o.disabled_builtin_ids
      : [];
  const disabled = new Set<string>(
    uniqIds(disabledRaw).filter((id) => isInitialChaptersLevel(id)),
  );
  const importedRaw = Array.isArray(o.importedLibraryIds)
    ? o.importedLibraryIds
    : Array.isArray(o.imported_library_ids)
      ? o.imported_library_ids
      : [];
  const imported = uniqIds(importedRaw).filter((id) => isMapTypeLibraryId(id));
  const cores = DEFAULT_SELECTED_LIBRARY_IDS.filter((id) => !disabled.has(id));
  return orderSelectedLibraryIds([...cores, ...imported]);
}

function derivedDisabledBuiltinIds(selected: readonly string[]): string[] {
  return DEFAULT_SELECTED_LIBRARY_IDS.filter((id) => !selected.includes(id));
}

function derivedImportedLibraryIds(selected: readonly string[]): string[] {
  return selected.filter((id) => !isInitialChaptersLevel(id));
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
    orderStepCount: 0,
    orderSteps: [],
    layoutInstruction: option.layoutInstruction.trim(),
    band: {
      min: option.band.min,
      max: option.band.max,
      target: option.band.target,
      audience: option.band.audience,
    },
    topologyMode: option.kind === "random" ? "scatter" : "shaped",
    titleKey: option.titleKey,
    descKey: option.descKey,
  };
}

export function mapTypeRecordFromLibrary(
  entry: MapTypeLibraryEntry,
  enabled = true,
): WorkspaceMapTypeRecord {
  const blockedKeys = new Set(entry.blocked.map((c) => cellKey(c.row, c.col)));
  const cells: MapTypeCell[] = [
    ...entry.blocked.map((c) => ({ row: c.row, col: c.col, mark: "blocked" as const })),
    ...entry.occupied
      .filter((c) => !blockedKeys.has(cellKey(c.row, c.col)))
      .map((c) => ({ row: c.row, col: c.col, mark: "spawn" as const })),
  ];
  const isCore = isInitialChaptersLevel(entry.id);
  return {
    id: entry.id,
    label: entry.label,
    description: isCore
      ? entry.description
      : [entry.description, entry.playRule].filter(Boolean).join(" "),
    source: isCore ? "builtin" : "library",
    enabled,
    cells: normalizeMapTypeCells(cells),
    dagHintIds: [],
    orderStepCount: 0,
    orderSteps: [],
    layoutInstruction: isCore
      ? entry.layoutInstruction.trim()
      : [
          entry.layoutInstruction,
          entry.playRule ? `PLAY RULE: ${entry.playRule}` : "",
          entry.useWhen ? `USE WHEN: ${entry.useWhen}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
    band: entry.band
      ? { ...entry.band }
      : { ...DEFAULT_CUSTOM_BAND, audience: entry.useWhen || DEFAULT_CUSTOM_BAND.audience },
    topologyMode: entry.topologyMode === "scatter" ? "scatter" : "shaped",
    titleKey: entry.titleKey,
    descKey: entry.descKey,
    libraryId: entry.id,
    authorUsername: entry.authorUsername,
    category: entry.category,
  };
}

export function mapTypeRecordFromLibraryId(
  id: unknown,
  enabled = true,
): WorkspaceMapTypeRecord | null {
  const raw = cleanId(id);
  if (!isMapTypeLibraryId(raw)) return null;
  if (isInitialChaptersLevel(raw)) {
    return mapTypeRecordFromBuiltin(raw, enabled);
  }
  const entry = MAP_TYPE_LIBRARY_BY_ID[raw];
  return entry ? mapTypeRecordFromLibrary(entry, enabled) : null;
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
    orderStepCount: 0,
    orderSteps: [],
    layoutInstruction: "",
    band: { ...DEFAULT_CUSTOM_BAND },
    topologyMode: "shaped",
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
  const orderStepCount = clampOrderStepCount(
    o.orderStepCount ?? o.order_step_count,
  );
  const cells = normalizeMapTypeCells(o.cells);
  return {
    id,
    label,
    description:
      description || "Custom chapter-map layout for this workspace.",
    source: "custom",
    enabled,
    cells,
    dagHintIds: uniqIds(Array.isArray(o.dagHintIds) ? o.dagHintIds : []),
    orderStepCount,
    orderSteps: normalizeMapTypeOrderSteps(
      o.orderSteps ?? o.order_steps,
      orderStepCount,
      o.cells,
    ),
    layoutInstruction: String(o.layoutInstruction || "").trim(),
    band: normalizeBand(o.band, DEFAULT_CUSTOM_BAND),
    topologyMode: o.topologyMode === "scatter" ? "scatter" : "shaped",
    libraryId: typeof o.libraryId === "string" ? o.libraryId : undefined,
    authorUsername:
      typeof o.authorUsername === "string" ? o.authorUsername : null,
    category: typeof o.category === "string" ? o.category : undefined,
  };
}

/** Normalize jsonb / API payload into selected library ids + custom records. */
export function normalizeWorkspaceMapTypes(raw: unknown): WorkspaceMapTypesState {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const selectedLibraryIds = migrateSelectedLibraryIds(o);
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
  return {
    selectedLibraryIds,
    disabledBuiltinIds: derivedDisabledBuiltinIds(selectedLibraryIds),
    importedLibraryIds: derivedImportedLibraryIds(selectedLibraryIds),
    customTypes,
  };
}

export function serializeWorkspaceMapTypes(
  state: unknown,
): WorkspaceMapTypesState {
  const normalized = normalizeWorkspaceMapTypes(state);
  return {
    selectedLibraryIds:
      normalized.selectedLibraryIds || [...DEFAULT_SELECTED_LIBRARY_IDS],
    disabledBuiltinIds: normalized.disabledBuiltinIds,
    importedLibraryIds: normalized.importedLibraryIds,
    customTypes: normalized.customTypes.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      source: "custom" as const,
      enabled: t.enabled,
      cells: t.cells,
      dagHintIds: t.dagHintIds,
      orderStepCount: t.orderStepCount,
      orderSteps: t.orderSteps,
      layoutInstruction: t.layoutInstruction,
      band: t.band,
      libraryId: t.libraryId,
      authorUsername: t.authorUsername,
      category: t.category,
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
  return enabled
    ? importLibraryMapType(state, id)
    : removeLibraryMapType(state, id);
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
  return {
    ...current,
    customTypes,
  };
}

export function removeCustomMapType(
  state: WorkspaceMapTypesState,
  id: unknown,
): WorkspaceMapTypesState {
  const current = normalizeWorkspaceMapTypes(state);
  const target = cleanId(id);
  return {
    ...current,
    customTypes: current.customTypes.filter((t) => t.id !== target),
  };
}

export function importLibraryMapType(
  state: WorkspaceMapTypesState,
  libraryId: unknown,
): WorkspaceMapTypesState {
  const current = normalizeWorkspaceMapTypes(state);
  const id = cleanId(libraryId);
  if (!isMapTypeLibraryId(id)) return current;
  const currentSelected = current.selectedLibraryIds || [];
  if (currentSelected.includes(id)) return current;
  const selectedLibraryIds = orderSelectedLibraryIds([...currentSelected, id]);
  return {
    ...current,
    selectedLibraryIds,
    disabledBuiltinIds: derivedDisabledBuiltinIds(selectedLibraryIds),
    importedLibraryIds: derivedImportedLibraryIds(selectedLibraryIds),
  };
}

export function removeLibraryMapType(
  state: WorkspaceMapTypesState,
  libraryId: unknown,
): WorkspaceMapTypesState {
  const current = normalizeWorkspaceMapTypes(state);
  const id = cleanId(libraryId);
  const selectedLibraryIds = (current.selectedLibraryIds || []).filter(
    (x) => x !== id,
  );
  return {
    ...current,
    selectedLibraryIds,
    disabledBuiltinIds: derivedDisabledBuiltinIds(selectedLibraryIds),
    importedLibraryIds: derivedImportedLibraryIds(selectedLibraryIds),
  };
}

export function workspaceHasLibraryMapType(
  state: WorkspaceMapTypesState,
  libraryId: unknown,
): boolean {
  const current = normalizeWorkspaceMapTypes(state);
  const id = cleanId(libraryId);
  if ((current.selectedLibraryIds || []).includes(id)) return true;
  return current.customTypes.some(
    (t) => t.libraryId === id || t.id === id,
  );
}

export function recordFromLibraryListing(item: {
  id?: string;
  slug?: string;
  label?: string;
  description?: string;
  occupied?: Array<{ row: number; col: number }>;
  blocked?: Array<{ row: number; col: number }>;
  payload?: unknown;
  authorUsername?: string | null;
  playRule?: string;
  useWhen?: string;
  category?: string;
}): WorkspaceMapTypeRecord {
  const fromPayload = normalizeCustomMapTypeRecord({
    ...(item.payload && typeof item.payload === "object" ? item.payload : {}),
    id: newCustomMapTypeId(item.slug || item.id || "pub"),
    label: item.label,
    description: item.description,
    authorUsername: item.authorUsername,
    category: item.category || "community",
    libraryId: item.slug || item.id,
  });
  if (fromPayload && (fromPayload.cells.length > 0 || item.payload)) {
    return {
      ...fromPayload,
      authorUsername: item.authorUsername ?? fromPayload.authorUsername,
      libraryId: String(item.slug || item.id || fromPayload.libraryId || ""),
    };
  }
  const occupied = Array.isArray(item.occupied) ? item.occupied : [];
  const blocked = Array.isArray(item.blocked) ? item.blocked : [];
  const blockedKeys = new Set(blocked.map((c) => cellKey(c.row, c.col)));
  const cells: MapTypeCell[] = [
    ...blocked.map((c) => ({ row: c.row, col: c.col, mark: "blocked" as const })),
    ...occupied
      .filter((c) => !blockedKeys.has(cellKey(c.row, c.col)))
      .map((c) => ({ row: c.row, col: c.col, mark: "spawn" as const })),
  ];
  return {
    ...blankCustomMapType({
      id: newCustomMapTypeId(item.slug || item.id || "pub"),
      label: item.label || "Library map",
    }),
    description: item.description || "",
    cells: normalizeMapTypeCells(cells),
    layoutInstruction: item.playRule || "",
    authorUsername: item.authorUsername ?? null,
    libraryId: String(item.slug || item.id || ""),
    category: item.category || "community",
  };
}

function librarySelected(
  state: WorkspaceMapTypesState,
  id: string,
): boolean {
  return (state.selectedLibraryIds || []).includes(id);
}

/**
 * Picker catalog: selected official library types (core defaults + extras)
 * plus enabled custom types. If that would be empty, fall back to islands.
 */
export function resolveWorkspaceMapTypeCatalog(
  state?: WorkspaceMapTypesState | null,
): WorkspaceMapTypeRecord[] {
  const normalized = normalizeWorkspaceMapTypes(state ?? emptyWorkspaceMapTypesState());
  const selected = (normalized.selectedLibraryIds || [])
    .map((id) => mapTypeRecordFromLibraryId(id, true))
    .filter((r): r is WorkspaceMapTypeRecord => Boolean(r));
  const customs = normalized.customTypes.filter((t) => t.enabled);
  const catalog = [...selected, ...customs];
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
      librarySelected(normalized, canonical),
    );
  }
  const custom = normalized.customTypes.find((t) => t.id === raw);
  if (custom) return custom;
  if (isMapTypeLibraryId(raw) && librarySelected(normalized, raw)) {
    return mapTypeRecordFromLibraryId(raw, true);
  }
  return null;
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

export function chebyshevDist(
  a: { row: number; col: number },
  b: { row: number; col: number },
): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

export function mapTypeUsesShapedTopology(
  record: Pick<WorkspaceMapTypeRecord, "topologyMode" | "source" | "cells">,
): boolean {
  if (record.topologyMode === "scatter") return false;
  return cellsWithMark(record, "spawn").length > 0;
}

export function schematicStartCell(
  spawn: Array<{ row: number; col: number }>,
): { row: number; col: number } {
  if (spawn.length === 0) return { row: 0, col: 0 };
  const origin = spawn.find((c) => c.row === 0 && c.col === 0);
  if (origin) return origin;
  const cr = spawn.reduce((s, c) => s + c.row, 0) / spawn.length;
  const cc = spawn.reduce((s, c) => s + c.col, 0) / spawn.length;
  let best = spawn[0]!;
  let bestD = Infinity;
  for (const cell of spawn) {
    const d = (cell.row - cr) ** 2 + (cell.col - cc) ** 2;
    if (d < bestD) {
      bestD = d;
      best = cell;
    }
  }
  return best;
}

export function mapTypeSkeletonFrame(
  record: Pick<WorkspaceMapTypeRecord, "cells" | "orderSteps">,
  pad = 2,
): { minRow: number; maxRow: number; minCol: number; maxCol: number } | null {
  const skeleton = [
    ...cellsWithMark(record, "spawn"),
    ...cellsWithMark(record, "blocked"),
    ...(record.orderSteps || []).flatMap((s) => s.cells),
  ];
  if (skeleton.length === 0) return null;
  let minRow = skeleton[0]!.row;
  let maxRow = skeleton[0]!.row;
  let minCol = skeleton[0]!.col;
  let maxCol = skeleton[0]!.col;
  for (const cell of skeleton) {
    if (cell.row < minRow) minRow = cell.row;
    if (cell.row > maxRow) maxRow = cell.row;
    if (cell.col < minCol) minCol = cell.col;
    if (cell.col > maxCol) maxCol = cell.col;
  }
  return {
    minRow: minRow - pad,
    maxRow: maxRow + pad,
    minCol: minCol - pad,
    maxCol: maxCol + pad,
  };
}

export type MapTypeResemblance = {
  total: number;
  nearSkeleton: number;
  /** 0–1 fraction of generated cells within Chebyshev 1 of a spawn cell. */
  score: number;
};

/** How closely generated occupancy matches the painted spawn skeleton. */
export function mapTypeTopologyResemblance(
  generated: Array<{ row: number; col: number }>,
  record: Pick<WorkspaceMapTypeRecord, "cells">,
): MapTypeResemblance {
  const spawn = cellsWithMark(record, "spawn");
  const points = generated.filter(
    (c) => Number.isFinite(c.row) && Number.isFinite(c.col),
  );
  if (points.length === 0) return { total: 0, nearSkeleton: 0, score: 0 };
  if (spawn.length === 0) return { total: points.length, nearSkeleton: 0, score: 0 };
  let near = 0;
  for (const p of points) {
    if (spawn.some((s) => chebyshevDist(p, s) <= 1)) near += 1;
  }
  return {
    total: points.length,
    nearSkeleton: near,
    score: near / points.length,
  };
}

type GridPos = { position_x?: number | null; position_y?: number | null };

/**
 * Pull far-away generated tiles back into the schematic frame (pad 2 around
 * spawn/blocked). Does not snap onto spawn cells 1:1 — only stops distant scatter.
 */
export function clampPositionsToMapTypeFrame<T extends GridPos>(
  items: readonly T[],
  record: WorkspaceMapTypeRecord,
): T[] {
  if (!mapTypeUsesShapedTopology(record)) return [...items];
  const frame = mapTypeSkeletonFrame(record, 2);
  const spawn = cellsWithMark(record, "spawn");
  const blocked = cellsWithMark(record, "blocked");
  if (!frame || spawn.length === 0) return [...items];
  const occupied = new Set<string>();
  const next = items.map((item) => ({ ...item }));
  for (let i = 0; i < next.length; i += 1) {
    const item = next[i];
    if (typeof item.position_x !== "number" || typeof item.position_y !== "number") {
      continue;
    }
    let col = Math.min(frame.maxCol, Math.max(frame.minCol, item.position_x));
    let row = Math.min(frame.maxRow, Math.max(frame.minRow, item.position_y));
    const key = getCellKey(row, col);
    const blockedHit = blocked.some((b) => b.row === row && b.col === col);
    if (occupied.has(key) || blockedHit) {
      const free = nextFreeChapterCell({
        occupied,
        blocked,
        from: { row, col },
      });
      row = Math.min(frame.maxRow, Math.max(frame.minRow, free.row));
      col = Math.min(frame.maxCol, Math.max(frame.minCol, free.col));
    }
    next[i] = { ...item, position_x: col, position_y: row };
    occupied.add(getCellKey(row, col));
  }
  return next;
}

export const MAP_TYPE_SHAPED_SPATIAL_RULES = `MAP TYPE TOPOLOGY (critical — this SUPERSEDES generic four-quadrant scatter / "start at (0,0)" rules when they conflict):
- Follow the painted skeleton of this map type. The generated occupancy must be recognizable as this shape (~80% resemblance): hub stays a hub, islands stay clusters, a ring stays a ring.
- Use the schematic coordinates as given (do not translate the whole pattern so the hub sits at the origin unless the schematic hub IS the origin).
- At least 80% of chapters MUST occupy a SPAWN cell or a cell within Chebyshev distance 1 of a SPAWN cell.
- No chapter may sit more than Chebyshev distance 2 from the nearest SPAWN cell. Do not send arms into distant quadrants or large negative coordinates.
- Stay inside the schematic bounding box expanded by 1 cell.
- Unique integer (position_x, position_y). Never two chapters on the same cell.
- Adjacent cells (Chebyshev 1) should be related or natural progressions.
- Branching is allowed only along the skeleton (spokes of a hub, rungs of a ladder, island clusters, ring arcs).`;

/**
 * Single generator-context formatter for built-in and custom map types.
 * Spawn / no-spawn / blocked / DAG-hint text is topology context, not a
 * tile-for-tile template. Used by session-plan create.
 */
export function formatMapTypeGeneratorContext(
  record: WorkspaceMapTypeRecord,
): MapTypeGeneratorContext {
  const spawn = cellsWithMark(record, "spawn");
  const blocked = cellsWithMark(record, "blocked");
  const orderSteps = normalizeMapTypeOrderSteps(
    record.orderSteps,
    record.orderStepCount ?? 0,
  );
  const layoutInstruction = String(record.layoutInstruction || "").trim();
  const shaped = mapTypeUsesShapedTopology(record);
  const start = schematicStartCell(spawn);
  const frame = mapTypeSkeletonFrame(record, 1);
  const topologyInstruction = shaped
    ? [
        `TOPOLOGY FIDELITY (~80% resemblance, not a 1:1 copy): the generated map MUST look like "${record.label}".`,
        `FOUNDATION CELL: place the start / foundation chapter at (position_x=${start.col}, position_y=${start.row}). Do not use (0, 0) unless that is this cell.`,
        frame
          ? `KEEP INSIDE FRAME: all chapters must stay within position_x=${frame.minCol}..${frame.maxCol}, position_y=${frame.minRow}..${frame.maxRow}.`
          : "",
        "Do not scatter far from the skeleton even if generic spatial rules mention four quadrants or negative coordinates.",
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const spawnInstruction =
    spawn.length > 0
      ? shaped
        ? `SPAWN SKELETON (intended occupancy — place ~80% of chapters on or Chebyshev-adjacent to these cells): ${formatCellList(spawn)}.`
        : `SPAWN CELLS (preferred chapter locations — hints, not a 1:1 template): ${formatCellList(spawn)}.`
      : "";
  const noSpawnInstruction = "";
  const blockedInstruction =
    blocked.length > 0
      ? `BLOCKED CHAPTER SLOTS (non-placeable ground): do not place any chapter or block on these cells: ${formatCellList(blocked)}. Persist them as blocked/unusable so corridors stay empty for later bridges.`
      : "";
  const paintedOrder = orderSteps.filter((s) => s.cells.length > 0);
  const orderInstruction =
    paintedOrder.length > 0
      ? [
          "ORDER STEPS (recommended DAG / practice sequence — loose follow, not a 1:1 copy):",
          "Earlier numbered areas should generally precede later ones. Chapters in area k should lock until work in area k-1 is done when they sit downstream.",
          "Emit lock_until_orders (prerequisite chapter `order` numbers) and next_orders on each chapter so the map has DAG-like requirements.",
          ...paintedOrder.map(
            (s) => `Area ${s.step}: ${formatCellList(s.cells)}.`,
          ),
        ].join(" ")
      : "";
  const dagHintInstruction = orderInstruction;
  const spatialInstruction = shaped
    ? MAP_TYPE_SHAPED_SPATIAL_RULES
    : SPATIAL_MAP_LAYOUT_RULES;
  const countInstruction = [
    `Generate about ${record.band.target} initial chapters/blocks (acceptable range ${record.band.min}-${record.band.max}). Initial chapters level is "${record.id}" — ${record.label} (${record.band.audience}).`,
    layoutInstruction,
    topologyInstruction,
    spawnInstruction,
    noSpawnInstruction,
    blockedInstruction,
    orderInstruction,
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
    orderInstruction,
    topologyInstruction,
    spatialInstruction,
    countInstruction,
  };
}

export function mapTypeCellsToMiniMap(
  record: Pick<WorkspaceMapTypeRecord, "cells">,
): MiniMapCell[] {
  return record.cells.map((cell) => ({
    row: cell.row,
    col: cell.col,
    kind: cell.mark === "blocked" ? "blocked" : "occupied",
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
