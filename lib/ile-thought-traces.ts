export const ILE_TRACE_TOOL_NAME = "ile-thought-trace";
export const ILE_CHAT_TOOL_NAME = "ile-helios-chat";
export const ILE_IDLE_TOOL_NAME = "ile-idle-heartbeat";
export const ILE_SPEECH_TOOL_NAME = "ile-speech-segment";
export const ILE_IDLE_POW_INTERVAL_MS = 60_000;

export type IleTraceType = "system1" | "system2";
export type IleSystem1Action = "crystallize" | "pause_finalize" | "auto_stash";
/** send/promote/submit; remove = demote solution → stash (Exercise TAP parity). */
export type IleSystem2Action =
  | "send"
  | "skip"
  | "select"
  | "deselect"
  | "resend"
  | "edit"
  | "remove";

export interface IleThoughtTracePayload {
  type: "uncertain_systems_ile_thought_trace";
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

export interface IleChatExchangePayload {
  type: "uncertain_systems_ile_chat_exchange";
  session_id: string;
  workspace_id: string;
  block_id?: string | null;
  learner_thought: string;
  helios_reply: string;
  timestamp_ms: number;
  at: string;
}

export function buildIleChatExchangePayload(input: {
  sessionId: string;
  workspaceId: string;
  blockId?: string | null;
  learnerThought: string;
  heliosReply: string;
  timestampMs?: number;
}): IleChatExchangePayload {
  const timestampMs = input.timestampMs ?? Date.now();
  return {
    type: "uncertain_systems_ile_chat_exchange",
    session_id: input.sessionId,
    workspace_id: input.workspaceId,
    block_id: input.blockId ?? null,
    learner_thought: input.learnerThought,
    helios_reply: input.heliosReply,
    timestamp_ms: timestampMs,
    at: new Date(timestampMs).toISOString(),
  };
}

export interface IleIdleHeartbeatPayload {
  type: "uncertain_systems_ile_idle_heartbeat";
  session_id: string;
  workspace_id: string;
  block_id?: string | null;
  idle_duration_ms: number;
  has_pending_transcription: boolean;
  timestamp_ms: number;
  at: string;
}

export function buildIleIdleHeartbeatPayload(input: {
  sessionId: string;
  workspaceId: string;
  blockId?: string | null;
  idleDurationMs: number;
  hasPendingTranscription?: boolean;
  timestampMs?: number;
}): IleIdleHeartbeatPayload {
  const timestampMs = input.timestampMs ?? Date.now();
  return {
    type: "uncertain_systems_ile_idle_heartbeat",
    session_id: input.sessionId,
    workspace_id: input.workspaceId,
    block_id: input.blockId ?? null,
    idle_duration_ms: Math.max(0, Math.trunc(input.idleDurationMs)),
    has_pending_transcription: Boolean(input.hasPendingTranscription),
    timestamp_ms: timestampMs,
    at: new Date(timestampMs).toISOString(),
  };
}

export type IleSpeechSegmentEvent = "start" | "stop";

export interface IleSpeechSegmentPayload {
  type: "uncertain_systems_ile_speech_segment";
  event: IleSpeechSegmentEvent;
  session_id: string;
  workspace_id: string;
  block_id?: string | null;
  segment_duration_ms?: number;
  transcript_snapshot?: string;
  timestamp_ms: number;
  at: string;
}

export function buildIleSpeechSegmentPayload(input: {
  event: IleSpeechSegmentEvent;
  sessionId: string;
  workspaceId: string;
  blockId?: string | null;
  segmentDurationMs?: number;
  transcriptSnapshot?: string;
  timestampMs?: number;
}): IleSpeechSegmentPayload {
  const timestampMs = input.timestampMs ?? Date.now();
  return {
    type: "uncertain_systems_ile_speech_segment",
    event: input.event,
    session_id: input.sessionId,
    workspace_id: input.workspaceId,
    block_id: input.blockId ?? null,
    segment_duration_ms:
      input.event === "stop" && typeof input.segmentDurationMs === "number"
        ? Math.max(0, Math.trunc(input.segmentDurationMs))
        : undefined,
    transcript_snapshot:
      input.transcriptSnapshot?.trim() ? input.transcriptSnapshot.trim().slice(0, 2000) : undefined,
    timestamp_ms: timestampMs,
    at: new Date(timestampMs).toISOString(),
  };
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
    type: "uncertain_systems_ile_thought_trace",
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