"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ChapterMiniMap } from "@/components/ChapterMiniMap";
import {
  MAP_TYPE_GRID,
  MAX_MAP_TYPE_ORDER_STEPS,
  applyMapTypePaint,
  blankCustomMapType,
  formatMapTypeGeneratorContext,
  importLibraryMapType,
  mapTypeRecordFromBuiltin,
  mapTypeRecordFromLibrary,
  mapTypeCellsToMiniMap,
  newCustomMapTypeId,
  normalizeWorkspaceMapTypes,
  occupancyAt,
  orderStepAt,
  recordFromLibraryListing,
  removeCustomMapType,
  removeLibraryMapType,
  serializeWorkspaceMapTypes,
  setBuiltinMapTypeEnabled,
  setMapTypeOrderStepCount,
  upsertCustomMapType,
  workspaceHasLibraryMapType,
  type MapTypePaintTool,
  type WorkspaceMapTypeRecord,
  type WorkspaceMapTypesState,
} from "@/lib/workspace-map-types";
import { INITIAL_CHAPTERS_LEVELS } from "@/lib/initial-chapters";
import {
  MAP_TYPE_LIBRARY_CATEGORIES,
  MAP_TYPE_LIBRARY_EXTRAS,
} from "@/lib/map-type-library";
import type { WorkspaceDagRecord } from "@/lib/workspace-dags";

const ORDER_FILL = [
  "bg-sky-700",
  "bg-amber-700",
  "bg-violet-700",
  "bg-emerald-700",
  "bg-rose-700",
  "bg-cyan-700",
  "bg-lime-800",
  "bg-fuchsia-700",
];

function cellFillClass(
  occupancy: "spawn" | "blocked" | null,
  orderStep: number | null,
): string {
  if (occupancy === "blocked") {
    return "bg-[repeating-linear-gradient(135deg,rgba(64,64,64,0.95)_0_2px,rgba(24,24,24,0.95)_2px_4px)]";
  }
  if (occupancy === "spawn" && orderStep) {
    return `${ORDER_FILL[(orderStep - 1) % ORDER_FILL.length]} ring-1 ring-inset ring-neutral-200/80`;
  }
  if (occupancy === "spawn") return "bg-neutral-300";
  if (orderStep) return ORDER_FILL[(orderStep - 1) % ORDER_FILL.length];
  return "bg-neutral-800";
}

function cellFromPoint(
  clientX: number,
  clientY: number,
): { row: number; col: number } | null {
  const el = document.elementFromPoint(clientX, clientY);
  const node = el?.closest("[data-map-type-cell]");
  const raw = node?.getAttribute("data-map-type-cell") || "";
  const [rs, cs] = raw.split(":");
  const row = Number(rs);
  const col = Number(cs);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  return { row, col };
}

function MapTypeGrid({
  record,
  editable,
  onPaint,
}: {
  record: WorkspaceMapTypeRecord;
  editable: boolean;
  onPaint?: (row: number, col: number) => void;
}) {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let r = MAP_TYPE_GRID.minRow; r <= MAP_TYPE_GRID.maxRow; r += 1) rows.push(r);
  for (let c = MAP_TYPE_GRID.minCol; c <= MAP_TYPE_GRID.maxCol; c += 1) cols.push(c);
  const painting = useRef(false);
  const lastPainted = useRef<string | null>(null);

  const paintAt = (row: number, col: number) => {
    if (!editable) return;
    const key = `${row}:${col}`;
    if (lastPainted.current === key) return;
    lastPainted.current = key;
    onPaint?.(row, col);
  };

  return (
    <div
      data-map-type-grid
      data-map-type-grid-editable={editable ? "true" : "false"}
      data-map-type-paint-drag="true"
      className="aspect-square w-full max-w-[18rem] touch-none select-none"
      onPointerDown={(e) => {
        if (!editable) return;
        const cell = cellFromPoint(e.clientX, e.clientY);
        if (!cell) return;
        painting.current = true;
        lastPainted.current = null;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        paintAt(cell.row, cell.col);
      }}
      onPointerMove={(e) => {
        if (!editable || !painting.current) return;
        const cell = cellFromPoint(e.clientX, e.clientY);
        if (!cell) return;
        paintAt(cell.row, cell.col);
      }}
      onPointerUp={() => {
        painting.current = false;
        lastPainted.current = null;
      }}
      onPointerCancel={() => {
        painting.current = false;
        lastPainted.current = null;
      }}
    >
      <div
        className="grid h-full w-full gap-px"
        style={{
          gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))`,
        }}
      >
        {rows.flatMap((row) =>
          cols.map((col) => {
            const occupancy = occupancyAt(record.cells, row, col);
            const orderStep = orderStepAt(record.orderSteps || [], row, col);
            return (
              <div
                key={`${row}:${col}`}
                data-map-type-cell={`${row}:${col}`}
                data-map-type-cell-mark={
                  occupancy || (orderStep ? `order-${orderStep}` : "empty")
                }
                className={`relative min-h-0 min-w-0 rounded-[1px] ${cellFillClass(
                  occupancy,
                  orderStep,
                )} ${editable ? "cursor-crosshair" : "cursor-default"}`}
                aria-label={`Row ${row} column ${col}`}
              >
                {orderStep ? (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-semibold text-white/90">
                    {orderStep}
                  </span>
                ) : null}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

export function WorkspaceMapTypesPanel({
  workspaceId,
  isOwner,
  ayclToken,
  initialState,
  workspaceDags: _workspaceDags = [],
  workspaceTitle,
  t,
}: {
  workspaceId: string;
  isOwner: boolean;
  ayclToken?: string | null;
  initialState?: unknown;
  workspaceDags?: readonly WorkspaceDagRecord[];
  workspaceTitle?: string | null;
  t: (key: string) => string;
}) {
  const [state, setState] = useState<WorkspaceMapTypesState>(() =>
    normalizeWorkspaceMapTypes(initialState),
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    INITIAL_CHAPTERS_LEVELS[0] ?? null,
  );
  const [paletteTool, setPaletteTool] = useState<MapTypePaintTool>({
    kind: "spawn",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulateError, setSimulateError] = useState<string | null>(null);
  const [simulateResult, setSimulateResult] = useState<{
    mapTypeId: string;
    cells: Array<{ row: number; col: number }>;
    percent: number;
  } | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseFilter, setBrowseFilter] = useState<string>("all");
  const [community, setCommunity] = useState<Array<Record<string, unknown>>>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishNote, setPublishNote] = useState<string | null>(null);

  const importedLibrary = useMemo(
    () =>
      (state.importedLibraryIds || [])
        .map((id) => MAP_TYPE_LIBRARY_EXTRAS.find((e) => e.id === id))
        .filter((e): e is (typeof MAP_TYPE_LIBRARY_EXTRAS)[number] => Boolean(e))
        .map((e) => mapTypeRecordFromLibrary(e, true)),
    [state.importedLibraryIds],
  );

  const builtins = useMemo(
    () =>
      INITIAL_CHAPTERS_LEVELS.map((id) =>
        mapTypeRecordFromBuiltin(
          id,
          !state.disabledBuiltinIds.includes(id),
        ),
      ),
    [state.disabledBuiltinIds],
  );
  const selected =
    builtins.find((b) => b.id === selectedId) ||
    importedLibrary.find((b) => b.id === selectedId) ||
    state.customTypes.find((c) => c.id === selectedId) ||
    null;
  const selectedIsCustom = selected?.source === "custom";

  const loadCommunity = useCallback(async () => {
    try {
      const res = await fetch("/api/map-types/library");
      const data = await res.json().catch(() => ({}));
      setCommunity(Array.isArray(data.community) ? data.community : []);
    } catch {
      setCommunity([]);
    }
  }, []);

  const persist = useCallback(
    async (next: WorkspaceMapTypesState) => {
      if (!isOwner) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/workspace/map-types", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            state: serializeWorkspaceMapTypes(next),
            ...(ayclToken ? { ayclToken } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Failed to save map types",
          );
        }
        if (data.state) {
          setState(normalizeWorkspaceMapTypes(data.state));
        } else {
          setState(next);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save map types");
      } finally {
        setSaving(false);
      }
    },
    [ayclToken, isOwner, workspaceId],
  );

  const addLibraryType = (id: string) => {
    const next = importLibraryMapType(state, id);
    setState(next);
    setSelectedId(id);
    void persist(next);
  };

  const dropLibraryType = (id: string) => {
    const next = removeLibraryMapType(state, id);
    setState(next);
    if (selectedId === id) setSelectedId(INITIAL_CHAPTERS_LEVELS[0] ?? null);
    void persist(next);
  };

  const addCommunityType = (item: Record<string, unknown>) => {
    const record = recordFromLibraryListing({
      id: typeof item.id === "string" ? item.id : undefined,
      slug: typeof item.slug === "string" ? item.slug : undefined,
      label: typeof item.label === "string" ? item.label : undefined,
      description:
        typeof item.description === "string" ? item.description : undefined,
      occupied: Array.isArray(item.occupied)
        ? (item.occupied as Array<{ row: number; col: number }>)
        : [],
      blocked: Array.isArray(item.blocked)
        ? (item.blocked as Array<{ row: number; col: number }>)
        : [],
      payload: item.payload,
      authorUsername:
        typeof item.authorUsername === "string" ? item.authorUsername : null,
      playRule: typeof item.playRule === "string" ? item.playRule : undefined,
      category: "community",
    });
    const next = upsertCustomMapType(state, record);
    setState(next);
    setSelectedId(record.id);
    void persist(next);
  };

  const publishSelected = async () => {
    if (!selected || selected.source !== "custom" || publishing) return;
    setPublishing(true);
    setPublishNote(null);
    try {
      const res = await fetch("/api/map-types/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapType: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to publish",
        );
      }
      setPublishNote(
        t("planView.mapTypesPublished") +
          (data.authorUsername ? ` · ${data.authorUsername}` : ""),
      );
      void loadCommunity();
    } catch (err) {
      setPublishNote(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const toggleBuiltin = (id: string, enabled: boolean) => {
    const next = setBuiltinMapTypeEnabled(state, id, enabled);
    setState(next);
    void persist(next);
  };

  const createCustom = () => {
    const record = blankCustomMapType({
      id: newCustomMapTypeId(),
      label: "Custom map",
    });
    const next = upsertCustomMapType(state, record);
    setState(next);
    setSelectedId(record.id);
    void persist(next);
  };

  const patchSelected = (patch: Partial<WorkspaceMapTypeRecord>) => {
    if (!selected || selected.source !== "custom") return;
    const nextRecord = { ...selected, ...patch };
    const next = upsertCustomMapType(state, nextRecord);
    setState(next);
  };

  const saveSelected = () => {
    if (!selected || selected.source !== "custom") return;
    void persist(upsertCustomMapType(state, selected));
  };

  const deleteSelected = (id: string) => {
    const next = removeCustomMapType(state, id);
    setState(next);
    setConfirmDeleteId(null);
    if (selectedId === id) setSelectedId(INITIAL_CHAPTERS_LEVELS[0] ?? null);
    void persist(next);
  };

  const paintCell = (row: number, col: number) => {
    if (!isOwner) return;
    setState((prev) => {
      const current = prev.customTypes.find((c) => c.id === selectedId);
      if (!current) return prev;
      return upsertCustomMapType(
        prev,
        applyMapTypePaint(current, row, col, paletteTool),
      );
    });
  };

  const previewCtx = selected ? formatMapTypeGeneratorContext(selected) : null;

  const runSimulate = async () => {
    if (!selected || simulating) return;
    setSimulating(true);
    setSimulateError(null);
    try {
      const res = await fetch("/api/workspace/map-types/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          mapTypeId: selected.id,
          mapType: selected.source === "custom" ? selected : undefined,
          topic: workspaceTitle || undefined,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : t("planView.mapTypesSimulateError"),
        );
      }
      const generated = Array.isArray(data.generated)
        ? data.generated.filter(
            (c: { row?: number; col?: number }) =>
              typeof c.row === "number" && typeof c.col === "number",
          )
        : [];
      const percent = Math.round(
        Number(data.resemblance?.score ?? 0) * 100,
      );
      setSimulateResult({
        mapTypeId: selected.id,
        cells: generated,
        percent: Number.isFinite(percent) ? percent : 0,
      });
    } catch (err) {
      setSimulateError(
        err instanceof Error ? err.message : t("planView.mapTypesSimulateError"),
      );
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div
      data-workspace-map-types-panel
      className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden"
    >
      <div className="shrink-0">
        <h2 className="text-sm font-medium text-white">
          {t("planView.sectionMapTypes")}
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
          {t("planView.mapTypesIntro")}
        </p>
        {isOwner ? (
          <button
            type="button"
            data-map-type-browse
            onClick={() => {
              setBrowseOpen(true);
              void loadCommunity();
            }}
            className="mt-3 rounded-none border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-neutral-100 hover:bg-white/10"
          >
            {t("planView.mapTypesBrowse")}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="shrink-0 rounded-none border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row">
        <div className="flex min-h-0 w-full shrink-0 flex-col gap-4 overflow-y-auto lg:w-72">
          <section data-map-types-builtins>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              {t("planView.mapTypesBuiltins")}
            </h3>
            <ul className="space-y-1.5" data-map-types-builtin-list>
              {builtins.map((item) => (
                <li key={item.id}>
                  <div
                    className={`flex items-center gap-2 rounded-none border px-2 py-1.5 ${
                      selectedId === item.id
                        ? "border-neutral-500 bg-neutral-900"
                        : "border-white/10 bg-neutral-950/70"
                    }`}
                  >
                    <button
                      type="button"
                      data-map-type-select={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className="min-w-0 flex-1 truncate text-left text-[12px] text-neutral-100"
                    >
                      {item.label}
                    </button>
                    <label className="flex shrink-0 items-center gap-1 text-[10px] text-neutral-400">
                      <input
                        type="checkbox"
                        data-map-type-builtin-enabled={item.id}
                        checked={item.enabled}
                        disabled={!isOwner || saving}
                        onChange={(e) => toggleBuiltin(item.id, e.target.checked)}
                        className="h-3 w-3 rounded-none border-neutral-600 bg-neutral-950"
                      />
                      {t("planView.mapTypesEnabled")}
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {importedLibrary.length > 0 ? (
            <section data-map-types-imported>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                {t("planView.mapTypesBrowseTitle")}
              </h3>
              <ul className="space-y-1.5">
                {importedLibrary.map((item) => (
                  <li key={item.id}>
                    <div
                      className={`flex items-center gap-2 rounded-none border px-2 py-1.5 ${
                        selectedId === item.id
                          ? "border-neutral-500 bg-neutral-900"
                          : "border-white/10 bg-neutral-950/70"
                      }`}
                    >
                      <button
                        type="button"
                        data-map-type-select={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className="min-w-0 flex-1 truncate text-left text-[12px] text-neutral-100"
                      >
                        {item.label}
                      </button>
                      {isOwner ? (
                        <button
                          type="button"
                          data-map-type-library-remove={item.id}
                          onClick={() => dropLibraryType(item.id)}
                          className="text-[10px] text-neutral-500 hover:text-neutral-200"
                        >
                          {t("planView.mapTypesRemove")}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section data-map-types-customs>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
                {t("planView.mapTypesCustom")}
              </h3>
              {isOwner ? (
                <button
                  type="button"
                  data-map-type-create
                  disabled={saving}
                  onClick={createCustom}
                  className="rounded-none border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-medium text-neutral-100 hover:bg-white/10 disabled:opacity-40"
                >
                  {t("planView.mapTypesNew")}
                </button>
              ) : null}
            </div>
            {state.customTypes.length === 0 ? (
              <p
                data-map-types-custom-empty
                className="rounded-none border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-neutral-500"
              >
                {t("planView.mapTypesEmptyCustom")}
              </p>
            ) : (
              <ul className="space-y-1.5" data-map-types-custom-list>
                {state.customTypes.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-map-type-select={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full truncate rounded-none border px-2 py-1.5 text-left text-[12px] ${
                        selectedId === item.id
                          ? "border-neutral-500 bg-neutral-900 text-white"
                          : "border-white/10 bg-neutral-950/70 text-neutral-100"
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div
          data-map-type-editor
          className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-none border border-white/10 bg-neutral-950/60 p-4"
        >
          {!selected ? (
            <p className="text-[12px] text-neutral-500">Select a map type.</p>
          ) : (
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="min-w-0 flex-1 space-y-3">
                {selectedIsCustom && isOwner ? (
                  <>
                    <label className="block text-[11px] text-neutral-400">
                      {t("planView.mapTypesLabel")}
                      <input
                        data-map-type-label
                        value={selected.label}
                        onChange={(e) => patchSelected({ label: e.target.value })}
                        className="mt-1 w-full rounded-none border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-white"
                      />
                    </label>
                    <label className="block text-[11px] text-neutral-400">
                      {t("planView.mapTypesDescription")}
                      <textarea
                        data-map-type-description
                        value={selected.description}
                        onChange={(e) =>
                          patchSelected({ description: e.target.value })
                        }
                        rows={3}
                        className="mt-1 w-full rounded-none border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-white"
                      />
                    </label>
                    <label className="block text-[11px] text-neutral-400">
                      {t("planView.mapTypesLayoutHint")}
                      <textarea
                        data-map-type-layout
                        value={selected.layoutInstruction}
                        onChange={(e) =>
                          patchSelected({ layoutInstruction: e.target.value })
                        }
                        rows={3}
                        className="mt-1 w-full rounded-none border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-white"
                      />
                    </label>
                    <div className="grid grid-cols-3 gap-2" data-map-type-band>
                      {(["min", "max", "target"] as const).map((field) => (
                        <label
                          key={field}
                          className="block text-[11px] text-neutral-400"
                        >
                          {field}
                          <input
                            type="number"
                            data-map-type-band-field={field}
                            value={selected.band[field]}
                            min={1}
                            onChange={(e) =>
                              patchSelected({
                                band: {
                                  ...selected.band,
                                  [field]: Number(e.target.value) || selected.band[field],
                                },
                              })
                            }
                            className="mt-1 w-full rounded-none border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-white"
                          />
                        </label>
                      ))}
                    </div>
                    <label className="block text-[11px] text-neutral-400">
                      {t("planView.mapTypesOrderSteps")}
                      <input
                        type="number"
                        data-map-type-order-count
                        min={0}
                        max={MAX_MAP_TYPE_ORDER_STEPS}
                        value={selected.orderStepCount ?? 0}
                        onChange={(e) => {
                          const next = setMapTypeOrderStepCount(
                            selected,
                            e.target.value,
                          );
                          patchSelected({
                            orderStepCount: next.orderStepCount,
                            orderSteps: next.orderSteps,
                          });
                          if (
                            paletteTool.kind === "order" &&
                            paletteTool.step > next.orderStepCount
                          ) {
                            setPaletteTool({ kind: "spawn" });
                          }
                        }}
                        className="mt-1 w-full rounded-none border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-white"
                      />
                      <span className="mt-1 block text-[10px] leading-snug text-neutral-500">
                        {t("planView.mapTypesOrderStepsHint")}
                      </span>
                    </label>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-white">{selected.label}</p>
                    <p className="text-[12px] leading-relaxed text-neutral-400">
                      {selected.description}
                    </p>
                  </>
                )}

                {selectedIsCustom && isOwner ? (
                  <div
                    data-map-type-palette
                    className="flex flex-wrap gap-1.5"
                  >
                    {(
                      [
                        { kind: "spawn" as const, label: t("planView.mapTypesSpawn") || "Spawn" },
                        { kind: "blocked" as const, label: t("planView.mapTypesBlocked") || "Blocked" },
                        { kind: "clear" as const, label: t("planView.mapTypesClear") || "Clear" },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.kind}
                        type="button"
                        data-map-type-palette-mark={item.kind}
                        onClick={() => setPaletteTool({ kind: item.kind })}
                        className={`rounded-none border px-2 py-1 text-[10px] ${
                          paletteTool.kind === item.kind
                            ? "border-neutral-300 bg-neutral-800 text-white"
                            : "border-white/10 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                    {Array.from(
                      { length: selected.orderStepCount || 0 },
                      (_, i) => i + 1,
                    ).map((step) => (
                      <button
                        key={`order-${step}`}
                        type="button"
                        data-map-type-palette-mark={`order-${step}`}
                        onClick={() => setPaletteTool({ kind: "order", step })}
                        className={`rounded-none border px-2 py-1 text-[10px] ${
                          paletteTool.kind === "order" && paletteTool.step === step
                            ? "border-neutral-300 bg-neutral-800 text-white"
                            : "border-white/10 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        {t("planView.mapTypesOrderStep")} {step}
                      </button>
                    ))}
                  </div>
                ) : null}

                <MapTypeGrid
                  record={selected}
                  editable={Boolean(selectedIsCustom && isOwner)}
                  onPaint={paintCell}
                />

                {isOwner ? (
                  <div className="space-y-2" data-map-type-simulate-block>
                    <button
                      type="button"
                      data-map-type-simulate
                      disabled={simulating}
                      onClick={() => void runSimulate()}
                      className="w-full rounded-none border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-medium text-neutral-100 hover:bg-white/10 disabled:opacity-40"
                    >
                      {simulating
                        ? t("planView.mapTypesSimulating")
                        : t("planView.mapTypesSimulate")}
                    </button>
                    <p className="text-[10px] leading-snug text-neutral-500">
                      {t("planView.mapTypesSimulateHint")}
                    </p>
                    {simulateError ? (
                      <p
                        data-map-type-simulate-error
                        className="text-[11px] text-rose-200"
                      >
                        {simulateError}
                      </p>
                    ) : null}
                    {simulateResult && simulateResult.mapTypeId === selected.id ? (
                      <div
                        data-map-type-simulate-result
                        className="space-y-2 rounded-none border border-white/10 bg-black/30 p-2"
                      >
                        <p className="text-[11px] text-neutral-300">
                          {t("planView.mapTypesResemble").replace(
                            "{percent}",
                            String(simulateResult.percent),
                          )}
                        </p>
                        <div className="mx-auto aspect-square w-full max-w-[14rem]">
                          <ChapterMiniMap
                            cells={simulateResult.cells.map((c) => ({
                              row: c.row,
                              col: c.col,
                              kind: "occupied" as const,
                            }))}
                            dummy
                            density={selected.id}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {selectedIsCustom && isOwner ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      data-map-type-save
                      disabled={saving}
                      onClick={saveSelected}
                      className="flex-1 rounded-none bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-neutral-200 disabled:opacity-40"
                    >
                      {saving ? "Saving…" : t("planView.mapTypesSave")}
                    </button>
                    <button
                      type="button"
                      data-map-type-publish
                      disabled={publishing}
                      onClick={() => void publishSelected()}
                      className="rounded-none border border-white/15 px-3 py-2 text-xs text-neutral-200 hover:bg-white/5 disabled:opacity-40"
                    >
                      {publishing
                        ? t("planView.mapTypesPublishing")
                        : t("planView.mapTypesPublish")}
                    </button>
                    {confirmDeleteId === selected.id ? (
                      <>
                        <button
                          type="button"
                          data-map-type-delete-confirm
                          disabled={saving}
                          onClick={() => deleteSelected(selected.id)}
                          className="rounded-none border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-100"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-none px-3 py-2 text-xs text-neutral-400"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        data-map-type-delete
                        disabled={saving}
                        onClick={() => setConfirmDeleteId(selected.id)}
                        className="rounded-none border border-white/10 px-3 py-2 text-xs text-neutral-400 hover:text-neutral-200"
                      >
                        {t("planView.mapTypesDelete")}
                      </button>
                    )}
                  </div>
                ) : null}
                {publishNote ? (
                  <p className="text-[11px] text-neutral-400">{publishNote}</p>
                ) : null}
              </div>
              {previewCtx ? (
                <pre
                  data-map-type-context-preview
                  className="max-h-64 overflow-auto whitespace-pre-wrap rounded-none border border-white/10 bg-black/40 p-3 text-[10px] leading-relaxed text-neutral-500 lg:max-h-none lg:w-64 lg:shrink-0"
                >
                  {previewCtx.countInstruction}
                </pre>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {browseOpen ? (
        <div
          data-map-type-browser
          className="absolute inset-0 z-20 flex flex-col bg-neutral-950/95 p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-white">
              {t("planView.mapTypesBrowseTitle")}
            </h3>
            <button
              type="button"
              data-map-type-browse-close
              onClick={() => setBrowseOpen(false)}
              className="rounded-none border border-white/15 px-2 py-1 text-[11px] text-neutral-300"
            >
              {t("planView.mapTypesBrowseClose")}
            </button>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setBrowseFilter("all")}
              className={`rounded-none border px-2 py-1 text-[10px] ${
                browseFilter === "all"
                  ? "border-neutral-300 text-white"
                  : "border-white/10 text-neutral-400"
              }`}
            >
              All
            </button>
            {MAP_TYPE_LIBRARY_CATEGORIES.filter((c) => c.id !== "core").map(
              (cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setBrowseFilter(cat.id)}
                  className={`rounded-none border px-2 py-1 text-[10px] ${
                    browseFilter === cat.id
                      ? "border-neutral-300 text-white"
                      : "border-white/10 text-neutral-400"
                  }`}
                >
                  {cat.label}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setBrowseFilter("community")}
              className={`rounded-none border px-2 py-1 text-[10px] ${
                browseFilter === "community"
                  ? "border-neutral-300 text-white"
                  : "border-white/10 text-neutral-400"
              }`}
            >
              Community
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {MAP_TYPE_LIBRARY_EXTRAS.filter(
                (e) =>
                  browseFilter === "all" ||
                  browseFilter === e.category ||
                  browseFilter === e.strength,
              ).map((entry) => {
                const record = mapTypeRecordFromLibrary(entry);
                const inWs = workspaceHasLibraryMapType(state, entry.id);
                return (
                  <li
                    key={entry.id}
                    data-map-type-library-card={entry.id}
                    className="flex flex-col rounded-none border border-white/10 bg-neutral-950 p-3"
                  >
                    <div className="mx-auto aspect-square w-full max-w-[10rem]">
                      <ChapterMiniMap
                        cells={mapTypeCellsToMiniMap(record)}
                        dummy
                        density={entry.id}
                      />
                    </div>
                    <p className="mt-2 text-[12px] font-medium text-white">
                      {entry.label}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                      {entry.categoryLabel} · {entry.strengthLabel}
                    </p>
                    <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-neutral-400">
                      {entry.description}
                    </p>
                    <p className="mt-1 text-[10px] text-neutral-600">
                      {t("planView.mapTypesOfficial")}
                    </p>
                    {inWs ? (
                      <button
                        type="button"
                        data-map-type-library-remove={entry.id}
                        onClick={() => dropLibraryType(entry.id)}
                        className="mt-2 rounded-none border border-white/15 px-2 py-1.5 text-[10px] text-neutral-300"
                      >
                        {t("planView.mapTypesRemove")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-map-type-library-add={entry.id}
                        onClick={() => addLibraryType(entry.id)}
                        className="mt-2 rounded-none bg-white px-2 py-1.5 text-[10px] font-semibold text-black"
                      >
                        {t("planView.mapTypesAdd")}
                      </button>
                    )}
                  </li>
                );
              })}
              {(browseFilter === "all" || browseFilter === "community") &&
                community.map((item) => {
                  const id = String(item.id || item.slug || "");
                  const inWs = workspaceHasLibraryMapType(state, id);
                  const record = recordFromLibraryListing({
                    id,
                    slug: typeof item.slug === "string" ? item.slug : id,
                    label: String(item.label || "Untitled"),
                    description: String(item.description || ""),
                    occupied: Array.isArray(item.occupied)
                      ? (item.occupied as Array<{ row: number; col: number }>)
                      : [],
                    blocked: Array.isArray(item.blocked)
                      ? (item.blocked as Array<{ row: number; col: number }>)
                      : [],
                    payload: item.payload,
                    authorUsername:
                      typeof item.authorUsername === "string"
                        ? item.authorUsername
                        : null,
                  });
                  return (
                    <li
                      key={id}
                      data-map-type-library-card={id}
                      className="flex flex-col rounded-none border border-white/10 bg-neutral-950 p-3"
                    >
                      <div className="mx-auto aspect-square w-full max-w-[10rem]">
                        <ChapterMiniMap
                          cells={mapTypeCellsToMiniMap(record)}
                          dummy
                          density={record.id}
                        />
                      </div>
                      <p className="mt-2 text-[12px] font-medium text-white">
                        {record.label}
                      </p>
                      <p className="text-[10px] text-neutral-500">
                        {t("planView.mapTypesBy").replace(
                          "{name}",
                          String(item.authorUsername || "anonymous"),
                        )}
                      </p>
                      <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-neutral-400">
                        {record.description}
                      </p>
                      {inWs ? (
                        <p className="mt-2 text-[10px] text-neutral-500">
                          {t("planView.mapTypesInWorkspace")}
                        </p>
                      ) : (
                        <button
                          type="button"
                          data-map-type-library-add={id}
                          onClick={() => addCommunityType(item)}
                          className="mt-2 rounded-none bg-white px-2 py-1.5 text-[10px] font-semibold text-black"
                        >
                          {t("planView.mapTypesAdd")}
                        </button>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
