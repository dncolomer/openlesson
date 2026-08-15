"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UnusableCell } from "@/lib/map-ground-rules";
import {
  applyAiTextToAreaSummary,
  createMapNoteFromAreaSummary,
  isSelectivePolygonReady,
  MAP_EXPLORE_DEFAULT_OPEN_DRAWER,
  mapNoteCreateInputFromAreaSummary,
  normalizeEmptySpotTopic,
  normalizeMapSearchQuery,
  resolveSuggestSpotLimit,
  SUGGEST_SPOT_LIMIT_DEFAULT,
  SUGGEST_SPOT_LIMIT_MAX,
  SUGGEST_SPOT_LIMIT_MIN,
  summarizeSelectiveArea,
  type EmptyMapBlock,
  type EmptyMapCell,
  type SelectiveAreaSummary,
} from "@/lib/empty-map-pane";
import type { GridContinuousPoint } from "@/lib/block-map-tools";
import type { MapNoteSource } from "@/lib/learner-map-notes";
import {
  WorkspaceRightPaneDrawer,
  WorkspaceRightPaneDrawerGroup,
} from "@/components/WorkspaceRightPaneDrawer";
import {
  WorkspacePromptContextAlternatives,
  type PromptContextMode,
} from "@/components/WorkspacePromptContextAlternatives";

/**
 * Expand Map right-column UI as accordion drawers (overview, search, suggest
 * spot, selective description). Mounted only while the Explore / Expand Map
 * control is open — not the default empty-selection pane.
 * Powered by /api/workspace/map-explore.
 */
export function WorkspaceEmptyMapPane({
  canEdit = false,
  interactionMode = "creator",
  workspaceId,
  ayclToken = null,
  locale = "en",
  blocks = [],
  unusableCells = null,
  selectivePolygon = null,
  selectiveDrawing = false,
  onSearchSelectBlocks,
  onSuggestSelectEmptyCells,
  onStartSelectiveDraw,
  onClearSelectiveOverlay,
  onCreateNoteFromSummary,
  busy = false,
}: {
  canEdit?: boolean;
  /** Wire id: creator = Build, learner = Play. */
  interactionMode?: "creator" | "learner";
  workspaceId?: string | null;
  ayclToken?: string | null;
  locale?: string;
  blocks?: EmptyMapBlock[];
  unusableCells?: UnusableCell[] | null;
  /** Completed free-shape overlay (grid continuous coords) — independent of selection. */
  selectivePolygon?: GridContinuousPoint[] | null;
  /** True while map is in free-shape draw mode for Selective Explanation. */
  selectiveDrawing?: boolean;
  onSearchSelectBlocks?: (blockIds: string[]) => void;
  onSuggestSelectEmptyCells?: (cells: EmptyMapCell[]) => void;
  onStartSelectiveDraw?: () => void;
  onClearSelectiveOverlay?: () => void;
  onCreateNoteFromSummary?: (input: {
    body: string;
    x: number;
    y: number;
    source: MapNoteSource;
  }) => void;
  busy?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [spotTopic, setSpotTopic] = useState("");
  const [spotLimit, setSpotLimit] = useState(SUGGEST_SPOT_LIMIT_DEFAULT);
  const [spotContextMode, setSpotContextMode] =
    useState<PromptContextMode>("adhoc");
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [spotStatus, setSpotStatus] = useState<string | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [spotBusy, setSpotBusy] = useState(false);
  const [overviewText, setOverviewText] = useState<string>("");
  const [overviewBusy, setOverviewBusy] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [areaSummary, setAreaSummary] = useState<SelectiveAreaSummary | null>(
    null,
  );
  const [areaBusy, setAreaBusy] = useState(false);
  const overviewKeyRef = useRef("");
  const areaKeyRef = useRef("");
  const overviewRequestIdRef = useRef(0);

  const blockPayload = useMemo(
    () =>
      (blocks || []).map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        position_x: b.position_x,
        position_y: b.position_y,
        span_w: b.span_w,
        span_h: b.span_h,
        shape_cells: b.shape_cells,
      })),
    [blocks],
  );

  const unusablePayload = useMemo(
    () =>
      (unusableCells || []).map((c) => ({
        row: Math.trunc(c.row),
        col: Math.trunc(c.col),
      })),
    [unusableCells],
  );

  const callMapExplore = useCallback(
    async (op: string, extra: Record<string, unknown> = {}) => {
      if (!workspaceId) {
        throw new Error("Workspace required for map exploration");
      }
      const model =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planner-model")?.replace(/^x-ai\//, "") ||
            undefined
          : undefined;
      const res = await fetch("/api/workspace/map-explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          op,
          blocks: blockPayload,
          unusableCells: unusablePayload,
          locale,
          model,
          ...(ayclToken ? { ayclToken } : {}),
          ...extra,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data && data.error) || `Map explore failed (${res.status})`,
        );
      }
      return data as Record<string, unknown>;
    },
    [ayclToken, blockPayload, locale, unusablePayload, workspaceId],
  );

  // Overview only while this pane is mounted (explore open). Neutral busy/idle copy.
  useEffect(() => {
    if (!workspaceId) {
      setOverviewBusy(false);
      setOverviewError(null);
      setOverviewText(
        blockPayload.length
          ? "Open a workspace to generate a map overview."
          : "This map is empty.",
      );
      overviewKeyRef.current = "";
      return;
    }
    const key = blockPayload
      .map((b) => `${b.id}:${b.title}:${b.position_x}:${b.position_y}`)
      .join("|");
    if (key === overviewKeyRef.current && overviewText) return;
    overviewKeyRef.current = key;
    const requestId = ++overviewRequestIdRef.current;
    let cancelled = false;
    setOverviewBusy(true);
    setOverviewError(null);
    void (async () => {
      try {
        const data = await callMapExplore("overview");
        if (cancelled || requestId !== overviewRequestIdRef.current) return;
        setOverviewText(
          String(data.summary || "").trim() ||
            "Could not generate an overview yet.",
        );
        setOverviewError(null);
      } catch (err) {
        if (cancelled || requestId !== overviewRequestIdRef.current) return;
        setOverviewError(
          err instanceof Error
            ? err.message
            : "Failed to generate map overview.",
        );
        setOverviewText("");
      } finally {
        if (!cancelled && requestId === overviewRequestIdRef.current) {
          setOverviewBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // overviewText intentionally omitted from deps — gate uses ref + busy flag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockPayload, callMapExplore, workspaceId]);

  // When free-shape completes, generate a prose summary of that area.
  useEffect(() => {
    if (!isSelectivePolygonReady(selectivePolygon)) {
      return;
    }
    const poly = selectivePolygon || [];
    const key = poly.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("|");
    if (key === areaKeyRef.current) return;
    areaKeyRef.current = key;

    const base = summarizeSelectiveArea({
      polygon: poly,
      blocks,
      unusableKeys: unusablePayload.map((c) => `${c.row}:${c.col}`),
    });
    setAreaSummary(base);

    if (!workspaceId) {
      setAreaSummary(base);
      return;
    }

    let cancelled = false;
    setAreaBusy(true);
    void (async () => {
      try {
        const data = await callMapExplore("area_summary", {
          polygon: poly,
        });
        if (cancelled) return;
        const aiText = String(data.summary || "").trim();
        setAreaSummary(applyAiTextToAreaSummary(base, aiText || base.text));
      } catch {
        if (cancelled) return;
        setAreaSummary(base);
      } finally {
        if (!cancelled) setAreaBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    blocks,
    callMapExplore,
    selectivePolygon,
    unusablePayload,
    workspaceId,
  ]);

  const modeLabel = interactionMode === "learner" ? "Play" : "Build";
  const disabled = busy || !workspaceId;

  const handleSearch = async () => {
    const topic = normalizeMapSearchQuery(searchQuery) || searchQuery.trim();
    if (!topic) {
      setSearchStatus("Enter a topic to search the map.");
      onSearchSelectBlocks?.([]);
      return;
    }
    if (!workspaceId) {
      setSearchStatus("Workspace required.");
      return;
    }
    setSearchBusy(true);
    setSearchStatus("Searching the map…");
    try {
      const data = await callMapExplore("search", { query: topic });
      const ids = Array.isArray(data.blockIds)
        ? data.blockIds.map((id) => String(id)).filter(Boolean)
        : [];
      onSearchSelectBlocks?.(ids);
      const rationale = String(data.rationale || "").trim();
      setSearchStatus(
        ids.length === 0
          ? rationale || `No blocks found for “${topic}”.`
          : `Selected ${ids.length} block${ids.length === 1 ? "" : "s"}${rationale ? ` — ${rationale}` : ""}.`,
      );
    } catch (err) {
      setSearchStatus(
        err instanceof Error ? err.message : "Search failed",
      );
    } finally {
      setSearchBusy(false);
    }
  };

  const handleSuggestSpot = async () => {
    const topic =
      normalizeEmptySpotTopic(spotTopic) || spotTopic.trim() || "";
    if (!workspaceId) {
      setSpotStatus("Workspace required.");
      return;
    }
    setSpotBusy(true);
    setSpotStatus("Suggesting empty coordinates…");
    try {
      const limit = resolveSuggestSpotLimit(spotLimit);
      const data = await callMapExplore("suggest_spot", {
        topic,
        limit,
      });
      const cells = (
        Array.isArray(data.cells) ? data.cells : []
      ) as EmptyMapCell[];
      const cleaned = cells
        .filter((c) => c && Number.isFinite(c.row) && Number.isFinite(c.col))
        .map((c) => ({ row: Math.trunc(c.row), col: Math.trunc(c.col) }));
      onSuggestSelectEmptyCells?.(cleaned);
      const rationale = String(data.rationale || "").trim();
      setSpotStatus(
        cleaned.length === 0
          ? rationale || "No empty spots found."
          : `Selected ${cleaned.length} empty cell${cleaned.length === 1 ? "" : "s"}${rationale ? ` — ${rationale}` : ""}.`,
      );
    } catch (err) {
      setSpotStatus(err instanceof Error ? err.message : "Suggest failed");
    } finally {
      setSpotBusy(false);
    }
  };

  const handleStartDraw = () => {
    areaKeyRef.current = "";
    setAreaSummary(null);
    onStartSelectiveDraw?.();
  };

  const handleSaveNote = () => {
    if (!areaSummary || !areaSummary.text) return;
    const source: MapNoteSource =
      interactionMode === "learner" ? "learner" : "creator";
    const createInput = mapNoteCreateInputFromAreaSummary(areaSummary, {
      source,
    });
    const note = createMapNoteFromAreaSummary(areaSummary, { source });
    onCreateNoteFromSummary?.({
      body: note.body,
      x: createInput.x,
      y: createInput.y,
      source,
    });
  };

  const overviewDisplay = overviewBusy
    ? "Writing an overview…"
    : overviewError
      ? overviewError
      : overviewText || "Overview will appear here.";

  return (
    <WorkspaceRightPaneDrawerGroup
      defaultOpenId={MAP_EXPLORE_DEFAULT_OPEN_DRAWER}
      data-workspace-empty-map-pane
      data-workspace-map-explore-pane
      data-map-explore-drawers
      data-workspace-right-pane="map_explore"
      data-empty-map-mode={interactionMode}
      data-empty-map-xai="true"
      data-empty-map-overview-busy={overviewBusy ? "true" : "false"}
      className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-neutral-950/95"
    >
      <div
        data-map-explore-header
        className="shrink-0 border-b border-neutral-800/80 px-3 py-2"
      >
        <p
          className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500"
          data-expand-map-title
          data-map-explore-drawer-title
        >
          Expand Map · {modeLabel}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">
          Open a drawer: overview, search, empty spots, or selective summary.
        </p>
      </div>

      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="map_overview"
        title="Map overview"
        defaultExpanded={false}
        bodyClassName="space-y-2"
        surfaceDataAttr="data-empty-map-overview"
      >
        <div data-empty-map-overview data-map-explore-drawer-body="map_overview">
          <p
            data-empty-map-overview-text
            className="text-[11px] leading-relaxed text-neutral-300"
          >
            {overviewDisplay}
          </p>
        </div>
      </WorkspaceRightPaneDrawer>

      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="map_search"
        title="Map Search"
        defaultExpanded={MAP_EXPLORE_DEFAULT_OPEN_DRAWER === "map_search"}
        bodyClassName="space-y-3"
        surfaceDataAttr="data-empty-map-search"
      >
        <div
          data-empty-map-search
          data-map-explore-drawer-body="map_search"
          className="flex flex-col gap-3"
        >
          <p className="text-[10px] leading-snug text-neutral-600">
            Find blocks about a topic — multi-selects matching filled blocks on
            the map.
          </p>
          <label className="block space-y-1.5">
            <span className="sr-only">Search topic</span>
            <input
              type="text"
              data-empty-map-search-input
              value={searchQuery}
              disabled={disabled || searchBusy}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder="Find me blocks about…"
              className="w-full rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
            />
          </label>
          <button
            type="button"
            data-empty-map-search-submit
            disabled={disabled || searchBusy}
            onClick={() => void handleSearch()}
            className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-medium text-neutral-200 transition hover:bg-white/10 disabled:opacity-40"
          >
            {searchBusy ? "Searching…" : "Search map"}
          </button>
          {searchStatus ? (
            <p
              data-empty-map-search-status
              className="pt-0.5 text-[10px] leading-snug text-neutral-500"
            >
              {searchStatus}
            </p>
          ) : null}
        </div>
      </WorkspaceRightPaneDrawer>

      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="map_suggest_spot"
        title="Suggest best spot"
        defaultExpanded={false}
        bodyClassName="space-y-3"
        surfaceDataAttr="data-empty-map-suggest-spot"
      >
        <div
          data-empty-map-suggest-spot
          data-map-explore-drawer-body="map_suggest_spot"
          className="flex flex-col gap-3"
        >
          <p className="text-[10px] leading-snug text-neutral-600">
            Recommend empty placeable cells for a topic — multi-selects empties
            (not filled blocks).
            {!canEdit ? " Visibility only in Play." : ""}
          </p>
          <div data-expand-map-suggest-context data-suggest-best-spot-context>
            <WorkspacePromptContextAlternatives
              workspaceId={workspaceId || undefined}
              ayclToken={ayclToken || undefined}
              draftPrompt={spotTopic}
              surface="expand map suggest spot"
              mode={spotContextMode}
              onModeChange={setSpotContextMode}
              adhocValue={spotTopic}
              onAdhocChange={setSpotTopic}
              onAccept={(prompt) => setSpotTopic(prompt)}
              disabled={disabled || spotBusy}
              adhocPlaceholder="Best spot for… (or use Suggest from Knowledge / Simulation)"
              adhocLabel="Topic for empty spot"
            />
          </div>
          <label className="block space-y-1.5">
            <span className="sr-only">Topic for empty spot</span>
            <input
              type="text"
              data-empty-map-suggest-input
              value={spotTopic}
              disabled={disabled || spotBusy}
              onChange={(e) => setSpotTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSuggestSpot();
                }
              }}
              placeholder="Best spot for…"
              className="w-full rounded-md border border-neutral-700 bg-black/60 px-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
            />
          </label>
          <label
            className="block space-y-1.5"
            data-empty-map-suggest-limit
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-neutral-400">
                Selection size
              </span>
              <span
                className="font-mono text-[10px] text-neutral-500"
                data-empty-map-suggest-limit-value
              >
                {resolveSuggestSpotLimit(spotLimit)} cell
                {resolveSuggestSpotLimit(spotLimit) === 1 ? "" : "s"}
              </span>
            </div>
            <input
              type="range"
              min={SUGGEST_SPOT_LIMIT_MIN}
              max={SUGGEST_SPOT_LIMIT_MAX}
              step={1}
              value={resolveSuggestSpotLimit(spotLimit)}
              disabled={disabled || spotBusy}
              onChange={(e) =>
                setSpotLimit(resolveSuggestSpotLimit(Number(e.target.value)))
              }
              className="w-full accent-white"
              data-empty-map-suggest-limit-input
              aria-label="How many empty cells to select"
            />
            <p className="text-[10px] leading-snug text-neutral-600">
              How many empty cells to multi-select for this suggestion.
            </p>
          </label>
          <button
            type="button"
            data-empty-map-suggest-submit
            disabled={disabled || spotBusy}
            onClick={() => void handleSuggestSpot()}
            className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-medium text-neutral-200 transition hover:bg-white/10 disabled:opacity-40"
          >
            {spotBusy
              ? "Suggesting…"
              : `Suggest ${resolveSuggestSpotLimit(spotLimit)} empty cell${
                  resolveSuggestSpotLimit(spotLimit) === 1 ? "" : "s"
                }`}
          </button>
          {spotStatus ? (
            <p
              data-empty-map-suggest-status
              className="pt-0.5 text-[10px] leading-snug text-neutral-500"
            >
              {spotStatus}
            </p>
          ) : null}
        </div>
      </WorkspaceRightPaneDrawer>

      <WorkspaceRightPaneDrawer
        variant="section"
        drawerId="map_selective"
        title="Selective Explanation"
        defaultExpanded={false}
        bodyClassName="space-y-3"
        surfaceDataAttr="data-empty-map-selective-explanation"
      >
        <div
          data-empty-map-selective-explanation
          data-map-explore-drawer-body="map_selective"
          className="flex flex-col gap-3"
        >
          <p className="text-[10px] leading-snug text-neutral-600">
            Draw a free-shape white overlay on the map (not a block selection).
            Get a summary of that area, then save it as a map Note.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-2.5">
            <button
              type="button"
              data-empty-map-selective-draw
              data-active={selectiveDrawing ? "true" : "false"}
              disabled={busy}
              onClick={handleStartDraw}
              className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-[11px] font-medium transition disabled:opacity-40 ${
                selectiveDrawing
                  ? "border-white/30 bg-white/15 text-white"
                  : "border-white/15 bg-white/5 text-neutral-200 hover:bg-white/10"
              }`}
            >
              {selectiveDrawing
                ? "Drawing… (drag on map)"
                : "Draw free-shape area"}
            </button>
            <button
              type="button"
              data-empty-map-selective-clear
              disabled={
                busy || (!selectivePolygon?.length && !selectiveDrawing)
              }
              onClick={() => {
                areaKeyRef.current = "";
                setAreaSummary(null);
                onClearSelectiveOverlay?.();
              }}
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-transparent px-3 py-2 text-[11px] font-medium text-neutral-400 transition hover:bg-white/5 disabled:opacity-40"
            >
              Clear overlay
            </button>
          </div>
          {areaSummary && isSelectivePolygonReady(areaSummary.polygon) ? (
            <div
              data-empty-map-selective-summary
              className="space-y-3 rounded-md border border-neutral-700/80 bg-black/40 p-3"
            >
              <p className="text-[11px] leading-relaxed text-neutral-200">
                {areaBusy ? "Summarizing this area…" : areaSummary.text}
              </p>
              <button
                type="button"
                data-empty-map-selective-to-note
                disabled={busy || areaBusy}
                onClick={handleSaveNote}
                className="w-full rounded-md bg-white px-3 py-2 text-[11px] font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
              >
                Save summary as map Note
              </button>
            </div>
          ) : selectiveDrawing ? (
            <p className="pt-0.5 text-[10px] leading-snug text-neutral-600">
              Drag a freehand path on the map to finish the area.
            </p>
          ) : null}
        </div>
      </WorkspaceRightPaneDrawer>
    </WorkspaceRightPaneDrawerGroup>
  );
}
