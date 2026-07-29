/**
 * Global Map of Knowledge — pure geometry for region-dot graph + dual orbits.
 *
 * Membership uses high-D knowledgecfg vectors when available (same L2 / radius
 * geometry as custom verification mean_radius). Projected x/y are only used for
 * layout of region dots on the Global Map canvas.
 *
 * Inside: L2(user, region) ≤ mean_radius (region.radius).
 * Near (not inside): mean_radius < L2 ≤ mean_radius * NEAR_RADIUS_FACTOR.
 * Users are only scored against regions in the same workspace_id.
 */

import { l2Distance } from "@/lib/knowledge-config/math";
import type { MapRegion, MapUserLocation } from "./index";

/** Outer orbit: close to region but outside hard membership radius. */
export const GLOBAL_MAP_NEAR_RADIUS_FACTOR = 1.75;

export type GlobalMapUserClass = "inside" | "near" | "outside";

export type GlobalMapRegionNode = {
  id: string;
  name: string;
  workspace_id: string;
  workspace_title: string;
  /** Layout position (from projected embedding coords). */
  x: number;
  y: number;
  /** High-D radius used for membership (mean_radius). */
  radius: number;
  inside_count: number;
  near_count: number;
};

export type GlobalMapEdge = {
  source_id: string;
  target_id: string;
  /** Finite non-negative distance (high-D L2 between region centroids when possible). */
  distance: number;
};

export type GlobalMapModel = {
  nodes: GlobalMapRegionNode[];
  edges: GlobalMapEdge[];
};

export function regionMembershipRadius(region: Pick<MapRegion, "radius">): number {
  const r = typeof region.radius === "number" && Number.isFinite(region.radius) ? region.radius : 0.35;
  return Math.max(0.05, r);
}

/**
 * Classify a user vs one region using high-D vectors + mean_radius.
 * Falls back to projected 2D distance if vectors are missing/mismatched.
 */
export function classifyUserAgainstRegion(
  user: Pick<MapUserLocation, "vector" | "x" | "y" | "workspace_id">,
  region: Pick<MapRegion, "vector" | "x" | "y" | "radius" | "workspace_id">,
  nearFactor: number = GLOBAL_MAP_NEAR_RADIUS_FACTOR,
): GlobalMapUserClass {
  if (user.workspace_id && region.workspace_id && user.workspace_id !== region.workspace_id) {
    return "outside";
  }

  const r = regionMembershipRadius(region);
  const nearR = r * Math.max(1.01, nearFactor);

  const uv = Array.isArray(user.vector) ? user.vector : [];
  const rv = Array.isArray(region.vector) ? region.vector : [];
  let dist: number;
  if (uv.length > 0 && uv.length === rv.length) {
    dist = l2Distance(uv, rv);
  } else {
    // Projected plane fallback (same frame as Local Map 2D).
    const dx = (user.x || 0) - (region.x || 0);
    const dy = (user.y || 0) - (region.y || 0);
    dist = Math.sqrt(dx * dx + dy * dy);
  }

  if (!Number.isFinite(dist)) return "outside";
  if (dist <= r) return "inside";
  if (dist <= nearR) return "near";
  return "outside";
}

/**
 * Per-region orbit counts. A user counted as inside is never also counted as near
 * for the same region. Cross-workspace users do not contribute.
 */
export function countUsersForRegion(
  region: MapRegion,
  users: readonly MapUserLocation[],
  nearFactor: number = GLOBAL_MAP_NEAR_RADIUS_FACTOR,
): { inside_count: number; near_count: number } {
  let inside = 0;
  let near = 0;
  for (const user of users) {
    const cls = classifyUserAgainstRegion(user, region, nearFactor);
    if (cls === "inside") inside += 1;
    else if (cls === "near") near += 1;
  }
  return {
    inside_count: Math.max(0, Math.floor(inside)),
    near_count: Math.max(0, Math.floor(near)),
  };
}

/** High-D L2 between region centroids; finite ≥ 0. */
export function regionCentroidDistance(a: MapRegion, b: MapRegion): number {
  const av = Array.isArray(a.vector) ? a.vector : [];
  const bv = Array.isArray(b.vector) ? b.vector : [];
  if (av.length > 0 && av.length === bv.length) {
    const d = l2Distance(av, bv);
    return Number.isFinite(d) ? Math.max(0, d) : 0;
  }
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  const d = Math.sqrt(dx * dx + dy * dy);
  return Number.isFinite(d) ? Math.max(0, d) : 0;
}

/**
 * Build a readable edge set: complete graph within each workspace, plus MST
 * across workspaces (closest region pair) so Global Map stays legible.
 */
export function buildGlobalMapEdges(regions: readonly MapRegion[]): GlobalMapEdge[] {
  if (regions.length < 2) return [];

  const byWs = new Map<string, MapRegion[]>();
  for (const r of regions) {
    const key = r.workspace_id || "unknown";
    const list = byWs.get(key);
    if (list) list.push(r);
    else byWs.set(key, [r]);
  }

  const edgeKey = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`);
  const edges = new Map<string, GlobalMapEdge>();

  const addEdge = (a: MapRegion, b: MapRegion) => {
    if (a.id === b.id) return;
    const key = edgeKey(a.id, b.id);
    if (edges.has(key)) return;
    edges.set(key, {
      source_id: a.id,
      target_id: b.id,
      distance: regionCentroidDistance(a, b),
    });
  };

  // Within-workspace: complete graph (small N per field)
  for (const group of byWs.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        addEdge(group[i], group[j]);
      }
    }
  }

  // Cross-workspace: MST on workspace supernodes using closest region pair distance
  const wsIds = Array.from(byWs.keys());
  if (wsIds.length >= 2) {
    type Link = { a: string; b: string; dist: number; ra: MapRegion; rb: MapRegion };
    const links: Link[] = [];
    for (let i = 0; i < wsIds.length; i++) {
      for (let j = i + 1; j < wsIds.length; j++) {
        const ga = byWs.get(wsIds[i])!;
        const gb = byWs.get(wsIds[j])!;
        let best: Link | null = null;
        for (const ra of ga) {
          for (const rb of gb) {
            const dist = regionCentroidDistance(ra, rb);
            if (!best || dist < best.dist) {
              best = { a: wsIds[i], b: wsIds[j], dist, ra, rb };
            }
          }
        }
        if (best) links.push(best);
      }
    }
    links.sort((x, y) => x.dist - y.dist);
    const parent = new Map(wsIds.map((id) => [id, id]));
    const find = (id: string): string => {
      const p = parent.get(id)!;
      if (p !== id) {
        const root = find(p);
        parent.set(id, root);
        return root;
      }
      return id;
    };
    for (const link of links) {
      const pa = find(link.a);
      const pb = find(link.b);
      if (pa === pb) continue;
      parent.set(pa, pb);
      addEdge(link.ra, link.rb);
    }
  }

  return Array.from(edges.values()).filter((e) => Number.isFinite(e.distance));
}

/**
 * Full Global Map model for enabled regions + public user locations.
 */
export function buildGlobalMapModel(
  regions: readonly MapRegion[],
  users: readonly MapUserLocation[],
  nearFactor: number = GLOBAL_MAP_NEAR_RADIUS_FACTOR,
): GlobalMapModel {
  const nodes: GlobalMapRegionNode[] = regions.map((region) => {
    const counts = countUsersForRegion(region, users, nearFactor);
    return {
      id: region.id,
      name: region.name,
      workspace_id: region.workspace_id,
      workspace_title: region.workspace_title,
      x: Number.isFinite(region.x) ? region.x : 0,
      y: Number.isFinite(region.y) ? region.y : 0,
      radius: regionMembershipRadius(region),
      inside_count: counts.inside_count,
      near_count: counts.near_count,
    };
  });

  return {
    nodes,
    edges: buildGlobalMapEdges(regions),
  };
}

/** Format distance for edge labels (compact). */
export function formatGlobalMapDistance(distance: number): string {
  if (!Number.isFinite(distance)) return "—";
  if (distance < 0.01) return "0.00";
  if (distance < 10) return distance.toFixed(2);
  return distance.toFixed(1);
}
