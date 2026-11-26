/**
 * Circular 2D embedding map for a single knowledge region: polar grid,
 * nested density contours, mixed glyphs, centroid marks, distance rays,
 * identity paths, and a quadrant view that slices the disk by nearest
 * simulation cluster and radii by unsys distance.
 */

import {
  formatStudioHighDimDistance,
  studioPointInsideHighDimRegion,
  STUDIO_HUMAN_FILL,
  STUDIO_SIMULATED_FILL,
} from "@/lib/data-studio-view";
import { recoverFlowEmbeddingRaw } from "@/lib/flow-embedding";
import type { RegionCentroidInput } from "@/lib/knowledge-config";
import { l2Distance } from "@/lib/knowledge-config/math";
import { flowLinkDefinesReference, flowLinkIsAiUse, normalizeFlowLinkLabel } from "@/lib/flow-links";
import {
  isAiUseIdentity,
  type StudioEmbeddingOrigin,
} from "@/lib/region-simulation";

export const KNOWLEDGE_REGION_CLUSTER_COLORS = [
  "#b7d6f4",
  "#6ea8de",
  "#3d6fad",
] as const;

export const KNOWLEDGE_REGION_ANALYSIS_FILL = "#cbb8a0";

export type KnowledgeRegionPointKind = "simulated" | "cohort" | "analysis" | "ai_use";

export const KNOWLEDGE_REGION_MAP_SIZE = 480;
export const KNOWLEDGE_REGION_MAP_CENTER = { x: 240, y: 240 };
export const KNOWLEDGE_REGION_MAP_RADIUS = 208;

export type KnowledgeRegionGlyphKind =
  | "filled-circle"
  | "open-circle"
  | "diamond"
  | "open-diamond";

export type KnowledgeRegionFigureSpace = "full" | "quadrant" | "ai_use";
export type KnowledgeRegionFigureTrack = "individual" | "path";
export type KnowledgeRegionFigureMode =
  | "individual"
  | "path"
  | "quadrant"
  | "quadrant-path"
  | "ai_use"
  | "ai_use-path";

export function parseKnowledgeRegionFigureSpace(value: unknown): KnowledgeRegionFigureSpace {
  if (value === "quadrant") return "quadrant";
  if (value === "ai_use") return "ai_use";
  return "full";
}

export function parseKnowledgeRegionFigureTrack(value: unknown): KnowledgeRegionFigureTrack {
  return value === "path" ? "path" : "individual";
}

export function knowledgeRegionFigureSpace(mode: KnowledgeRegionFigureMode): KnowledgeRegionFigureSpace {
  if (mode === "quadrant" || mode === "quadrant-path") return "quadrant";
  if (mode === "ai_use" || mode === "ai_use-path") return "ai_use";
  return "full";
}

export function knowledgeRegionFigureTrack(mode: KnowledgeRegionFigureMode): KnowledgeRegionFigureTrack {
  return mode === "path" || mode === "quadrant-path" || mode === "ai_use-path" ? "path" : "individual";
}

export function knowledgeRegionFigureMode(
  space: KnowledgeRegionFigureSpace,
  track: KnowledgeRegionFigureTrack,
): KnowledgeRegionFigureMode {
  if (space === "quadrant") return track === "path" ? "quadrant-path" : "quadrant";
  if (space === "ai_use") return track === "path" ? "ai_use-path" : "ai_use";
  return track === "path" ? "path" : "individual";
}

export function parseKnowledgeRegionFigureMode(value: unknown): KnowledgeRegionFigureMode {
  if (value === "path") return "path";
  if (value === "quadrant") return "quadrant";
  if (value === "quadrant-path") return "quadrant-path";
  if (value === "ai_use") return "ai_use";
  if (value === "ai_use-path") return "ai_use-path";
  return "individual";
}

export const KNOWLEDGE_REGION_FIGURE_ZOOM_FIT = 1;
export const KNOWLEDGE_REGION_FIGURE_ZOOM_MIN = 1;
export const KNOWLEDGE_REGION_FIGURE_ZOOM_MAX = 16;
export const KNOWLEDGE_REGION_FIGURE_ZOOM_STEP = 1.25;
export const KNOWLEDGE_REGION_FIGURE_FOCUS_PAD = 1.4;
export const KNOWLEDGE_REGION_FIGURE_FOCUS_MIN_SPAN = 12;
export const KNOWLEDGE_REGION_FIGURE_LABEL_PAD = 8;
export const KNOWLEDGE_REGION_FIGURE_LABEL_GLYPH_RADIUS = 4.2;
export const KNOWLEDGE_REGION_FIGURE_LABEL_MIN_SEGMENT = 40;

export function clampKnowledgeRegionFigureZoom(value: unknown): number {
  const zoom = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(zoom) || zoom <= 0) return KNOWLEDGE_REGION_FIGURE_ZOOM_FIT;
  return Math.min(
    KNOWLEDGE_REGION_FIGURE_ZOOM_MAX,
    Math.max(KNOWLEDGE_REGION_FIGURE_ZOOM_MIN, zoom),
  );
}

export function knowledgeRegionFigureZoomIn(zoom: unknown): number {
  return clampKnowledgeRegionFigureZoom(
    clampKnowledgeRegionFigureZoom(zoom) * KNOWLEDGE_REGION_FIGURE_ZOOM_STEP,
  );
}

export function knowledgeRegionFigureZoomOut(zoom: unknown): number {
  return clampKnowledgeRegionFigureZoom(
    clampKnowledgeRegionFigureZoom(zoom) / KNOWLEDGE_REGION_FIGURE_ZOOM_STEP,
  );
}

export function clampKnowledgeRegionFigurePan(
  pan: unknown,
  size: number,
  zoom: unknown,
): number {
  const value = typeof pan === "number" ? pan : Number(pan);
  const map = Number.isFinite(size) && size > 0 ? size : KNOWLEDGE_REGION_MAP_SIZE;
  const visible = map / clampKnowledgeRegionFigureZoom(zoom);
  const max = (map - visible) / 2;
  if (!Number.isFinite(value)) return 0;
  if (max <= 0) return 0;
  return Math.max(-max, Math.min(max, value));
}

export function knowledgeRegionFigureViewBox(input: {
  size?: number;
  zoom?: unknown;
  panX?: unknown;
  panY?: unknown;
}): { x: number; y: number; width: number; height: number; value: string } {
  const size =
    Number.isFinite(input.size) && (input.size as number) > 0
      ? (input.size as number)
      : KNOWLEDGE_REGION_MAP_SIZE;
  const zoom = clampKnowledgeRegionFigureZoom(input.zoom);
  const width = size / zoom;
  const height = size / zoom;
  const x = (size - width) / 2 + clampKnowledgeRegionFigurePan(input.panX, size, zoom);
  const y = (size - height) / 2 + clampKnowledgeRegionFigurePan(input.panY, size, zoom);
  return { x, y, width, height, value: `${x} ${y} ${width} ${height}` };
}

export function knowledgeRegionFigureFocusOnPoints(
  points: readonly { x: number; y: number }[],
  size = KNOWLEDGE_REGION_MAP_SIZE,
): { zoom: number; panX: number; panY: number } {
  const map = Number.isFinite(size) && size > 0 ? size : KNOWLEDGE_REGION_MAP_SIZE;
  const valid = points.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );
  if (!valid.length) {
    return { zoom: KNOWLEDGE_REGION_FIGURE_ZOOM_FIT, panX: 0, panY: 0 };
  }
  let minX = valid[0]!.x;
  let minY = valid[0]!.y;
  let maxX = valid[0]!.x;
  let maxY = valid[0]!.y;
  for (const point of valid) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const span = Math.max(
    maxX - minX,
    maxY - minY,
    KNOWLEDGE_REGION_FIGURE_FOCUS_MIN_SPAN,
  );
  const box = span * KNOWLEDGE_REGION_FIGURE_FOCUS_PAD;
  const zoom = clampKnowledgeRegionFigureZoom(map / box);
  const panX = clampKnowledgeRegionFigurePan((minX + maxX) / 2 - map / 2, map, zoom);
  const panY = clampKnowledgeRegionFigurePan((minY + maxY) / 2 - map / 2, map, zoom);
  return { zoom, panX, panY };
}

export function knowledgeRegionFigureLabelScale(zoom: unknown): number {
  return 1 / clampKnowledgeRegionFigureZoom(zoom);
}

export function knowledgeRegionFigureLabelTransform(
  x: number,
  y: number,
  zoom: unknown,
): string {
  return `translate(${x} ${y}) scale(${knowledgeRegionFigureLabelScale(zoom)})`;
}

export function knowledgeRegionFigureOverviewLabels(zoom: unknown): boolean {
  return clampKnowledgeRegionFigureZoom(zoom) <= KNOWLEDGE_REGION_FIGURE_ZOOM_FIT;
}

export function knowledgeRegionFigureShowSegmentLabel(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  zoom: unknown,
): boolean {
  const screen = Math.hypot(x2 - x1, y2 - y1) * clampKnowledgeRegionFigureZoom(zoom);
  return screen >= KNOWLEDGE_REGION_FIGURE_LABEL_MIN_SEGMENT;
}

export function knowledgeRegionFigureLabelOffset(
  zoom: unknown,
  mapRadius = KNOWLEDGE_REGION_FIGURE_LABEL_GLYPH_RADIUS,
  pad = KNOWLEDGE_REGION_FIGURE_LABEL_PAD,
): number {
  return mapRadius * clampKnowledgeRegionFigureZoom(zoom) + pad;
}

export function knowledgeRegionFigureStepLabelOffset(
  step: { x: number; y: number; index: number },
  steps: readonly { x: number; y: number }[],
  zoom: unknown,
): { x: number; y: number } {
  const reach = knowledgeRegionFigureLabelOffset(zoom);
  const i = Math.max(0, step.index - 1);
  const prev = steps[i - 1];
  const next = steps[i + 1];
  let dx = 0;
  let dy = -1;
  if (prev && next) {
    dx = next.x - prev.x;
    dy = next.y - prev.y;
  } else if (next) {
    dx = next.x - step.x;
    dy = next.y - step.y;
  } else if (prev) {
    dx = step.x - prev.x;
    dy = step.y - prev.y;
  }
  const len = Math.hypot(dx, dy) || 1;
  const side = step.index % 2 === 0 ? -1 : 1;
  return { x: (-dy / len) * reach * side, y: (dx / len) * reach * side };
}

export function knowledgeRegionIdentityKey(point: {
  id?: string | null;
  identity?: string | null;
}): string {
  const identity = String(point.identity || "").trim();
  if (identity) return identity;
  return String(point.id || "").trim();
}

export type KnowledgeRegionFigurePoint = {
  id: string;
  x: number;
  y: number;
  origin: StudioEmbeddingOrigin;
  pointKind?: KnowledgeRegionPointKind;
  clusterId: string | null;
  identity: string | null;
  vector?: number[] | null;
  createdAt?: string | null;
  unsysDistance?: number | null;
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

export type KnowledgeRegionPathStep = {
  id: string;
  index: number;
  x: number;
  y: number;
  identity: string | null;
  createdAt: string | null;
  clusterId: string | null;
  clusterLabel: string | null;
  vector?: number[] | null;
};

export type KnowledgeRegionPathSegment = {
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  midX: number;
  midY: number;
  distance: number;
  label: string;
};

export type KnowledgeRegionIdentityPath = {
  key: string;
  label: string;
  steps: KnowledgeRegionPathStep[];
  segments: KnowledgeRegionPathSegment[];
};

export type KnowledgeRegionIdentityOption = {
  id: string;
  label: string;
};

export type KnowledgeRegionFigureLegendItem = {
  id: string;
  kind: "cluster" | "simulated" | "cohort" | "analysis" | "ai_use";
  label: string;
  color: string;
  toggle: "cluster" | "simulated" | "cohort" | "analysis" | "ai_use" | null;
  on: boolean;
};

export type KnowledgeRegionPolarGrid = {
  cx: number;
  cy: number;
  radius: number;
  rings: number[];
  spokes: Array<{ x1: number; y1: number; x2: number; y2: number }>;
};

export type KnowledgeRegionQuadrantSection = {
  clusterId: string;
  label: string;
  color: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  path: string;
};

export type KnowledgeRegionFigureView = {
  map: { size: number; cx: number; cy: number; radius: number };
  grid: KnowledgeRegionPolarGrid;
  sections: KnowledgeRegionQuadrantSection[];
  contours: KnowledgeRegionContour[];
  glyphs: KnowledgeRegionGlyph[];
  centroids: Array<{ id: string; x: number; y: number; color: string; label: string }>;
  badges: KnowledgeRegionBadge[];
  rays: KnowledgeRegionRay[];
  path: KnowledgeRegionIdentityPath | null;
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
  if (pointKind === "ai_use") return "AI use";
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
  linkLabel?: string | null;
  subjects?: readonly {
    user_id?: unknown;
    guest_user_id?: unknown;
    label?: unknown;
  }[] | null;
}): KnowledgeRegionPointKind {
  const linkLabel = normalizeFlowLinkLabel(input.linkLabel);
  if (
    input.origin === "simulated" &&
    (isAiUseIdentity(input.identity) || flowLinkIsAiUse(linkLabel))
  ) {
    return "ai_use";
  }
  if (isAiUseIdentity(input.identity) || flowLinkIsAiUse(linkLabel)) return "ai_use";
  if (input.origin === "simulated") return "simulated";
  if (flowLinkDefinesReference(linkLabel)) return "cohort";
  if (linkLabel && linkLabel.toLowerCase() === "test") return "analysis";
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

function createdAtMs(value: string | null | undefined): number {
  const ms = Date.parse(String(value || "").trim());
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

export function knowledgeRegionIdentityLabel(
  identity: string | null | undefined,
  labels?: Record<string, string> | null,
): string {
  const key = String(identity || "").trim();
  if (!key) return "";
  return String(labels?.[key] || "").trim() || key;
}

export function knowledgeRegionIdentityOptions(
  points: readonly Pick<KnowledgeRegionFigurePoint, "id" | "identity">[],
  labels?: Record<string, string> | null,
): KnowledgeRegionIdentityOption[] {
  const seen = new Map<string, string>();
  for (const point of points) {
    const key = knowledgeRegionIdentityKey(point);
    if (!key || seen.has(key)) continue;
    seen.set(key, knowledgeRegionIdentityLabel(String(point.identity || "").trim() || key, labels));
  }
  return [...seen.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function knowledgeRegionSampleIdForIdentity(input: {
  points: readonly Pick<KnowledgeRegionFigurePoint, "id" | "identity" | "createdAt">[];
  identityKey: string | null | undefined;
  currentId?: string | null;
}): string | null {
  const key = String(input.identityKey || "").trim();
  if (!key) return null;
  const members = input.points
    .filter((point) => knowledgeRegionIdentityKey(point) === key)
    .sort((a, b) => {
      const byTime = createdAtMs(a.createdAt) - createdAtMs(b.createdAt);
      return byTime !== 0 ? byTime : String(a.id).localeCompare(String(b.id));
    });
  if (!members.length) return null;
  const current = String(input.currentId || "").trim();
  if (current && members.some((point) => point.id === current)) return current;
  return members[members.length - 1]?.id ?? null;
}

export function presentKnowledgeRegionIdentityPath(input: {
  points: readonly KnowledgeRegionFigurePoint[];
  identityKey: string | null | undefined;
  clusters?: readonly { id: string; strategyName: string }[];
}): KnowledgeRegionIdentityPath | null {
  const key = String(input.identityKey || "").trim();
  if (!key) return null;
  const clusterLabelById = new Map(
    (input.clusters ?? []).map((cluster) => [cluster.id, cluster.strategyName] as const),
  );
  const members = input.points
    .filter((point) => knowledgeRegionIdentityKey(point) === key)
    .sort((a, b) => {
      const byTime = createdAtMs(a.createdAt) - createdAtMs(b.createdAt);
      return byTime !== 0 ? byTime : String(a.id).localeCompare(String(b.id));
    });
  if (!members.length) return null;
  const steps: KnowledgeRegionPathStep[] = members.map((point, index) => ({
    id: point.id,
    index: index + 1,
    x: point.x,
    y: point.y,
    identity: point.identity,
    createdAt: point.createdAt ?? null,
    clusterId: point.clusterId,
    clusterLabel: point.clusterId ? clusterLabelById.get(point.clusterId) ?? null : null,
    vector: point.vector ?? null,
  }));
  const segments: KnowledgeRegionPathSegment[] = [];
  for (let i = 1; i < steps.length; i += 1) {
    const from = steps[i - 1]!;
    const to = steps[i]!;
    const distance = pointDistance(from, to);
    segments.push({
      fromId: from.id,
      toId: to.id,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      midX: (from.x + to.x) / 2,
      midY: (from.y + to.y) / 2,
      distance,
      label: formatStudioHighDimDistance(distance),
    });
  }
  return {
    key,
    label: String(members[0]?.identity || "").trim() || key,
    steps,
    segments,
  };
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

export function knowledgeRegionUnsysDistance(raw: unknown): number | null {
  const recovered = recoverFlowEmbeddingRaw(raw);
  const nested =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as { projectedPolicy?: { distance?: unknown }; raw?: { projectedPolicy?: { distance?: unknown } } })
      : null;
  const distance = Number(
    recovered?.projectedPolicy?.distance ??
      nested?.projectedPolicy?.distance ??
      nested?.raw?.projectedPolicy?.distance,
  );
  return Number.isFinite(distance) ? distance : null;
}

function unitHash(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function pieSlicePath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  if (sweep >= Math.PI * 2 - 1e-6) {
    return `M ${cx - radius} ${cy} a ${radius} ${radius} 0 1 1 ${radius * 2} 0 a ${radius} ${radius} 0 1 1 ${-radius * 2} 0 Z`;
  }
  const x0 = cx + Math.cos(startAngle) * radius;
  const y0 = cy + Math.sin(startAngle) * radius;
  const x1 = cx + Math.cos(endAngle) * radius;
  const y1 = cy + Math.sin(endAngle) * radius;
  const large = sweep > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1} Z`;
}

function nearestClusterByVector(
  vector: number[] | null | undefined,
  clusters: readonly { id: string; vector?: number[] | null }[],
): string | null {
  const v = Array.isArray(vector) ? vector : [];
  let best: { id: string; distance: number } | null = null;
  for (const cluster of clusters) {
    const centroid = cluster.vector;
    if (!Array.isArray(centroid) || !centroid.length || centroid.length !== v.length) continue;
    const distance = l2Distance(v, centroid);
    if (!Number.isFinite(distance)) continue;
    if (!best || distance < best.distance) best = { id: cluster.id, distance };
  }
  return best?.id ?? null;
}

export function placeKnowledgeRegionQuadrantPoints(input: {
  points: readonly KnowledgeRegionFigurePoint[];
  clusters: readonly {
    id: string;
    strategyName: string;
    vector?: number[] | null;
    color?: string;
    colorIndex?: number;
  }[];
  map: { cx: number; cy: number; radius: number };
}): {
  placed: Map<
    string,
    { x: number; y: number; clusterId: string | null; unsysDistance: number | null; angle: number; radius: number }
  >;
  sections: KnowledgeRegionQuadrantSection[];
  spokes: KnowledgeRegionPolarGrid["spokes"];
} {
  const { cx, cy, radius } = input.map;
  const n = input.clusters.length;
  const start = -Math.PI / 2;
  const sweep = n > 0 ? (Math.PI * 2) / n : Math.PI * 2;
  const sections: KnowledgeRegionQuadrantSection[] = input.clusters.map((cluster, index) => {
    const startAngle = start + index * sweep;
    const endAngle = start + (index + 1) * sweep;
    const midAngle = startAngle + sweep / 2;
    return {
      clusterId: cluster.id,
      label: cluster.strategyName,
      color: cluster.color ?? knowledgeRegionClusterColor(cluster.colorIndex ?? index),
      startAngle,
      endAngle,
      midAngle,
      path: pieSlicePath(cx, cy, radius, startAngle, endAngle),
    };
  });
  const spokes: KnowledgeRegionPolarGrid["spokes"] = sections.map((section) => ({
    x1: cx,
    y1: cy,
    x2: cx + Math.cos(section.startAngle) * radius,
    y2: cy + Math.sin(section.startAngle) * radius,
  }));
  const scored = input.points
    .map((point) => point.unsysDistance)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);
  const maxDistance = scored.length ? Math.max(...scored) : 0;
  const inner = radius * 0.12;
  const outer = radius * 0.86;
  const placed = new Map<
    string,
    { x: number; y: number; clusterId: string | null; unsysDistance: number | null; angle: number; radius: number }
  >();
  for (const point of input.points) {
    const clusterId =
      nearestClusterByVector(point.vector, input.clusters) ||
      (point.clusterId && input.clusters.some((cluster) => cluster.id === point.clusterId)
        ? point.clusterId
        : null);
    const section = clusterId
      ? sections.find((row) => row.clusterId === clusterId) ?? null
      : null;
    const unsysDistance =
      typeof point.unsysDistance === "number" && Number.isFinite(point.unsysDistance)
        ? Math.max(0, point.unsysDistance)
        : null;
    const t =
      unsysDistance == null ? 0.5 : maxDistance > 1e-9 ? Math.min(1, unsysDistance / maxDistance) : 0;
    const r = inner + t * (outer - inner);
    const jitter = (unitHash(point.id) - 0.5) * sweep * 0.55;
    const angle = section ? section.midAngle + jitter : start;
    placed.set(point.id, {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      clusterId,
      unsysDistance,
      angle,
      radius: r,
    });
  }
  return { placed, sections, spokes };
}

export function nearestAiUseClusterDistance(input: {
  vector: number[] | null | undefined;
  clusters: readonly { id: string; strategyName: string; vector?: number[] | null }[];
}): { clusterId: string; label: string; distance: number; formatted: string } | null {
  const vector = Array.isArray(input.vector) ? input.vector : [];
  let best: { clusterId: string; label: string; distance: number } | null = null;
  for (const cluster of input.clusters) {
    const centroid = cluster.vector;
    if (!Array.isArray(centroid) || centroid.length !== vector.length || !vector.length) continue;
    const distance = l2Distance(vector, centroid);
    if (!Number.isFinite(distance)) continue;
    if (!best || distance < best.distance) {
      best = { clusterId: cluster.id, label: cluster.strategyName, distance };
    }
  }
  if (!best) return null;
  return { ...best, formatted: formatStudioHighDimDistance(best.distance) };
}

export function placeKnowledgeRegionAiUsePoints(input: {
  points: readonly KnowledgeRegionFigurePoint[];
  clusters: readonly { id: string; strategyName: string; vector?: number[] | null }[];
  threshold: number;
  map: { cx: number; cy: number; radius: number };
}): {
  placed: Map<
    string,
    { x: number; y: number; clusterId: string | null; unsysDistance: number | null; angle: number; radius: number }
  >;
  sections: KnowledgeRegionQuadrantSection[];
  spokes: KnowledgeRegionPolarGrid["spokes"];
} {
  const { cx, cy, radius } = input.map;
  const closeStart = Math.PI / 2;
  const farStart = -Math.PI / 2;
  const sections: KnowledgeRegionQuadrantSection[] = [
    {
      clusterId: "ai-use-close",
      label: "Close",
      color: "#c48b6a",
      startAngle: closeStart,
      endAngle: closeStart + Math.PI,
      midAngle: closeStart + Math.PI / 2,
      path: pieSlicePath(cx, cy, radius, closeStart, closeStart + Math.PI),
    },
    {
      clusterId: "ai-use-far",
      label: "Far",
      color: "#6ea8de",
      startAngle: farStart,
      endAngle: farStart + Math.PI,
      midAngle: farStart + Math.PI / 2,
      path: pieSlicePath(cx, cy, radius, farStart, farStart + Math.PI),
    },
  ];
  const spokes: KnowledgeRegionPolarGrid["spokes"] = sections.map((section) => ({
    x1: cx,
    y1: cy,
    x2: cx + Math.cos(section.startAngle) * radius,
    y2: cy + Math.sin(section.startAngle) * radius,
  }));
  const scored = input.points
    .map((point) => point.unsysDistance)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);
  const maxDistance = scored.length ? Math.max(...scored) : 0;
  const inner = radius * 0.12;
  const outer = radius * 0.86;
  const placed = new Map<
    string,
    { x: number; y: number; clusterId: string | null; unsysDistance: number | null; angle: number; radius: number }
  >();
  for (const point of input.points) {
    if (point.pointKind === "ai_use") continue;
    const nearest = nearestAiUseClusterDistance({ vector: point.vector, clusters: input.clusters });
    const close = nearest ? nearest.distance <= input.threshold : false;
    const section = close ? sections[0]! : sections[1]!;
    const unsysDistance =
      typeof point.unsysDistance === "number" && Number.isFinite(point.unsysDistance)
        ? Math.max(0, point.unsysDistance)
        : null;
    const t =
      unsysDistance == null ? 0.5 : maxDistance > 1e-9 ? Math.min(1, unsysDistance / maxDistance) : 0;
    const r = inner + t * (outer - inner);
    const jitter = (unitHash(point.id) - 0.5) * Math.PI * 0.45;
    const angle = section.midAngle + jitter;
    placed.set(point.id, {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      clusterId: section.clusterId,
      unsysDistance,
      angle,
      radius: r,
    });
  }
  return { placed, sections, spokes };
}

export function defaultAiUseThreshold(distances: readonly number[]): number {
  const values = distances.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!values.length) return 0.35;
  const mid = values[Math.floor(values.length / 2)]!;
  return mid;
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
  mode?: KnowledgeRegionFigureMode | string | null;
  aiUseClusters?: readonly { id: string; strategyName: string; vector?: number[] | null }[];
  aiUseThreshold?: number | null;
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
  const mode = parseKnowledgeRegionFigureMode(input.mode);
  const space = knowledgeRegionFigureSpace(mode);
  const track = knowledgeRegionFigureTrack(mode);
  const map = {
    size: KNOWLEDGE_REGION_MAP_SIZE,
    cx: KNOWLEDGE_REGION_MAP_CENTER.x,
    cy: KNOWLEDGE_REGION_MAP_CENTER.y,
    radius: KNOWLEDGE_REGION_MAP_RADIUS,
  };
  const visible = input.points.filter((point) => {
    const kind = resolveKnowledgeRegionPointKind(point);
    if (!visiblePointKinds.has(kind)) return false;
    if (point.clusterId && !clusterVisibleInKnowledgeRegion(point.clusterId, visibleClusterIds)) {
      return kind !== "simulated";
    }
    return true;
  });
  const wedgeClusters = input.clusters
    .map((cluster, index) => ({
      ...cluster,
      color: knowledgeRegionClusterColor(index),
      colorIndex: index,
    }))
    .filter((cluster) => clusterVisibleInKnowledgeRegion(cluster.id, visibleClusterIds));
  const aiUseClusters = input.aiUseClusters ?? [];
  const classifiedForThreshold = visible.filter((point) => point.pointKind !== "ai_use");
  const thresholdDistances = classifiedForThreshold
    .map((point) => nearestAiUseClusterDistance({ vector: point.vector, clusters: aiUseClusters })?.distance)
    .filter((value): value is number => typeof value === "number");
  const aiUseThreshold =
    typeof input.aiUseThreshold === "number" && Number.isFinite(input.aiUseThreshold)
      ? input.aiUseThreshold
      : defaultAiUseThreshold(thresholdDistances);
  const quadrant =
    space === "quadrant"
      ? placeKnowledgeRegionQuadrantPoints({
          points: visible,
          clusters: wedgeClusters,
          map,
        })
      : space === "ai_use"
        ? placeKnowledgeRegionAiUsePoints({
            points: visible,
            clusters: aiUseClusters,
            threshold: aiUseThreshold,
            map,
          })
        : null;
  const grid = quadrant
    ? {
        ...knowledgeRegionPolarGrid({
          cx: map.cx,
          cy: map.cy,
          radius: map.radius,
          spokes: Math.max(4, space === "ai_use" ? 2 : wedgeClusters.length),
        }),
        spokes: quadrant.spokes,
      }
    : knowledgeRegionPolarGrid(map);
  const placed = quadrant
    ? new Map([...quadrant.placed].map(([id, row]) => [id, { x: row.x, y: row.y }] as const))
    : mapPointsToDisk(visible, map);
  const located = visible
    .map((point) => {
      const xy = placed.get(point.id);
      if (!xy) return null;
      const assigned = quadrant?.placed.get(point.id)?.clusterId;
      return {
        ...point,
        x: xy.x,
        y: xy.y,
        clusterId: assigned ?? point.clusterId,
      };
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
  const sections = quadrant?.sections ?? [];
  if (quadrant) {
    for (const section of sections) {
      const label = section.label;
      const width = badgeWidth(label);
      const rimX = map.cx + Math.cos(section.midAngle) * (map.radius + 18);
      const rimY = map.cy + Math.sin(section.midAngle) * (map.radius + 18);
      badges.push({
        id: section.clusterId,
        kind: "cluster",
        label,
        x: rimX - width / 2,
        y: rimY - 9,
        width,
        color: section.color,
      });
    }
  } else {
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

  const path =
    track === "path" && focusPoint
      ? presentKnowledgeRegionIdentityPath({
          points: located,
          identityKey: knowledgeRegionIdentityKey(focusPoint),
          clusters: input.clusters,
        })
      : null;

  const rays: KnowledgeRegionRay[] = [];
  if (track === "individual" && space === "full" && focus && focusPoint) {
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
    {
      id: "ai_use",
      kind: "ai_use",
      label: "AI use",
      color: "#c48b6a",
      toggle: "ai_use",
      on: visiblePointKinds.has("ai_use"),
    },
  ];

  return {
    map,
    grid,
    sections,
    contours,
    glyphs,
    centroids,
    badges,
    rays,
    path,
    focus,
    legend,
  };
}
