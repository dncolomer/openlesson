/**
 * Region builder selection — filter subjects / PoW provenance for Knowledge Regions.
 *
 * Supports human PoW vs tapbench PoW and filter by link / TAPBench link id.
 */

import {
  classifyPowSource,
  sourceLinkIdFromMetadata,
  type PowSourceKind,
  HUMAN_POW_SOURCE,
  TAPBENCH_POW_SOURCE,
} from "./tapbench";

export type RegionBuilderSourceFilter = "all" | PowSourceKind;

export interface RegionBuilderSubject {
  user_id: string | null;
  guest_user_id: string | null;
  /** human | tapbench — derived from associated PoW metadata when available. */
  pow_source: PowSourceKind;
  /** Guest link / TAPBench link id that produced the subject's PoW (if any). */
  source_link_id: string | null;
  /** Optional share URL for the link (listable; not private one-shot). */
  source_link_url: string | null;
  embedding_model_id?: string;
  as_of_ms?: number;
  confidence?: number;
  label?: string | null;
}

export interface RegionBuilderFilters {
  /** all | human | tapbench */
  source: RegionBuilderSourceFilter;
  /**
   * Filter by link / TAPBench link id or full share URL.
   * Empty string = no link filter.
   */
  linkQuery?: string | null;
}

export function normalizeRegionBuilderSourceFilter(raw: unknown): RegionBuilderSourceFilter {
  if (raw === TAPBENCH_POW_SOURCE || raw === "tapbench_pow" || raw === "tapbench-pow") {
    return TAPBENCH_POW_SOURCE;
  }
  if (raw === HUMAN_POW_SOURCE || raw === "human_pow" || raw === "human-pow") {
    return HUMAN_POW_SOURCE;
  }
  return "all";
}

/**
 * Build a region-builder subject from a base subject row + optional PoW metadata samples.
 * When multiple PoW rows exist, tapbench wins if any sample is tapbench (provenance union).
 */
export function enrichSubjectWithPowProvenance(
  subject: {
    user_id?: string | null;
    guest_user_id?: string | null;
    embedding_model_id?: string;
    as_of_ms?: number;
    confidence?: number;
    label?: string | null;
  },
  powMetadataSamples: Array<Record<string, unknown> | null | undefined> = [],
  linkUrlById: Map<string, string> | Record<string, string> = {},
): RegionBuilderSubject {
  let pow_source: PowSourceKind = HUMAN_POW_SOURCE;
  let source_link_id: string | null = null;

  for (const meta of powMetadataSamples) {
    if (classifyPowSource(meta) === TAPBENCH_POW_SOURCE) {
      pow_source = TAPBENCH_POW_SOURCE;
    }
    if (!source_link_id) {
      source_link_id = sourceLinkIdFromMetadata(meta);
    }
  }

  const source_link_url = source_link_id
    ? linkUrlFromMap(linkUrlById, source_link_id)
    : null;

  return {
    user_id: subject.user_id ?? null,
    guest_user_id: subject.guest_user_id ?? null,
    pow_source,
    source_link_id,
    source_link_url,
    embedding_model_id: subject.embedding_model_id,
    as_of_ms: subject.as_of_ms,
    confidence: subject.confidence,
    label: subject.label ?? null,
  };
}

function linkUrlFromMap(
  map: Map<string, string> | Record<string, string>,
  id: string,
): string | null {
  if (map instanceof Map) {
    return map.get(id) ?? null;
  }
  return map[id] ?? null;
}

/**
 * Whether a subject matches region-builder filters (source kind + link id/URL).
 */
export function regionBuilderSubjectMatches(
  subject: RegionBuilderSubject,
  filters: RegionBuilderFilters,
): boolean {
  const source = filters.source ?? "all";
  if (source !== "all" && subject.pow_source !== source) {
    return false;
  }

  const q = (filters.linkQuery ?? "").trim().toLowerCase();
  if (!q) return true;

  const hay = [
    subject.source_link_id ?? "",
    subject.source_link_url ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/**
 * Filter subjects for the region builder. Pure — no I/O.
 */
export function filterRegionBuilderSubjects(
  subjects: readonly RegionBuilderSubject[],
  filters: RegionBuilderFilters,
): RegionBuilderSubject[] {
  return subjects.filter((s) => regionBuilderSubjectMatches(s, filters));
}

/**
 * Subjects that would be included when creating a region from a filtered selection.
 * Used by tests to assert tapbench-only selections exclude human subjects.
 */
export function selectSubjectsForRegion(
  subjects: readonly RegionBuilderSubject[],
  filters: RegionBuilderFilters,
  selectedKeys?: ReadonlySet<string> | null,
): RegionBuilderSubject[] {
  const filtered = filterRegionBuilderSubjects(subjects, filters);
  if (!selectedKeys || selectedKeys.size === 0) return filtered;
  return filtered.filter((s) => selectedKeys.has(regionBuilderSubjectKey(s)));
}

export function regionBuilderSubjectKey(s: {
  user_id?: string | null;
  guest_user_id?: string | null;
}): string {
  return `${s.user_id ?? ""}|${s.guest_user_id ?? ""}`;
}

/**
 * Assert a tapbench-only region selection only contains tapbench subjects.
 */
export function assertTapbenchOnlySelection(
  subjects: readonly RegionBuilderSubject[],
): boolean {
  return subjects.length > 0 && subjects.every((s) => s.pow_source === TAPBENCH_POW_SOURCE);
}
