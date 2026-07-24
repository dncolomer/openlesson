/**
 * PoW quality flags stored in metadata / payload (no dedicated DB columns).
 * Snapshots exclude impure + practice; the PoW stats UI surfaces counts and filters.
 */

import { isPracticePoWMetadata, TAP_PRACTICE_POW_LABEL } from "@/lib/tap-practice";

export type PowQualityKind = "scored" | "practice" | "impure";

export type PowQualityFilter = "all" | PowQualityKind;

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

/** Rows that must not enter LWM Snapshot / performance context. */
export function isExcludedFromSnapshotPoW(metadata: unknown): boolean {
  return isImpurePoWMetadata(metadata) || isPracticePoW(metadata);
}

export function isScoredPoW(metadata: unknown): boolean {
  return !isExcludedFromSnapshotPoW(metadata);
}

/**
 * Classify for UI filters. Impure wins over practice when both flags exist
 * (impure practice is still not scored).
 */
export function classifyPowQuality(metadata: unknown): PowQualityKind {
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
