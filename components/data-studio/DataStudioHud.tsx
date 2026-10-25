"use client";

import { StudioMultiSelect } from "@/components/data-studio/StudioMultiSelect";
import type { DataStudioView } from "@/lib/data-studio-explainer";
import {
  DATA_STUDIO_SPACE_OPTIONS,
  parseDataStudioSpace,
  STUDIO_IN_REGION_FILL,
  STUDIO_OUT_REGION_FILL,
  studioHiddenRegionIdsFromVisible,
  type DataStudioSpace,
  type StudioSelectOption,
} from "@/lib/data-studio-view";
import {
  PROJECTION_ALGORITHM_OPTIONS,
  parseProjectionAlgorithmId,
  type ProjectionAlgorithmId,
} from "@/lib/knowledge-config";

const SELECT_CLASS =
  "w-full min-w-0 max-w-full rounded-none border border-white/20 bg-black px-2 py-1 font-mono text-[11px] text-white outline-none focus:border-white/60";

export function DataStudioHud({
  productLabel,
  space,
  onSpaceChange,
  algorithm,
  onAlgorithmChange,
  showFlowFilters,
  flowOptions,
  flowIds,
  onFlowIdsChange,
  runOptions,
  runIds,
  onRunIdsChange,
  mapId,
  onMapIdChange,
  maps,
  spaceRegions,
  regionOptions,
  visibleRegionIds,
  regionIds,
  onHiddenRegionIdsChange,
  onToggleRegion,
  view,
  colorMembership,
  hiddenRegionIds,
  filteredCount,
  cameraScale,
  cursor,
  onResetCamera,
  showDistances,
  onToggleDistances,
  onToggleMembership,
  onToggleHelp,
}: {
  productLabel: string;
  space: DataStudioSpace;
  onSpaceChange: (space: DataStudioSpace) => void;
  algorithm: ProjectionAlgorithmId;
  onAlgorithmChange: (algorithm: ProjectionAlgorithmId) => void;
  showFlowFilters: boolean;
  flowOptions: readonly StudioSelectOption[];
  flowIds: readonly string[];
  onFlowIdsChange: (ids: string[]) => void;
  runOptions: readonly StudioSelectOption[];
  runIds: readonly string[];
  onRunIdsChange: (ids: string[]) => void;
  mapId: string;
  onMapIdChange: (id: string) => void;
  maps: readonly { id: string; title: string }[];
  spaceRegions: readonly { id: string; name: string }[];
  regionOptions: readonly StudioSelectOption[];
  visibleRegionIds: readonly string[];
  regionIds: readonly string[];
  onHiddenRegionIdsChange: (ids: string[]) => void;
  onToggleRegion: (id: string) => void;
  view: DataStudioView;
  colorMembership: boolean;
  hiddenRegionIds: readonly string[];
  filteredCount: number;
  cameraScale: number;
  cursor: { x: number; y: number } | null;
  onResetCamera: () => void;
  showDistances: boolean;
  onToggleDistances: () => void;
  onToggleMembership: () => void;
  onToggleHelp: () => void;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] flex flex-col justify-between gap-2 p-3"
      data-data-studio-hud
    >
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <header
          className="pointer-events-auto min-w-0 flex-1 basis-[16rem] border border-white/15 bg-black/75 px-2 py-1.5"
          data-data-studio-toolbar
        >
          <div className="mb-1.5 flex min-w-0 items-baseline gap-2">
            <p className="truncate text-xs font-medium uppercase tracking-[0.16em] text-white">
              Data Studio
            </p>
            <span className="truncate text-[11px] text-neutral-500">{productLabel}</span>
          </div>
          <div
            className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-x-2 gap-y-1.5"
            data-data-studio-toolbar-grid
          >
            <label className="flex min-w-0 flex-col gap-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
              Space
              <select
                className={SELECT_CLASS}
                value={space}
                onChange={(event) => onSpaceChange(parseDataStudioSpace(event.target.value))}
                data-data-studio-space-select
              >
                {DATA_STUDIO_SPACE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
              Projection
              <select
                className={SELECT_CLASS}
                value={algorithm}
                onChange={(event) =>
                  onAlgorithmChange(parseProjectionAlgorithmId(event.target.value, "pca"))
                }
                data-data-studio-algorithm
                data-projection-algorithm-select
              >
                {PROJECTION_ALGORITHM_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.shortLabel}
                  </option>
                ))}
              </select>
            </label>
            {showFlowFilters ? (
              <>
                <StudioMultiSelect
                  label="Flow"
                  options={flowOptions}
                  selected={flowIds}
                  onChange={onFlowIdsChange}
                  emptyLabel="All together"
                  plural="flows"
                  searchPlaceholder="Search flows"
                  marker="data-data-studio-flow-filter"
                  compact
                />
                <StudioMultiSelect
                  label="Run"
                  options={runOptions}
                  selected={runIds}
                  onChange={onRunIdsChange}
                  emptyLabel="All runs"
                  plural="runs"
                  searchPlaceholder="Search runs"
                  marker="data-data-studio-run-filter"
                  compact
                />
              </>
            ) : (
              <label className="flex min-w-0 flex-col gap-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                Map
                <select
                  className={SELECT_CLASS}
                  value={mapId}
                  onChange={(event) => onMapIdChange(event.target.value)}
                  data-data-studio-map-filter
                >
                  <option value="">All play sessions</option>
                  {maps.map((map) => (
                    <option key={map.id} value={map.id}>
                      {map.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {spaceRegions.length > 0 ? (
              <StudioMultiSelect
                label="Region"
                options={regionOptions}
                selected={visibleRegionIds}
                onChange={(ids) =>
                  onHiddenRegionIdsChange(studioHiddenRegionIdsFromVisible(regionIds, ids))
                }
                emptyLabel="None"
                allLabel="All regions"
                plural="regions"
                searchPlaceholder="Search regions"
                marker="data-data-studio-region-filter"
                compact
              />
            ) : null}
          </div>
        </header>
        {view === "map" && spaceRegions.length > 0 ? (
          <div
            className="pointer-events-auto min-w-0 max-w-full shrink-0 basis-[13.5rem] border border-white/15 bg-black/75 px-2 py-1.5"
            data-data-studio-region-legend
          >
            <p className="mb-1 text-[9px] uppercase tracking-[0.14em] text-neutral-500">
              Regions
            </p>
            {colorMembership ? (
              <div
                className="mb-1.5 space-y-1 text-[10px] text-neutral-400"
                data-data-studio-membership-legend
              >
                <p className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: STUDIO_IN_REGION_FILL }}
                    />
                    in
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: STUDIO_OUT_REGION_FILL }}
                    />
                    out
                  </span>
                  <span className="text-neutral-600">cosine ≥ τ</span>
                </p>
                <p className="text-[9px] leading-snug text-neutral-500">
                  Spread disk = mean ‖builder − centroid‖ of the people who defined
                  the region, flattened to 2D. It is how tight that cohort was. Dashed
                  ring = cosine ≥ τ ball. A bright dot outside the white disk is still
                  in 96-D.
                </p>
              </div>
            ) : null}
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {spaceRegions.map((region) => {
                const visible = !hiddenRegionIds.includes(region.id);
                return (
                  <li key={region.id} className="min-w-0">
                    <label className="flex min-w-0 cursor-pointer items-center gap-1.5 text-[10px] text-white/80">
                      <input
                        type="checkbox"
                        className="accent-white"
                        checked={visible}
                        onChange={() => onToggleRegion(region.id)}
                        data-data-studio-region-toggle={region.id}
                      />
                      <span className={`min-w-0 truncate ${visible ? "text-white" : "text-neutral-500"}`}>
                        {region.name}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
      <div
        className="pointer-events-auto ml-auto flex max-w-full min-w-0 flex-wrap items-center justify-end gap-2 border border-white/15 bg-black/75 px-2 py-1.5 text-[10px] text-neutral-500"
        data-data-studio-status
      >
        <span data-data-studio-count className="text-white/80">
          {filteredCount} embeddings
        </span>
        <span data-data-studio-camera>×{cameraScale.toFixed(2)}</span>
        <span>{cursor ? `${cursor.x.toFixed(0)},${cursor.y.toFixed(0)}` : "—,—"}</span>
        <button
          type="button"
          className="border border-white/25 px-2 py-0.5 text-[10px] text-white/80 hover:border-white/60 hover:text-white"
          onClick={onResetCamera}
          data-data-studio-reset-camera
        >
          Reset
        </button>
        {spaceRegions.length > 0 ? (
          <>
            <button
              type="button"
              className={
                showDistances
                  ? "border border-white/80 bg-white px-2 py-0.5 text-[10px] text-black"
                  : "border border-white/25 px-2 py-0.5 text-[10px] text-white/80 hover:border-white/60 hover:text-white"
              }
              aria-pressed={showDistances}
              onClick={onToggleDistances}
              data-data-studio-distances-toggle
            >
              ‖x−c‖
            </button>
            <button
              type="button"
              className={
                colorMembership
                  ? "border border-white/80 bg-white px-2 py-0.5 text-[10px] text-black"
                  : "border border-white/25 px-2 py-0.5 text-[10px] text-white/80 hover:border-white/60 hover:text-white"
              }
              aria-pressed={colorMembership}
              onClick={onToggleMembership}
              data-data-studio-membership-toggle
            >
              In region
            </button>
          </>
        ) : null}
        <button
          type="button"
          className={
            view === "help"
              ? "border border-white/80 bg-white px-2 py-0.5 text-[10px] text-black"
              : "border border-white/25 px-2 py-0.5 text-[10px] text-white/80 hover:border-white/60 hover:text-white"
          }
          aria-pressed={view === "help"}
          onClick={onToggleHelp}
          data-data-studio-help
        >
          Help
        </button>
      </div>
    </div>
  );
}
