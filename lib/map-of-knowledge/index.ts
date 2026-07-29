/**
 * Map of Knowledge — pure aggregation, projection, and guest-placement helpers.
 * Public workspaces expose embeddings, regions, blocks, and PoW aggregates here.
 */

import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  KNOWLEDGE_CONFIG_SEM_DIM,
  KNOWLEDGE_CONFIG_STRUCT_DIM,
  parseProjectionAlgorithmId,
  projectVectors2D,
  type ProjectionAlgorithmId,
} from "@/lib/knowledge-config";

export type { ProjectionAlgorithmId } from "@/lib/knowledge-config";
export {
  PROJECTION_ALGORITHM_IDS,
  PROJECTION_ALGORITHM_OPTIONS,
  parseProjectionAlgorithmId,
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  KNOWLEDGE_CONFIG_SEM_DIM,
  KNOWLEDGE_CONFIG_STRUCT_DIM,
} from "@/lib/knowledge-config";

export type {
  StemMiniAvatar,
  StemMiniAvatarId,
} from "@/lib/map-of-knowledge/stem-avatars";
export {
  STEM_MINI_AVATARS,
  STEM_MINI_AVATAR_BASE_PATH,
  getStemMiniAvatar,
  hashStringToSeed,
  isStemMiniAvatarId,
  pickStemMiniAvatar,
  resolveMapUserAvatar,
  stemMiniAvatarCatalogSize,
  stemMiniAvatarForSubjectId,
  stemMiniAvatarPath,
} from "@/lib/map-of-knowledge/stem-avatars";

import {
  pickStemMiniAvatar,
  resolveMapUserAvatar,
} from "@/lib/map-of-knowledge/stem-avatars";

export type MapDotKind = "tap" | "ile" | "standard";

/** Catalog entry for embedding models shown on the Map of Knowledge. */
export interface EmbeddingModelInfo {
  id: string;
  label: string;
  dim: number;
  /** Structural feature dims when hybrid (e.g. knowledgecfg). */
  struct_dim?: number | null;
  /** Semantic feature dims when hybrid. */
  sem_dim?: number | null;
  description: string;
  notes?: string[];
  /** How many public user points use this model in the current load. */
  point_count?: number;
  /** How many public regions use this model in the current load. */
  region_count?: number;
}

/**
 * Known embedding models (comparable only within the same id).
 * Vectors with different embedding_model_id must never be mixed.
 */
export const EMBEDDING_MODEL_CATALOG: readonly EmbeddingModelInfo[] = [
  {
    id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
    label: "Knowledge config v1 (D=64)",
    dim: KNOWLEDGE_CONFIG_DIM,
    struct_dim: KNOWLEDGE_CONFIG_STRUCT_DIM,
    sem_dim: KNOWLEDGE_CONFIG_SEM_DIM,
    description:
      "Hybrid learner-state geometry: 48 structural + 16 semantic dimensions, L2-normalized into a fixed 64-D space comparable across public workspaces.",
    notes: [
      "Axes are shared globally for this model id — distance ≈ knowledge proximity.",
      "Structural block encodes coverage, PoW patterns, and tool traces.",
      "Semantic block encodes topic / language features from the hybrid encoder.",
      "Regions (custom verification models) live in the same frame when built from this model.",
    ],
  },
] as const;

export function describeEmbeddingModel(
  modelId: string | null | undefined,
  dimHint?: number | null,
): EmbeddingModelInfo {
  const id = (modelId || "").trim() || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
  const known = EMBEDDING_MODEL_CATALOG.find((m) => m.id === id);
  if (known) return { ...known };
  const dim =
    typeof dimHint === "number" && Number.isFinite(dimHint) && dimHint > 0
      ? Math.floor(dimHint)
      : 0;
  return {
    id,
    label: id,
    dim,
    description:
      dim > 0
        ? `Public embedding model “${id}” with fixed dimension D=${dim}. Vectors are only comparable within this model id.`
        : `Public embedding model “${id}”. Vectors are only comparable within this model id.`,
    notes: [
      "Different embedding_model_id values are not comparable — the map never mixes them.",
      "Dimension is inferred from stored snapshots or regions when not in the built-in catalog.",
    ],
  };
}

/** Merge catalog + discovered models; sort primary catalog first then by id. */
export function mergeEmbeddingModelCatalog(
  discovered: Array<{ id: string; dim?: number | null; point_count?: number; region_count?: number }>,
): EmbeddingModelInfo[] {
  const byId = new Map<string, EmbeddingModelInfo>();
  for (const m of EMBEDDING_MODEL_CATALOG) {
    byId.set(m.id, { ...m, point_count: 0, region_count: 0 });
  }
  for (const d of discovered) {
    const id = (d.id || "").trim();
    if (!id) continue;
    const existing = byId.get(id);
    if (existing) {
      byId.set(id, {
        ...existing,
        point_count: (existing.point_count || 0) + (d.point_count || 0),
        region_count: (existing.region_count || 0) + (d.region_count || 0),
        dim: existing.dim || d.dim || 0,
      });
    } else {
      byId.set(id, {
        ...describeEmbeddingModel(id, d.dim),
        point_count: d.point_count || 0,
        region_count: d.region_count || 0,
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const aKnown = EMBEDDING_MODEL_CATALOG.some((m) => m.id === a.id) ? 0 : 1;
    const bKnown = EMBEDDING_MODEL_CATALOG.some((m) => m.id === b.id) ? 0 : 1;
    if (aKnown !== bKnown) return aKnown - bKnown;
    return a.id.localeCompare(b.id);
  });
}

export function resolveSelectedEmbeddingModelId(
  requested: string | null | undefined,
  available: readonly EmbeddingModelInfo[],
): string {
  const req = (requested || "").trim();
  if (req && available.some((m) => m.id === req)) return req;
  if (available.some((m) => m.id === KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID)) {
    return KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
  }
  return available[0]?.id || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
}

export interface MapPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface MapUserLocation {
  id: string;
  workspace_id: string;
  workspace_title: string;
  subject_label: string;
  /** Short user/guest id preview for map labels (e.g. first 6 hex chars). */
  id_preview: string;
  kind: MapDotKind;
  /** STEM mini avatar catalog id (explicit or deterministically assigned). */
  avatar_id: string;
  /** Public path for the mini avatar asset. */
  avatar_path: string;
  vector: number[];
  x: number;
  y: number;
  z: number;
  confidence: number;
}

export interface MapRegion {
  id: string;
  workspace_id: string;
  workspace_title: string;
  name: string;
  vector: number[];
  x: number;
  y: number;
  z: number;
  radius: number;
  enabled_default?: boolean;
}

export interface MapPublicWorkspace {
  id: string;
  title: string;
  root_topic: string;
  description: string | null;
  cover_image_url: string | null;
  block_count: number;
  region_count: number;
  user_point_count: number;
}

export interface MapPublicBlock {
  id: string;
  workspace_id: string;
  title: string;
  is_start: boolean;
}

export interface MapAggregatedPowStats {
  workspace_count: number;
  total_artifacts: number;
  unique_sessions: number;
  unique_blocks: number;
  last_24h: number;
  last_7d: number;
  by_type: Array<{ type: string; count: number }>;
}

export interface MapOfKnowledgePayload {
  title: string;
  workspaces: MapPublicWorkspace[];
  blocks: MapPublicBlock[];
  regions: MapRegion[];
  user_locations: MapUserLocation[];
  pow_stats: MapAggregatedPowStats;
  generated_at: string;
  /** Active embedding model for this payload (points + regions filtered to it). */
  embedding_model_id: string;
  /** Catalog + discovered models available across public workspaces. */
  embedding_models: EmbeddingModelInfo[];
  /** Explainer for the selected model (dims, hybrid structure, comparability). */
  embedding_info: EmbeddingModelInfo;
}

export interface PublicWorkspaceRaw {
  id: string;
  title: string | null;
  root_topic: string | null;
  description?: string | null;
  cover_image_url?: string | null;
  is_public: boolean;
}

export interface PublicBlockRaw {
  id: string;
  workspace_id: string;
  title: string | null;
  is_start?: boolean | null;
}

export interface PublicRegionRaw {
  id: string;
  workspace_id: string;
  name: string;
  centroid: number[];
  mean_radius?: number | null;
  embedding_model_id?: string | null;
  dim?: number | null;
}

export interface PublicUserPointRaw {
  id: string;
  workspace_id: string;
  subject_user_id?: string | null;
  subject_guest_user_id?: string | null;
  vector: number[];
  confidence?: number | null;
  /** When known from guest metadata / participant type. */
  kind?: MapDotKind | null;
  embedding_model_id?: string | null;
  dim?: number | null;
}

export interface PublicPowWorkspaceStatsRaw {
  workspace_id: string;
  total_artifacts: number;
  unique_sessions: number;
  unique_blocks: number;
  last_24h: number;
  last_7d: number;
  by_type?: Array<{ type: string; count: number }>;
}

/** Filter rows to public workspaces only. */
export function filterPublicWorkspaces<T extends { is_public?: boolean | null }>(
  rows: T[],
): T[] {
  return rows.filter((r) => r.is_public === true);
}

/** Dot kind for map rendering: ILE = golden, TAP = standard. */
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
 * Project high-D vectors with a named knowledge-config algorithm.
 * - `pca`: full 3D PCA (top-3 PCs)
 * - other algorithms: shipped 2D layout (random / MDS / SMACOF) + soft residual height as z
 *   so 3D explore still has depth while the primary plane matches the algorithm.
 */
export function projectMapVectors(
  vectors: number[][],
  algorithm: ProjectionAlgorithmId | string = "pca",
): MapPoint3D[] {
  const algo = parseProjectionAlgorithmId(algorithm, "pca");
  if (algo === "pca") return projectVectors3D(vectors);

  const xy = projectVectors2D(vectors, algo);
  return xy.map((p, i) => {
    const v = vectors[i] || [];
    let z = 0;
    let n = 0;
    for (let j = 2; j < v.length; j += 3) {
      z += v[j] ?? 0;
      n += 1;
    }
    z = n > 0 ? z / n : 0;
    return {
      x: p.x,
      y: p.y,
      z: Number.isFinite(z) ? z : 0,
    };
  });
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
 * Project high-D vectors to 3D via PCA (top-3 principal components).
 * Reuses the same Jacobi path as knowledge-config 2D projection.
 */
export function projectVectors3D(vectors: number[][]): MapPoint3D[] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: 0, y: 0, z: 0 }];

  const d = vectors[0]?.length ?? 0;
  if (d === 0) return vectors.map(() => ({ x: 0, y: 0, z: 0 }));

  const mean = new Array(d).fill(0);
  for (const v of vectors) {
    for (let j = 0; j < d; j++) mean[j] += v[j] ?? 0;
  }
  for (let j = 0; j < d; j++) mean[j] /= n;

  const centered = vectors.map((v) => v.map((x, j) => (x ?? 0) - mean[j]));

  const cov: number[][] = Array.from({ length: d }, () => new Array(d).fill(0));
  for (let i = 0; i < n; i++) {
    const row = centered[i];
    for (let a = 0; a < d; a++) {
      const ra = row[a];
      if (ra === 0) continue;
      for (let b = a; b < d; b++) {
        cov[a][b] += ra * row[b];
      }
    }
  }
  for (let a = 0; a < d; a++) {
    for (let b = a; b < d; b++) {
      cov[a][b] /= Math.max(1, n - 1);
      cov[b][a] = cov[a][b];
    }
  }

  // Local Jacobi (same algorithm as project-2d) — keep dependency free for client bundles.
  const { values, vectors: evecs } = jacobiSymmetric(cov);
  const pc0 = values[0] > 1e-12 ? 0 : -1;
  const pc1 = values[1] > 1e-12 ? 1 : -1;
  const pc2 = values[2] > 1e-12 ? 2 : -1;

  return centered.map((row) => {
    let x = 0;
    let y = 0;
    let z = 0;
    if (pc0 >= 0) for (let j = 0; j < d; j++) x += row[j] * evecs[j][pc0];
    if (pc1 >= 0) for (let j = 0; j < d; j++) y += row[j] * evecs[j][pc1];
    if (pc2 >= 0) for (let j = 0; j < d; j++) z += row[j] * evecs[j][pc2];
    return {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      z: Number.isFinite(z) ? z : 0,
    };
  });
}

function jacobiSymmetric(matrix: number[][]): { values: number[]; vectors: number[][] } {
  const n = matrix.length;
  if (n === 0) return { values: [], vectors: [] };
  if (n === 1) return { values: [matrix[0][0]], vectors: [[1]] };

  const a = matrix.map((row) => row.slice());
  const v = Array.from({ length: n }, (_, i) => {
    const row = new Array(n).fill(0);
    row[i] = 1;
    return row;
  });

  for (let sweep = 0; sweep < 48; sweep++) {
    let maxOff = 0;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        maxOff = Math.max(maxOff, Math.abs(a[p][q]));
        const app = a[p][p];
        const aqq = a[q][q];
        const apq = a[p][q];
        if (Math.abs(apq) < 1e-18) continue;
        const tau = (aqq - app) / (2 * apq);
        const sign = tau >= 0 ? 1 : -1;
        const t = sign / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;
        a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
        a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
        a[p][q] = 0;
        a[q][p] = 0;
        for (let i = 0; i < n; i++) {
          if (i === p || i === q) continue;
          const aip = a[i][p];
          const aiq = a[i][q];
          a[i][p] = c * aip - s * aiq;
          a[p][i] = a[i][p];
          a[i][q] = s * aip + c * aiq;
          a[q][i] = a[i][q];
        }
        for (let i = 0; i < n; i++) {
          const vip = v[i][p];
          const viq = v[i][q];
          v[i][p] = c * vip - s * viq;
          v[i][q] = s * vip + c * viq;
        }
      }
    }
    if (maxOff < 1e-12) break;
  }

  const values = a.map((row, i) => row[i]);
  const order = values
    .map((val, i) => ({ val, i }))
    .sort((x, y) => y.val - x.val);
  const sortedValues = order.map((o) => o.val);
  const sortedVectors = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let col = 0; col < n; col++) {
    const src = order[col].i;
    for (let row = 0; row < n; row++) {
      sortedVectors[row][col] = v[row][src];
    }
  }
  return { values: sortedValues, vectors: sortedVectors };
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

/** Workspace-grouped region list for Map of Knowledge collapsible toggles. */
export type MapRegionWorkspaceGroup<T extends {
  id: string;
  workspace_id: string;
  workspace_title: string;
  name: string;
} = MapRegion> = {
  workspace_id: string;
  workspace_title: string;
  regions: T[];
};

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

export type DefaultRegionPickResult = {
  /** Region ids enabled by default (all from `workspace_id`). */
  regionIds: string[];
  /** Workspace that was randomly selected as the default highlight source. */
  workspace_id: string | null;
};

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
  /** Preferred embedding model; falls back to primary knowledgecfg when missing. */
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
    const id = (modelId || "").trim() || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
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
    const id = (modelId || "").trim() || KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID;
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

/** Random anonymous guest display identity for Map placement UI (name + STEM mini avatar). */
export function generateAnonymousGuestIdentity(seed?: number): {
  display_name: string;
  guest_token: string;
  avatar_id: string;
  avatar_path: string;
  avatar_label: string;
} {
  const adjectives = [
    "Silent",
    "Curious",
    "Orbital",
    "Lucid",
    "Vivid",
    "Sparse",
    "Radiant",
    "Hidden",
    "Swift",
    "Deep",
  ];
  const nouns = [
    "Neuron",
    "Orbit",
    "Atlas",
    "Vector",
    "Signal",
    "Lattice",
    "Comet",
    "Prism",
    "Echo",
    "Quasar",
  ];
  const n =
    typeof seed === "number" && Number.isFinite(seed)
      ? Math.abs(Math.floor(seed))
      : Math.floor(Math.random() * 1e9);
  const adj = adjectives[n % adjectives.length];
  const noun = nouns[Math.floor(n / adjectives.length) % nouns.length];
  const suffix = (n % 9000) + 1000;
  // Offset seed so avatar variety is not locked 1:1 to the adjective index alone.
  const avatar = pickStemMiniAvatar(Math.floor(n / 17) + n * 3);
  const guest_token =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `guest-${n.toString(16)}-${Date.now().toString(16)}`;
  return {
    display_name: `${adj} ${noun} ${suffix}`,
    guest_token,
    avatar_id: avatar.id,
    avatar_path: avatar.path,
    avatar_label: avatar.label,
  };
}

export type GuestLinkKind = "tap" | "ile";

export interface GuestPlacementRequest {
  workspace_id: string;
  block_id: string;
  link_kind: GuestLinkKind;
  guest_display_name?: string;
}

export interface GuestPlacementResult {
  ok: true;
  link_kind: GuestLinkKind;
  private_url: string;
  workspace_id: string;
  block_id: string;
  guest_display_name: string;
  map_dot_kind: MapDotKind;
  map_dot_golden: boolean;
}

export interface GuestPlacementError {
  ok: false;
  error: string;
  code: string;
}

/**
 * Validate guest placement inputs against the public map catalog.
 * Pure — does not mint links; API uses this then calls TAP/ILE create.
 */
export function validateGuestPlacement(
  request: GuestPlacementRequest,
  catalog: {
    workspaces: Array<{ id: string; is_public?: boolean }>;
    blocks: Array<{ id: string; workspace_id: string }>;
  },
): { ok: true } | GuestPlacementError {
  const workspaceId = (request.workspace_id || "").trim();
  const blockId = (request.block_id || "").trim();
  const kind = request.link_kind;

  if (!workspaceId || !blockId) {
    return { ok: false, error: "workspace_id and block_id are required", code: "validation_error" };
  }
  if (kind !== "tap" && kind !== "ile") {
    return { ok: false, error: "link_kind must be tap or ile", code: "validation_error" };
  }

  const ws = catalog.workspaces.find((w) => w.id === workspaceId);
  if (!ws || ws.is_public === false) {
    return { ok: false, error: "Workspace is not public", code: "not_public" };
  }

  const block = catalog.blocks.find((b) => b.id === blockId && b.workspace_id === workspaceId);
  if (!block) {
    return { ok: false, error: "Block not found in public workspace", code: "block_not_found" };
  }

  return { ok: true };
}

/** Build the success payload for a minted guest link (dot kind semantics). */
export function buildGuestPlacementResult(input: {
  link_kind: GuestLinkKind;
  private_url: string;
  workspace_id: string;
  block_id: string;
  guest_display_name: string;
}): GuestPlacementResult {
  const map_dot_kind: MapDotKind = input.link_kind === "ile" ? "ile" : "tap";
  return {
    ok: true,
    link_kind: input.link_kind,
    private_url: input.private_url,
    workspace_id: input.workspace_id,
    block_id: input.block_id,
    guest_display_name: input.guest_display_name,
    map_dot_kind,
    map_dot_golden: mapDotIsGolden(map_dot_kind),
  };
}
