"use client";

import { useCallback, useMemo, useState } from "react";
import {
  MAP_TYPE_GRID,
  blankCustomMapType,
  formatMapTypeGeneratorContext,
  mapTypeRecordFromBuiltin,
  newCustomMapTypeId,
  normalizeWorkspaceMapTypes,
  removeCustomMapType,
  serializeWorkspaceMapTypes,
  setBuiltinMapTypeEnabled,
  setMapTypeCellMark,
  upsertCustomMapType,
  type MapTypeCellMark,
  type WorkspaceMapTypeRecord,
  type WorkspaceMapTypesState,
} from "@/lib/workspace-map-types";
import { INITIAL_CHAPTERS_LEVELS } from "@/lib/initial-chapters";
import type { WorkspaceDagRecord } from "@/lib/workspace-dags";

const MARK_PALETTE: Array<{
  mark: MapTypeCellMark | null;
  labelKey: string;
  fallback: string;
}> = [
  { mark: "spawn", labelKey: "planView.mapTypesSpawn", fallback: "Spawn" },
  { mark: "no_spawn", labelKey: "planView.mapTypesNoSpawn", fallback: "No spawn" },
  { mark: "blocked", labelKey: "planView.mapTypesBlocked", fallback: "Blocked" },
  { mark: "dag_hint", labelKey: "planView.mapTypesDagHint", fallback: "DAG hint" },
  { mark: null, labelKey: "planView.mapTypesClear", fallback: "Clear" },
];

function cellFillClass(mark: MapTypeCellMark | undefined): string {
  if (mark === "spawn") return "bg-neutral-300";
  if (mark === "blocked") {
    return "bg-[repeating-linear-gradient(135deg,rgba(64,64,64,0.95)_0_2px,rgba(24,24,24,0.95)_2px_4px)]";
  }
  if (mark === "no_spawn") return "bg-neutral-950 ring-1 ring-inset ring-rose-900/70";
  if (mark === "dag_hint") return "bg-sky-900/70 ring-1 ring-inset ring-sky-500/50";
  return "bg-neutral-800";
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
  const byKey = new Map(record.cells.map((c) => [`${c.row}:${c.col}`, c.mark]));
  const rows: number[] = [];
  const cols: number[] = [];
  for (let r = MAP_TYPE_GRID.minRow; r <= MAP_TYPE_GRID.maxRow; r += 1) rows.push(r);
  for (let c = MAP_TYPE_GRID.minCol; c <= MAP_TYPE_GRID.maxCol; c += 1) cols.push(c);

  return (
    <div
      data-map-type-grid
      data-map-type-grid-editable={editable ? "true" : "false"}
      className="aspect-square w-full max-w-[18rem]"
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
            const mark = byKey.get(`${row}:${col}`);
            return (
              <button
                key={`${row}:${col}`}
                type="button"
                data-map-type-cell={`${row}:${col}`}
                data-map-type-cell-mark={mark || "empty"}
                disabled={!editable}
                onClick={() => onPaint?.(row, col)}
                className={`min-h-0 min-w-0 rounded-[1px] ${cellFillClass(mark)} ${
                  editable
                    ? "cursor-pointer hover:brightness-125"
                    : "cursor-default"
                } disabled:cursor-default`}
                aria-label={`Row ${row} column ${col}${mark ? ` ${mark}` : ""}`}
              />
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
  workspaceDags = [],
  t,
}: {
  workspaceId: string;
  isOwner: boolean;
  ayclToken?: string | null;
  initialState?: unknown;
  workspaceDags?: readonly WorkspaceDagRecord[];
  t: (key: string) => string;
}) {
  const [state, setState] = useState<WorkspaceMapTypesState>(() =>
    normalizeWorkspaceMapTypes(initialState),
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    INITIAL_CHAPTERS_LEVELS[0] ?? null,
  );
  const [paletteMark, setPaletteMark] = useState<MapTypeCellMark | null>("spawn");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    state.customTypes.find((c) => c.id === selectedId) ||
    null;
  const selectedIsCustom = selected?.source === "custom";

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
    if (!selected || selected.source !== "custom" || !isOwner) return;
    const current = selected.cells.find((c) => c.row === row && c.col === col);
    const nextMark =
      current?.mark === paletteMark ? null : paletteMark;
    const cells = setMapTypeCellMark(selected.cells, row, col, nextMark);
    patchSelected({ cells });
  };

  const toggleDagHint = (dagId: string) => {
    if (!selected || selected.source !== "custom") return;
    const has = selected.dagHintIds.includes(dagId);
    patchSelected({
      dagHintIds: has
        ? selected.dagHintIds.filter((x) => x !== dagId)
        : [...selected.dagHintIds, dagId],
    });
  };

  const previewCtx = selected ? formatMapTypeGeneratorContext(selected) : null;

  return (
    <div
      data-workspace-map-types-panel
      className="flex h-full min-h-0 flex-col gap-4 overflow-hidden"
    >
      <div className="shrink-0">
        <h2 className="text-sm font-medium text-white">
          {t("planView.sectionMapTypes")}
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
          {t("planView.mapTypesIntro")}
        </p>
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
                    {workspaceDags.length > 0 ? (
                      <div data-map-type-dag-hints>
                        <p className="mb-1.5 text-[11px] text-neutral-400">
                          {t("planView.mapTypesDagHints")}
                        </p>
                        <ul className="space-y-1">
                          {workspaceDags.map((dag) => (
                            <li key={dag.id}>
                              <label className="flex items-center gap-2 text-[11px] text-neutral-300">
                                <input
                                  type="checkbox"
                                  data-map-type-dag-hint={dag.id}
                                  checked={selected.dagHintIds.includes(dag.id)}
                                  onChange={() => toggleDagHint(dag.id)}
                                  className="h-3 w-3 rounded-none border-neutral-600 bg-neutral-950"
                                />
                                {dag.title || dag.id}
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
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
                    {MARK_PALETTE.map((item) => (
                      <button
                        key={item.fallback}
                        type="button"
                        data-map-type-palette-mark={item.mark ?? "clear"}
                        onClick={() => setPaletteMark(item.mark)}
                        className={`rounded-none border px-2 py-1 text-[10px] ${
                          paletteMark === item.mark
                            ? "border-neutral-300 bg-neutral-800 text-white"
                            : "border-white/10 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        {t(item.labelKey) || item.fallback}
                      </button>
                    ))}
                  </div>
                ) : null}

                <MapTypeGrid
                  record={selected}
                  editable={Boolean(selectedIsCustom && isOwner)}
                  onPaint={paintCell}
                />

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
    </div>
  );
}
