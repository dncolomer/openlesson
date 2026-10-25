/**
 * Known embedding models shown on the Map of Knowledge.
 * Vectors with different embedding_model_id must never be mixed.
 */

import {
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  FLOW_EMBEDDING_SEM_DIM,
  FLOW_EMBEDDING_STRUCT_DIM,
} from "@/lib/flow-embedding";

/** Catalog entry for embedding models shown on the Map of Knowledge. */
export interface EmbeddingModelInfo {
  id: string;
  label: string;
  dim: number;
  /** Structural feature dims when hybrid (e.g. flowcfg). */
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
    id: FLOW_EMBEDDING_MODEL_ID,
    label: "Flow config v1 (D=96)",
    dim: FLOW_EMBEDDING_DIM,
    struct_dim: FLOW_EMBEDDING_STRUCT_DIM,
    sem_dim: FLOW_EMBEDDING_SEM_DIM,
    description:
      "Completed Calibrate, Learn, and Verify embeddings: tree + priced edges + policy Distance + proof of work, L2-normalized in a fixed 96-D space.",
    notes: [
      "Axes are shared globally for this model id.",
      "Regions (custom verification models) live in the same frame when built from this model.",
    ],
  },
] as const;

export function describeEmbeddingModel(
  modelId: string | null | undefined,
  dimHint?: number | null,
): EmbeddingModelInfo {
  const id = (modelId || "").trim() || FLOW_EMBEDDING_MODEL_ID;
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
  if (available.some((m) => m.id === FLOW_EMBEDDING_MODEL_ID)) {
    return FLOW_EMBEDDING_MODEL_ID;
  }
  return available[0]?.id || FLOW_EMBEDDING_MODEL_ID;
}
