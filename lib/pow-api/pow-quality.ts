/**
 * PoW quality flags stored in metadata / payload (no dedicated DB columns).
 * Snapshots exclude impure + practice + manually invalidated rows;
 * the PoW stats UI surfaces counts and filters.
 */

import { isPracticePoWMetadata, TAP_PRACTICE_POW_LABEL } from "@/lib/tap-practice";

export type PowQualityKind = "scored" | "practice" | "impure" | "invalidated";

export type PowQualityFilter = "all" | PowQualityKind;

/** Canonical metadata key for manual invalidation (no SQL column). */
export const POW_INVALIDATED_METADATA_KEY = "invalidated" as const;

export function asMetadataRecord(
  metadata: unknown,
): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return metadata as Record<string, unknown>;
}

export function isImpurePoWMetadata(metadata: unknown): boolean {
  const m = asMetadataRecord(metadata);
  if (!m) return false;
  return (
    m.impure === true ||
    m.quality === "impure" ||
    m.session_quality === "impure"
  );
}

export function isPracticePoW(metadata: unknown): boolean {
  return isPracticePoWMetadata(asMetadataRecord(metadata));
}

/**
 * Manual invalidation flag lives only in metadata (never a dedicated column).
 * Accepts boolean true or the string "true" for robustness.
 */
export function isInvalidatedPoWMetadata(metadata: unknown): boolean {
  const m = asMetadataRecord(metadata);
  if (!m) return false;
  const v = m[POW_INVALIDATED_METADATA_KEY] ?? m.invalidated_pow ?? m.pow_invalidated;
  return v === true || v === "true" || v === 1;
}

export type MarkPowInvalidatedOptions = {
  at?: string | null;
  by?: string | null;
  reason?: string | null;
};

/**
 * Pure: merge invalidate flag + optional audit fields into a metadata object.
 * Does not mutate the input.
 */
export function markPowMetadataInvalidated(
  metadata: unknown,
  options?: MarkPowInvalidatedOptions,
): Record<string, unknown> {
  const base = asMetadataRecord(metadata) ? { ...asMetadataRecord(metadata)! } : {};
  base[POW_INVALIDATED_METADATA_KEY] = true;
  const at =
    typeof options?.at === "string" && options.at.trim()
      ? options.at.trim()
      : new Date().toISOString();
  base.invalidated_at = at;
  if (typeof options?.by === "string" && options.by.trim()) {
    base.invalidated_by = options.by.trim();
  }
  if (typeof options?.reason === "string" && options.reason.trim()) {
    base.invalidated_reason = options.reason.trim();
  }
  return base;
}

/** Pure: clear invalidate flag (and common audit keys) from metadata. */
export function clearPowMetadataInvalidated(metadata: unknown): Record<string, unknown> {
  const base = asMetadataRecord(metadata) ? { ...asMetadataRecord(metadata)! } : {};
  delete base[POW_INVALIDATED_METADATA_KEY];
  delete base.invalidated_at;
  delete base.invalidated_by;
  delete base.invalidated_reason;
  delete base.invalidated_pow;
  delete base.pow_invalidated;
  return base;
}

/** Rows that must not enter LWM Snapshot / performance context. */
export function isExcludedFromSnapshotPoW(metadata: unknown): boolean {
  return (
    isImpurePoWMetadata(metadata) ||
    isPracticePoW(metadata) ||
    isInvalidatedPoWMetadata(metadata)
  );
}

export function isScoredPoW(metadata: unknown): boolean {
  return !isExcludedFromSnapshotPoW(metadata);
}

/**
 * Classify for UI filters. Impure wins over practice when both flags exist
 * (impure practice is still not scored). Invalidated is its own bucket.
 */
export function classifyPowQuality(metadata: unknown): PowQualityKind {
  if (isInvalidatedPoWMetadata(metadata)) return "invalidated";
  if (isImpurePoWMetadata(metadata)) return "impure";
  if (isPracticePoW(metadata)) return "practice";
  return "scored";
}

export function matchesPowQualityFilter(
  metadata: unknown,
  filter: PowQualityFilter,
): boolean {
  if (filter === "all") return true;
  return classifyPowQuality(metadata) === filter;
}

export function filterSnapshotEligibleProofOfWorkRows<T extends { metadata?: unknown }>(
  rows: T[] | null | undefined,
): T[] {
  if (!rows?.length) return [];
  return rows.filter((row) => !isExcludedFromSnapshotPoW(row.metadata));
}

export { TAP_PRACTICE_POW_LABEL };
