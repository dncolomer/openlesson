import type { IleProofOfWorkUploadItem } from "@/lib/learn-evidence-buffer";
import { BEHAVIOR_TOOL_NAME, assertNoPersonMedia } from "@/lib/behavior-capture";

export const BEHAVIOR_ROLLUP_SCHEMA = "behavior-convergence-v0";
export const BEHAVIOR_ROLLUP_ACTION = "session_rollup";

export type BehaviorStreamIndex = {
  stream: string;
  xai_file_id?: string | null;
  sample_count: number;
  t0?: number;
  t1?: number;
};

export function buildBehaviorSessionRollup(input: {
  sessionId: string;
  identity?: string | null;
  kind?: string | null;
  problemId?: string | null;
  t0: number;
  t1: number;
  hiddenStateWalk?: string[];
  streams: BehaviorStreamIndex[];
  counts?: Record<string, number>;
  timestampMs?: number;
}): IleProofOfWorkUploadItem {
  const payload = {
    schema: BEHAVIOR_ROLLUP_SCHEMA,
    session_id: input.sessionId,
    identity: input.identity ?? null,
    kind: input.kind ?? null,
    problem_id: input.problemId ?? null,
    t0: input.t0,
    t1: input.t1,
    hidden_state_walk: input.hiddenStateWalk ?? [],
    streams: input.streams,
    counts: input.counts ?? {},
  };
  const json = JSON.stringify(payload);
  assertNoPersonMedia({ mimeType: "application/json", kind: "tool", payload: json });
  return {
    kind: "tool",
    mimeType: "application/json",
    fileName: `behavior-rollup-${input.sessionId}-${input.t1}.json`,
    payload: json,
    timestampMs: input.timestampMs ?? input.t1,
    toolName: BEHAVIOR_TOOL_NAME,
    toolAction: BEHAVIOR_ROLLUP_ACTION,
    metadata: {
      schema: BEHAVIOR_ROLLUP_SCHEMA,
      stream: "session_rollup",
      t0: input.t0,
      t1: input.t1,
    },
  };
}
