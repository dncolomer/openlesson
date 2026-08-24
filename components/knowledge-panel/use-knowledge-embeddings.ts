"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KnowledgeRegionListItem } from "@/components/CustomVerificationModelsPanel";
import { resolveEmbeddingsSubjectSelection } from "@/lib/pow-api/models-tab-scope";
import {
  projectTrajectoryAndRegions,
  parseProjectionAlgorithmId,
  type KnowledgeRegionOverlay2D,
  type ProjectionDisplayMode,
  type ProjectionAlgorithmId,
} from "@/lib/knowledge-config";
import {
  enabledRegionsForLocalFocus,
  reprojectMapLayout,
  workspaceKnowledgeToGlobalMapInputs,
} from "@/lib/map-of-knowledge";
import {
  trajectoryPointSubjectKey,
  type AvailableSubject,
  type KnowledgeConfigResponse,
} from "@/components/knowledge-panel/widgets";
import {
  fetchKnowledgeConfig,
  mergeAvailableSubjects,
} from "@/components/knowledge-panel/knowledge-config-client";
import type { OverlayDistance } from "@/components/knowledge-panel/types";
import { assembleSelectedRegionOverlayInputs } from "@/lib/knowledge-region-import";

export function useKnowledgeEmbeddings(input: {
  workspaceId: string;
  currentUserId?: string | null;
  ayclToken?: string;
  canInspectOthers: boolean;
  lockSubjectToSelf: boolean;
}) {
  const {
    workspaceId,
    currentUserId = null,
    ayclToken,
    canInspectOthers,
    lockSubjectToSelf,
  } = input;

  const [embSelectedKeys, setEmbSelectedKeys] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<AvailableSubject[]>([]);
  const [embData, setEmbData] = useState<KnowledgeConfigResponse | null>(null);
  const [embLoading, setEmbLoading] = useState(false);
  const [embError, setEmbError] = useState<string | null>(null);
  const [embeddingsFullscreen, setEmbeddingsFullscreen] = useState(false);
  const embeddingsShellRef = useRef<HTMLDivElement | null>(null);

  const [knowledgeRegions, setKnowledgeRegions] = useState<KnowledgeRegionListItem[]>([]);
  const [importableRegions, setImportableRegions] = useState<KnowledgeRegionListItem[]>([]);
  const [importedRegionIds, setImportedRegionIds] = useState<Set<string>>(new Set());
  const [importPickerOpen, setImportPickerOpen] = useState(false);
  const [selectedRegionIds, setSelectedRegionIds] = useState<Set<string>>(new Set());
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [projectionDisplayMode, setProjectionDisplayMode] =
    useState<ProjectionDisplayMode>("trajectory");
  const [projectionAlgorithm, setProjectionAlgorithm] =
    useState<ProjectionAlgorithmId>("random");
  const [knowledgeMapScope, setKnowledgeMapScope] = useState<"local" | "global">("global");
  const [knowledgeGlobalViewMode, setKnowledgeGlobalViewMode] = useState<"2d" | "3d">("2d");
  const [globalSelectedRegionId, setGlobalSelectedRegionId] = useState<string | null>(null);
  const [regionPickerExpanded, setRegionPickerExpanded] = useState(false);
  const [overlayDistances, setOverlayDistances] = useState<Record<string, OverlayDistance>>({});
  const [overlayDistancesLoading, setOverlayDistancesLoading] = useState(false);

  const enterEmbeddingsFullscreen = useCallback(async () => {
    setEmbeddingsFullscreen(true);
    const el = embeddingsShellRef.current;
    if (el && typeof el.requestFullscreen === "function") {
      try {
        await el.requestFullscreen();
      } catch {
        // CSS fixed overlay fallback (still z above app chrome)
      }
    }
  }, []);

  const exitEmbeddingsFullscreen = useCallback(async () => {
    setEmbeddingsFullscreen(false);
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
      if (!document.fullscreenElement) setEmbeddingsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    if (!embeddingsFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void exitEmbeddingsFullscreen();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [embeddingsFullscreen, exitEmbeddingsFullscreen]);

  useEffect(() => {
    if (!currentUserId) return;
    setEmbSelectedKeys((prev) => (prev.length === 0 ? [`u:${currentUserId}`] : prev));
  }, [currentUserId]);

  useEffect(() => {
    if (canInspectOthers || !currentUserId) return;
    const selfKey = `u:${currentUserId}`;
    setEmbSelectedKeys((prev) =>
      prev.length === 1 && prev[0] === selfKey ? prev : [selfKey],
    );
  }, [canInspectOthers, currentUserId]);

  const embScope = useMemo(
    () =>
      resolveEmbeddingsSubjectSelection({
        selectedKeys: embSelectedKeys,
        currentUserId,
        canInspectOthers,
        lockSubjectToSelf,
      }),
    [canInspectOthers, currentUserId, embSelectedKeys, lockSubjectToSelf],
  );

  const embUserId = embScope.subjects[0]?.user_id ?? "";
  const embGuestUserId = embScope.subjects[0]?.guest_user_id ?? "";

  const loadEmbeddings = useCallback(async () => {
    setEmbLoading(true);
    setEmbError(null);
    try {
      const payload = await fetchKnowledgeConfig(workspaceId, ayclToken, embScope.query);
      setEmbData(payload);
      setAvailableSubjects((prev) => mergeAvailableSubjects(prev, payload));
    } catch (err) {
      setEmbError(err instanceof Error ? err.message : "Failed to load embeddings");
    } finally {
      setEmbLoading(false);
    }
  }, [ayclToken, embScope.query, workspaceId]);

  const loadRegionsForOverlay = useCallback(async () => {
    setRegionsLoading(true);
    setRegionsError(null);
    try {
      const res = await fetch(
        `/api/workspace/custom-knowledge-regions?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not load knowledge regions",
        );
      }
      const mapModel = (
        m: Record<string, unknown>,
        extras?: Partial<KnowledgeRegionListItem>,
      ): KnowledgeRegionListItem => ({
        id: String(m.id),
        name: String(m.name),
        description: (m.description as string | null) ?? null,
        subject_count: Number(m.subject_count) || 0,
        cosine_threshold: Number(m.cosine_threshold) || 0.5,
        cohort_cohesion: Number(m.cohort_cohesion) || 0,
        mean_radius: Number(m.mean_radius) || 0,
        embedding_model_id: String(m.embedding_model_id || ""),
        centroid: Array.isArray(m.centroid) ? (m.centroid as number[]) : [],
        created_at: String(m.created_at || ""),
        workspace_id: typeof m.workspace_id === "string" ? m.workspace_id : workspaceId,
        workspace_title:
          typeof m.workspace_title === "string" ? m.workspace_title : undefined,
        imported: Boolean(extras?.imported),
        ...extras,
      });
      const nextModels = (Array.isArray(data.models) ? data.models : []).map(
        (m: Record<string, unknown>) => mapModel(m, { imported: false }),
      );
      const nextImportable = (
        Array.isArray(data.importable_models) ? data.importable_models : []
      ).map((m: Record<string, unknown>) => mapModel(m, { imported: true }));
      setKnowledgeRegions(nextModels);
      setImportableRegions(nextImportable);
      const importableIds = new Set(
        nextImportable.map((r: KnowledgeRegionListItem) => r.id),
      );
      setImportedRegionIds((prevImported) => {
        const keptImported = new Set<string>();
        for (const id of prevImported) {
          if (importableIds.has(id)) keptImported.add(id);
        }
        setSelectedRegionIds((prevSelected) => {
          const allowed = new Set([
            ...nextModels.map((r: KnowledgeRegionListItem) => r.id),
            ...keptImported,
          ]);
          const next = new Set<string>();
          for (const id of prevSelected) {
            if (allowed.has(id)) next.add(id);
          }
          return next;
        });
        return keptImported;
      });
    } catch (err) {
      setKnowledgeRegions([]);
      setRegionsError(err instanceof Error ? err.message : "Could not load knowledge regions");
    } finally {
      setRegionsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadEmbeddings();
  }, [loadEmbeddings]);

  useEffect(() => {
    void loadRegionsForOverlay();
  }, [loadRegionsForOverlay]);

  const importedRegions = useMemo(
    () => importableRegions.filter((r) => importedRegionIds.has(r.id)),
    [importableRegions, importedRegionIds],
  );

  const overlayRegionCatalog = useMemo(
    () => [...knowledgeRegions, ...importedRegions],
    [importedRegions, knowledgeRegions],
  );

  useEffect(() => {
    const ids = Array.from(selectedRegionIds);
    if (ids.length === 0) {
      setOverlayDistances({});
      setOverlayDistancesLoading(false);
      return;
    }
    if (!embUserId && !embGuestUserId) {
      setOverlayDistances({});
      return;
    }

    let cancelled = false;
    setOverlayDistancesLoading(true);

    void (async () => {
      const next: Record<string, OverlayDistance> = {};
      await Promise.all(
        ids.map(async (regionId) => {
          const catalogHit = overlayRegionCatalog.find((r) => r.id === regionId);
          const targetWorkspaceId = catalogHit?.workspace_id || workspaceId;
          try {
            const res = await fetch("/api/workspace/custom-knowledge-regions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "knowledge_distance",
                workspaceId: targetWorkspaceId,
                regionId,
                ...(embUserId ? { user_id: embUserId } : {}),
                ...(embGuestUserId ? { guest_user_id: embGuestUserId } : {}),
                ...(ayclToken ? { ayclToken } : {}),
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (cancelled) return;
            if (!res.ok) {
              next[regionId] = {
                knowledge_distance: NaN,
                cosine_similarity: NaN,
                cosine_distance: NaN,
                in_region: false,
                region_name:
                  overlayRegionCatalog.find((r) => r.id === regionId)?.name ?? regionId,
                error:
                  typeof data.error === "string" ? data.error : "Distance unavailable",
              };
              return;
            }
            const kd = data.knowledge_distance as {
              knowledge_distance: number;
              cosine_similarity: number;
              cosine_distance: number;
              in_region: boolean;
              region_name?: string;
            };
            next[regionId] = {
              knowledge_distance: Number(kd.knowledge_distance),
              cosine_similarity: Number(kd.cosine_similarity),
              cosine_distance: Number(kd.cosine_distance),
              in_region: Boolean(kd.in_region),
              region_name:
                kd.region_name ||
                overlayRegionCatalog.find((r) => r.id === regionId)?.name ||
                regionId,
            };
          } catch (err) {
            if (cancelled) return;
            next[regionId] = {
              knowledge_distance: NaN,
              cosine_similarity: NaN,
              cosine_distance: NaN,
              in_region: false,
              region_name:
                overlayRegionCatalog.find((r) => r.id === regionId)?.name ?? regionId,
              error: err instanceof Error ? err.message : "Distance unavailable",
            };
          }
        }),
      );
      if (!cancelled) {
        setOverlayDistances(next);
        setOverlayDistancesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    ayclToken,
    embGuestUserId,
    embUserId,
    overlayRegionCatalog,
    selectedRegionIds,
    workspaceId,
  ]);

  const projectedLayout = useMemo(() => {
    const regionInputs = assembleSelectedRegionOverlayInputs({
      localRegions: knowledgeRegions,
      importedRegions,
      selectedIds: selectedRegionIds,
    });

    const rawPoints = embData?.trajectory.points;
    if (Array.isArray(rawPoints) && rawPoints.length > 0) {
      const layout = projectTrajectoryAndRegions({
        points: rawPoints.map((p) => ({
          t: p.t,
          as_of_ms: p.as_of_ms,
          vector: Array.isArray(p.vector) ? p.vector : [],
          confidence: p.confidence,
        })),
        regions: regionInputs,
        algorithm: projectionAlgorithm,
      });
      return {
        ...layout,
        coords: layout.coords.map((c, i) => ({
          ...c,
          subjectKey: trajectoryPointSubjectKey(rawPoints[i] || {}),
        })),
      };
    }

    const serverCoords = embData?.trajectory.projection.coords ?? [];
    if (projectionAlgorithm === "random" || serverCoords.length === 0) {
      const regionOnly = projectTrajectoryAndRegions({
        points: [],
        regions: regionInputs,
        algorithm: projectionAlgorithm,
      });
      return {
        ...regionOnly,
        coords: serverCoords.map((c) => ({
          t: c.t,
          as_of_ms: c.as_of_ms,
          x: c.x,
          y: c.y,
          confidence: c.confidence,
          subjectKey: c.subjectKey,
        })),
      };
    }

    return projectTrajectoryAndRegions({
      points: [],
      regions: regionInputs,
      algorithm: projectionAlgorithm,
    });
  }, [embData, importedRegions, knowledgeRegions, projectionAlgorithm, selectedRegionIds]);

  const coords = projectedLayout.coords;
  const regionOverlays = projectedLayout.regionOverlays as KnowledgeRegionOverlay2D[];

  const workspaceGlobalMap = useMemo(() => {
    const rawPoints = embData?.trajectory.points;
    const latestBySubject = new Map<
      string,
      { id: string; vector: number[]; label?: string; as_of_ms: number }
    >();
    if (Array.isArray(rawPoints)) {
      for (const p of rawPoints) {
        const vec = Array.isArray(p.vector) ? p.vector : [];
        if (vec.length === 0) continue;
        const key =
          (p.subject_guest_user_id && `g:${p.subject_guest_user_id}`) ||
          (p.subject_user_id && `u:${p.subject_user_id}`) ||
          `p:${p.as_of_ms}`;
        const prev = latestBySubject.get(key);
        if (!prev || p.as_of_ms >= prev.as_of_ms) {
          latestBySubject.set(key, {
            id: key,
            vector: vec,
            as_of_ms: p.as_of_ms,
            label: key.startsWith("g:")
              ? `Guest ${key.slice(2, 10)}`
              : key.startsWith("u:")
                ? `User ${key.slice(2, 10)}`
                : key,
          });
        }
      }
    }
    const subjectVectors = Array.from(latestBySubject.values()).map((s) => ({
      id: s.id,
      vector: s.vector,
      label: s.label,
    }));
    const selectedRegions = [
      ...knowledgeRegions,
      ...importedRegions,
    ].filter(
      (r) =>
        selectedRegionIds.has(r.id) &&
        Array.isArray(r.centroid) &&
        r.centroid.length > 0,
    );
    const base = workspaceKnowledgeToGlobalMapInputs({
      workspaceId,
      workspaceTitle: "Workspace",
      regions: selectedRegions.map((r) => ({
        id: r.id,
        name: r.name,
        centroid: r.centroid,
        mean_radius: r.mean_radius,
      })),
      subjectVectors,
    });
    const laidOut = reprojectMapLayout({
      userLocations: base.users,
      regions: base.regions,
      algorithm: projectionAlgorithm,
    });
    return { regions: laidOut.regions, users: laidOut.userLocations };
  }, [
    embData?.trajectory.points,
    importedRegions,
    knowledgeRegions,
    selectedRegionIds,
    workspaceId,
    projectionAlgorithm,
  ]);

  useEffect(() => {
    if (knowledgeRegions.length === 0) return;
    setSelectedRegionIds((prev) => {
      if (prev.size > 0) return prev;
      const next = new Set<string>();
      for (const r of knowledgeRegions) {
        if (Array.isArray(r.centroid) && r.centroid.length > 0) next.add(r.id);
      }
      return next;
    });
  }, [knowledgeRegions]);

  const openLocalMapFocusedOnRegion = useCallback((regionId: string) => {
    const ids = enabledRegionsForLocalFocus(regionId);
    if (ids.length === 0) return;
    setSelectedRegionIds(new Set(ids));
    setGlobalSelectedRegionId(null);
    setKnowledgeMapScope("local");
    setProjectionDisplayMode("latest");
    setRegionPickerExpanded(true);
  }, []);

  const toggleRegionOverlay = (id: string) => {
    setSelectedRegionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableRegionIds = useMemo(
    () =>
      knowledgeRegions
        .filter((r) => Array.isArray(r.centroid) && r.centroid.length > 0)
        .map((r) => r.id),
    [knowledgeRegions],
  );

  const toggleAllWorkspaceRegions = useCallback(() => {
    setSelectedRegionIds((prev) => {
      const allOn =
        selectableRegionIds.length > 0 &&
        selectableRegionIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allOn) {
        for (const id of selectableRegionIds) next.delete(id);
        return next;
      }
      for (const id of selectableRegionIds) next.add(id);
      return next;
    });
  }, [selectableRegionIds]);

  const importRegionOverlay = useCallback((id: string) => {
    setImportedRegionIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setSelectedRegionIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const summary = useMemo(() => {
    if (!embData) return null;
    return {
      confidence: embData.knowledge_config.confidence,
      pathLength: embData.trajectory.path_length,
      points: embData.trajectory.point_count,
      model: embData.knowledge_config.embedding_model_id,
      empty: embData.knowledge_config.empty,
    };
  }, [embData]);

  return {
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
    importPickerOpen,
    importRegionOverlay,
    importableRegions,
    importedRegionIds,
    importedRegions,
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
    setImportPickerOpen,
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
  };
}
