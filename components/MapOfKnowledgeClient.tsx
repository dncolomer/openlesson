"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Maximize2,
  Minimize2,
  Sparkles,
} from "lucide-react";
import {
  MAP_NEWSLETTER_SUBSCRIBE_NOTE,
  buildFindYourselfMapFocus,
  enabledRegionsForLocalFocus,
  filterEnabledRegions,
  filterMapPlacementWorkspaces,
  generateAnonymousGuestIdentity,
  groupRegionsByWorkspace,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  parsePlacementLinkToken,
  parseProjectionAlgorithmId,
  pickDefaultEnabledRegionsFromOneWorkspace,
  PROJECTION_ALGORITHM_OPTIONS,
  reprojectMapLayout,
  type MapOfKnowledgePayload,
  type MapRegion,
  type MapUserLocation,
  type ProjectionAlgorithmId,
} from "@/lib/map-of-knowledge";
import { PRODUCT_INTENT_LABELS } from "@/lib/product-intent";
import { MapOfKnowledge2D } from "@/components/MapOfKnowledge2D";
import { MapOfKnowledge3D } from "@/components/MapOfKnowledge3D";
import { MapOfKnowledgeGlobal } from "@/components/MapOfKnowledgeGlobal";

/** Parent map representation: Local (embedding 2D/3D) vs Global (region graph). */
type MapScope = "local" | "global";
type ViewMode = "2d" | "3d";

/** Map placement product options — both are timed guest sessions (TAP under the hood). */
type PlacementProductKind = "timed_explore" | "timed_drill";

/** Allowed Timed Exploration durations on Map of Knowledge (minutes). */
const TIMED_EXPLORE_DURATION_OPTIONS = [5, 10, 30] as const;
type TimedExploreDurationMinutes = (typeof TIMED_EXPLORE_DURATION_OPTIONS)[number];
const TIMED_EXPLORE_DURATION_DEFAULT: TimedExploreDurationMinutes = 10;

/** Allowed Timed Drill durations on Map of Knowledge (minutes). */
const TIMED_DRILL_DURATION_OPTIONS = [15, 30, 45] as const;
type TimedDrillDurationMinutes = (typeof TIMED_DRILL_DURATION_OPTIONS)[number];
const TIMED_DRILL_DURATION_DEFAULT: TimedDrillDurationMinutes = 30;

function parseTimedExploreDurationMinutes(
  value: unknown,
  fallback: TimedExploreDurationMinutes = TIMED_EXPLORE_DURATION_DEFAULT,
): TimedExploreDurationMinutes {
  const n = typeof value === "number" ? value : Number(value);
  return (TIMED_EXPLORE_DURATION_OPTIONS as readonly number[]).includes(n)
    ? (n as TimedExploreDurationMinutes)
    : fallback;
}

function parseTimedDrillDurationMinutes(
  value: unknown,
  fallback: TimedDrillDurationMinutes = TIMED_DRILL_DURATION_DEFAULT,
): TimedDrillDurationMinutes {
  const n = typeof value === "number" ? value : Number(value);
  return (TIMED_DRILL_DURATION_OPTIONS as readonly number[]).includes(n)
    ? (n as TimedDrillDurationMinutes)
    : fallback;
}

const PLACEMENT_PRODUCTS: Record<
  PlacementProductKind,
  {
    label: string;
    eyebrow: string;
    shortDiff: string;
    mintingLabel: string;
    mintLabel: string;
    interaction_kind: "conversational" | "exercise";
    accent: "slate" | "amber";
  }
> = {
  timed_explore: {
    label: PRODUCT_INTENT_LABELS.timedExplore,
    eyebrow: "Interactive LLM-powered Dialog",
    shortDiff:
      "A timed exploratory dialog — light and quick. You still think aloud; Helios keeps the conversation going as you show what you know.",
    mintingLabel: "Minting Timed Exploration…",
    mintLabel: "Mint Timed Exploration link",
    interaction_kind: "conversational",
    accent: "slate",
  },
  timed_drill: {
    label: PRODUCT_INTENT_LABELS.timedDrill,
    eyebrow: "Solo monolog",
    shortDiff:
      "A timed exercise without dialog — more complex, solo work. You still think aloud as you work through and submit your solution.",
    mintingLabel: "Minting Timed Drill…",
    mintLabel: "Mint Timed Drill link",
    interaction_kind: "exercise",
    accent: "amber",
  },
};

export function MapOfKnowledgeClient() {
  const [data, setData] = useState<MapOfKnowledgePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapScope, setMapScope] = useState<MapScope>("global");
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  /** Global Map region selection (summary panel). */
  const [globalSelectedRegionId, setGlobalSelectedRegionId] = useState<string | null>(null);
  const [projectionAlgorithm, setProjectionAlgorithm] =
    useState<ProjectionAlgorithmId>("pca");
  const [embeddingModelId, setEmbeddingModelId] = useState<string>(
    KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  );
  const [enabledRegions, setEnabledRegions] = useState<Set<string>>(new Set());
  /** Workspace ids whose region groups are expanded in the regions panel. */
  const [expandedRegionWorkspaces, setExpandedRegionWorkspaces] = useState<Set<string>>(
    () => new Set(),
  );
  const [fullscreen, setFullscreen] = useState(false);
  // Fresh random identity on each page load (not a fixed seed).
  const [guestIdentity, setGuestIdentity] = useState(() => generateAnonymousGuestIdentity());
  const guestName = guestIdentity.display_name;
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState("");
  /** Timed Exploration session length (5 / 10 / 30 min) chosen before minting. */
  const [timedExploreMinutes, setTimedExploreMinutes] =
    useState<TimedExploreDurationMinutes>(TIMED_EXPLORE_DURATION_DEFAULT);
  /** Timed Drill session length (15 / 30 / 45 min) chosen before minting. */
  const [timedDrillMinutes, setTimedDrillMinutes] =
    useState<TimedDrillDurationMinutes>(TIMED_DRILL_DURATION_DEFAULT);
  const [minting, setMinting] = useState<PlacementProductKind | null>(null);
  const [mintResult, setMintResult] = useState<{
    url: string;
    kind: PlacementProductKind;
    golden: boolean;
    guest_display_name: string;
    workspace_title: string;
    block_title: string;
    minutes: number;
  } | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  /** Collapsible “Find yourself” (replaces Embedding space details). */
  const [findYourselfOpen, setFindYourselfOpen] = useState(false);
  const [findYourselfLink, setFindYourselfLink] = useState("");
  const [findYourselfBusy, setFindYourselfBusy] = useState(false);
  const [findYourselfError, setFindYourselfError] = useState<string | null>(null);
  const [findYourselfOk, setFindYourselfOk] = useState<string | null>(null);
  /** When Find yourself hits not_on_map — offer email notify. */
  const [findYourselfAwaitingSnapshot, setFindYourselfAwaitingSnapshot] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  /** Snapshot id of the subject focused via Find yourself (Local Map highlight). */
  const [focusedUserId, setFocusedUserId] = useState<string | null>(null);

  const mapShellRef = useRef<HTMLDivElement>(null);
  const workspaceInitRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (embeddingModelId) qs.set("embedding_model_id", embeddingModelId);
    const url = `/api/map-of-knowledge${qs.toString() ? `?${qs}` : ""}`;
    fetch(url)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load map");
        if (cancelled) return;
        const payload = json as MapOfKnowledgePayload;
        setData(payload);
        if (payload.embedding_model_id && payload.embedding_model_id !== embeddingModelId) {
          setEmbeddingModelId(payload.embedding_model_id);
        }
        // Default highlight: 3 regions from one randomly chosen workspace (never mixed).
        const regions = (payload.regions || []) as MapRegion[];
        const defaultPick = pickDefaultEnabledRegionsFromOneWorkspace(regions, 3);
        setEnabledRegions(new Set(defaultPick.regionIds));
        // Region workspace groups start collapsed; users expand to pick.
        setExpandedRegionWorkspaces(new Set());
        if (!workspaceInitRef.current) {
          workspaceInitRef.current = true;
          // Placement: public workspaces with expert regions only (not bare community plans).
          const placement = filterMapPlacementWorkspaces(payload.workspaces || []);
          const firstWs = placement[0];
          if (firstWs) {
            setSelectedWorkspaceId(firstWs.id);
            const startBlock =
              (payload.blocks || []).find(
                (b: { workspace_id: string; is_start: boolean }) =>
                  b.workspace_id === firstWs.id && b.is_start,
              ) ||
              (payload.blocks || []).find(
                (b: { workspace_id: string }) => b.workspace_id === firstWs.id,
              );
            if (startBlock) setSelectedBlockId(startBlock.id);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [embeddingModelId]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  const enterFullscreen = useCallback(async () => {
    setFullscreen(true);
    const el = mapShellRef.current;
    if (el && typeof el.requestFullscreen === "function") {
      try {
        await el.requestFullscreen();
      } catch {
        // CSS overlay fallback
      }
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    setFullscreen(false);
    if (typeof document !== "undefined" && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  /** Public placement targets only — never private / region-less community plans. */
  const placementWorkspaces = useMemo(() => {
    if (!data?.workspaces) return [];
    return filterMapPlacementWorkspaces(data.workspaces);
  }, [data?.workspaces]);

  const blocksForWorkspace = useMemo(() => {
    if (!data) return [];
    // Only blocks for a selected placement-eligible public workspace.
    if (!placementWorkspaces.some((w) => w.id === selectedWorkspaceId)) return [];
    return data.blocks.filter((b) => b.workspace_id === selectedWorkspaceId);
  }, [data, selectedWorkspaceId, placementWorkspaces]);

  // If selection falls outside the public placement list, snap to first eligible.
  useEffect(() => {
    if (placementWorkspaces.length === 0) {
      if (selectedWorkspaceId) setSelectedWorkspaceId("");
      return;
    }
    if (!placementWorkspaces.some((w) => w.id === selectedWorkspaceId)) {
      setSelectedWorkspaceId(placementWorkspaces[0].id);
    }
  }, [placementWorkspaces, selectedWorkspaceId]);

  useEffect(() => {
    if (blocksForWorkspace.length === 0) {
      setSelectedBlockId("");
      return;
    }
    if (!blocksForWorkspace.some((b) => b.id === selectedBlockId)) {
      const start = blocksForWorkspace.find((b) => b.is_start) || blocksForWorkspace[0];
      setSelectedBlockId(start.id);
    }
  }, [blocksForWorkspace, selectedBlockId]);

  /** Re-project locations + regions jointly when the user changes algorithm. */
  const projectedLayout = useMemo(() => {
    if (!data) return { userLocations: [] as MapUserLocation[], regions: [] as MapRegion[] };
    return reprojectMapLayout({
      userLocations: data.user_locations,
      regions: data.regions,
      algorithm: projectionAlgorithm,
    });
  }, [data, projectionAlgorithm]);

  const visibleRegions = useMemo(() => {
    return filterEnabledRegions(projectedLayout.regions, enabledRegions);
  }, [projectedLayout.regions, enabledRegions]);

  const projectedUsers = projectedLayout.userLocations;

  const toggleRegion = (id: string) => {
    setEnabledRegions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const regionWorkspaceGroups = useMemo(() => {
    if (!data?.regions?.length) return [];
    return groupRegionsByWorkspace(data.regions);
  }, [data?.regions]);

  const toggleRegionWorkspaceGroup = (workspaceId: string) => {
    setExpandedRegionWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) next.delete(workspaceId);
      else next.add(workspaceId);
      return next;
    });
  };

  /** Select all regions in a workspace, or clear them if every region is already on. */
  const toggleAllRegionsInWorkspace = (regionIds: readonly string[]) => {
    if (regionIds.length === 0) return;
    setEnabledRegions((prev) => {
      const next = new Set(prev);
      const allOn = regionIds.every((id) => next.has(id));
      if (allOn) {
        for (const id of regionIds) next.delete(id);
      } else {
        for (const id of regionIds) next.add(id);
      }
      return next;
    });
  };

  /** From Global Map: switch to Local with only this region enabled. */
  const openLocalMapFocusedOnRegion = useCallback(
    (regionId: string) => {
      const ids = enabledRegionsForLocalFocus(regionId);
      if (ids.length === 0) return;
      setEnabledRegions(new Set(ids));
      setGlobalSelectedRegionId(null);
      setMapScope("local");
      // Expand the workspace group that owns this region.
      const region = data?.regions.find((r) => r.id === regionId);
      if (region?.workspace_id) {
        setExpandedRegionWorkspaces(new Set([region.workspace_id]));
      }
    },
    [data?.regions],
  );

  const regenerateGuest = () => {
    // Fresh seedless identity reshuffles both display name and STEM mini avatar.
    setGuestIdentity(generateAnonymousGuestIdentity());
    setMintResult(null);
  };

  const mintLink = useCallback(
    async (kind: PlacementProductKind) => {
      if (!selectedWorkspaceId || !selectedBlockId) return;
      const product = PLACEMENT_PRODUCTS[kind];
      const minutes =
        kind === "timed_explore"
          ? parseTimedExploreDurationMinutes(timedExploreMinutes)
          : parseTimedDrillDurationMinutes(timedDrillMinutes);
      setMinting(kind);
      setMintError(null);
      setMintResult(null);
      try {
        const res = await fetch("/api/map-of-knowledge/guest-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: selectedWorkspaceId,
            block_id: selectedBlockId,
            // Technical surface is always timed TAP; product intent chooses shell.
            link_kind: "tap",
            interaction_kind: product.interaction_kind,
            placement_product: kind,
            guest_display_name: guestName,
            minutes,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to mint link");
        }
        const wsTitle =
          data?.workspaces.find((w) => w.id === selectedWorkspaceId)?.title || "Workspace";
        const blockTitle =
          data?.blocks.find((b) => b.id === selectedBlockId)?.title || "Block";
        const resultKind: PlacementProductKind =
          json.placement_product === "timed_drill" ||
          json.interaction_kind === "exercise"
            ? "timed_drill"
            : "timed_explore";
        const resultMinutes =
          typeof json.minutes === "number" && Number.isFinite(json.minutes)
            ? json.minutes
            : minutes;
        setMintResult({
          url: json.private_url,
          kind: resultKind,
          golden: Boolean(json.map_dot_golden),
          guest_display_name:
            typeof json.guest_display_name === "string" && json.guest_display_name
              ? json.guest_display_name
              : guestName,
          workspace_title: wsTitle,
          block_title: blockTitle,
          minutes: resultMinutes,
        });
        setLinkCopied(false);
      } catch (err) {
        setMintError(err instanceof Error ? err.message : "Failed to mint link");
      } finally {
        setMinting(null);
      }
    },
    [
      selectedWorkspaceId,
      selectedBlockId,
      guestName,
      data,
      timedExploreMinutes,
      timedDrillMinutes,
    ],
  );

  const copyMintedLink = useCallback(async () => {
    if (!mintResult?.url) return;
    try {
      await navigator.clipboard.writeText(mintResult.url);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setMintError("Could not copy link to clipboard");
    }
  }, [mintResult?.url]);

  const truncateUrl = (url: string, max = 48) => {
    if (url.length <= max) return url;
    try {
      const u = new URL(url);
      const path = u.pathname + u.search;
      const host = u.host;
      const keep = Math.max(12, max - host.length - 3);
      const shortPath =
        path.length > keep ? `${path.slice(0, Math.floor(keep / 2))}…${path.slice(-Math.floor(keep / 2))}` : path;
      return `${host}${shortPath}`;
    } catch {
      return `${url.slice(0, max - 1)}…`;
    }
  };

  const activeAlgoMeta = PROJECTION_ALGORITHM_OPTIONS.find((o) => o.id === projectionAlgorithm);
  const embeddingModels = data?.embedding_models || [];
  const applyFindYourself = useCallback(async () => {
    setFindYourselfError(null);
    setFindYourselfOk(null);
    setFindYourselfAwaitingSnapshot(false);
    setNotifyMessage(null);
    setNotifyError(null);
    const token = parsePlacementLinkToken(findYourselfLink);
    if (!token) {
      setFindYourselfError("Paste your saved placement link (the full session URL).");
      return;
    }
    if (!data) {
      setFindYourselfError("Map data is still loading — try again in a moment.");
      return;
    }
    setFindYourselfBusy(true);
    try {
      const res = await fetch("/api/map-of-knowledge/find-yourself", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: findYourselfLink.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : "Could not resolve that link",
        );
      }
      const focus = buildFindYourselfMapFocus({
        users: data.user_locations,
        regions: data.regions,
        guest_user_id: String(json.guest_user_id || ""),
        workspace_id: String(json.workspace_id || ""),
      });
      if (!focus.ok) {
        setFindYourselfError(focus.error);
        if (focus.code === "not_on_map") {
          setFindYourselfAwaitingSnapshot(true);
        }
        return;
      }
      setFocusedUserId(focus.focused_user_id);
      setEnabledRegions(new Set(focus.enabled_region_ids));
      if (focus.workspace_id) {
        setExpandedRegionWorkspaces(new Set([focus.workspace_id]));
      }
      setMapScope("local");
      setViewMode("2d");
      setFindYourselfOk("Found you — Local Map is focused on your placement.");
      // Scroll map canvas into view
      document.getElementById("map-canvas")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setFindYourselfError(err instanceof Error ? err.message : "Could not find you on the map");
    } finally {
      setFindYourselfBusy(false);
    }
  }, [findYourselfLink, data]);

  const submitNotifyWhenReady = useCallback(async () => {
    setNotifyError(null);
    setNotifyMessage(null);
    if (!findYourselfLink.trim()) {
      setNotifyError("Paste your placement link above first.");
      return;
    }
    setNotifyBusy(true);
    try {
      const res = await fetch("/api/map-of-knowledge/notify-when-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          link: findYourselfLink.trim(),
          email: notifyEmail.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : "Could not save email",
        );
      }
      setNotifyMessage(
        typeof json.message === "string"
          ? json.message
          : "Thanks — you're on the Uncertain Systems newsletter list.",
      );
    } catch (err) {
      setNotifyError(err instanceof Error ? err.message : "Could not save email");
    } finally {
      setNotifyBusy(false);
    }
  }, [findYourselfLink, notifyEmail]);

  const selectClass =
    "h-8 rounded-sm border border-zinc-700 bg-black/50 px-2 font-mono text-[11px] tracking-wide text-zinc-200 outline-none transition hover:border-zinc-500 focus:border-cyan-500/40";
  const toolBtnClass = (active: boolean) =>
    `inline-flex h-8 items-center rounded-sm border px-2.5 font-mono text-[11px] tracking-wide transition ${
      active
        ? "border-white/30 bg-white/10 text-white"
        : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
    }`;

  /** Compact controls bar — sits directly on the map chrome. */
  const mapToolbar = (
    <div
      className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800 bg-zinc-950/95 px-2 py-1.5"
      data-map-toolbar
      role="toolbar"
      aria-label="Map view controls"
    >
      <div
        className="inline-flex rounded-sm border border-zinc-800 p-0.5"
        role="group"
        aria-label="Map scope"
        data-map-scope-toggle
      >
        <button
          type="button"
          onClick={() => setMapScope("local")}
          className={`rounded-sm px-2.5 py-1 font-mono text-[11px] tracking-wide transition ${
            mapScope === "local" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
          data-map-scope="local"
          aria-pressed={mapScope === "local"}
        >
          Local Map
        </button>
        <button
          type="button"
          onClick={() => setMapScope("global")}
          className={`rounded-sm px-2.5 py-1 font-mono text-[11px] tracking-wide transition ${
            mapScope === "global" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
          data-map-scope="global"
          aria-pressed={mapScope === "global"}
        >
          Global Map
        </button>
      </div>

      {/* 2D / 3D for Local Map and Global Map */}
      <span className="hidden h-4 w-px bg-zinc-800 sm:block" aria-hidden />

      <div
        className="inline-flex rounded-sm border border-zinc-800 p-0.5"
        role="group"
        aria-label={mapScope === "global" ? "Global view mode" : "Local view mode"}
        data-map-view-mode-toggle
        data-map-view-mode-scope={mapScope}
      >
        <button
          type="button"
          onClick={() => setViewMode("2d")}
          className={`rounded-sm px-2.5 py-1 font-mono text-[11px] tracking-wide transition ${
            viewMode === "2d" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
          data-map-view-mode="2d"
          aria-pressed={viewMode === "2d"}
        >
          2D
        </button>
        <button
          type="button"
          onClick={() => setViewMode("3d")}
          className={`rounded-sm px-2.5 py-1 font-mono text-[11px] tracking-wide transition ${
            viewMode === "3d" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
          data-map-view-mode="3d"
          aria-pressed={viewMode === "3d"}
        >
          3D
        </button>
      </div>

      {mapScope === "local" && (
        <>
          <span className="hidden h-4 w-px bg-zinc-800 sm:block" aria-hidden />

          <label className="inline-flex items-center gap-1.5">
            <span className="hidden font-mono text-[9px] uppercase tracking-[1px] text-zinc-600 sm:inline">
              Model
            </span>
            <select
              value={embeddingModelId}
              onChange={(e) => setEmbeddingModelId(e.target.value)}
              className={`${selectClass} max-w-[11rem] sm:max-w-[14rem]`}
              title="Select embedding model (vectors are only comparable within a model)"
              aria-label="Embedding model"
              data-map-embedding-model-select
            >
              {(embeddingModels.length > 0
                ? embeddingModels
                : [
                    {
                      id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
                      label: "Knowledge config v1 (D=64)",
                      dim: 64,
                    },
                  ]
              ).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {typeof m.dim === "number" && m.dim > 0 ? ` · D=${m.dim}` : ""}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {/* Project: 2D / Local 3D / Global Map multi-algo layout (x,y,z) */}
      <span className="hidden h-4 w-px bg-zinc-800 sm:block" aria-hidden />

      <label className="inline-flex items-center gap-1.5" data-map-projection-picker>
        <span className="hidden font-mono text-[9px] uppercase tracking-[1px] text-zinc-600 sm:inline">
          Project
        </span>
        <select
          value={projectionAlgorithm}
          onChange={(e) =>
            setProjectionAlgorithm(parseProjectionAlgorithmId(e.target.value, "pca"))
          }
          className={selectClass}
          title={activeAlgoMeta?.description || "2D / 3D / Global projection algorithm"}
          aria-label="Projection algorithm (2D, Local 3D, and Global Map)"
          data-map-projection-select
          data-map-3d-projection-select
        >
          {PROJECTION_ALGORITHM_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id} title={opt.description}>
              {opt.shortLabel}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={() => void (fullscreen ? exitFullscreen() : enterFullscreen())}
        className={`${toolBtnClass(fullscreen)} ml-auto`}
        aria-pressed={fullscreen}
        title={fullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
      >
        {fullscreen ? <Minimize2 size={13} aria-hidden /> : <Maximize2 size={13} aria-hidden />}
        <span className="ml-1 hidden sm:inline">{fullscreen ? "Exit" : "Fullscreen"}</span>
      </button>
    </div>
  );

  /** Collapsible Find yourself — replaces the old Embedding space details panel. */
  const findYourselfPanel = (
    <aside
      id="map-find-yourself"
      data-map-find-yourself
      data-expanded={findYourselfOpen ? "true" : "false"}
      className="mt-3 border border-zinc-800 bg-zinc-950/70 backdrop-blur-sm"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
        aria-expanded={findYourselfOpen}
        aria-controls="map-find-yourself-panel"
        onClick={() => setFindYourselfOpen((open) => !open)}
        data-map-find-yourself-toggle
      >
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
            Placement
          </p>
          <p className="mt-0.5 text-sm font-medium text-white">Find yourself</p>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-zinc-500 transition-transform ${
            findYourselfOpen ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {findYourselfOpen && (
        <div
          id="map-find-yourself-panel"
          className="border-t border-zinc-800/80 px-4 pb-4 pt-3"
          data-map-find-yourself-panel
        >
          <p className="text-xs leading-relaxed text-zinc-400">
            Paste the private session link you saved after minting. Once your practice is processed,
            we overlay you on the map and open Local Map focused on your workspace.
          </p>
          <label className="mt-3 block">
            <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
              Your placement link
            </span>
            <input
              type="url"
              value={findYourselfLink}
              onChange={(e) => {
                setFindYourselfLink(e.target.value);
                setFindYourselfError(null);
                setFindYourselfOk(null);
                setFindYourselfAwaitingSnapshot(false);
                setNotifyMessage(null);
                setNotifyError(null);
              }}
              placeholder="https://…/tap/session/…"
              className="mt-1.5 w-full rounded-sm border border-zinc-800 bg-black/40 px-3 py-2.5 font-mono text-xs text-white placeholder:text-zinc-600"
              data-map-find-yourself-link-input
              aria-label="Placement session link"
            />
          </label>
          <button
            type="button"
            disabled={findYourselfBusy || !findYourselfLink.trim()}
            onClick={() => void applyFindYourself()}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-white bg-transparent px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-40"
            data-map-find-yourself-submit
          >
            {findYourselfBusy ? "Looking…" : "Show me on the map"}
          </button>
          {findYourselfError ? (
            <div
              role="alert"
              className="mt-2 rounded-sm border border-amber-500/25 bg-amber-950/20 px-3 py-2.5"
              data-map-find-yourself-error
              data-map-not-on-map={findYourselfAwaitingSnapshot ? "true" : undefined}
            >
              <p className="text-xs leading-relaxed text-amber-100/90">{findYourselfError}</p>
              {findYourselfAwaitingSnapshot ? (
                <div className="mt-3 space-y-2" data-map-ready-notify data-map-newsletter-subscribe>
                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-amber-200/60">
                      Email
                    </span>
                    <input
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => {
                        setNotifyEmail(e.target.value);
                        setNotifyError(null);
                        setNotifyMessage(null);
                      }}
                      placeholder="you@example.com"
                      className="mt-1.5 w-full rounded-sm border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                      data-map-ready-notify-email
                      data-map-newsletter-email
                      aria-label="Email for Uncertain Systems newsletter"
                    />
                  </label>
                  <p
                    className="text-[11px] leading-relaxed text-amber-100/55"
                    data-map-newsletter-subscribe-note
                  >
                    {MAP_NEWSLETTER_SUBSCRIBE_NOTE}
                  </p>
                  <button
                    type="button"
                    disabled={notifyBusy || !notifyEmail.trim()}
                    onClick={() => void submitNotifyWhenReady()}
                    className="inline-flex w-full items-center justify-center rounded-sm border border-white/80 bg-transparent px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10 disabled:opacity-40"
                    data-map-ready-notify-submit
                    data-map-newsletter-submit
                  >
                    {notifyBusy ? "Saving…" : "Subscribe to newsletter"}
                  </button>
                  {notifyError ? (
                    <p className="text-[11px] text-red-300" data-map-ready-notify-error>
                      {notifyError}
                    </p>
                  ) : null}
                  {notifyMessage ? (
                    <p className="text-[11px] text-cyan-200/90" data-map-ready-notify-success>
                      {notifyMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {findYourselfOk ? (
            <p
              className="mt-2 text-xs leading-relaxed text-cyan-200/90"
              data-map-find-yourself-success
            >
              {findYourselfOk}
            </p>
          ) : null}
        </div>
      )}
    </aside>
  );

  const mapSurface = (
    <div
      className={`flex min-h-0 flex-col overflow-hidden border border-zinc-800 bg-zinc-950/90 ${
        fullscreen ? "min-h-0 flex-1" : ""
      }`}
      data-map-surface
      data-map-scope={mapScope}
      data-map-view={mapScope === "global" ? `global-${viewMode}` : viewMode}
      data-map-fullscreen={fullscreen ? "true" : "false"}
    >
      {mapToolbar}
      <div className={`relative min-h-0 ${fullscreen ? "flex-1" : ""}`}>
        {/* Soft vignette only on Local Map — Global 2D keeps a clean infinite grid */}
        {mapScope === "local" ? (
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,0.08),transparent_55%)]" />
        ) : null}
        {loading ? (
          <div
            className={`relative z-[1] flex items-center justify-center text-sm text-zinc-500 ${
              fullscreen ? "h-full min-h-[240px]" : "h-[min(58vh,520px)]"
            }`}
          >
            Projecting public embedding space…
          </div>
        ) : mapScope === "global" ? (
          <MapOfKnowledgeGlobal
            userLocations={projectedUsers}
            regions={visibleRegions}
            projectionAlgorithm={projectionAlgorithm}
            viewMode={viewMode}
            fill={fullscreen}
            className={fullscreen ? "relative z-[1] h-full min-h-0 flex-1" : "relative z-[1]"}
            selectedRegionId={globalSelectedRegionId}
            onSelectRegion={(summary) =>
              setGlobalSelectedRegionId(summary?.region_id ?? null)
            }
            onOpenLocalMap={openLocalMapFocusedOnRegion}
          />
        ) : viewMode === "3d" ? (
          <MapOfKnowledge3D
            userLocations={projectedUsers}
            regions={visibleRegions}
            projectionAlgorithm={projectionAlgorithm}
            focusedUserId={focusedUserId}
            fill={fullscreen}
            className={fullscreen ? "relative z-[1] h-full min-h-0 flex-1" : "relative z-[1]"}
          />
        ) : (
          <MapOfKnowledge2D
            userLocations={projectedUsers}
            regions={visibleRegions}
            projectionAlgorithm={projectionAlgorithm}
            focusedUserId={focusedUserId}
            fill={fullscreen}
            className={fullscreen ? "relative z-[1] h-full min-h-0 flex-1" : "relative z-[1]"}
          />
        )}
      </div>
      {mapScope === "global" && viewMode === "2d" && !loading && (
        <div className="sr-only" aria-live="polite">
          Global Map 2D: regions as dots with membership orbits; drag to pan, scroll to zoom.
        </div>
      )}
      {mapScope === "global" && viewMode === "3d" && !loading && (
        <div className="sr-only" aria-live="polite">
          Global Map 3D: multi-algo region graph; drag to orbit, scroll to zoom, click a region for summary.
        </div>
      )}
      {mapScope === "local" && viewMode === "3d" && !loading && (
        <div className="sr-only" aria-live="polite">
          3D map: drag to orbit, right-drag or two-finger to pan, scroll to zoom, double-click to reset.
        </div>
      )}
      {mapScope === "local" && viewMode === "2d" && !loading && (
        <div className="sr-only" aria-live="polite">
          2D map: drag or arrows to pan, scroll or pinch to zoom, plus minus to zoom, zero or R to reset.
        </div>
      )}
    </div>
  );

  const regionsPanel = (
    <aside
      className={`border border-zinc-800 bg-zinc-950/70 p-4 backdrop-blur-sm ${
        fullscreen ? "flex min-h-0 w-full flex-col md:w-72 md:shrink-0" : ""
      }`}
      data-map-regions-panel
    >
      <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">Regions</p>
      <p className="mt-1 text-xs text-zinc-500">
        Grouped by workspace — expand a field, then toggle expert regions.
      </p>
      <ul
        className={`mt-3 space-y-2 overflow-y-auto pr-1 ${
          fullscreen ? "min-h-0 flex-1" : "max-h-[min(52vh,400px)]"
        }`}
        data-map-region-workspace-groups
      >
        {regionWorkspaceGroups.length > 0 ? (
          regionWorkspaceGroups.map((group) => {
            const expanded = expandedRegionWorkspaces.has(group.workspace_id);
            const enabledInGroup = group.regions.filter((r) =>
              enabledRegions.has(r.id),
            ).length;
            const hasSelection = enabledInGroup > 0;
            const allSelected =
              group.regions.length > 0 && enabledInGroup === group.regions.length;
            const groupRegionIds = group.regions.map((r) => r.id);
            return (
              <li
                key={group.workspace_id}
                className={`rounded-sm border bg-black/20 ${
                  hasSelection ? "border-zinc-500/80" : "border-zinc-800/90"
                }`}
                data-map-region-workspace-group
                data-workspace-id={group.workspace_id}
                data-expanded={expanded ? "true" : "false"}
                data-has-selection={hasSelection ? "true" : "false"}
              >
                <div className="flex items-stretch gap-0">
                  <button
                    type="button"
                    onClick={() => toggleRegionWorkspaceGroup(group.workspace_id)}
                    className={`flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-xs transition hover:bg-zinc-900/60 ${
                      hasSelection ? "text-white" : "text-zinc-500"
                    }`}
                    aria-expanded={expanded}
                    data-map-region-workspace-toggle
                  >
                    <ChevronDown
                      size={14}
                      className={`shrink-0 transition-transform ${
                        expanded ? "rotate-0" : "-rotate-90"
                      } ${hasSelection ? "text-white" : "text-zinc-600"}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate font-medium ${
                          hasSelection ? "text-white" : "text-zinc-500"
                        }`}
                      >
                        {group.workspace_title}
                      </span>
                      <span
                        className={`block text-[10px] ${
                          hasSelection ? "text-zinc-300" : "text-zinc-600"
                        }`}
                      >
                        {enabledInGroup}/{group.regions.length} on
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAllRegionsInWorkspace(groupRegionIds);
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
                        ? `Clear all regions in ${group.workspace_title}`
                        : `Select all regions in ${group.workspace_title}`
                    }
                    aria-label={
                      allSelected
                        ? `Unselect all regions in ${group.workspace_title}`
                        : `Select all regions in ${group.workspace_title}`
                    }
                    data-map-region-workspace-select-all
                    data-select-all-state={allSelected ? "all" : hasSelection ? "partial" : "none"}
                  >
                    {allSelected ? "None" : "All"}
                  </button>
                </div>
                {expanded && (
                  <ul className="space-y-1 border-t border-zinc-800/80 px-1.5 py-1.5" data-map-region-list>
                    {group.regions.map((region) => {
                      const on = enabledRegions.has(region.id);
                      return (
                        <li key={region.id}>
                          <button
                            type="button"
                            onClick={() => toggleRegion(region.id)}
                            className={`flex w-full items-start gap-2 rounded-sm border px-2.5 py-2 text-left text-xs transition ${
                              on
                                ? "border-cyan-500/25 bg-cyan-950/20 text-zinc-200"
                                : "border-zinc-800 bg-transparent text-zinc-500 hover:border-zinc-700"
                            }`}
                            data-map-region-toggle
                          >
                            <span
                              className={`mt-0.5 h-3 w-3 shrink-0 rounded-sm border ${
                                on ? "border-cyan-400 bg-cyan-400/80" : "border-zinc-600"
                              }`}
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{region.name}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })
        ) : (
          <li className="text-xs text-zinc-600">No public regions yet.</li>
        )}
      </ul>
    </aside>
  );

  return (
    <div className="space-y-12">
      <section id="map-canvas" aria-labelledby="map-canvas-heading" className="scroll-mt-4">
        <div
          ref={mapShellRef}
          className={
            fullscreen
              ? "fixed inset-0 z-[100] flex flex-col bg-[#050505] p-3 sm:p-4"
              : undefined
          }
        >
          {fullscreen ? (
            <h2 id="map-canvas-heading" className="sr-only">
              2D & 3D knowledge configuration
            </h2>
          ) : (
            <div className="mb-2 min-w-0">
              <div className="mb-1 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-2.5 py-0.5 font-mono text-[10px] tracking-[2px] text-zinc-500">
                EMBEDDING SPACE
              </div>
              <h2
                id="map-canvas-heading"
                className="text-lg font-medium tracking-tight text-white sm:text-xl"
              >
                2D & 3D knowledge configuration
              </h2>
            </div>
          )}

          {!fullscreen && findYourselfPanel}

          <div
            className={
              fullscreen
                ? "flex min-h-0 flex-1 flex-col gap-3 md:flex-row"
                : "mt-2 grid gap-3 lg:grid-cols-[1fr_260px]"
            }
          >
            {mapSurface}
            {regionsPanel}
          </div>
        </div>
      </section>

      <section id="map-place-yourself" aria-labelledby="map-place-heading">
        <div className="mb-3 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
          ANONYMOUS PLACEMENT
        </div>
        <h2 id="map-place-heading" className="text-xl font-medium tracking-tight text-white sm:text-2xl">
          Put yourself on the map
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Place yourself on the Map of Knowledge by running a short timed session on a public
          workspace. Choose a{" "}
          <span className="text-zinc-300">timed exploratory dialog</span> (interactive LLM-powered
          dialog) or a <span className="text-amber-200/90">timed exercise without dialog</span>{" "}
          (solo monolog).
          In both cases you still <span className="text-zinc-300">think aloud</span> — then you
          appear on the map after you practice.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.05fr]">
          {/* Identity + scope */}
          <div className="space-y-4 border border-zinc-800 bg-zinc-950/70 p-5 backdrop-blur-sm sm:p-6">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                Guest identity
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-900"
                  data-guest-avatar
                  data-guest-avatar-id={guestIdentity.avatar_id}
                  title={guestIdentity.avatar_label}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={guestIdentity.avatar_path}
                    alt={guestIdentity.avatar_label}
                    width={44}
                    height={44}
                    className="h-11 w-11 object-cover"
                  />
                </span>
                <span
                  className="min-w-0 flex-1 truncate rounded-sm border border-zinc-800 bg-black/40 px-3 py-2.5 text-sm text-zinc-200"
                  data-guest-display-name
                  aria-label="Guest display name"
                  title={guestName}
                >
                  {guestName}
                </span>
                <button
                  type="button"
                  onClick={regenerateGuest}
                  className="rounded-sm border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  data-guest-reshuffle
                  title="Generate a new guest name and avatar"
                >
                  Reshuffle
                </button>
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                Public workspace
              </label>
              <select
                value={selectedWorkspaceId}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                className="mt-1.5 w-full rounded-sm border border-zinc-800 bg-black/40 px-3 py-2.5 text-sm text-white"
                data-map-placement-workspace-select
              >
                {placementWorkspaces.length === 0 && (
                  <option value="">No public knowledge workspaces</option>
                )}
                {placementWorkspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                Block
              </label>
              <select
                value={selectedBlockId}
                onChange={(e) => setSelectedBlockId(e.target.value)}
                className="mt-1.5 w-full rounded-sm border border-zinc-800 bg-black/40 px-3 py-2.5 text-sm text-white"
              >
                {blocksForWorkspace.length === 0 && <option value="">No blocks</option>}
                {blocksForWorkspace.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600">
              Anonymous guest sessions are scoped to the public workspace you choose. Display name is
              local chrome only — map identity is a guest subject UUID.
            </p>
          </div>

          {/* Timed Exploration / Timed Drill product cards + result */}
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Timed Exploration card: duration options live inside the box so they aren't missed */}
              <div
                className="flex flex-col rounded-sm border border-zinc-700 bg-zinc-950/80 p-4 transition hover:border-zinc-500"
                data-mint-timed-explore-card
                data-timed-explore-minutes={timedExploreMinutes}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.5)]" />
                  <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                    {PLACEMENT_PRODUCTS.timed_explore.eyebrow}
                  </span>
                </span>
                <span className="mt-2 text-base font-medium text-white">
                  {PLACEMENT_PRODUCTS.timed_explore.label}
                </span>
                <span className="mt-1 text-xs leading-relaxed text-zinc-500">
                  {PLACEMENT_PRODUCTS.timed_explore.shortDiff}
                </span>

                <div
                  className="mt-3 w-full"
                  data-timed-explore-duration-picker
                >
                  <p
                    className="mb-1.5 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500"
                    id="timed-explore-duration-label"
                  >
                    Session length
                  </p>
                  <div
                    className="inline-flex w-full rounded-sm border border-zinc-700 bg-black/40 p-0.5"
                    role="group"
                    aria-labelledby="timed-explore-duration-label"
                    data-timed-explore-duration-options
                  >
                    {TIMED_EXPLORE_DURATION_OPTIONS.map((mins) => {
                      const selected = timedExploreMinutes === mins;
                      return (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setTimedExploreMinutes(mins)}
                          disabled={minting !== null}
                          className={`min-w-0 flex-1 rounded-sm px-2 py-1.5 font-mono text-[11px] tracking-wide transition ${
                            selected
                              ? "bg-white/15 text-white"
                              : "text-zinc-500 hover:text-zinc-200"
                          } disabled:opacity-40`}
                          data-timed-explore-duration={mins}
                          aria-pressed={selected}
                        >
                          {mins} min
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!selectedBlockId || minting !== null}
                  onClick={() => void mintLink("timed_explore")}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
                  data-mint-timed-explore
                  data-mint-tap
                >
                  {minting === "timed_explore"
                    ? PLACEMENT_PRODUCTS.timed_explore.mintingLabel
                    : `Get ${timedExploreMinutes}-minute session URL`}
                  <ExternalLink size={12} aria-hidden />
                </button>
              </div>

              {/* Timed Drill card: duration options (15 / 30 / 45) inside the box */}
              <div
                className="flex flex-col rounded-sm border border-amber-500/30 bg-amber-950/20 p-4 transition hover:border-amber-400/50"
                data-mint-timed-drill-card
                data-timed-drill-minutes={timedDrillMinutes}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.65)]" />
                  <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-amber-200/70">
                    {PLACEMENT_PRODUCTS.timed_drill.eyebrow}
                  </span>
                </span>
                <span className="mt-2 text-base font-medium text-amber-50">
                  {PLACEMENT_PRODUCTS.timed_drill.label}
                </span>
                <span className="mt-1 text-xs leading-relaxed text-amber-100/50">
                  {PLACEMENT_PRODUCTS.timed_drill.shortDiff}
                </span>

                <div className="mt-3 w-full" data-timed-drill-duration-picker>
                  <p
                    className="mb-1.5 font-mono text-[10px] uppercase tracking-[1.5px] text-amber-200/60"
                    id="timed-drill-duration-label"
                  >
                    Session length
                  </p>
                  <div
                    className="inline-flex w-full rounded-sm border border-amber-500/25 bg-black/30 p-0.5"
                    role="group"
                    aria-labelledby="timed-drill-duration-label"
                    data-timed-drill-duration-options
                  >
                    {TIMED_DRILL_DURATION_OPTIONS.map((mins) => {
                      const selected = timedDrillMinutes === mins;
                      return (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setTimedDrillMinutes(mins)}
                          disabled={minting !== null}
                          className={`min-w-0 flex-1 rounded-sm px-2 py-1.5 font-mono text-[11px] tracking-wide transition ${
                            selected
                              ? "bg-amber-500/20 text-amber-50"
                              : "text-amber-100/45 hover:text-amber-100/80"
                          } disabled:opacity-40`}
                          data-timed-drill-duration={mins}
                          aria-pressed={selected}
                        >
                          {mins} min
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!selectedBlockId || minting !== null}
                  onClick={() => void mintLink("timed_drill")}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs font-medium text-amber-50 transition hover:border-amber-400/60 hover:bg-amber-900/40 disabled:opacity-40"
                  data-mint-timed-drill
                >
                  <Sparkles size={12} aria-hidden />
                  {minting === "timed_drill"
                    ? PLACEMENT_PRODUCTS.timed_drill.mintingLabel
                    : `Get ${timedDrillMinutes}-minute session URL`}
                </button>
              </div>
            </div>

            {mintError && (
              <div
                role="alert"
                className="rounded-sm border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-300"
              >
                {mintError}
              </div>
            )}

            {mintResult && (
              <div
                data-minted-link-card
                data-minted-kind={mintResult.kind}
                className={`rounded-sm border p-4 sm:p-5 ${
                  mintResult.kind === "timed_drill"
                    ? "border-amber-500/35 bg-gradient-to-br from-amber-950/40 via-zinc-950/80 to-zinc-950/90"
                    : "border-zinc-600 bg-gradient-to-br from-zinc-900/90 via-zinc-950/90 to-zinc-950"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                        mintResult.kind === "timed_drill"
                          ? "border-amber-400/40 bg-amber-500/15"
                          : "border-slate-400/30 bg-slate-500/10"
                      }`}
                      aria-hidden
                    >
                      <span
                        className={`h-3 w-3 rounded-full ${
                          mintResult.kind === "timed_drill"
                            ? "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]"
                            : "bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.55)]"
                        }`}
                      />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[1.5px] ${
                            mintResult.kind === "timed_drill"
                              ? "border-amber-400/35 bg-amber-500/10 text-amber-200"
                              : "border-zinc-600 bg-zinc-800/80 text-zinc-300"
                          }`}
                        >
                          {PLACEMENT_PRODUCTS[mintResult.kind].label}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          Timed guest session · map placement
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-white">
                        Ready for {mintResult.guest_display_name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {mintResult.workspace_title}
                        <span className="text-zinc-700"> · </span>
                        {mintResult.block_title}
                        {mintResult.minutes > 0 ? (
                          <>
                            <span className="text-zinc-700"> · </span>
                            <span data-minted-duration-minutes={mintResult.minutes}>
                              {mintResult.minutes} min
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-sm border border-zinc-800/90 bg-black/50 px-3 py-2.5">
                  <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-zinc-600">
                    Private session URL
                  </p>
                  <a
                    href={mintResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-1 block break-all font-mono text-xs leading-relaxed underline-offset-2 hover:underline sm:text-sm ${
                      mintResult.kind === "timed_drill" ? "text-amber-200/90" : "text-cyan-300/90"
                    }`}
                    title={mintResult.url}
                  >
                    <span className="sm:hidden">{truncateUrl(mintResult.url, 36)}</span>
                    <span className="hidden sm:inline">{truncateUrl(mintResult.url, 64)}</span>
                  </a>
                </div>

                <div
                  className="mt-3 rounded-sm border border-amber-500/30 bg-amber-950/25 px-3 py-2.5"
                  data-minted-save-link-reminder
                  role="note"
                >
                  <p className="text-sm font-medium text-amber-100">
                    Save this link if you want to find yourself on the map later
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
                    After you finish the session and your practice is processed, come back to Map of
                    Knowledge, open <span className="text-amber-50">Find yourself</span>, and paste
                    this URL to overlay your position on Local Map. If you lose the link, we cannot
                    match you to your dot.
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={mintResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-sm px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
                      mintResult.kind === "timed_drill"
                        ? "bg-amber-400 text-black hover:bg-amber-300"
                        : "bg-white text-black hover:bg-zinc-200"
                    }`}
                  >
                    Open session
                    <ExternalLink size={14} aria-hidden />
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyMintedLink()}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-zinc-700 bg-black/40 px-4 py-2.5 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white sm:flex-none"
                  >
                    {linkCopied ? (
                      <>
                        <Check size={14} aria-hidden />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy size={14} aria-hidden />
                        Copy link
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {!mintResult && !mintError && (
              <div className="flex items-center gap-3 rounded-sm border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-3 text-xs text-zinc-600">
                <span className="inline-flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-500" />
                  <span className="h-2 w-2 rounded-full bg-amber-400/80" />
                </span>
                Mint a link, think aloud in the session, then appear on the map.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
