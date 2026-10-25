/**
 * Map of Knowledge payload builders, public-workspace filters, and layout helpers.
 */

import {
  parseProjectionAlgorithmId,
  projectVectors3D as projectVectors3DMulti,
  type ProjectionAlgorithmId,
} from "@/lib/knowledge-config";
import { FLOW_EMBEDDING_MODEL_ID } from "@/lib/flow-embedding";
import { resolveMapUserAvatar } from "@/lib/map-of-knowledge/stem-avatars";
import {
  describeEmbeddingModel,
  mergeEmbeddingModelCatalog,
  resolveSelectedEmbeddingModelId,
  type EmbeddingModelInfo,
} from "./embedding-catalog";
import type {
  DefaultRegionPickResult,
  MapAggregatedPowStats,
  MapDotKind,
  MapOfKnowledgePayload,
  MapPoint3D,
  MapPublicWorkspace,
  MapRegion,
  MapRegionWorkspaceGroup,
  MapUserLocation,
  PublicBlockRaw,
  PublicPowWorkspaceStatsRaw,
  PublicRegionRaw,
  PublicUserPointRaw,
  PublicWorkspaceRaw,
} from "./types";

/**
 * Eligible for Map of Knowledge public surfaces:
 * - is_public must be strictly true
 * - not archived
 * - status active when present (legacy rows without status still allowed)
 */
export function isEligibleMapPublicWorkspace(row: {
  is_public?: boolean | null;
  status?: string | null;
  archived_at?: string | null;
}): boolean {
  if (row.is_public !== true) return false;
  if (row.archived_at) return false;
  const status = typeof row.status === "string" ? row.status.trim().toLowerCase() : "";
  if (status && status !== "active") return false;
  return true;
}

/** Filter rows to public workspaces only. */
export function filterPublicWorkspaces<
  T extends { is_public?: boolean | null; status?: string | null; archived_at?: string | null },
>(rows: T[]): T[] {
  return rows.filter((r) => isEligibleMapPublicWorkspace(r));
}

/**
 * Workspaces shown in the "mint guest link" placement dropdown.
 * Public + active + not archived, and must have at least one expert knowledge
 * region so placement is against the knowledge map (not random community plans
 * that happen to be is_public).
 */
export function filterMapPlacementWorkspaces<
  T extends {
    is_public?: boolean | null;
    status?: string | null;
    archived_at?: string | null;
    region_count?: number | null;
  },
>(workspaces: readonly T[]): T[] {
  return workspaces.filter(
    (ws) =>
      isEligibleMapPublicWorkspace(ws) &&
      typeof ws.region_count === "number" &&
      ws.region_count > 0,
  );
}

/** Dot kind for map rendering: TAP Learning = golden, TAP = standard. */
export function mapDotKindFromParticipant(
  kind: string | null | undefined,
): MapDotKind {
  const k = (kind || "").toLowerCase();
  if (k === "ile" || k === "anonymous_ile_link" || k.includes("ile")) return "ile";
  if (k === "tap" || k === "anonymous_tap_link" || k.includes("tap")) return "tap";
  return "standard";
}

export function mapDotColor(kind: MapDotKind): string {
  if (kind === "ile") return "#fbbf24"; // golden
  return "#94a3b8"; // standard (TAP / default)
}

export function mapDotIsGolden(kind: MapDotKind): boolean {
  return kind === "ile";
}

/**
 * Project high-D vectors with a named knowledge-config 3D algorithm.
 * Shared by Local Map 3D and Global Map region-dot layout (finite x, y, z).
 */
export function projectMapVectors(
  vectors: number[][],
  algorithm: ProjectionAlgorithmId | string = "pca",
): MapPoint3D[] {
  const algo = parseProjectionAlgorithmId(algorithm, "pca");
  return projectVectors3D(vectors, algo);
}

/**
 * Jointly re-project user locations + regions so they share one embedding frame.
 * Preserves metadata; only updates x/y/z from high-D `vector` fields.
 */
export function reprojectMapLayout(input: {
  userLocations: MapUserLocation[];
  regions: MapRegion[];
  algorithm: ProjectionAlgorithmId | string;
}): { userLocations: MapUserLocation[]; regions: MapRegion[] } {
  const locations = input.userLocations;
  const regions = input.regions;
  const allVectors = [
    ...locations.map((u) => (Array.isArray(u.vector) ? u.vector : [])),
    ...regions.map((r) => (Array.isArray(r.vector) ? r.vector : [])),
  ];
  const coords = projectMapVectors(allVectors, input.algorithm);
  const userLocations = locations.map((u, i) => {
    const c = coords[i] || { x: 0, y: 0, z: 0 };
    return { ...u, x: c.x, y: c.y, z: c.z };
  });
  const regionOut = regions.map((r, i) => {
    const c = coords[locations.length + i] || { x: 0, y: 0, z: 0 };
    return { ...r, x: c.x, y: c.y, z: c.z };
  });
  return { userLocations, regions: regionOut };
}

/**
 * Project high-D vectors to 3D via the selected multi-algo projector
 * (PCA / Classical MDS / SMACOF / Random). Defaults to PCA.
 */
export function projectVectors3D(
  vectors: number[][],
  algorithm: ProjectionAlgorithmId | string = "pca",
): MapPoint3D[] {
  const algo = parseProjectionAlgorithmId(algorithm, "pca");
  return projectVectors3DMulti(vectors, algo).map((p) => ({
    x: Number.isFinite(p.x) ? p.x : 0,
    y: Number.isFinite(p.y) ? p.y : 0,
    z: Number.isFinite(p.z) ? p.z : 0,
  }));
}

/** Keep regions whose ids are in the enabled set (toggleable list). */
export function filterEnabledRegions<T extends { id: string }>(
  regions: T[],
  enabledRegionIds: ReadonlySet<string> | readonly string[],
): T[] {
  const set =
    enabledRegionIds instanceof Set
      ? enabledRegionIds
      : new Set(enabledRegionIds);
  return regions.filter((r) => set.has(r.id));
}

/**
 * Group map regions by workspace for collapsible UI.
 * Pure — order of workspaces is title A–Z; region order within a group is stable input order.
 */
export function groupRegionsByWorkspace<
  T extends {
    id: string;
    workspace_id: string;
    workspace_title: string;
    name: string;
  },
>(regions: readonly T[]): MapRegionWorkspaceGroup<T>[] {
  const map = new Map<string, MapRegionWorkspaceGroup<T>>();
  for (const region of regions) {
    const wsId = (region.workspace_id || "").trim() || "unknown";
    let group = map.get(wsId);
    if (!group) {
      group = {
        workspace_id: wsId,
        workspace_title: (region.workspace_title || "").trim() || "Workspace",
        regions: [],
      };
      map.set(wsId, group);
    }
    group.regions.push(region);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.workspace_title.localeCompare(b.workspace_title, undefined, { sensitivity: "base" }),
  );
}

/**
 * Short preview of a user/guest UUID for map labels.
 * Prefers subject user id, then guest id, then snapshot id.
 */
export function shortUserIdPreview(input: {
  subject_user_id?: string | null;
  subject_guest_user_id?: string | null;
  id?: string | null;
}): string {
  const raw =
    (typeof input.subject_user_id === "string" && input.subject_user_id.trim()) ||
    (typeof input.subject_guest_user_id === "string" && input.subject_guest_user_id.trim()) ||
    (typeof input.id === "string" && input.id.trim()) ||
    "";
  const cleaned = raw.replace(/-/g, "").toLowerCase();
  if (cleaned.length >= 6) return cleaned.slice(0, 6);
  if (cleaned.length > 0) return cleaned;
  return "—";
}

/**
 * Pick up to `count` region ids at random from a flat list.
 * Remaining regions start disabled (user can toggle them back on).
 */
export function pickRandomEnabledRegionIds(
  regionIds: readonly string[],
  count = 3,
  random: () => number = Math.random,
): string[] {
  if (regionIds.length === 0) return [];
  if (regionIds.length <= count) return [...regionIds];
  const shuffled = [...regionIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, count);
}

/**
 * Default map highlight: pick one workspace at random, then enable up to
 * `count` regions from that workspace only (never a mix across workspaces).
 */
export function pickDefaultEnabledRegionsFromOneWorkspace(
  regions: readonly { id: string; workspace_id: string }[],
  count = 3,
  random: () => number = Math.random,
): DefaultRegionPickResult {
  if (!regions.length) {
    return { regionIds: [], workspace_id: null };
  }

  const byWorkspace = new Map<string, string[]>();
  for (const region of regions) {
    const wsId = (region.workspace_id || "").trim() || "unknown";
    const list = byWorkspace.get(wsId);
    if (list) list.push(region.id);
    else byWorkspace.set(wsId, [region.id]);
  }

  const workspaceIds = Array.from(byWorkspace.keys());
  const workspace_id =
    workspaceIds[Math.floor(random() * workspaceIds.length)] ?? null;
  if (!workspace_id) {
    return { regionIds: [], workspace_id: null };
  }

  const candidateIds = byWorkspace.get(workspace_id) || [];
  return {
    regionIds: pickRandomEnabledRegionIds(candidateIds, count, random),
    workspace_id,
  };
}

export function aggregatePublicPowStats(
  rows: PublicPowWorkspaceStatsRaw[],
): MapAggregatedPowStats {
  const byType = new Map<string, number>();
  let total = 0;
  let sessions = 0;
  let blocks = 0;
  let last24 = 0;
  let last7 = 0;

  for (const row of rows) {
    total += row.total_artifacts || 0;
    sessions += row.unique_sessions || 0;
    blocks += row.unique_blocks || 0;
    last24 += row.last_24h || 0;
    last7 += row.last_7d || 0;
    for (const entry of row.by_type || []) {
      byType.set(entry.type, (byType.get(entry.type) || 0) + (entry.count || 0));
    }
  }

  return {
    workspace_count: rows.length,
    total_artifacts: total,
    unique_sessions: sessions,
    unique_blocks: blocks,
    last_24h: last24,
    last_7d: last7,
    by_type: Array.from(byType.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function buildMapOfKnowledgePayload(input: {
  workspaces: PublicWorkspaceRaw[];
  blocks: PublicBlockRaw[];
  regions: PublicRegionRaw[];
  userPoints: PublicUserPointRaw[];
  powStats: PublicPowWorkspaceStatsRaw[];
  generatedAt?: string;
  /** Preferred embedding model; falls back to primary flowcfg when missing. */
  embeddingModelId?: string | null;
  /** Pre-built catalog from loader (optional). */
  embeddingModels?: EmbeddingModelInfo[];
}): MapOfKnowledgePayload {
  const publicWs = filterPublicWorkspaces(input.workspaces);
  const wsIds = new Set(publicWs.map((w) => w.id));
  const titleById = new Map(
    publicWs.map((w) => [w.id, w.title || w.root_topic || "Untitled"]),
  );

  const blocks = input.blocks.filter((b) => wsIds.has(b.workspace_id));

  // Discover models from raw public points/regions before filter
  const discoveredCounts = new Map<
    string,
    { dim: number; point_count: number; region_count: number }
  >();
  const bump = (
    modelId: string | null | undefined,
    dim: number | null | undefined,
    kind: "point" | "region",
  ) => {
    const id = (modelId || "").trim() || FLOW_EMBEDDING_MODEL_ID;
    const cur = discoveredCounts.get(id) || { dim: 0, point_count: 0, region_count: 0 };
    if (typeof dim === "number" && dim > 0) cur.dim = dim;
    if (kind === "point") cur.point_count += 1;
    else cur.region_count += 1;
    discoveredCounts.set(id, cur);
  };
  for (const p of input.userPoints) {
    if (!wsIds.has(p.workspace_id)) continue;
    bump(
      p.embedding_model_id,
      p.dim ?? (Array.isArray(p.vector) ? p.vector.length : null),
      "point",
    );
  }
  for (const r of input.regions) {
    if (!wsIds.has(r.workspace_id)) continue;
    bump(
      r.embedding_model_id,
      r.dim ?? (Array.isArray(r.centroid) ? r.centroid.length : null),
      "region",
    );
  }

  const embedding_models =
    input.embeddingModels && input.embeddingModels.length > 0
      ? input.embeddingModels
      : mergeEmbeddingModelCatalog(
          Array.from(discoveredCounts.entries()).map(([id, c]) => ({
            id,
            dim: c.dim,
            point_count: c.point_count,
            region_count: c.region_count,
          })),
        );

  const embedding_model_id = resolveSelectedEmbeddingModelId(
    input.embeddingModelId,
    embedding_models,
  );
  const embedding_info =
    embedding_models.find((m) => m.id === embedding_model_id) ||
    describeEmbeddingModel(embedding_model_id);

  const matchesModel = (modelId: string | null | undefined) => {
    const id = (modelId || "").trim() || FLOW_EMBEDDING_MODEL_ID;
    return id === embedding_model_id;
  };

  const regionsRaw = input.regions.filter(
    (r) => wsIds.has(r.workspace_id) && matchesModel(r.embedding_model_id),
  );
  const pointsRaw = input.userPoints.filter(
    (p) => wsIds.has(p.workspace_id) && matchesModel(p.embedding_model_id),
  );

  const allVectors = [
    ...pointsRaw.map((p) => p.vector),
    ...regionsRaw.map((r) => r.centroid),
  ];
  const projected = projectMapVectors(allVectors, "pca");
  const pointCoords = projected.slice(0, pointsRaw.length);
  const regionCoords = projected.slice(pointsRaw.length);

  const user_locations: MapUserLocation[] = pointsRaw.map((p, i) => {
    const kind = mapDotKindFromParticipant(p.kind);
    const coord = pointCoords[i] || { x: 0, y: 0, z: 0 };
    const id_preview = shortUserIdPreview({
      subject_user_id: p.subject_user_id,
      subject_guest_user_id: p.subject_guest_user_id,
      id: p.id,
    });
    // Deterministic STEM avatar per subject (no DB field required for legacy rows).
    const avatar = resolveMapUserAvatar({ id: p.id });
    return {
      id: p.id,
      workspace_id: p.workspace_id,
      workspace_title: titleById.get(p.workspace_id) || "Workspace",
      subject_label: p.subject_guest_user_id
        ? `guest:${id_preview}`
        : p.subject_user_id
          ? `user:${id_preview}`
          : `id:${id_preview}`,
      id_preview,
      kind,
      avatar_id: avatar.id,
      avatar_path: avatar.path,
      subject_guest_user_id: p.subject_guest_user_id ?? null,
      subject_user_id: p.subject_user_id ?? null,
      vector: p.vector,
      x: coord.x,
      y: coord.y,
      z: coord.z,
      confidence: typeof p.confidence === "number" ? p.confidence : 0.5,
    };
  });

  const regions: MapRegion[] = regionsRaw.map((r, i) => {
    const coord = regionCoords[i] || { x: 0, y: 0, z: 0 };
    return {
      id: r.id,
      workspace_id: r.workspace_id,
      workspace_title: titleById.get(r.workspace_id) || "Workspace",
      name: r.name,
      vector: r.centroid,
      x: coord.x,
      y: coord.y,
      z: coord.z,
      radius: typeof r.mean_radius === "number" && r.mean_radius > 0 ? r.mean_radius : 0.35,
      enabled_default: true,
    };
  });

  const blockCountByWs = new Map<string, number>();
  for (const b of blocks) {
    blockCountByWs.set(b.workspace_id, (blockCountByWs.get(b.workspace_id) || 0) + 1);
  }
  const regionCountByWs = new Map<string, number>();
  for (const r of regions) {
    regionCountByWs.set(r.workspace_id, (regionCountByWs.get(r.workspace_id) || 0) + 1);
  }
  const pointCountByWs = new Map<string, number>();
  for (const p of user_locations) {
    pointCountByWs.set(p.workspace_id, (pointCountByWs.get(p.workspace_id) || 0) + 1);
  }

  const workspaces: MapPublicWorkspace[] = publicWs.map((w) => ({
    id: w.id,
    title: w.title || w.root_topic || "Untitled",
    root_topic: w.root_topic || w.title || "Untitled",
    description: w.description ?? null,
    cover_image_url: w.cover_image_url ?? null,
    is_public: true,
    block_count: blockCountByWs.get(w.id) || 0,
    region_count: regionCountByWs.get(w.id) || 0,
    user_point_count: pointCountByWs.get(w.id) || 0,
  }));

  const powFiltered = input.powStats.filter((s) => wsIds.has(s.workspace_id));

  return {
    title: "The Map of Knowledge",
    workspaces,
    blocks: blocks.map((b) => ({
      id: b.id,
      workspace_id: b.workspace_id,
      title: b.title || "Block",
      is_start: Boolean(b.is_start),
    })),
    regions,
    user_locations,
    pow_stats: aggregatePublicPowStats(powFiltered),
    generated_at: input.generatedAt || new Date().toISOString(),
    embedding_model_id,
    embedding_models,
    embedding_info: {
      ...embedding_info,
      point_count: pointsRaw.length,
      region_count: regionsRaw.length,
    },
  };
}
