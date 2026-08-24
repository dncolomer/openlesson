/**
 * Cross-workspace Knowledge Region import for embeddings overlays.
 * Only regions from other workspaces the caller owns are importable.
 */

import type { RegionCentroidInput } from "@/lib/knowledge-config/project-2d";

export type KnowledgeRegionOverlaySource = {
  id: string;
  name: string;
  centroid: number[];
  mean_radius?: number;
  cosine_threshold?: number;
  description?: string | null;
  workspace_id?: string;
  workspace_title?: string;
  imported?: boolean;
};

export type OwnedWorkspaceRef = {
  id: string;
  user_id: string;
  title?: string | null;
  root_topic?: string | null;
};

export type ImportableRegionRow = {
  id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  centroid?: number[] | null;
  mean_radius?: number;
  cosine_threshold?: number;
  subject_count?: number;
  embedding_model_id?: string;
  created_at?: string;
};

export type ImportableKnowledgeRegion = ImportableRegionRow & {
  workspace_title: string;
  imported: true;
};

/**
 * Keep regions whose workspace is owned by the caller and is not the current
 * workspace. Regions from workspaces the caller does not own are dropped.
 */
export function filterImportableKnowledgeRegions(input: {
  callerUserId: string;
  currentWorkspaceId: string;
  ownedWorkspaces: readonly OwnedWorkspaceRef[];
  regions: readonly ImportableRegionRow[];
}): ImportableKnowledgeRegion[] {
  const caller = String(input.callerUserId || "").trim();
  const current = String(input.currentWorkspaceId || "").trim();
  if (!caller) return [];

  const ownedIds = new Set<string>();
  const titleById = new Map<string, string>();
  for (const w of input.ownedWorkspaces) {
    const id = String(w.id || "").trim();
    if (!id) continue;
    if (String(w.user_id || "") !== caller) continue;
    if (id === current) continue;
    ownedIds.add(id);
    titleById.set(id, String(w.title || w.root_topic || "Workspace").trim() || "Workspace");
  }

  const out: ImportableKnowledgeRegion[] = [];
  for (const r of input.regions) {
    const wsId = String(r.workspace_id || "").trim();
    if (!wsId || wsId === current) continue;
    if (!ownedIds.has(wsId)) continue;
    out.push({
      ...r,
      workspace_id: wsId,
      workspace_title: titleById.get(wsId) || "Workspace",
      imported: true,
    });
  }
  return out;
}

function selectedIdSet(
  selectedIds: ReadonlySet<string> | readonly string[],
): ReadonlySet<string> {
  return selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
}

/**
 * Merge local + imported selected regions into projector inputs.
 * Callers feed this to `projectTrajectoryAndRegions` — do not reproject here.
 */
export function assembleSelectedRegionOverlayInputs(input: {
  localRegions: readonly KnowledgeRegionOverlaySource[];
  importedRegions?: readonly KnowledgeRegionOverlaySource[];
  selectedIds: ReadonlySet<string> | readonly string[];
}): RegionCentroidInput[] {
  const selected = selectedIdSet(input.selectedIds);
  const merged = [
    ...input.localRegions,
    ...(input.importedRegions ?? []),
  ];
  const seen = new Set<string>();
  const out: RegionCentroidInput[] = [];
  for (const r of merged) {
    if (!selected.has(r.id) || seen.has(r.id)) continue;
    if (!Array.isArray(r.centroid) || r.centroid.length === 0) continue;
    seen.add(r.id);
    out.push({
      id: r.id,
      name: r.name,
      centroid: r.centroid,
      mean_radius: r.mean_radius,
      cosine_threshold: r.cosine_threshold,
      source: r.imported
        ? `imported:${r.workspace_id || "foreign"}`
        : r.description?.includes("[synthetic:grok-4.5]")
          ? "synthetic:grok-4.5"
          : "cohort",
    });
  }
  return out;
}
