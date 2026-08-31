/**
 * Session-global ILE Proof-of-Work type totals (RTS-style resource counters).
 * Counts are never partitioned by chapter id.
 */
import {
  normalizeProofOfWorkType,
  type WorkspaceProofOfWorkType,
} from "@/lib/pow-api/workspace-proof-of-work";

export const ILE_POW_COUNTER_TYPES = ["tool", "screen", "video", "eeg"] as const;
export type IlePowCounterType = (typeof ILE_POW_COUNTER_TYPES)[number];

export type IlePowTypeCounts = Record<IlePowCounterType, number>;

/** Artifact shape accepted from live uploads, buffers, or fixture lists. */
export type IlePowCounterArtifact = {
  type?: string | null;
  proof_of_work_type?: string | null;
  kind?: string | null;
  chapter_id?: string | null;
  step_id?: string | null;
  block_id?: string | null;
  tool_name?: string | null;
  tool_action?: string | null;
  metadata?: Record<string, unknown> | null;
};

export const ILE_POW_COUNTER_LABELS: Record<IlePowCounterType, string> = {
  tool: "Traces",
  screen: "Screen",
  video: "Video",
  eeg: "EEG",
};

export function emptyIlePowTypeCounts(): IlePowTypeCounts {
  return { tool: 0, screen: 0, video: 0, eeg: 0 };
}

export function resolveIlePowCounterType(value: unknown): IlePowCounterType | null {
  const normalized = normalizeProofOfWorkType(value);
  if (normalized) return normalized;
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (raw === "traces" || raw === "trace" || raw === "tool_event" || raw === "tool-events") {
    return "tool";
  }
  return null;
}

function artifactType(item: IlePowCounterArtifact): IlePowCounterType | null {
  return (
    resolveIlePowCounterType(item.type) ||
    resolveIlePowCounterType(item.proof_of_work_type) ||
    resolveIlePowCounterType(item.kind)
  );
}

/**
 * Live totals for the ILE resource bar. Chapter ids on artifacts are ignored
 * so switching the focused chapter does not split the session economy.
 */
export function countIlePowByType(
  artifacts: readonly IlePowCounterArtifact[] | null | undefined,
): IlePowTypeCounts {
  const counts = emptyIlePowTypeCounts();
  if (!artifacts?.length) return counts;
  for (const item of artifacts) {
    const type = artifactType(item);
    if (!type) continue;
    counts[type] += 1;
  }
  return counts;
}

export function ilePowCounterTotal(counts: IlePowTypeCounts): number {
  return counts.tool + counts.screen + counts.video + counts.eeg;
}

export function appendIlePowCounterArtifact(
  artifacts: readonly IlePowCounterArtifact[],
  next: IlePowCounterArtifact,
): IlePowCounterArtifact[] {
  return [...artifacts, next];
}
