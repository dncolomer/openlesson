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
  filterEnabledRegions,
  generateAnonymousGuestIdentity,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  parseProjectionAlgorithmId,
  pickRandomEnabledRegionIds,
  PROJECTION_ALGORITHM_OPTIONS,
  reprojectMapLayout,
  type MapOfKnowledgePayload,
  type MapRegion,
  type MapUserLocation,
  type ProjectionAlgorithmId,
} from "@/lib/map-of-knowledge";
import { MapOfKnowledge2D } from "@/components/MapOfKnowledge2D";
import { MapOfKnowledge3D } from "@/components/MapOfKnowledge3D";

type ViewMode = "2d" | "3d";

export function MapOfKnowledgeClient() {
  const [data, setData] = useState<MapOfKnowledgePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [projectionAlgorithm, setProjectionAlgorithm] =
    useState<ProjectionAlgorithmId>("pca");
  const [embeddingModelId, setEmbeddingModelId] = useState<string>(
    KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  );
  const [enabledRegions, setEnabledRegions] = useState<Set<string>>(new Set());
  const [fullscreen, setFullscreen] = useState(false);
  const [guestName, setGuestName] = useState(() => generateAnonymousGuestIdentity(42).display_name);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [minting, setMinting] = useState<"tap" | "ile" | null>(null);
  const [mintResult, setMintResult] = useState<{
    url: string;
    kind: "tap" | "ile";
    golden: boolean;
    guest_display_name: string;
    workspace_title: string;
    block_title: string;
  } | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [embeddingInfoOpen, setEmbeddingInfoOpen] = useState(false);

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
        // Only 3 regions on by default (random); rest start disabled
        const allRegionIds = ((payload.regions || []) as MapRegion[]).map((r) => r.id);
        setEnabledRegions(new Set(pickRandomEnabledRegionIds(allRegionIds, 3)));
        if (!workspaceInitRef.current) {
          workspaceInitRef.current = true;
          const firstWs = (payload.workspaces || [])[0];
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

  const blocksForWorkspace = useMemo(() => {
    if (!data) return [];
    return data.blocks.filter((b) => b.workspace_id === selectedWorkspaceId);
  }, [data, selectedWorkspaceId]);

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

  const regenerateGuest = () => {
    setGuestName(generateAnonymousGuestIdentity().display_name);
    setMintResult(null);
  };

  const mintLink = useCallback(
    async (kind: "tap" | "ile") => {
      if (!selectedWorkspaceId || !selectedBlockId) return;
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
            link_kind: kind,
            guest_display_name: guestName,
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
        setMintResult({
          url: json.private_url,
          kind: json.link_kind,
          golden: Boolean(json.map_dot_golden),
          guest_display_name:
            typeof json.guest_display_name === "string" && json.guest_display_name
              ? json.guest_display_name
              : guestName,
          workspace_title: wsTitle,
          block_title: blockTitle,
        });
        setLinkCopied(false);
      } catch (err) {
        setMintError(err instanceof Error ? err.message : "Failed to mint link");
      } finally {
        setMinting(null);
      }
    },
    [selectedWorkspaceId, selectedBlockId, guestName, data],
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
  const embeddingInfo = data?.embedding_info;
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
        aria-label="View mode"
      >
        <button
          type="button"
          onClick={() => setViewMode("2d")}
          className={`rounded-sm px-2.5 py-1 font-mono text-[11px] tracking-wide transition ${
            viewMode === "2d" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          2D
        </button>
        <button
          type="button"
          onClick={() => setViewMode("3d")}
          className={`rounded-sm px-2.5 py-1 font-mono text-[11px] tracking-wide transition ${
            viewMode === "3d" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          3D
        </button>
      </div>

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

      <label className="inline-flex items-center gap-1.5">
        <span className="hidden font-mono text-[9px] uppercase tracking-[1px] text-zinc-600 sm:inline">
          Project
        </span>
        <select
          value={projectionAlgorithm}
          onChange={(e) =>
            setProjectionAlgorithm(parseProjectionAlgorithmId(e.target.value, "pca"))
          }
          className={selectClass}
          title={activeAlgoMeta?.description || "Projection algorithm"}
          aria-label="Projection algorithm"
          data-map-projection-select
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

  const embeddingExplain = embeddingInfo ? (
    <aside
      id="map-embedding-info"
      data-map-embedding-info
      data-expanded={embeddingInfoOpen ? "true" : "false"}
      className="mt-3 border border-zinc-800 bg-zinc-950/70 backdrop-blur-sm"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
        aria-expanded={embeddingInfoOpen}
        aria-controls="map-embedding-info-panel"
        onClick={() => setEmbeddingInfoOpen((open) => !open)}
        data-map-embedding-info-toggle
      >
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
            Embedding space
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-white">
            {embeddingInfo.label}
            {embeddingInfo.dim > 0 ? (
              <span className="ml-2 font-mono text-xs font-normal text-zinc-500">
                D={embeddingInfo.dim}
              </span>
            ) : null}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-zinc-500 transition-transform ${
            embeddingInfoOpen ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {embeddingInfoOpen && (
        <div id="map-embedding-info-panel" className="border-t border-zinc-800/80 px-4 pb-4 pt-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="max-w-3xl text-xs leading-relaxed text-zinc-400">
                {embeddingInfo.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="border border-zinc-800 bg-black/40 px-3 py-2 text-center">
                <p className="font-mono text-[9px] uppercase tracking-[1px] text-zinc-600">Dim</p>
                <p className="mt-0.5 font-mono text-lg text-cyan-200/90">
                  {embeddingInfo.dim > 0 ? embeddingInfo.dim : "—"}
                </p>
              </div>
              {typeof embeddingInfo.struct_dim === "number" && (
                <div className="border border-zinc-800 bg-black/40 px-3 py-2 text-center">
                  <p className="font-mono text-[9px] uppercase tracking-[1px] text-zinc-600">Struct</p>
                  <p className="mt-0.5 font-mono text-lg text-zinc-200">{embeddingInfo.struct_dim}</p>
                </div>
              )}
              {typeof embeddingInfo.sem_dim === "number" && (
                <div className="border border-zinc-800 bg-black/40 px-3 py-2 text-center">
                  <p className="font-mono text-[9px] uppercase tracking-[1px] text-zinc-600">Sem</p>
                  <p className="mt-0.5 font-mono text-lg text-zinc-200">{embeddingInfo.sem_dim}</p>
                </div>
              )}
              <div className="border border-zinc-800 bg-black/40 px-3 py-2 text-center">
                <p className="font-mono text-[9px] uppercase tracking-[1px] text-zinc-600">Points</p>
                <p className="mt-0.5 font-mono text-lg text-zinc-200">
                  {embeddingInfo.point_count ?? projectedUsers.length}
                </p>
              </div>
              <div className="border border-zinc-800 bg-black/40 px-3 py-2 text-center">
                <p className="font-mono text-[9px] uppercase tracking-[1px] text-zinc-600">Regions</p>
                <p className="mt-0.5 font-mono text-lg text-zinc-200">
                  {embeddingInfo.region_count ?? projectedLayout.regions.length}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-3 font-mono text-[10px] text-zinc-600">
            model id · <span className="text-zinc-400">{embeddingInfo.id}</span>
            {activeAlgoMeta ? (
              <>
                {" "}
                · projection · <span className="text-zinc-400">{activeAlgoMeta.label}</span>
              </>
            ) : null}
          </p>
          {embeddingInfo.notes && embeddingInfo.notes.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-zinc-800/80 pt-2 text-[11px] leading-relaxed text-zinc-500">
              {embeddingInfo.notes.map((note) => (
                <li key={note} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  ) : null;

  const mapSurface = (
    <div
      className={`flex min-h-0 flex-col overflow-hidden border border-zinc-800 bg-zinc-950/90 ${
        fullscreen ? "min-h-0 flex-1" : ""
      }`}
      data-map-surface
      data-map-view={viewMode}
    >
      {mapToolbar}
      <div className={`relative min-h-0 ${fullscreen ? "flex-1" : ""}`}>
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,0.08),transparent_55%)]" />
        {loading ? (
          <div
            className={`relative z-[1] flex items-center justify-center text-sm text-zinc-500 ${
              fullscreen ? "h-full min-h-[240px]" : "h-[min(58vh,480px)]"
            }`}
          >
            Projecting public embedding space…
          </div>
        ) : viewMode === "3d" ? (
          <MapOfKnowledge3D
            userLocations={projectedUsers}
            regions={visibleRegions}
            fill={fullscreen}
            className={fullscreen ? "relative z-[1] h-full min-h-0 flex-1" : "relative z-[1]"}
          />
        ) : (
          <MapOfKnowledge2D
            userLocations={projectedUsers}
            regions={visibleRegions}
            projectionAlgorithm={projectionAlgorithm}
            fill={fullscreen}
            className={fullscreen ? "relative z-[1] h-full min-h-0 flex-1" : "relative z-[1]"}
          />
        )}
      </div>
      {viewMode === "3d" && !loading && (
        <div className="sr-only" aria-live="polite">
          3D map: drag to orbit, right-drag or two-finger to pan, scroll to zoom, double-click to reset.
        </div>
      )}
      {viewMode === "2d" && !loading && (
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
    >
      <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">Regions</p>
      <p className="mt-1 text-xs text-zinc-500">Toggle regions from all public workspaces.</p>
      <ul
        className={`mt-3 space-y-1.5 overflow-y-auto pr-1 ${
          fullscreen ? "min-h-0 flex-1" : "max-h-[min(52vh,400px)]"
        }`}
      >
        {data && data.regions.length > 0 ? (
          data.regions.map((region) => {
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
                >
                  <span
                    className={`mt-0.5 h-3 w-3 shrink-0 rounded-sm border ${
                      on ? "border-cyan-400 bg-cyan-400/80" : "border-zinc-600"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{region.name}</span>
                    <span className="block truncate text-[10px] text-zinc-500">
                      {region.workspace_title}
                    </span>
                  </span>
                </button>
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

          {!fullscreen && embeddingExplain}

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

      <section id="map-stats" aria-labelledby="map-stats-heading">
        <div className="mb-3 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
          AGGREGATED PROOF OF WORK
        </div>
        <h2 id="map-stats-heading" className="text-xl font-medium tracking-tight text-white sm:text-2xl">
          Signal across every public workspace
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-500">Loading public aggregates…</p>
        ) : error ? (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        ) : data ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Public workspaces", value: data.pow_stats.workspace_count },
              { label: "PoW artifacts", value: data.pow_stats.total_artifacts },
              { label: "Sessions", value: data.pow_stats.unique_sessions },
              { label: "Last 7 days", value: data.pow_stats.last_7d },
            ].map((stat) => (
              <div
                key={stat.label}
                className="border border-zinc-800 bg-zinc-950/70 px-5 py-4 backdrop-blur-sm"
              >
                <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-medium tracking-tight text-white">
                  {stat.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section id="map-place-yourself" aria-labelledby="map-place-heading">
        <div className="mb-3 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
          ANONYMOUS PLACEMENT
        </div>
        <h2 id="map-place-heading" className="text-xl font-medium tracking-tight text-white sm:text-2xl">
          Put yourself on the map
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Pick a public workspace and block, then mint a guest session link.{" "}
          <span className="text-zinc-300">TAP</span> places a standard slate dot;{" "}
          <span className="text-amber-200/90">ILE</span> places a golden one.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.05fr]">
          {/* Identity + scope */}
          <div className="space-y-4 border border-zinc-800 bg-zinc-950/70 p-5 backdrop-blur-sm sm:p-6">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                Guest identity
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="min-w-0 flex-1 rounded-sm border border-zinc-800 bg-black/40 px-3 py-2.5 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={regenerateGuest}
                  className="rounded-sm border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
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
              >
                {(data?.workspaces || []).length === 0 && (
                  <option value="">No public workspaces</option>
                )}
                {(data?.workspaces || []).map((ws) => (
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
                    {b.is_start ? " (start)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600">
              Anonymous guest sessions are scoped to the public workspace you choose. Display name is
              local chrome only — map identity is a guest subject UUID.
            </p>
          </div>

          {/* TAP / ILE product cards + result */}
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!selectedBlockId || minting !== null}
                onClick={() => void mintLink("tap")}
                className="group flex flex-col items-start rounded-sm border border-zinc-700 bg-zinc-950/80 p-4 text-left transition hover:border-zinc-500 hover:bg-zinc-900/80 disabled:opacity-40"
                data-mint-tap
              >
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.5)]" />
                  <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                    Think Aloud Protocol
                  </span>
                </span>
                <span className="mt-2 text-base font-medium text-white">
                  {minting === "tap" ? "Minting TAP…" : "Mint TAP link"}
                </span>
                <span className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Live cognition under probe. Renders as a{" "}
                  <span className="text-slate-300">standard slate dot</span> on the map.
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-300 transition group-hover:text-white">
                  Get private session URL
                  <ExternalLink size={12} aria-hidden />
                </span>
              </button>

              <button
                type="button"
                disabled={!selectedBlockId || minting !== null}
                onClick={() => void mintLink("ile")}
                className="group flex flex-col items-start rounded-sm border border-amber-500/30 bg-amber-950/20 p-4 text-left transition hover:border-amber-400/50 hover:bg-amber-950/35 disabled:opacity-40"
                data-mint-ile
              >
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.65)]" />
                  <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-amber-200/70">
                    Integrated Learning Env
                  </span>
                </span>
                <span className="mt-2 text-base font-medium text-amber-50">
                  {minting === "ile" ? "Minting ILE…" : "Mint ILE link"}
                </span>
                <span className="mt-1 text-xs leading-relaxed text-amber-100/50">
                  Immersive practice session. Renders as a{" "}
                  <span className="text-amber-200">golden map dot</span>.
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-amber-100/90 transition group-hover:text-amber-50">
                  <Sparkles size={12} aria-hidden />
                  Get private session URL
                </span>
              </button>
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
                  mintResult.kind === "ile"
                    ? "border-amber-500/35 bg-gradient-to-br from-amber-950/40 via-zinc-950/80 to-zinc-950/90"
                    : "border-zinc-600 bg-gradient-to-br from-zinc-900/90 via-zinc-950/90 to-zinc-950"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                        mintResult.kind === "ile"
                          ? "border-amber-400/40 bg-amber-500/15"
                          : "border-slate-400/30 bg-slate-500/10"
                      }`}
                      aria-hidden
                    >
                      <span
                        className={`h-3 w-3 rounded-full ${
                          mintResult.kind === "ile"
                            ? "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]"
                            : "bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.55)]"
                        }`}
                      />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[1.5px] ${
                            mintResult.kind === "ile"
                              ? "border-amber-400/35 bg-amber-500/10 text-amber-200"
                              : "border-zinc-600 bg-zinc-800/80 text-zinc-300"
                          }`}
                        >
                          {mintResult.kind === "ile" ? "ILE link" : "TAP link"}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {mintResult.golden ? "Golden map dot" : "Standard map dot"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-white">
                        Ready for {mintResult.guest_display_name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {mintResult.workspace_title}
                        <span className="text-zinc-700"> · </span>
                        {mintResult.block_title}
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
                    className={`mt-1 block break-all font-mono text-xs leading-relaxed underline-offset-2 hover:underline sm:text-sm ${
                      mintResult.kind === "ile" ? "text-amber-200/90" : "text-cyan-300/90"
                    }`}
                    title={mintResult.url}
                  >
                    <span className="sm:hidden">{truncateUrl(mintResult.url, 36)}</span>
                    <span className="hidden sm:inline">{truncateUrl(mintResult.url, 64)}</span>
                  </a>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={mintResult.url}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-sm px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
                      mintResult.kind === "ile"
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
                Mint a TAP or ILE link to appear on the map after you practice.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
