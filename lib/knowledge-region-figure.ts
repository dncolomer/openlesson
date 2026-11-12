/**
 * Circular 2D embedding map for a single knowledge region: polar grid,
 * nested density contours, mixed glyphs, centroid marks, and distance
 * rays from the selected point. Real points stay off until toggled.
 */

import {
  formatStudioHighDimDistance,
  studioPointInsideHighDimRegion,
  STUDIO_HUMAN_FILL,
  STUDIO_SIMULATED_FILL,
} from "@/lib/data-studio-view";
import type { RegionCentroidInput } from "@/lib/knowledge-config";
import { l2Distance } from "@/lib/knowledge-config/math";
import type { StudioEmbeddingOrigin } from "@/lib/region-simulation";

export const KNOWLEDGE_REGION_CLUSTER_COLORS = [
  "#b7d6f4",
  "#6ea8de",
  "#3d6fad",
] as const;

export const KNOWLEDGE_REGION_ANALYSIS_FILL = "#cbb8a0";

export type KnowledgeRegionPointKind = "simulated" | "cohort" | "analysis";

export const KNOWLEDGE_REGION_MAP_SIZE = 480;
export const KNOWLEDGE_REGION_MAP_CENTER = { x: 240, y: 240 };
export const KNOWLEDGE_REGION_MAP_RADIUS = 208;

export type KnowledgeRegionGlyphKind =
  | "filled-circle"
  | "open-circle"
  | "diamond"
  | "open-diamond";

export type KnowledgeRegionFigurePoint = {
  id: string;
  x: number;
  y: number;
  origin: StudioEmbeddingOrigin;
  pointKind?: KnowledgeRegionPointKind;
  clusterId: string | null;
  identity: string | null;
  vector?: number[] | null;
};

export type KnowledgeRegionContour = {
  clusterId: string;
  level: number;
  path: string;
  color: string;
};

export type KnowledgeRegionGlyph = {
  id: string;
  x: number;
  y: number;
  origin: StudioEmbeddingOrigin;
  pointKind: KnowledgeRegionPointKind;
  clusterId: string | null;
  identity: string | null;
  glyph: KnowledgeRegionGlyphKind;
  stray: boolean;
};

export type KnowledgeRegionBadge = {
  id: string;
  kind: "cluster" | "focus";
  label: string;
  x: number;
  y: number;
  width: number;
  color: string;
};

export type KnowledgeRegionRay = {
  clusterId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  midX: number;
  midY: number;
  label: string;
  distance: number;
};

export type KnowledgeRegionFigureLegendItem = {
  id: string;
  kind: "cluster" | "simulated" | "cohort" | "analysis";
  label: string;
  color: string;
  toggle: "cluster" | "simulated" | "cohort" | "analysis" | null;
  on: boolean;
};

export type KnowledgeRegionPolarGrid = {
  cx: number;
  cy: number;
  radius: number;
  rings: number[];
  spokes: Array<{ x1: number; y1: number; x2: number; y2: number }>;
};

export type KnowledgeRegionFigureView = {
  map: { size: number; cx: number; cy: number; radius: number };
  grid: KnowledgeRegionPolarGrid;
  contours: KnowledgeRegionContour[];
  glyphs: KnowledgeRegionGlyph[];
  centroids: Array<{ id: string; x: number; y: number; color: string; label: string }>;
  badges: KnowledgeRegionBadge[];
  rays: KnowledgeRegionRay[];
  focus: { id: string; x: number; y: number; label: string } | null;
  legend: KnowledgeRegionFigureLegendItem[];
};

function meanPoint(points: readonly { x: number; y: number }[]): { x: number; y: number } {
  const n = points.length || 1;
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / n,
    y: points.reduce((sum, point) => sum + point.y, 0) / n,
  };
}

export function knowledgeRegionClustersShowingAll(
  visibleIds: readonly string[] | null | undefined,
  allIds: readonly string[],
): boolean {
  if (!visibleIds) return true;
  return allIds.length > 0 && allIds.every((id) => visibleIds.includes(id));
}

export function clusterVisibleInKnowledgeRegion(
  clusterId: string | null | undefined,
  visibleIds: readonly string[] | null | undefined,
): boolean {
  const id = String(clusterId || "").trim();
  if (!id) return true;
  if (!visibleIds) return true;
  return visibleIds.includes(id);
}

export function knowledgeRegionVisibleIdsFromSelection(
  selected: readonly string[],
  allIds: readonly string[],
): string[] | null {
  if (knowledgeRegionClustersShowingAll(selected, allIds)) return null;
  return [...selected];
}

export function knowledgeRegionAnalysisPointLabel(kind: string | null | undefined): string {
  return kind === "verification" || kind === "verify" ? "Test" : "Students";
}

export function knowledgeRegionPointKindLabel(
  pointKind: KnowledgeRegionPointKind,
  productKind?: string | null,
): string {
  if (pointKind === "simulated") return "Simulated";
  if (pointKind === "cohort") return "Reference";
  return knowledgeRegionAnalysisPointLabel(productKind);
}

function subjectText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function knowledgeRegionPointKind(input: {
  origin?: StudioEmbeddingOrigin | string | null;
  id?: string | null;
  identity?: string | null;
  userId?: string | null;
  subjects?: readonly {
    user_id?: unknown;
    guest_user_id?: unknown;
    label?: unknown;
  }[] | null;
}): KnowledgeRegionPointKind {
  if (input.origin === "simulated") return "simulated";
  const identity = subjectText(input.identity);
  const id = subjectText(input.id);
  const userId = subjectText(input.userId);
  for (const subject of input.subjects ?? []) {
    const label = subjectText(subject.label);
    const user = subjectText(subject.user_id);
    const guest = subjectText(subject.guest_user_id);
    const keys = [label, user, guest].filter(Boolean);
    if (identity && keys.includes(identity)) return "cohort";
    if (id && keys.includes(id)) return "cohort";
    if (userId && keys.includes(userId)) return "cohort";
  }
  return "analysis";
}

export function resolveKnowledgeRegionPointKind(
  point: Pick<KnowledgeRegionFigurePoint, "origin" | "pointKind">,
): KnowledgeRegionPointKind {
  return point.pointKind ?? (point.origin === "human" ? "analysis" : "simulated");
}

export function toggleKnowledgeRegionCluster(
  visibleIds: readonly string[] | null | undefined,
  id: string,
  allIds: readonly string[],
): string[] | null {
  const key = String(id || "").trim();
  const all = allIds.map((item) => String(item || "").trim()).filter(Boolean);
  if (!key || !all.includes(key)) {
    return visibleIds && visibleIds.length ? [...visibleIds] : null;
  }
  if (knowledgeRegionClustersShowingAll(visibleIds, all)) {
    return [key];
  }
  const current = (visibleIds ?? []).filter((item) => all.includes(item));
  if (current.includes(key)) {
    const next = current.filter((item) => item !== key);
    return next.length === 0 ? null : next;
  }
  const next = [...current, key];
  return knowledgeRegionClustersShowingAll(next, all) ? null : next;
}

export type KnowledgeRegionClusterDistance = {
  clusterId: string;
  label: string;
  distance: number;
  formatted: string;
  inCluster: boolean;
  nearest: boolean;
};

export function formatKnowledgeRegionTimestamp(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return raw;
  return `${new Date(ms).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export function presentKnowledgeRegionClusterDistances(input: {
  vector: number[] | null | undefined;
  clusters: readonly { id: string; strategyName: string }[];
  regions: readonly Pick<RegionCentroidInput, "id" | "centroid" | "cosine_threshold">[];
}): KnowledgeRegionClusterDistance[] {
  const vector = Array.isArray(input.vector) ? input.vector : [];
  const regionById = new Map(input.regions.map((region) => [region.id, region] as const));
  const rows = input.clusters
    .map((cluster) => {
      const region = regionById.get(cluster.id);
      const centroid = region?.centroid;
      if (
        !region ||
        !Array.isArray(centroid) ||
        !centroid.length ||
        vector.length !== centroid.length
      ) {
        return null;
      }
      const distance = l2Distance(vector, centroid);
      if (!Number.isFinite(distance)) return null;
      return {
        clusterId: cluster.id,
        label: cluster.strategyName,
        distance,
        formatted: formatStudioHighDimDistance(distance),
        inCluster: studioPointInsideHighDimRegion(vector, region),
        nearest: false,
      };
    })
    .filter((row): row is KnowledgeRegionClusterDistance => !!row)
    .sort((a, b) => a.distance - b.distance);
  if (rows[0]) rows[0].nearest = true;
  return rows;
}

export function knowledgeRegionClusterColor(index: number): string {
  const palette = KNOWLEDGE_REGION_CLUSTER_COLORS;
  return palette[((index % palette.length) + palette.length) % palette.length]!;
}

export function knowledgeRegionPolarGrid(input?: {
  cx?: number;
  cy?: number;
  radius?: number;
  rings?: number;
  spokes?: number;
}): KnowledgeRegionPolarGrid {
  const cx = input?.cx ?? KNOWLEDGE_REGION_MAP_CENTER.x;
  const cy = input?.cy ?? KNOWLEDGE_REGION_MAP_CENTER.y;
  const radius = input?.radius ?? KNOWLEDGE_REGION_MAP_RADIUS;
  const ringCount = Math.max(2, Math.round(input?.rings ?? 5));
  const spokeCount = Math.max(4, Math.round(input?.spokes ?? 12));
  const rings: number[] = [];
  for (let i = 1; i <= ringCount; i += 1) rings.push((radius * i) / ringCount);
  const spokes: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let i = 0; i < spokeCount; i += 1) {
    const angle = (Math.PI * 2 * i) / spokeCount;
    spokes.push({
      x1: cx,
      y1: cy,
      x2: cx + Math.cos(angle) * radius,
      y2: cy + Math.sin(angle) * radius,
    });
  }
  return { cx, cy, radius, rings, spokes };
}

export function convexHull(
  points: readonly { x: number; y: number }[],
): { x: number; y: number }[] {
  const unique = [...points]
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (unique.length <= 1) return unique.map((point) => ({ ...point }));
  const cross = (
    o: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: { x: number; y: number }[] = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: { x: number; y: number }[] = [];
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const point = unique[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function inflatePolygon(
  points: readonly { x: number; y: number }[],
  pad: number,
  miterLimit = 2.2,
): { x: number; y: number }[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ x: points[0]!.x, y: points[0]!.y }];
  const n = points.length;
  const origin = meanPoint(points);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = points[(i + n - 1) % n]!;
    const curr = points[i]!;
    const next = points[(i + 1) % n]!;
    const e1x = curr.x - prev.x;
    const e1y = curr.y - prev.y;
    const e2x = next.x - curr.x;
    const e2y = next.y - curr.y;
    const l1 = Math.hypot(e1x, e1y) || 1;
    const l2 = Math.hypot(e2x, e2y) || 1;
    let nx = -e1y / l1 + -e2y / l2;
    let ny = e1x / l1 + e2x / l2;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    const awayX = curr.x - origin.x;
    const awayY = curr.y - origin.y;
    if (nx * awayX + ny * awayY < 0) {
      nx = -nx;
      ny = -ny;
    }
    const n1x = -e1y / l1;
    const n1y = e1x / l1;
    const cos = Math.max(0.38, Math.abs(n1x * nx + n1y * ny));
    const miter = Math.min(pad * miterLimit, pad / cos);
    out.push({ x: curr.x + nx * miter, y: curr.y + ny * miter });
  }
  return out;
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number, rotation: number): string {
  const major = Math.max(rx, ry + 4);
  const minor = Math.min(rx, ry);
  const cr = Math.cos(rotation);
  const sr = Math.sin(rotation);
  const dx = cr * major;
  const dy = sr * major;
  const deg = (rotation * 180) / Math.PI;
  return `M ${(cx - dx).toFixed(2)} ${(cy - dy).toFixed(2)} A ${major.toFixed(2)} ${minor.toFixed(2)} ${deg.toFixed(2)} 0 1 ${(cx + dx).toFixed(2)} ${(cy + dy).toFixed(2)} A ${major.toFixed(2)} ${minor.toFixed(2)} ${deg.toFixed(2)} 0 1 ${(cx - dx).toFixed(2)} ${(cy - dy).toFixed(2)} Z`;
}

function smoothClosedPath(points: readonly { x: number; y: number }[]): string {
  if (!points.length) return "";
  if (points.length === 1) return ellipsePath(points[0]!.x, points[0]!.y, 22, 15, 0.32);
  if (points.length === 2) {
    const a = points[0]!;
    const b = points[1]!;
    const span = Math.hypot(b.x - a.x, b.y - a.y);
    return ellipsePath(
      (a.x + b.x) / 2,
      (a.y + b.y) / 2,
      span / 2 + Math.min(14, span * 0.4 + 8),
      Math.min(12, span * 0.28 + 7),
      Math.atan2(b.y - a.y, b.x - a.x),
    );
  }
  const n = points.length;
  const at = (i: number) => points[(i + n) % n]!;
  let d = `M ${at(0).x.toFixed(2)} ${at(0).y.toFixed(2)}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return `${d} Z`;
}

function clusterSpan(points: readonly { x: number; y: number }[]): number {
  const origin = meanPoint(points);
  return points.reduce(
    (max, point) => Math.max(max, Math.hypot(point.x - origin.x, point.y - origin.y)),
    0,
  );
}

export function blobPathFromPoints(
  points: readonly { x: number; y: number }[],
  pad = 16,
): string {
  const usable = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!usable.length) return "";
  if (usable.length <= 2) return smoothClosedPath(usable);
  const span = clusterSpan(usable);
  const limited = Math.min(pad, Math.max(6, span * 0.32 + 6));
  return smoothClosedPath(inflatePolygon(convexHull(usable), limited));
}

function scaleRingToward(
  points: readonly { x: number; y: number }[],
  origin: { x: number; y: number },
  scale: number,
): { x: number; y: number }[] {
  return points.map((point) => ({
    x: origin.x + (point.x - origin.x) * scale,
    y: origin.y + (point.y - origin.y) * scale,
  }));
}

export function densityContourRings(
  points: readonly { x: number; y: number }[],
  layers = 3,
): { x: number; y: number }[][] {
  const usable = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!usable.length) return [];
  const count = Math.max(2, Math.min(3, Math.round(layers)));
  const origin = meanPoint(usable);
  const span = clusterSpan(usable);
  let outer: { x: number; y: number }[];
  if (usable.length === 1) {
    const p = usable[0]!;
    outer = [
      { x: p.x + 20, y: p.y },
      { x: p.x, y: p.y + 14 },
      { x: p.x - 20, y: p.y },
      { x: p.x, y: p.y - 14 },
    ];
  } else if (usable.length === 2) {
    const a = usable[0]!;
    const b = usable[1]!;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const major = len / 2 + Math.min(12, span * 0.4 + 7);
    const minor = Math.min(11, span * 0.3 + 6);
    outer = [
      { x: mx + ux * major, y: my + uy * major },
      { x: mx + px * minor, y: my + py * minor },
      { x: mx - ux * major, y: my - uy * major },
      { x: mx - px * minor, y: my - py * minor },
    ];
  } else {
    const pad = Math.min(14, Math.max(7, span * 0.28 + 6));
    outer = inflatePolygon(convexHull(usable), pad);
  }
  return Array.from({ length: count }, (_, i) =>
    scaleRingToward(outer, origin, 1 - (i / (count - 1)) * 0.58),
  );
}

export function densityContourPaths(
  points: readonly { x: number; y: number }[],
  layers = 3,
): string[] {
  return densityContourRings(points, layers).map((ring) => smoothClosedPath(ring));
}

export function diamondGlyphPoints(cx: number, cy: number, r: number): string {
  return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
}

export function knowledgeRegionGlyphForPoint(
  point: Pick<KnowledgeRegionFigurePoint, "id" | "origin" | "clusterId" | "pointKind">,
  _stray = false,
): KnowledgeRegionGlyphKind {
  const kind = resolveKnowledgeRegionPointKind(point);
  if (kind === "analysis") return "diamond";
  if (kind === "cohort") return "filled-circle";
  return "open-circle";
}

function badgeWidth(label: string): number {
  return Math.min(168, Math.max(40, label.length * 6.35 + 16));
}

function mapPointsToDisk(
  points: readonly { id: string; x: number; y: number }[],
  disk: { cx: number; cy: number; radius: number },
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  if (!points.length) return out;
  const origin = meanPoint(points);
  let max = 0;
  for (const point of points) {
    max = Math.max(max, Math.hypot(point.x - origin.x, point.y - origin.y));
  }
  const inner = disk.radius * 0.78;
  const scale = max > 1e-6 ? inner / max : 1;
  for (const point of points) {
    out.set(point.id, {
      x: disk.cx + (point.x - origin.x) * scale,
      y: disk.cy + (point.y - origin.y) * scale,
    });
  }
  return out;
}

function pointDistance(
  from: { x: number; y: number; vector?: number[] | null },
  to: { x: number; y: number; vector?: number[] | null },
): number {
  const a = from.vector;
  const b = to.vector;
  if (Array.isArray(a) && Array.isArray(b) && a.length && a.length === b.length) {
    return l2Distance(a, b);
  }
  return Math.hypot(from.x - to.x, from.y - to.y);
}

export function presentKnowledgeRegionFigure(input: {
  points: readonly KnowledgeRegionFigurePoint[];
  clusters: readonly { id: string; strategyName: string; vector?: number[] | null }[];
  parent: { id: string; name: string; center?: { x: number; y: number } | null };
  showReal?: boolean;
  showSimulated?: boolean;
  visiblePointKinds?: readonly KnowledgeRegionPointKind[] | null;
  analysisLabel?: string | null;
  selectedClusterId?: string | null;
  visibleClusterIds?: readonly string[] | null;
  selectedPointId?: string | null;
}): KnowledgeRegionFigureView {
  const visiblePointKinds = new Set<KnowledgeRegionPointKind>(
    input.visiblePointKinds
      ? input.visiblePointKinds
      : [
          ...(input.showSimulated !== false ? (["simulated"] as const) : []),
          ...(input.showReal ? (["cohort", "analysis"] as const) : []),
        ],
  );
  const showSimulated = visiblePointKinds.has("simulated");
  const analysisLabel = input.analysisLabel || "Test";
  const visibleClusterIds =
    input.visibleClusterIds !== undefined
      ? input.visibleClusterIds
      : input.selectedClusterId
        ? [input.selectedClusterId]
        : null;
  const selectedPointId = input.selectedPointId || null;
  const map = {
    size: KNOWLEDGE_REGION_MAP_SIZE,
    cx: KNOWLEDGE_REGION_MAP_CENTER.x,
    cy: KNOWLEDGE_REGION_MAP_CENTER.y,
    radius: KNOWLEDGE_REGION_MAP_RADIUS,
  };
  const grid = knowledgeRegionPolarGrid(map);
  const visible = input.points.filter((point) => {
    const kind = resolveKnowledgeRegionPointKind(point);
    if (!visiblePointKinds.has(kind)) return false;
    if (point.clusterId && !clusterVisibleInKnowledgeRegion(point.clusterId, visibleClusterIds)) {
      return kind !== "simulated";
    }
    return true;
  });
  const placed = mapPointsToDisk(visible, map);
  const located = visible
    .map((point) => {
      const xy = placed.get(point.id);
      if (!xy) return null;
      return { ...point, x: xy.x, y: xy.y };
    })
    .filter((point): point is KnowledgeRegionFigurePoint => !!point);

  const clusterMeta = input.clusters.map((cluster, index) => {
    const members = located.filter((point) => point.clusterId === cluster.id);
    const center = members.length ? meanPoint(members) : null;
    const memberVectors = members
      .map((point) => point.vector)
      .filter((vector): vector is number[] => Array.isArray(vector) && vector.length > 0);
    const vector =
      cluster.vector && cluster.vector.length
        ? cluster.vector
        : memberVectors.length
          ? memberVectors[0]!.map(
              (_, dim) =>
                memberVectors.reduce((sum, row) => sum + (row[dim] ?? 0), 0) / memberVectors.length,
            )
          : null;
    return {
      ...cluster,
      color: knowledgeRegionClusterColor(index),
      members,
      center,
      vector,
    };
  });

  const radii = clusterMeta
    .filter((cluster) => cluster.center && cluster.members.length)
    .map((cluster) => {
      const center = cluster.center!;
      const distances = cluster.members.map((point) => Math.hypot(point.x - center.x, point.y - center.y));
      distances.sort((a, b) => a - b);
      return distances[Math.floor(distances.length * 0.7)] || 24;
    });
  const strayRadius = radii.length ? Math.max(...radii) * 1.85 : map.radius * 0.55;

  const glyphs: KnowledgeRegionGlyph[] = located.map((point) => {
    const home = clusterMeta.find((cluster) => cluster.id === point.clusterId);
    const stray =
      !home?.center ||
      Math.hypot(point.x - home.center.x, point.y - home.center.y) > strayRadius;
    return {
      id: point.id,
      x: point.x,
      y: point.y,
      origin: point.origin,
      pointKind: resolveKnowledgeRegionPointKind(point),
      clusterId: point.clusterId,
      identity: point.identity,
      glyph: knowledgeRegionGlyphForPoint(point, stray),
      stray,
    };
  });

  const contours: KnowledgeRegionContour[] = [];
  const centroids: KnowledgeRegionFigureView["centroids"] = [];
  const badges: KnowledgeRegionBadge[] = [];
  for (const cluster of clusterMeta) {
    if (!cluster.members.length || !cluster.center) continue;
    densityContourPaths(cluster.members, 3).forEach((path, level) => {
      contours.push({
        clusterId: cluster.id,
        level,
        path,
        color: cluster.color,
      });
    });
    centroids.push({
      id: cluster.id,
      x: cluster.center.x,
      y: cluster.center.y,
      color: cluster.color,
      label: cluster.strategyName,
    });
    const outwardX = cluster.center.x - map.cx;
    const outwardY = cluster.center.y - map.cy;
    const outward = Math.hypot(outwardX, outwardY) || 1;
    const label = cluster.strategyName;
    const width = badgeWidth(label);
    badges.push({
      id: cluster.id,
      kind: "cluster",
      label,
      x: cluster.center.x + (outwardX / outward) * 26 - width / 2,
      y: cluster.center.y + (outwardY / outward) * 26 - 28,
      width,
      color: cluster.color,
    });
  }

  const focusGlyph = selectedPointId
    ? glyphs.find((glyph) => glyph.id === selectedPointId) ?? null
    : null;
  const focusPoint = focusGlyph
    ? located.find((point) => point.id === focusGlyph.id) ?? null
    : null;
  const focus = focusGlyph
    ? {
        id: focusGlyph.id,
        x: focusGlyph.x,
        y: focusGlyph.y,
        label: focusGlyph.identity || focusGlyph.id,
      }
    : null;
  if (focus) {
    const width = badgeWidth(focus.label);
    badges.push({
      id: `focus-${focus.id}`,
      kind: "focus",
      label: focus.label,
      x: focus.x - width / 2,
      y: focus.y - 34,
      width,
      color: "#ffffff",
    });
  }

  const rays: KnowledgeRegionRay[] = [];
  if (focus && focusPoint) {
    const ranked = [...clusterMeta]
      .filter((cluster) => cluster.center)
      .map((cluster) => ({
        cluster,
        distance: pointDistance(focusPoint, {
          x: cluster.center!.x,
          y: cluster.center!.y,
          vector: cluster.vector,
        }),
      }))
      .sort((a, b) => a.distance - b.distance);
    for (const row of ranked) {
      const center = row.cluster.center!;
      rays.push({
        clusterId: row.cluster.id,
        x1: focus.x,
        y1: focus.y,
        x2: center.x,
        y2: center.y,
        midX: (focus.x + center.x) / 2,
        midY: (focus.y + center.y) / 2,
        distance: row.distance,
        label: formatStudioHighDimDistance(row.distance),
      });
    }
  }

  const legend: KnowledgeRegionFigureLegendItem[] = [
    ...input.clusters.map((cluster, index) => ({
      id: cluster.id,
      kind: "cluster" as const,
      label: cluster.strategyName,
      color: knowledgeRegionClusterColor(index),
      toggle: "cluster" as const,
      on: clusterVisibleInKnowledgeRegion(cluster.id, visibleClusterIds),
    })),
    {
      id: "simulated",
      kind: "simulated",
      label: "Simulated",
      color: STUDIO_SIMULATED_FILL,
      toggle: "simulated",
      on: showSimulated,
    },
    {
      id: "cohort",
      kind: "cohort",
      label: "Reference",
      color: STUDIO_HUMAN_FILL,
      toggle: "cohort",
      on: visiblePointKinds.has("cohort"),
    },
    {
      id: "analysis",
      kind: "analysis",
      label: analysisLabel,
      color: KNOWLEDGE_REGION_ANALYSIS_FILL,
      toggle: "analysis",
      on: visiblePointKinds.has("analysis"),
    },
  ];

  return {
    map,
    grid,
    contours,
    glyphs,
    centroids,
    badges,
    rays,
    focus,
    legend,
  };
}
