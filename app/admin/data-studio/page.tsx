"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminError, AdminLoading } from "@/components/admin/AdminStatus";
import { PowDetailsPanel } from "@/components/admin/PowDetailsPanel";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import {
  adminBtnClass,
  adminCardClass,
  adminCardPaddedClass,
  adminInputClass,
  adminLabelClass,
  adminPillClass,
  adminPrimaryBtnClass,
  adminSectionTitleClass,
  adminSelectClass,
  adminTableHeadClass,
} from "@/components/admin/styles";
import {
  consumePlatformBulkNdjson,
  formatPlatformBulkSnapshotProgress,
  initialPlatformBulkSnapshotProgress,
  parseDataStudioTab,
  reducePlatformBulkSnapshotProgress,
  type DataStudioTab,
  type PlatformBulkSnapshotState,
  type StudioOverviewCounts,
} from "@/lib/admin/data-studio";
import type { AdminProofOfWorkDetails } from "@/lib/admin/proof-of-work";
import { PROJECTION_ALGORITHM_OPTIONS } from "@/lib/knowledge-config";

type PowItem = AdminProofOfWorkDetails & {
  summary?: string;
  xaiFileId?: string | null;
  userId?: string | null;
};

type SnapshotKc = {
  id: string;
  workspace_id: string;
  subject_user_id: string | null;
  subject_guest_user_id: string | null;
  embedding_model_id: string;
  dim: number;
  as_of_ms: number;
  pow_event_count: number;
  confidence: number;
  trigger: string;
  created_at: string;
};

type SnapshotEval = {
  id: string;
  workspace_id: string;
  subject_user_id: string | null;
  subject_guest_user_id: string | null;
  vertical: string;
  score: number;
  ghc_score: number | null;
  source: string;
  ran_at: string;
};

type RegionItem = {
  id: string;
  workspace_id: string;
  workspace_title: string | null;
  name: string;
  description: string | null;
  embedding_model_id: string;
  dim: number;
  centroid: number[];
  cohort_cohesion: number;
  mean_radius: number;
  cosine_threshold: number;
  subject_count: number;
  created_at: string;
};

type XaiOrgItem = {
  id: string;
  name: string;
  plan: string | null;
  xai_api_key_id: string | null;
  xai_api_key_name: string | null;
  xai_api_key_status: string | null;
  xai_collection_id: string | null;
  xai_collection_status: string | null;
  usage: {
    available: boolean;
    totalUsd?: number;
    periodStart?: string;
    periodEnd?: string;
    error?: string;
  } | null;
};

type BulkWorkspace = {
  id: string;
  title: string | null;
  root_topic: string | null;
  label: string;
};

type ProjectionResponse = {
  workspace: { id: string; title: string };
  point_count: number;
  region_count: number;
  projection: {
    algorithm: string;
    frame_id: string;
    displayMode: string;
    bounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
    coords: Array<{ x: number; y: number; screenX: number; screenY: number; confidence?: number }>;
    regionOverlays: Array<{
      id: string;
      name: string;
      x: number;
      y: number;
      radius: number;
      screenX: number;
      screenY: number;
      screenRadius: number;
    }>;
  };
};

const TABS: Array<{ id: DataStudioTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "pow", label: "Proof of Work" },
  { id: "snapshots", label: "Snapshots" },
  { id: "regions", label: "Regions" },
  { id: "xai", label: "xAI" },
  { id: "bulk", label: "Bulk Snapshot" },
  { id: "projections", label: "Projections" },
];

export default function AdminDataStudioPage() {
  const { loading, error, isAdmin } = useAdminGuard();
  const [tab, setTab] = useState<DataStudioTab>("overview");

  // Overview
  const [counts, setCounts] = useState<StudioOverviewCounts | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // PoW
  const [powItems, setPowItems] = useState<PowItem[]>([]);
  const [powPage, setPowPage] = useState(1);
  const [powTotalPages, setPowTotalPages] = useState(1);
  const [powTotal, setPowTotal] = useState(0);
  const [powSearch, setPowSearch] = useState("");
  const [powType, setPowType] = useState("");
  const [powLoading, setPowLoading] = useState(false);
  const [powError, setPowError] = useState<string | null>(null);
  const [expandedPowId, setExpandedPowId] = useState<string | null>(null);

  // Snapshots
  const [kcItems, setKcItems] = useState<SnapshotKc[]>([]);
  const [evalItems, setEvalItems] = useState<SnapshotEval[]>([]);
  const [snapshotTitles, setSnapshotTitles] = useState<Record<string, string>>({});
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotWsFilter, setSnapshotWsFilter] = useState("");

  // Regions
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [regionsTotal, setRegionsTotal] = useState(0);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [regionSearch, setRegionSearch] = useState("");
  const [evalRegionId, setEvalRegionId] = useState<string | null>(null);
  const [regionEvalResult, setRegionEvalResult] = useState<string | null>(null);

  // xAI
  const [xaiItems, setXaiItems] = useState<XaiOrgItem[]>([]);
  const [xaiPowFiles, setXaiPowFiles] = useState<{
    total: number;
    sample: Array<{ id: string; xai_file_id: string; file_name: string; created_at: string }>;
  } | null>(null);
  const [xaiMgmt, setXaiMgmt] = useState(false);
  const [xaiLoading, setXaiLoading] = useState(false);
  const [xaiError, setXaiError] = useState<string | null>(null);
  const [xaiIncludeUsage, setXaiIncludeUsage] = useState(false);

  // Bulk
  const [bulkWorkspaces, setBulkWorkspaces] = useState<BulkWorkspace[]>([]);
  const [selectedWs, setSelectedWs] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<PlatformBulkSnapshotState>(
    initialPlatformBulkSnapshotProgress(),
  );
  const [bulkLoadingList, setBulkLoadingList] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Projection
  const [projWorkspaceId, setProjWorkspaceId] = useState("");
  const [projAlgo, setProjAlgo] = useState("random");
  const [projMode, setProjMode] = useState<"trajectory" | "latest">("trajectory");
  const [projData, setProjData] = useState<ProjectionResponse | null>(null);
  const [projLoading, setProjLoading] = useState(false);
  const [projError, setProjError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setOverviewError(null);
    try {
      const res = await fetch("/api/admin/data-studio/overview");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load overview");
      setCounts(data.counts);
    } catch (err) {
      setOverviewError(err instanceof Error ? err.message : "Failed to load overview");
    }
  }, []);

  const loadPow = useCallback(async () => {
    setPowLoading(true);
    setPowError(null);
    try {
      const qs = new URLSearchParams({
        page: String(powPage),
        pageSize: "25",
      });
      if (powSearch.trim()) qs.set("search", powSearch.trim());
      if (powType.trim()) qs.set("type", powType.trim());
      const res = await fetch(`/api/admin/data-studio/pow?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load PoW");
      setPowItems(data.items || []);
      setPowTotal(data.totalCount || 0);
      setPowTotalPages(data.totalPages || 1);
    } catch (err) {
      setPowError(err instanceof Error ? err.message : "Failed to load PoW");
    } finally {
      setPowLoading(false);
    }
  }, [powPage, powSearch, powType]);

  const loadSnapshots = useCallback(async () => {
    setSnapshotLoading(true);
    setSnapshotError(null);
    try {
      const qs = new URLSearchParams({ kind: "both", page: "1", pageSize: "30" });
      if (snapshotWsFilter.trim()) qs.set("workspaceId", snapshotWsFilter.trim());
      const res = await fetch(`/api/admin/data-studio/snapshots?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load snapshots");
      setKcItems(data.knowledgeConfigs || []);
      setEvalItems(data.evalRuns || []);
      setSnapshotTitles(data.workspaceTitles || {});
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : "Failed to load snapshots");
    } finally {
      setSnapshotLoading(false);
    }
  }, [snapshotWsFilter]);

  const loadRegions = useCallback(async () => {
    setRegionsLoading(true);
    setRegionsError(null);
    try {
      const qs = new URLSearchParams({ page: "1", pageSize: "50" });
      if (regionSearch.trim()) qs.set("search", regionSearch.trim());
      const res = await fetch(`/api/admin/data-studio/regions?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load regions");
      setRegions(data.items || []);
      setRegionsTotal(data.totalCount || 0);
    } catch (err) {
      setRegionsError(err instanceof Error ? err.message : "Failed to load regions");
    } finally {
      setRegionsLoading(false);
    }
  }, [regionSearch]);

  const loadXai = useCallback(async () => {
    setXaiLoading(true);
    setXaiError(null);
    try {
      const qs = new URLSearchParams({ page: "1", pageSize: "50" });
      if (xaiIncludeUsage) qs.set("includeUsage", "1");
      const res = await fetch(`/api/admin/data-studio/xai?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load xAI data");
      setXaiItems(data.items || []);
      setXaiMgmt(Boolean(data.managementConfigured));
      setXaiPowFiles(data.powWithXaiFiles || null);
    } catch (err) {
      setXaiError(err instanceof Error ? err.message : "Failed to load xAI data");
    } finally {
      setXaiLoading(false);
    }
  }, [xaiIncludeUsage]);

  const loadBulkWorkspaces = useCallback(async () => {
    setBulkLoadingList(true);
    setBulkError(null);
    try {
      const res = await fetch("/api/admin/data-studio/bulk-snapshot");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to list workspaces");
      setBulkWorkspaces(data.workspaces || []);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Failed to list workspaces");
    } finally {
      setBulkLoadingList(false);
    }
  }, []);

  const loadProjection = useCallback(async () => {
    if (!projWorkspaceId.trim()) {
      setProjError("Enter a workspace id");
      return;
    }
    setProjLoading(true);
    setProjError(null);
    try {
      const qs = new URLSearchParams({
        workspaceId: projWorkspaceId.trim(),
        algorithm: projAlgo,
        displayMode: projMode,
      });
      const res = await fetch(`/api/admin/data-studio/projection?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load projection");
      setProjData(data);
    } catch (err) {
      setProjData(null);
      setProjError(err instanceof Error ? err.message : "Failed to load projection");
    } finally {
      setProjLoading(false);
    }
  }, [projWorkspaceId, projAlgo, projMode]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === "overview") void loadOverview();
    if (tab === "pow") void loadPow();
    if (tab === "snapshots") void loadSnapshots();
    if (tab === "regions") void loadRegions();
    if (tab === "xai") void loadXai();
    if (tab === "bulk") void loadBulkWorkspaces();
  }, [
    isAdmin,
    tab,
    loadOverview,
    loadPow,
    loadSnapshots,
    loadRegions,
    loadXai,
    loadBulkWorkspaces,
  ]);

  const bulkProgressText = useMemo(
    () => formatPlatformBulkSnapshotProgress(bulkProgress),
    [bulkProgress],
  );

  const runBulkSnapshot = async (mode: "selected" | "all") => {
    if (bulkProgress.phase === "running") return;
    setBulkError(null);
    setBulkProgress(initialPlatformBulkSnapshotProgress());

    const body =
      mode === "all"
        ? { all: true, stream: true, maxWorkspaces: 50 }
        : { workspaceIds: Array.from(selectedWs), stream: true, maxWorkspaces: 50 };

    if (mode === "selected" && selectedWs.size === 0) {
      setBulkError("Select at least one workspace");
      return;
    }

    try {
      const response = await fetch("/api/admin/data-studio/bulk-snapshot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Bulk snapshot failed (${response.status})`);
      }

      if (!response.body) throw new Error("No progress stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let state = initialPlatformBulkSnapshotProgress();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const { events, rest } = consumePlatformBulkNdjson(buffer, chunk);
        buffer = rest;
        for (const ev of events) {
          state = reducePlatformBulkSnapshotProgress(state, ev);
          setBulkProgress({ ...state });
        }
      }
      if (buffer.trim()) {
        const { events } = consumePlatformBulkNdjson(buffer, "\n");
        for (const ev of events) {
          state = reducePlatformBulkSnapshotProgress(state, ev);
          setBulkProgress({ ...state });
        }
      }
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Bulk snapshot failed");
      setBulkProgress((s) => ({
        ...s,
        phase: "error",
        error: err instanceof Error ? err.message : "Bulk snapshot failed",
      }));
    }
  };

  const evalRegionSelfCentroid = async (region: RegionItem) => {
    setEvalRegionId(region.id);
    setRegionEvalResult(null);
    try {
      const res = await fetch("/api/admin/data-studio/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "eval",
          regionId: region.id,
          vector: region.centroid,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eval failed");
      setRegionEvalResult(
        `${region.name}: validation=${data.score?.validation_score?.toFixed?.(1) ?? data.score?.validation_score} · in_region=${data.score?.in_region} · kd=${data.knowledge_distance?.knowledge_distance?.toFixed?.(4) ?? "—"}`,
      );
    } catch (err) {
      setRegionEvalResult(err instanceof Error ? err.message : "Eval failed");
    } finally {
      setEvalRegionId(null);
    }
  };

  const toggleWs = (id: string) => {
    setSelectedWs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <AdminLoading />;
  if (error || !isAdmin) return <AdminError message={error || "Admin access required"} />;

  return (
    <div className="space-y-6" data-admin-data-studio>
      <div className={`${adminCardPaddedClass} sm:px-8 sm:py-8`}>
        <p className={`mb-3 ${adminLabelClass}`}>Data Studio</p>
        <h2 className="max-w-3xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
          Platform PoW, xAI, snapshots, regions, and bulk LWM analysis.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Admin-only surface for inspecting collected data, visualizing knowledge-config
          projections with region overlays, exercising region geometry, and triggering
          platform-wide LWM Snapshot generation.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-neutral-800 pb-px">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-studio-tab={t.id}
              onClick={() => setTab(parseDataStudioTab(t.id))}
              className={`relative shrink-0 px-3 py-2 text-sm font-medium transition-colors ${
                active ? "text-white" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {t.label}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
              )}
            </button>
          );
        })}
      </nav>

      {tab === "overview" && (
        <section className="space-y-4" data-studio-panel="overview">
          {overviewError && <p className="text-sm text-neutral-300">{overviewError}</p>}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Proof of work" value={counts?.proofOfWork ?? 0} />
            <StatCard label="KC snapshots" value={counts?.knowledgeConfigSnapshots ?? 0} />
            <StatCard label="Eval runs" value={counts?.evalRunHistory ?? 0} />
            <StatCard label="Regions" value={counts?.customRegions ?? 0} />
            <StatCard label="Workspaces" value={counts?.workspaces ?? 0} />
            <StatCard label="Orgs w/ xAI key" value={counts?.organizationsWithXaiKey ?? 0} />
            <StatCard
              label="Orgs w/ collection"
              value={counts?.organizationsWithXaiCollection ?? 0}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TABS.filter((t) => t.id !== "overview").map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`${adminCardPaddedClass} text-left transition-colors hover:border-neutral-700`}
              >
                <p className={adminLabelClass}>{t.label}</p>
                <p className="mt-2 text-sm text-neutral-300">Open panel →</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === "pow" && (
        <section className="space-y-4" data-studio-panel="pow">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <label className={adminLabelClass}>Search</label>
              <input
                className={`${adminInputClass} mt-1`}
                value={powSearch}
                onChange={(e) => {
                  setPowPage(1);
                  setPowSearch(e.target.value);
                }}
                placeholder="file, tool, device…"
              />
            </div>
            <div>
              <label className={adminLabelClass}>Type</label>
              <input
                className={`${adminInputClass} mt-1 w-40`}
                value={powType}
                onChange={(e) => {
                  setPowPage(1);
                  setPowType(e.target.value);
                }}
                placeholder="tool, upload…"
              />
            </div>
            <button type="button" className={adminBtnClass} onClick={() => void loadPow()}>
              Refresh
            </button>
          </div>
          {powError && <p className="text-sm text-neutral-300">{powError}</p>}
          <p className="text-xs text-neutral-500">
            {powTotal.toLocaleString()} rows · page {powPage}/{powTotalPages}
          </p>
          {powLoading ? (
            <AdminLoading message="Loading proof of work" />
          ) : (
            <div className={adminCardClass}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className={adminTableHeadClass}>
                      <th className="px-4 py-2 font-medium">When</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium">Summary</th>
                      <th className="px-4 py-2 font-medium">Workspace</th>
                      <th className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {powItems.map((item) => {
                      const expanded = expandedPowId === item.id;
                      return (
                        <tr key={item.id} className="border-b border-neutral-800/80 align-top">
                          <td className="whitespace-nowrap px-4 py-2.5 text-neutral-400">
                            {formatWhen(item.createdAt)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={adminPillClass}>{item.proofOfWorkType}</span>
                          </td>
                          <td className="px-4 py-2.5 text-neutral-200">
                            {item.summary || item.fileName}
                            {expanded && <PowDetailsPanel details={item} />}
                          </td>
                          <td className="px-4 py-2.5 text-neutral-400">
                            {item.workspaceId ? (
                              <Link
                                href={`/admin/workspaces/${item.workspaceId}`}
                                className="hover:text-white hover:underline"
                              >
                                {item.workspaceTitle || item.workspaceId.slice(0, 8)}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              className="text-xs text-neutral-500 hover:text-white"
                              onClick={() =>
                                setExpandedPowId(expanded ? null : item.id)
                              }
                            >
                              {expanded ? "Hide" : "Details"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {powItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                          No proof of work found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-800 px-4 py-3">
                <button
                  type="button"
                  className={adminBtnClass}
                  disabled={powPage <= 1}
                  onClick={() => setPowPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className={adminBtnClass}
                  disabled={powPage >= powTotalPages}
                  onClick={() => setPowPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "snapshots" && (
        <section className="space-y-4" data-studio-panel="snapshots">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1">
              <label className={adminLabelClass}>Workspace id filter</label>
              <input
                className={`${adminInputClass} mt-1`}
                value={snapshotWsFilter}
                onChange={(e) => setSnapshotWsFilter(e.target.value)}
                placeholder="uuid (optional)"
              />
            </div>
            <button type="button" className={adminBtnClass} onClick={() => void loadSnapshots()}>
              Refresh
            </button>
          </div>
          {snapshotError && <p className="text-sm text-neutral-300">{snapshotError}</p>}
          {snapshotLoading ? (
            <AdminLoading message="Loading snapshot models" />
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className={adminCardClass}>
                <div className="border-b border-neutral-800 px-4 py-3">
                  <h3 className={adminSectionTitleClass}>Knowledge config snapshots</h3>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Latest-first geometry models (embedding space)
                  </p>
                </div>
                <ul className="divide-y divide-neutral-800/80 max-h-[28rem] overflow-y-auto">
                  {kcItems.map((row) => (
                    <li key={row.id} className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={adminPillClass}>{row.embedding_model_id}</span>
                        <span className="text-neutral-500">dim {row.dim}</span>
                      </div>
                      <p className="mt-1 text-neutral-200">
                        {snapshotTitles[row.workspace_id] || row.workspace_id.slice(0, 8)}
                        <span className="text-neutral-500">
                          {" "}
                          · conf {(row.confidence * 100).toFixed(0)}% · {row.pow_event_count} PoW
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {row.trigger} · {formatWhen(row.created_at)} · subject{" "}
                        {row.subject_guest_user_id
                          ? `g:${row.subject_guest_user_id.slice(0, 8)}`
                          : row.subject_user_id
                            ? `u:${row.subject_user_id.slice(0, 8)}`
                            : "—"}
                      </p>
                    </li>
                  ))}
                  {kcItems.length === 0 && (
                    <li className="px-4 py-8 text-center text-neutral-500">No snapshots</li>
                  )}
                </ul>
              </div>
              <div className={adminCardClass}>
                <div className="border-b border-neutral-800 px-4 py-3">
                  <h3 className={adminSectionTitleClass}>Eval run history (LWM scores)</h3>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Vertical scorecards / snapshot models
                  </p>
                </div>
                <ul className="divide-y divide-neutral-800/80 max-h-[28rem] overflow-y-auto">
                  {evalItems.map((row) => (
                    <li key={row.id} className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={adminPillClass}>{row.vertical}</span>
                        <span className="font-medium text-white tabular-nums">{row.score}</span>
                        {row.ghc_score != null && (
                          <span className="text-neutral-500">GHC {row.ghc_score}</span>
                        )}
                      </div>
                      <p className="mt-1 text-neutral-300">
                        {snapshotTitles[row.workspace_id] || row.workspace_id.slice(0, 8)}
                        <span className="text-neutral-500"> · {row.source}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">{formatWhen(row.ran_at)}</p>
                    </li>
                  ))}
                  {evalItems.length === 0 && (
                    <li className="px-4 py-8 text-center text-neutral-500">No eval runs</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "regions" && (
        <section className="space-y-4" data-studio-panel="regions">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <label className={adminLabelClass}>Search regions</label>
              <input
                className={`${adminInputClass} mt-1`}
                value={regionSearch}
                onChange={(e) => setRegionSearch(e.target.value)}
                placeholder="name…"
              />
            </div>
            <button type="button" className={adminBtnClass} onClick={() => void loadRegions()}>
              Refresh
            </button>
          </div>
          {regionsError && <p className="text-sm text-neutral-300">{regionsError}</p>}
          {regionEvalResult && (
            <p className="text-sm text-neutral-200" data-studio-region-eval>
              {regionEvalResult}
            </p>
          )}
          <p className="text-xs text-neutral-500">
            {regionsTotal.toLocaleString()} custom knowledge regions system-wide
          </p>
          {regionsLoading ? (
            <AdminLoading message="Loading regions" />
          ) : (
            <div className={adminCardClass}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className={adminTableHeadClass}>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Workspace</th>
                      <th className="px-4 py-2 font-medium">Subjects</th>
                      <th className="px-4 py-2 font-medium">Radius / θ</th>
                      <th className="px-4 py-2 font-medium">Cohesion</th>
                      <th className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {regions.map((r) => (
                      <tr key={r.id} className="border-b border-neutral-800/80">
                        <td className="px-4 py-2.5 text-white">{r.name}</td>
                        <td className="px-4 py-2.5 text-neutral-400">
                          <Link
                            href={`/admin/workspaces/${r.workspace_id}`}
                            className="hover:text-white hover:underline"
                          >
                            {r.workspace_title || r.workspace_id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-neutral-300">
                          {r.subject_count}
                        </td>
                        <td className="px-4 py-2.5 text-neutral-400 tabular-nums">
                          {Number(r.mean_radius).toFixed(3)} / {Number(r.cosine_threshold).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-neutral-400">
                          {Number(r.cohort_cohesion).toFixed(3)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            className="text-xs text-neutral-500 hover:text-white"
                            disabled={evalRegionId === r.id || !r.centroid?.length}
                            onClick={() => void evalRegionSelfCentroid(r)}
                          >
                            {evalRegionId === r.id ? "Eval…" : "Eval centroid"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {regions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                          No regions
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "xai" && (
        <section className="space-y-4" data-studio-panel="xai">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-neutral-400">
              <input
                type="checkbox"
                checked={xaiIncludeUsage}
                onChange={(e) => setXaiIncludeUsage(e.target.checked)}
              />
              Include Management API usage (slower)
            </label>
            <button type="button" className={adminBtnClass} onClick={() => void loadXai()}>
              Refresh
            </button>
            <span className={adminPillClass}>
              Management API: {xaiMgmt ? "configured" : "not configured"}
            </span>
          </div>
          {xaiError && <p className="text-sm text-neutral-300">{xaiError}</p>}
          {xaiLoading ? (
            <AdminLoading message="Loading xAI org data" />
          ) : (
            <>
              <div className={adminCardClass}>
                <div className="border-b border-neutral-800 px-4 py-3">
                  <h3 className={adminSectionTitleClass}>Organization xAI resources</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className={adminTableHeadClass}>
                        <th className="px-4 py-2 font-medium">Org</th>
                        <th className="px-4 py-2 font-medium">API key</th>
                        <th className="px-4 py-2 font-medium">Collection</th>
                        <th className="px-4 py-2 font-medium">Usage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {xaiItems.map((org) => (
                        <tr key={org.id} className="border-b border-neutral-800/80">
                          <td className="px-4 py-2.5">
                            <Link
                              href={`/admin/organizations/${org.id}`}
                              className="text-white hover:underline"
                            >
                              {org.name}
                            </Link>
                            {org.plan && (
                              <span className="ml-2 text-xs text-neutral-500">{org.plan}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-neutral-400">
                            <span className={adminPillClass}>
                              {org.xai_api_key_status || "—"}
                            </span>
                            {org.xai_api_key_name && (
                              <span className="ml-2 text-xs">{org.xai_api_key_name}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-neutral-400">
                            <span className={adminPillClass}>
                              {org.xai_collection_status || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-neutral-400 tabular-nums">
                            {org.usage?.available
                              ? `$${org.usage.totalUsd?.toFixed(2) ?? "—"}`
                              : org.usage?.error
                                ? org.usage.error.slice(0, 40)
                                : "—"}
                          </td>
                        </tr>
                      ))}
                      {xaiItems.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                            No organizations
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {xaiPowFiles && (
                <div className={adminCardPaddedClass}>
                  <p className={adminLabelClass}>PoW linked to xAI files</p>
                  <p className="mt-2 text-sm text-neutral-300">
                    {xaiPowFiles.total.toLocaleString()} total with xai_file_id
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-neutral-500">
                    {xaiPowFiles.sample.slice(0, 8).map((row) => (
                      <li key={row.id}>
                        {row.file_name} · {row.xai_file_id?.slice(0, 12)}… ·{" "}
                        {formatWhen(row.created_at)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {tab === "bulk" && (
        <section className="space-y-4" data-studio-panel="bulk">
          <div className={`${adminCardPaddedClass}`}>
            <h3 className={adminSectionTitleClass}>Platform bulk LWM Snapshot</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Generate snapshots across selected or all eligible workspaces (admin service
              role — not limited to workspace owners). Uses the same{" "}
              <code className="text-neutral-300">runVerticalScore</code> path as owner
              snapshot-all. Long runs stream NDJSON progress.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={adminPrimaryBtnClass}
                disabled={bulkProgress.phase === "running" || selectedWs.size === 0}
                data-studio-bulk-selected
                onClick={() => void runBulkSnapshot("selected")}
              >
                Run selected ({selectedWs.size})
              </button>
              <button
                type="button"
                className={adminBtnClass}
                disabled={bulkProgress.phase === "running"}
                data-studio-bulk-all
                onClick={() => void runBulkSnapshot("all")}
              >
                Run all (max 50)
              </button>
              <button
                type="button"
                className={adminBtnClass}
                onClick={() => void loadBulkWorkspaces()}
              >
                Refresh list
              </button>
            </div>
            {bulkError && <p className="mt-3 text-sm text-neutral-300">{bulkError}</p>}
            {bulkProgress.phase !== "idle" && (
              <div
                className="mt-4 space-y-2"
                data-studio-bulk-progress
                data-studio-bulk-phase={bulkProgress.phase}
              >
                <p className="text-sm text-neutral-200">{bulkProgressText}</p>
                <div
                  className="h-2 overflow-hidden rounded bg-neutral-900"
                  role="progressbar"
                  aria-valuenow={bulkProgress.completed}
                  aria-valuemax={bulkProgress.total_jobs || 1}
                >
                  <div
                    className={`h-full transition-all ${
                      bulkProgress.phase === "error"
                        ? "bg-red-500/80"
                        : bulkProgress.phase === "complete"
                          ? "bg-emerald-500/80"
                          : "bg-white/80"
                    }`}
                    style={{
                      width: `${
                        bulkProgress.total_jobs > 0
                          ? Math.min(
                              100,
                              (bulkProgress.completed / bulkProgress.total_jobs) * 100,
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="text-xs text-neutral-500" data-studio-bulk-counts>
                  {bulkProgress.succeeded} ok · {bulkProgress.skipped} skipped ·{" "}
                  {bulkProgress.failed} failed · {bulkProgress.completed}/
                  {bulkProgress.total_jobs} jobs · {bulkProgress.total_workspaces} workspaces
                </p>
                {bulkProgress.workspaceSummaries.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto text-xs text-neutral-500">
                    {bulkProgress.workspaceSummaries.map((ws) => (
                      <li key={ws.workspace_id}>
                        {ws.workspace_label || ws.workspace_id.slice(0, 8)}: {ws.succeeded} ok /{" "}
                        {ws.skipped} skip / {ws.failed} fail
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          {bulkLoadingList ? (
            <AdminLoading message="Loading workspaces" />
          ) : (
            <div className={adminCardClass}>
              <div className="border-b border-neutral-800 px-4 py-3 flex items-center justify-between gap-2">
                <h3 className={adminSectionTitleClass}>
                  Eligible workspaces ({bulkWorkspaces.length})
                </h3>
                <button
                  type="button"
                  className="text-xs text-neutral-500 hover:text-white"
                  onClick={() => {
                    if (selectedWs.size === bulkWorkspaces.length) {
                      setSelectedWs(new Set());
                    } else {
                      setSelectedWs(new Set(bulkWorkspaces.map((w) => w.id)));
                    }
                  }}
                >
                  {selectedWs.size === bulkWorkspaces.length ? "Clear all" : "Select all"}
                </button>
              </div>
              <ul className="max-h-[24rem] divide-y divide-neutral-800/80 overflow-y-auto">
                {bulkWorkspaces.map((ws) => (
                  <li key={ws.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedWs.has(ws.id)}
                      onChange={() => toggleWs(ws.id)}
                      disabled={bulkProgress.phase === "running"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-neutral-200">{ws.label}</p>
                      <p className="truncate text-xs text-neutral-600">{ws.id}</p>
                    </div>
                    <Link
                      href={`/admin/workspaces/${ws.id}`}
                      className="shrink-0 text-xs text-neutral-500 hover:text-white"
                    >
                      Open
                    </Link>
                  </li>
                ))}
                {bulkWorkspaces.length === 0 && (
                  <li className="px-4 py-8 text-center text-neutral-500">No workspaces</li>
                )}
              </ul>
            </div>
          )}
        </section>
      )}

      {tab === "projections" && (
        <section className="space-y-4" data-studio-panel="projections">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <label className={adminLabelClass}>Workspace id</label>
              <input
                className={`${adminInputClass} mt-1`}
                value={projWorkspaceId}
                onChange={(e) => setProjWorkspaceId(e.target.value)}
                placeholder="uuid"
                data-studio-projection-workspace
              />
            </div>
            <div>
              <label className={adminLabelClass}>Algorithm</label>
              <select
                className={`${adminSelectClass} mt-1`}
                value={projAlgo}
                onChange={(e) => setProjAlgo(e.target.value)}
              >
                {PROJECTION_ALGORITHM_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.shortLabel}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={adminLabelClass}>Display</label>
              <select
                className={`${adminSelectClass} mt-1`}
                value={projMode}
                onChange={(e) =>
                  setProjMode(e.target.value === "latest" ? "latest" : "trajectory")
                }
              >
                <option value="trajectory">Trajectory</option>
                <option value="latest">Latest only</option>
              </select>
            </div>
            <button
              type="button"
              className={adminPrimaryBtnClass}
              data-studio-projection-load
              disabled={projLoading}
              onClick={() => void loadProjection()}
            >
              {projLoading ? "Loading…" : "Project"}
            </button>
          </div>
          {projError && <p className="text-sm text-neutral-300">{projError}</p>}
          {projData && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_16rem]">
              <div className={adminCardPaddedClass} data-studio-projection-canvas>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span>{projData.workspace.title}</span>
                  <span className={adminPillClass}>{projData.projection.algorithm}</span>
                  <span>
                    {projData.point_count} pts · {projData.region_count} regions
                  </span>
                  <span className="truncate">{projData.projection.frame_id}</span>
                </div>
                <svg
                  viewBox="0 0 720 420"
                  className="h-auto w-full rounded border border-neutral-800 bg-neutral-950"
                  role="img"
                  aria-label="Knowledge config projection"
                >
                  <rect x={0} y={0} width={720} height={420} fill="#0a0a0a" />
                  {projData.projection.regionOverlays.map((r) => (
                    <g key={r.id}>
                      <circle
                        cx={r.screenX}
                        cy={r.screenY}
                        r={Math.max(6, r.screenRadius)}
                        fill="rgba(255,255,255,0.06)"
                        stroke="rgba(255,255,255,0.35)"
                        strokeWidth={1}
                      />
                      <text
                        x={r.screenX}
                        y={r.screenY - Math.max(6, r.screenRadius) - 4}
                        textAnchor="middle"
                        fill="#a3a3a3"
                        fontSize={10}
                      >
                        {r.name.slice(0, 24)}
                      </text>
                    </g>
                  ))}
                  {projData.projection.coords.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth={1.5}
                      points={projData.projection.coords
                        .map((c) => `${c.screenX},${c.screenY}`)
                        .join(" ")}
                    />
                  )}
                  {projData.projection.coords.map((c, i) => (
                    <circle
                      key={`${c.screenX}-${c.screenY}-${i}`}
                      cx={c.screenX}
                      cy={c.screenY}
                      r={i === projData.projection.coords.length - 1 ? 5 : 3}
                      fill={
                        i === projData.projection.coords.length - 1
                          ? "#fff"
                          : "rgba(255,255,255,0.55)"
                      }
                    />
                  ))}
                  {projData.projection.coords.length === 0 &&
                    projData.projection.regionOverlays.length === 0 && (
                      <text
                        x={360}
                        y={210}
                        textAnchor="middle"
                        fill="#525252"
                        fontSize={14}
                      >
                        No trajectory or region points
                      </text>
                    )}
                </svg>
                {projData.projection.bounds && (
                  <p className="mt-2 font-mono text-[10px] text-neutral-600">
                    bounds x[{projData.projection.bounds.minX.toFixed(3)},{" "}
                    {projData.projection.bounds.maxX.toFixed(3)}] y[
                    {projData.projection.bounds.minY.toFixed(3)},{" "}
                    {projData.projection.bounds.maxY.toFixed(3)}]
                  </p>
                )}
              </div>
              <div className={adminCardPaddedClass}>
                <p className={adminLabelClass}>Region overlays</p>
                <ul className="mt-3 space-y-2 text-xs text-neutral-400">
                  {projData.projection.regionOverlays.map((r) => (
                    <li key={r.id}>
                      <span className="text-neutral-200">{r.name}</span>
                      <br />
                      r={r.radius.toFixed(3)} · screen r={r.screenRadius.toFixed(1)}
                    </li>
                  ))}
                  {projData.projection.regionOverlays.length === 0 && (
                    <li>No regions in this workspace</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={adminCardPaddedClass}>
      <div className="text-xl font-semibold tabular-nums text-white sm:text-2xl">
        {value.toLocaleString()}
      </div>
      <div className={`mt-1 ${adminLabelClass}`}>{label}</div>
    </div>
  );
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
