/**
 * Session-global ILE Proof-of-Work type totals (RTS-style resource counters).
 * Counts are never partitioned by chapter id.
 */
import {
  normalizeProofOfWorkType,
  type WorkspaceProofOfWorkType,
} from "@/lib/pow-api/workspace-proof-of-work";
import { isExcludedFromSnapshotPoW } from "@/lib/pow-api/pow-quality";

export const ILE_POW_COUNTER_TYPES = ["tool", "screen", "video", "eeg"] as const;
export type IlePowCounterType = (typeof ILE_POW_COUNTER_TYPES)[number];

export const ILE_POW_DISPLAY_COUNTER_TYPES = [
  "tool",
  "screen",
  "video",
  "eeg",
  "thoughts",
] as const;
export type IlePowDisplayCounterType = (typeof ILE_POW_DISPLAY_COUNTER_TYPES)[number];

export type IlePowTypeCounts = Record<IlePowCounterType, number>;
export type IlePowDisplayCounts = Record<IlePowDisplayCounterType, number>;

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

export const ILE_POW_COUNTER_LABELS: Record<IlePowDisplayCounterType, string> = {
  tool: "Tools",
  screen: "Screen",
  video: "Video",
  eeg: "EEG",
  thoughts: "Thoughts",
};

const SPOKEN_TOOL_NAMES = new Set(["ile-speech-segment", "tap-speech-segment"]);
const SPOKEN_META_TYPES = new Set([
  "uncertain_systems_ile_speech_segment",
  "uncertain_systems_tap_speech_segment",
]);

/** Spoken-trace artifacts are display-only "thoughts", not the tools counter. */
export function isIleSpokenThoughtArtifact(
  item: IlePowCounterArtifact | null | undefined,
): boolean {
  if (!item) return false;
  const tool = String(item.tool_name || "").trim().toLowerCase();
  if (SPOKEN_TOOL_NAMES.has(tool)) return true;
  const action = String(item.tool_action || "").trim().toLowerCase();
  if (action.startsWith("speech_")) return true;
  const metaType =
    item.metadata && typeof item.metadata.type === "string"
      ? item.metadata.type.trim().toLowerCase()
      : "";
  if (SPOKEN_META_TYPES.has(metaType)) return true;
  const kind = String(item.kind || item.type || item.proof_of_work_type || "")
    .trim()
    .toLowerCase();
  return kind === "speech" || kind === "spoken" || kind === "thoughts" || kind === "thought";
}

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
export function countIleSpokenThoughts(
  artifacts: readonly IlePowCounterArtifact[] | null | undefined,
): number {
  if (!artifacts?.length) return 0;
  let count = 0;
  for (const item of artifacts) {
    if (isIleSpokenThoughtArtifact(item)) count += 1;
  }
  return count;
}

export function countIlePowByType(
  artifacts: readonly IlePowCounterArtifact[] | null | undefined,
): IlePowTypeCounts {
  const counts = emptyIlePowTypeCounts();
  if (!artifacts?.length) return counts;
  for (const item of artifacts) {
    if (isIleSpokenThoughtArtifact(item)) continue;
    const type = artifactType(item);
    if (!type) continue;
    if (type === "eeg" && isExcludedFromSnapshotPoW(item.metadata)) continue;
    counts[type] += 1;
  }
  return counts;
}

export function toIlePowDisplayCounts(
  typed: IlePowTypeCounts,
  artifacts?: readonly IlePowCounterArtifact[] | null,
): IlePowDisplayCounts {
  return {
    tool: typed.tool,
    screen: typed.screen,
    video: typed.video,
    eeg: typed.eeg,
    thoughts: countIleSpokenThoughts(artifacts),
  };
}

export function countIlePowDisplayByType(
  artifacts: readonly IlePowCounterArtifact[] | null | undefined,
): IlePowDisplayCounts {
  return toIlePowDisplayCounts(countIlePowByType(artifacts), artifacts);
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
