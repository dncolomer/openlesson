/**
 * Session-global TAP Learning Proof-of-Work type totals (RTS-style resource counters).
 * Counts are never partitioned by chapter id.
 */
import {
  normalizeProofOfWorkType,
  type WorkspaceProofOfWorkType,
} from "@/lib/pow-api/workspace-proof-of-work";
import { isExcludedFromSnapshotPoW } from "@/lib/pow-api/pow-quality";
import { ILE_TRACE_TOOL_NAME } from "@/lib/ile-thought-traces";
import { TAP_TRACE_TOOL_NAME } from "@/lib/tap-score-traces";

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
  /** Monotonic session index. Survives the in-memory window slide. */
  n?: number;
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

/** Recent rows kept in RAM after upload. HUD totals live on the session ledger. */
export const ILE_POW_ARTIFACT_WINDOW = 32;

const SLIM_META_KEYS = [
  "type",
  "impure",
  "quality",
  "session_quality",
  "practice",
  "practice_pow",
  "pow_kind",
  "pow_label",
  "invalidated",
  "invalidated_pow",
  "pow_invalidated",
  "calibration_passed",
] as const;

export type IlePowSessionLedger = {
  artifacts: IlePowCounterArtifact[];
  typed: IlePowTypeCounts;
  thoughts: number;
  nextN: number;
};

export const ILE_POW_COUNTER_LABELS: Record<IlePowDisplayCounterType, string> = {
  tool: "Tools",
  screen: "Screen",
  video: "Video",
  eeg: "EEG",
  thoughts: "Thoughts",
};

const SPOKEN_TOOL_NAMES = new Set<string>([
  "speech-segment",
  "ile-speech-segment",
  "tap-speech-segment",
]);
const THOUGHT_TRACE_TOOL_NAMES = new Set<string>([ILE_TRACE_TOOL_NAME, TAP_TRACE_TOOL_NAME]);
const SPOKEN_META_TYPES = new Set([
  "uncertain_systems_speech_segment",
  "uncertain_systems_ile_speech_segment",
  "uncertain_systems_tap_speech_segment",
]);
const THOUGHT_TRACE_META_TYPES = new Set([
  "uncertain_systems_thought_trace",
  "uncertain_systems_ile_thought_trace",
  "uncertain_systems_tap_thought_trace",
]);

/** Submitted thought traces (and spoken segments) are display-only "thoughts", not tools. */
export function isIleSpokenThoughtArtifact(
  item: IlePowCounterArtifact | null | undefined,
): boolean {
  if (!item) return false;
  const tool = String(item.tool_name || "").trim().toLowerCase();
  if (THOUGHT_TRACE_TOOL_NAMES.has(tool) || SPOKEN_TOOL_NAMES.has(tool)) return true;
  const action = String(item.tool_action || "").trim().toLowerCase();
  if (action.startsWith("speech_")) return true;
  const metaType =
    item.metadata && typeof item.metadata.type === "string"
      ? item.metadata.type.trim().toLowerCase()
      : "";
  if (THOUGHT_TRACE_META_TYPES.has(metaType) || SPOKEN_META_TYPES.has(metaType)) return true;
  const kind = String(item.kind || item.type || item.proof_of_work_type || "")
    .trim()
    .toLowerCase();
  return (
    kind === "speech" ||
    kind === "spoken" ||
    kind === "thoughts" ||
    kind === "thought" ||
    kind === "thought-trace" ||
    kind === "thought_trace"
  );
}

export function emptyIlePowTypeCounts(): IlePowTypeCounts {
  return { tool: 0, screen: 0, video: 0, eeg: 0 };
}

export function emptyIlePowDisplayCounts(): IlePowDisplayCounts {
  return { tool: 0, screen: 0, video: 0, eeg: 0, thoughts: 0 };
}

/** Pending work not yet sent via End turn (stashed thoughts, forming speech, dirty canvas). */
export function countIleUnsubmittedPowDisplay(input: {
  unflaggedThoughtCount?: number;
  formingThought?: boolean;
  canvasDirty?: boolean;
}): IlePowDisplayCounts {
  const thoughts = Math.max(0, Math.floor(Number(input.unflaggedThoughtCount) || 0));
  return {
    tool: Number(Boolean(input.canvasDirty)),
    screen: 0,
    video: 0,
    eeg: 0,
    thoughts: thoughts + (input.formingThought ? 1 : 0),
  };
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
 * Live totals for the TAP Learning resource bar. Chapter ids on artifacts are ignored
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
  thoughts?: number,
): IlePowDisplayCounts {
  return {
    tool: typed.tool,
    screen: typed.screen,
    video: typed.video,
    eeg: typed.eeg,
    thoughts:
      typeof thoughts === "number" && Number.isFinite(thoughts)
        ? Math.max(0, Math.floor(thoughts))
        : countIleSpokenThoughts(artifacts),
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

export function emptyIlePowSessionLedger(): IlePowSessionLedger {
  return {
    artifacts: [],
    typed: emptyIlePowTypeCounts(),
    thoughts: 0,
    nextN: 1,
  };
}

function slimMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const slim: Record<string, unknown> = {};
  for (const key of SLIM_META_KEYS) {
    if (key in metadata) slim[key] = metadata[key];
  }
  return Object.keys(slim).length ? slim : null;
}

export function slimIlePowCounterArtifact(
  item: IlePowCounterArtifact,
  n: number,
): IlePowCounterArtifact {
  return {
    n,
    type: item.type ?? null,
    proof_of_work_type: item.proof_of_work_type ?? null,
    kind: item.kind ?? null,
    chapter_id: item.chapter_id ?? null,
    step_id: item.step_id ?? null,
    block_id: item.block_id ?? null,
    tool_name: item.tool_name ?? null,
    tool_action: item.tool_action ?? null,
    metadata: slimMetadata(item.metadata),
  };
}

function addTypedCount(
  typed: IlePowTypeCounts,
  item: IlePowCounterArtifact,
): IlePowTypeCounts {
  if (isIleSpokenThoughtArtifact(item)) return typed;
  const type = artifactType(item);
  if (!type) return typed;
  if (type === "eeg" && isExcludedFromSnapshotPoW(item.metadata)) return typed;
  return { ...typed, [type]: typed[type] + 1 };
}

export function ilePowNextIndex(
  artifacts: readonly IlePowCounterArtifact[] | null | undefined,
): number {
  if (!artifacts?.length) return 0;
  let max = 0;
  let hasN = false;
  for (const item of artifacts) {
    if (typeof item.n === "number" && Number.isFinite(item.n)) {
      hasN = true;
      if (item.n > max) max = item.n;
    }
  }
  return hasN ? max + 1 : artifacts.length;
}

export function appendIlePowSessionLedger(
  ledger: IlePowSessionLedger,
  next: IlePowCounterArtifact,
): IlePowSessionLedger {
  const n = ledger.nextN;
  const slimmed = slimIlePowCounterArtifact(next, n);
  const artifacts = [...ledger.artifacts, slimmed];
  return {
    artifacts:
      artifacts.length > ILE_POW_ARTIFACT_WINDOW
        ? artifacts.slice(-ILE_POW_ARTIFACT_WINDOW)
        : artifacts,
    typed: addTypedCount(ledger.typed, slimmed),
    thoughts: ledger.thoughts + (isIleSpokenThoughtArtifact(slimmed) ? 1 : 0),
    nextN: n + 1,
  };
}

export function appendIlePowCounterArtifact(
  artifacts: readonly IlePowCounterArtifact[],
  next: IlePowCounterArtifact,
): IlePowCounterArtifact[] {
  const lastN = ilePowNextIndex(artifacts);
  return appendIlePowSessionLedger(
    {
      artifacts: [...artifacts],
      typed: emptyIlePowTypeCounts(),
      thoughts: 0,
      nextN: artifacts.length ? Math.max(1, lastN) : 1,
    },
    next,
  ).artifacts;
}
