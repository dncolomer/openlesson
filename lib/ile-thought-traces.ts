export const ILE_TRACE_TOOL_NAME = "ile-thought-trace";

export type IleTraceType = "system1" | "system2";
export type IleSystem1Action = "crystallize" | "pause_finalize";
export type IleSystem2Action = "send" | "skip" | "select" | "deselect" | "resend" | "edit";

export interface IleThoughtTracePayload {
  type: "openlesson_ile_thought_trace";
  trace_type: IleTraceType;
  action: IleSystem1Action | IleSystem2Action;
  session_id: string;
  workspace_id: string;
  block_id?: string | null;
  thought_id?: string;
  thought_ids?: string[];
  chain_id?: string;
  text?: string;
  original_text?: string;
  combined?: boolean;
  timestamp_ms: number;
  at: string;
}

export function buildIleThoughtTracePayload(input: {
  traceType: IleTraceType;
  action: IleSystem1Action | IleSystem2Action;
  sessionId: string;
  workspaceId: string;
  blockId?: string | null;
  thoughtId?: string;
  thoughtIds?: string[];
  chainId?: string;
  text?: string;
  originalText?: string;
  combined?: boolean;
  timestampMs?: number;
}): IleThoughtTracePayload {
  const timestampMs = input.timestampMs ?? Date.now();
  return {
    type: "openlesson_ile_thought_trace",
    trace_type: input.traceType,
    action: input.action,
    session_id: input.sessionId,
    workspace_id: input.workspaceId,
    block_id: input.blockId ?? null,
    thought_id: input.thoughtId,
    thought_ids: input.thoughtIds,
    chain_id: input.chainId,
    text: input.text,
    original_text: input.originalText,
    combined: input.combined,
    timestamp_ms: timestampMs,
    at: new Date(timestampMs).toISOString(),
  };
}