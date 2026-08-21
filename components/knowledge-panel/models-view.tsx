"use client";

import { MapOfKnowledgeGlobal } from "@/components/MapOfKnowledgeGlobal";
import { PROJECTION_ALGORITHM_OPTIONS } from "@/lib/knowledge-config";
import {
  EmbeddingsUserMultiPicker,
  ProjectionSpaceWidget,
  REGION_OVERLAY_COLORS,
  SUBJECT_TRAJECTORY_COLORS,
  subjectOptionKey,
} from "@/components/knowledge-panel/widgets";
import { useKnowledgeEmbeddings } from "@/components/knowledge-panel/use-knowledge-embeddings";
import type { KnowledgeModelsViewProps } from "@/components/knowledge-panel/types";

export function KnowledgeModelsView({
  workspaceId,
  currentUserId = null,
  ayclToken,
  canInspectOthers,
  lockSubjectToSelf,
}: KnowledgeModelsViewProps) {
  const {
    availableSubjects,
    coords,
    embData,
    embError,
    embLoading,
    embScope,
    embSelectedKeys,
    embeddingsFullscreen,
    embeddingsShellRef,
    enterEmbeddingsFullscreen,
    exitEmbeddingsFullscreen,
    globalSelectedRegionId,
    knowledgeGlobalViewMode,
    knowledgeMapScope,
    knowledgeRegions,
    loadEmbeddings,
    loadRegionsForOverlay,
    openLocalMapFocusedOnRegion,
    overlayDistances,
    overlayDistancesLoading,
    parseProjectionAlgorithmId,
    projectionAlgorithm,
    projectionDisplayMode,
    regionOverlays,
    regionPickerExpanded,
    regionsError,
    regionsLoading,
    selectableRegionIds,
    selectedRegionIds,
    setEmbSelectedKeys,
    setGlobalSelectedRegionId,
    setKnowledgeGlobalViewMode,
    setKnowledgeMapScope,
    setProjectionAlgorithm,
    setProjectionDisplayMode,
    setRegionPickerExpanded,
    summary,
    toggleAllWorkspaceRegions,
    toggleRegionOverlay,
    workspaceGlobalMap,
  } = useKnowledgeEmbeddings({
    workspaceId,
    currentUserId,
    ayclToken,
    canInspectOthers,
    lockSubjectToSelf,
  });

  return (
        <div
          ref={embeddingsShellRef}
          data-section="embeddings-projections"
          data-models-section="embeddings-projections"
          data-embeddings-layout="left-canvas-right-regions"
          data-embeddings-fullscreen={embeddingsFullscreen ? "true" : "false"}
          className={
            embeddingsFullscreen
              ? // True browser FS paints this element full viewport; fixed+z-[100] is CSS fallback over navbar
                "fixed inset-0 z-[100] flex h-full min-h-0 w-full flex-col gap-2 bg-neutral-950 p-3"
              : "flex min-h-0 w-full flex-1 flex-col gap-2"
          }
          aria-label="Embeddings Projections"
          role={embeddingsFullscreen ? "dialog" : undefined}
          aria-modal={embeddingsFullscreen ? true : undefined}
        >
          <div className="flex min-h-0 flex-1 gap-3">
            {/* Left: algorithm + tall users list (fills remaining height) + summary */}
            <aside
              data-embeddings-sidebar
              className={`flex min-h-0 shrink-0 flex-col gap-3 overflow-hidden ${
                embeddingsFullscreen ? "w-48 sm:w-52" : "w-52 sm:w-56"
              }`}
            >
              <div className="shrink-0 space-y-3">
                <p className="text-[11px] leading-relaxed text-neutral-500">
                  Trajectory in{" "}
                  <span className="font-mono text-neutral-400">knowledgecfg-v1-d64</span>. Overlay
                  regions on the right.
                </p>

                <div className="w-full" data-projection-algorithm-picker data-map-projection-picker>
                  <label className="block w-full">
                    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                      Projection
                    </span>
                    <select
                      value={projectionAlgorithm}
                      onChange={(e) =>
                        setProjectionAlgorithm(parseProjectionAlgorithmId(e.target.value, "random"))
                      }
                      aria-label="Projection algorithm (2D Local, 3D volume, and Global Map)"
                      data-projection-algorithm-select
                      data-map-3d-projection-select
                      className="w-full rounded-none border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white outline-none transition hover:border-neutral-500 focus:border-neutral-500"
                    >
                      {PROJECTION_ALGORITHM_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id} title={opt.description}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {/* data-picker="embeddings" anchors sidebar layout tests + multiselect control */}
              <div
                data-picker="embeddings"
                className="flex min-h-0 flex-1 flex-col"
              >
                <EmbeddingsUserMultiPicker
                  ariaLabel="Embeddings projections users"
                  selectedKeys={embSelectedKeys}
                  currentUserId={currentUserId}
                  availableSubjects={availableSubjects}
                  canInspectOthers={canInspectOthers}
                  onChange={setEmbSelectedKeys}
                  fillHeight
                />
              </div>

              {summary ? (
                <div className="shrink-0 border-t border-neutral-800/80 pt-3">
                  <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                    <div>
                      <dt className="text-neutral-500">Confidence</dt>
                      <dd className="font-mono text-neutral-200">
                        {(summary.confidence * 100).toFixed(0)}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Path</dt>
                      <dd className="font-mono text-neutral-200">
                        {summary.pathLength.toFixed(3)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Samples</dt>
                      <dd className="font-mono text-neutral-200">{summary.points}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-neutral-500">Model</dt>
                      <dd className="truncate font-mono text-neutral-300">{summary.model}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </aside>

            {/* Center: projection canvas */}
            <div
              data-embeddings-projection
              data-embeddings-projection-surface
              className="flex min-h-0 min-w-0 flex-1 flex-col gap-2"
            >
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <div
                    className="inline-flex rounded-none border border-neutral-700 p-0.5"
                    role="group"
                    aria-label="Knowledge map scope"
                    data-knowledge-map-scope-toggle
                  >
                    <button
                      type="button"
                      onClick={() => setKnowledgeMapScope("local")}
                      className={`rounded-none px-2 py-1 font-mono text-[10px] tracking-wide transition ${
                        knowledgeMapScope === "local"
                          ? "bg-white/10 text-white"
                          : "text-neutral-500 hover:text-neutral-300"
                      }`}
                      data-knowledge-map-scope="local"
                      aria-pressed={knowledgeMapScope === "local"}
                    >
                      Local Map
                    </button>
                    <button
                      type="button"
                      onClick={() => setKnowledgeMapScope("global")}
                      className={`rounded-none px-2 py-1 font-mono text-[10px] tracking-wide transition ${
                        knowledgeMapScope === "global"
                          ? "bg-white/10 text-white"
                          : "text-neutral-500 hover:text-neutral-300"
                      }`}
                      data-knowledge-map-scope="global"
                      aria-pressed={knowledgeMapScope === "global"}
                    >
                      Global Map
                    </button>
                  </div>
                  {knowledgeMapScope === "global" ? (
                    <div
                      className="inline-flex rounded-none border border-neutral-700 p-0.5"
                      role="group"
                      aria-label="Global Map view mode"
                      data-knowledge-global-view-mode-toggle
                      data-map-view-mode-toggle
                    >
                      <button
                        type="button"
                        onClick={() => setKnowledgeGlobalViewMode("2d")}
                        className={`rounded-none px-2 py-1 font-mono text-[10px] tracking-wide transition ${
                          knowledgeGlobalViewMode === "2d"
                            ? "bg-white/10 text-white"
                            : "text-neutral-500 hover:text-neutral-300"
                        }`}
                        data-knowledge-global-view-mode="2d"
                        data-map-view-mode="2d"
                        aria-pressed={knowledgeGlobalViewMode === "2d"}
                      >
                        2D
                      </button>
                      <button
                        type="button"
                        onClick={() => setKnowledgeGlobalViewMode("3d")}
                        className={`rounded-none px-2 py-1 font-mono text-[10px] tracking-wide transition ${
                          knowledgeGlobalViewMode === "3d"
                            ? "bg-white/10 text-white"
                            : "text-neutral-500 hover:text-neutral-300"
                        }`}
                        data-knowledge-global-view-mode="3d"
                        data-map-view-mode="3d"
                        aria-pressed={knowledgeGlobalViewMode === "3d"}
                      >
                        3D
                      </button>
                    </div>
                  ) : null}
                  <p className="min-w-0 truncate text-[11px] text-neutral-500">
                    {knowledgeMapScope === "global" ? (
                      <span className="text-neutral-400">
                        Region graph · dual orbits
                        {knowledgeGlobalViewMode === "3d" ? " · 3D" : " · 2D"}
                      </span>
                    ) : embScope.label ? (
                      <span className="text-neutral-400">{embScope.label}</span>
                    ) : (
                      <span>Knowledge config trajectory</span>
                    )}
                    {summary && knowledgeMapScope === "local" ? (
                      <span className="text-neutral-600">
                        {" "}
                        · {summary.points} sample{summary.points === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      void (
                        embeddingsFullscreen
                          ? exitEmbeddingsFullscreen()
                          : enterEmbeddingsFullscreen()
                      )
                    }
                    data-embeddings-fullscreen-toggle
                    data-embeddings-fullscreen-action={
                      embeddingsFullscreen ? "exit" : "enter"
                    }
                    aria-pressed={embeddingsFullscreen}
                    title={
                      embeddingsFullscreen
                        ? "Exit browser fullscreen (Esc)"
                        : "Enter browser fullscreen"
                    }
                    aria-label={
                      embeddingsFullscreen
                        ? "Exit browser fullscreen embedding visual"
                        : "Enter browser fullscreen embedding visual"
                    }
                    className="inline-flex items-center gap-1.5 rounded-none border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                  >
                    {embeddingsFullscreen ? (
                      <>
                        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden>
                          <path
                            d="M5 3H3v2M11 3h2v2M5 13H3v-2M11 13h2v-2"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Exit full screen
                      </>
                    ) : (
                      <>
                        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden>
                          <path
                            d="M3 6V3h3M10 3h3v3M3 10v3h3M13 10v3h-3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Full screen
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadEmbeddings()}
                    disabled={embLoading}
                    data-embeddings-refresh
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-none border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] text-neutral-300 transition hover:border-neutral-500 hover:text-white disabled:opacity-50"
                  >
                    <svg
                      className={`h-3 w-3 ${embLoading ? "animate-spin" : ""}`}
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M13.5 8A5.5 5.5 0 1 1 8 2.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M8 1v3l2-1.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {embLoading ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
              </div>

              {embError ? (
                <div className="shrink-0 rounded-none border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                  {embError}
                </div>
              ) : null}

              {embLoading &&
              !embData &&
              regionOverlays.length === 0 &&
              knowledgeMapScope === "local" ? (
                <div className="flex min-h-0 flex-1 items-center justify-center text-xs text-neutral-500">
                  Loading trajectory…
                </div>
              ) : knowledgeMapScope === "global" ? (
                <div
                  className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-neutral-800"
                  data-knowledge-global-map
                  data-embeddings-fullscreen-scope={embeddingsFullscreen ? "true" : "false"}
                >
                  <MapOfKnowledgeGlobal
                    regions={workspaceGlobalMap.regions}
                    userLocations={workspaceGlobalMap.users}
                    projectionAlgorithm={projectionAlgorithm}
                    viewMode={knowledgeGlobalViewMode}
                    fill
                    className="min-h-0 flex-1"
                    selectedRegionId={globalSelectedRegionId}
                    onSelectRegion={(summary) =>
                      setGlobalSelectedRegionId(summary?.region_id ?? null)
                    }
                    onOpenLocalMap={openLocalMapFocusedOnRegion}
                    openLocalLabel="Open Local Map (this region only)"
                  />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <ProjectionSpaceWidget
                    coords={coords}
                    regionOverlays={regionOverlays}
                    displayMode={projectionDisplayMode}
                    onDisplayModeChange={setProjectionDisplayMode}
                  />
                </div>
              )}

              <div className="flex shrink-0 flex-wrap gap-2 text-[10px] text-neutral-500">
                {embScope.kind === "multi" && embScope.subjects.length > 1 ? (
                  embScope.subjects.map((s, i) => {
                    const key = subjectOptionKey(s);
                    const color =
                      SUBJECT_TRAJECTORY_COLORS[i % SUBJECT_TRAJECTORY_COLORS.length];
                    const label =
                      s.guest_user_id
                        ? `Guest ${s.guest_user_id.slice(0, 8)}…`
                        : s.user_id && s.user_id === currentUserId
                          ? "You"
                          : s.user_id
                            ? `User ${s.user_id.slice(0, 8)}…`
                            : key;
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1"
                        data-embeddings-subject-legend={key}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />{" "}
                        {label}
                      </span>
                    );
                  })
                ) : (
                  <>
                    {projectionDisplayMode === "trajectory" ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-neutral-200" /> start
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-neutral-200" /> latest
                    </span>
                  </>
                )}
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full border border-pink-400 bg-pink-400/30" />{" "}
                  region overlay
                </span>
                <span data-projection-mode-hint>
                  {projectionDisplayMode === "latest"
                    ? embScope.kind === "multi"
                      ? "Latest position per selected user · view fits positions + regions"
                      : "Latest position only · view fits position + selected regions"
                    : embScope.kind === "multi"
                      ? "Multi-user trajectories · ℝ⁶⁴ → 2D"
                      : "Full trajectory · ℝ⁶⁴ → 2D"}
                </span>
                <span className="text-neutral-400" data-projection-algorithm-hint>
                  ·{" "}
                  {PROJECTION_ALGORITHM_OPTIONS.find((o) => o.id === projectionAlgorithm)?.label ??
                    projectionAlgorithm}
                </span>
              </div>
            </div>

            {/* Right: Map of Knowledge–style region picker (synced with Global/Local map) */}
            <aside
              data-embeddings-regions-rail
              data-map-regions-panel
              className={`flex shrink-0 flex-col overflow-hidden ${
                embeddingsFullscreen ? "w-56 sm:w-64" : "w-56 sm:w-64"
              }`}
            >
              {/*
                Region list + distance cards are siblings with reserved vertical space:
                list scrolls (flex-1 min-h-0 overflow-y-auto); distances are shrink-0 with
                their own max-height scroll so multi-select never covers the checklist.
              */}
              <div
                data-region-overlay-picker
                data-map-region-workspace-groups
                aria-label="Knowledge regions multi-select"
                className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden rounded-none border border-zinc-800 bg-zinc-950/70"
              >
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-2.5 py-2">
                  <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                    Regions
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadRegionsForOverlay()}
                    disabled={regionsLoading}
                    className="shrink-0 text-[11px] text-zinc-500 underline decoration-zinc-700 underline-offset-2 transition hover:text-zinc-200 disabled:opacity-40"
                    data-region-overlay-refresh
                  >
                    {regionsLoading ? "Loading…" : "Refresh"}
                  </button>
                </div>

                <div
                  data-region-overlay-body
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5"
                >
                  {regionsLoading && knowledgeRegions.length === 0 ? (
                    <p className="px-1 text-xs text-zinc-500" data-region-overlay-loading>
                      Loading knowledge regions…
                    </p>
                  ) : regionsError ? (
                    <div className="px-1 text-xs text-red-300" data-region-overlay-error>
                      <p>{regionsError}</p>
                      <button
                        type="button"
                        onClick={() => void loadRegionsForOverlay()}
                        className="mt-1 text-[11px] text-red-200 underline decoration-red-800 underline-offset-2 hover:text-white"
                      >
                        Retry
                      </button>
                    </div>
                  ) : knowledgeRegions.length === 0 ? (
                    <div className="px-1 text-xs text-zinc-400" data-region-overlay-empty>
                      <p className="font-medium text-zinc-300">No knowledge regions yet</p>
                      <p className="mt-1 text-zinc-500">
                        Create under Settings → Custom Knowledge Regions, then multi-select here.
                      </p>
                    </div>
                  ) : (
                    (() => {
                      const enabledInGroup = selectableRegionIds.filter((id) =>
                        selectedRegionIds.has(id),
                      ).length;
                      const hasSelection = enabledInGroup > 0;
                      const allSelected =
                        selectableRegionIds.length > 0 &&
                        enabledInGroup === selectableRegionIds.length;
                      return (
                        <ul className="space-y-2" data-region-overlay-list>
                          <li
                            className={`rounded-none border bg-black/20 ${
                              hasSelection ? "border-zinc-500/80" : "border-zinc-800/90"
                            }`}
                            data-map-region-workspace-group
                            data-workspace-id={workspaceId}
                            data-expanded={regionPickerExpanded ? "true" : "false"}
                            data-has-selection={hasSelection ? "true" : "false"}
                          >
                            <div className="flex items-stretch gap-0">
                              <button
                                type="button"
                                onClick={() => setRegionPickerExpanded((o) => !o)}
                                className={`flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-xs transition hover:bg-zinc-900/60 ${
                                  hasSelection ? "text-white" : "text-zinc-500"
                                }`}
                                aria-expanded={regionPickerExpanded}
                                data-map-region-workspace-toggle
                              >
                                <span
                                  className={`shrink-0 font-mono text-[10px] transition-transform ${
                                    regionPickerExpanded ? "rotate-0" : "-rotate-90"
                                  } ${hasSelection ? "text-white" : "text-zinc-600"}`}
                                  aria-hidden
                                >
                                  ▾
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span
                                    className={`block truncate font-medium ${
                                      hasSelection ? "text-white" : "text-zinc-500"
                                    }`}
                                  >
                                    Workspace regions
                                  </span>
                                  <span
                                    className={`block text-[10px] ${
                                      hasSelection ? "text-zinc-300" : "text-zinc-600"
                                    }`}
                                  >
                                    {enabledInGroup}/{selectableRegionIds.length} on
                                    {knowledgeMapScope === "global"
                                      ? " · Global Map"
                                      : " · Local overlay"}
                                  </span>
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleAllWorkspaceRegions();
                                }}
                                className={`shrink-0 border-l px-2.5 text-[10px] font-medium uppercase tracking-wide transition ${
                                  allSelected
                                    ? "border-zinc-600 text-zinc-200 hover:bg-zinc-800/80 hover:text-white"
                                    : hasSelection
                                      ? "border-zinc-600 text-zinc-300 hover:bg-zinc-800/80 hover:text-white"
                                      : "border-zinc-800 text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300"
                                }`}
                                title={
                                  allSelected
                                    ? "Clear all regions"
                                    : "Select all regions"
                                }
                                aria-label={
                                  allSelected
                                    ? "Unselect all regions"
                                    : "Select all regions"
                                }
                                data-map-region-workspace-select-all
                                data-select-all-state={
                                  allSelected ? "all" : hasSelection ? "partial" : "none"
                                }
                              >
                                {allSelected ? "None" : "All"}
                              </button>
                            </div>
                            {regionPickerExpanded && (
                              <ul
                                className="space-y-1 border-t border-zinc-800/80 px-1.5 py-1.5"
                                data-map-region-list
                                role="group"
                                aria-label="Select regions"
                              >
                                {knowledgeRegions.map((r) => {
                                  const checked = selectedRegionIds.has(r.id);
                                  const hasCentroid =
                                    Array.isArray(r.centroid) && r.centroid.length > 0;
                                  const dist = checked
                                    ? overlayDistances[r.id]
                                    : undefined;
                                  return (
                                    <li key={r.id}>
                                      <button
                                        type="button"
                                        disabled={!hasCentroid}
                                        onClick={() => toggleRegionOverlay(r.id)}
                                        className={`flex w-full items-start gap-2 rounded-none border px-2.5 py-2 text-left text-xs transition ${
                                          checked
                                            ? "border-neutral-600/25 bg-neutral-950/20 text-zinc-200"
                                            : "border-zinc-800 bg-transparent text-zinc-500 hover:border-zinc-700"
                                        } ${!hasCentroid ? "cursor-not-allowed opacity-40" : ""}`}
                                        data-region-overlay-toggle={r.id}
                                        data-map-region-toggle
                                        aria-pressed={checked}
                                      >
                                        <span
                                          className={`mt-0.5 h-3 w-3 shrink-0 rounded-none border ${
                                            checked
                                              ? "border-white/60 bg-neutral-800/80"
                                              : "border-zinc-600"
                                          }`}
                                        />
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate font-medium">
                                            {r.name}
                                          </span>
                                          {!hasCentroid ? (
                                            <span className="block text-[10px] text-zinc-600">
                                              no centroid
                                            </span>
                                          ) : checked &&
                                            dist &&
                                            !dist.error &&
                                            Number.isFinite(dist.knowledge_distance) ? (
                                            <span
                                              className="block font-mono text-[10px] text-neutral-300/90"
                                              data-knowledge-distance-inline={r.id}
                                            >
                                              d={dist.knowledge_distance.toFixed(3)}
                                            </span>
                                          ) : null}
                                        </span>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </li>
                        </ul>
                      );
                    })()
                  )}
                </div>

                {regionOverlays.length > 0 ? (
                  <div
                    className="flex max-h-[42%] shrink-0 flex-col gap-1.5 overflow-hidden border-t border-neutral-800/80 bg-neutral-950/70"
                    data-region-overlay-distances
                  >
                    <p
                      className="shrink-0 px-2.5 pt-2 text-[11px] text-neutral-300/80"
                      data-region-overlay-count
                    >
                      {regionOverlays.length} region{regionOverlays.length === 1 ? "" : "s"} selected
                      {overlayDistancesLoading ? " · computing distance…" : ""}
                    </p>
                    <ul
                      className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-2 pb-2"
                      data-knowledge-distance-list
                    >
                      {regionOverlays.map((overlay, i) => {
                        const dist = overlayDistances[overlay.id];
                        const color =
                          REGION_OVERLAY_COLORS[i % REGION_OVERLAY_COLORS.length];
                        return (
                          <li
                            key={overlay.id}
                            className="rounded-none bg-neutral-900/70 px-2 py-1.5 text-[10px]"
                            data-knowledge-distance={overlay.id}
                          >
                            <div className="flex items-center gap-1.5 text-neutral-200">
                              <span
                                className="inline-block h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: color }}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1 truncate font-medium">
                                {overlay.name}
                              </span>
                            </div>
                            {dist?.error ? (
                              <p className="mt-0.5 text-neutral-300/90">{dist.error}</p>
                            ) : dist && Number.isFinite(dist.knowledge_distance) ? (
                              <div className="mt-1 flex flex-wrap gap-1.5 text-neutral-400">
                                <span className="rounded-full border border-neutral-800/60 bg-neutral-950/40 px-1.5 py-0.5 font-mono text-neutral-200">
                                  dist {dist.knowledge_distance.toFixed(4)}
                                </span>
                                <span className="rounded-full border border-neutral-700 px-1.5 py-0.5 font-mono">
                                  cos {dist.cosine_similarity.toFixed(3)}
                                </span>
                                <span
                                  className={`rounded-full border px-1.5 py-0.5 ${
                                    dist.in_region
                                      ? "border-emerald-800 text-emerald-300"
                                      : "border-neutral-800 text-neutral-300"
                                  }`}
                                >
                                  {dist.in_region ? "In region" : "Outside"}
                                </span>
                              </div>
                            ) : overlayDistancesLoading ? (
                              <p className="mt-0.5 text-neutral-500">Computing…</p>
                            ) : (
                              <p className="mt-0.5 text-neutral-500">—</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : knowledgeRegions.length > 0 && !regionsLoading ? (
                  <p
                    className="shrink-0 border-t border-neutral-800/60 px-2.5 py-2 text-[11px] text-neutral-500"
                    data-region-overlay-hint
                  >
                    Select regions to draw on the projection and see Knowledge distance.
                  </p>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
  );
}
