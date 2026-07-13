export const TAP_IDLE_TOOL_NAME = "tap-idle-heartbeat";
export const TAP_IDLE_POW_INTERVAL_MS = 60_000;

export interface TapIdleHeartbeatPayload {
  type: "openlesson_tap_idle_heartbeat";
  tap_session_id: string;
  workspace_id: string;
  block_id?: string | null;
  focus_session_id?: string | null;
  idle_duration_ms: number;
  has_pending_transcription: boolean;
  timestamp_ms: number;
  at: string;
}

export function buildTapIdleHeartbeatPayload(input: {
  tapSessionId: string;
  workspaceId: string;
  blockId?: string | null;
  focusSessionId?: string | null;
  idleDurationMs: number;
  hasPendingTranscription?: boolean;
  timestampMs?: number;
}): TapIdleHeartbeatPayload {
  const timestampMs = input.timestampMs ?? Date.now();
  return {
    type: "openlesson_tap_idle_heartbeat",
    tap_session_id: input.tapSessionId,
    workspace_id: input.workspaceId,
    block_id: input.blockId ?? null,
    focus_session_id: input.focusSessionId ?? null,
    idle_duration_ms: Math.max(0, Math.trunc(input.idleDurationMs)),
    has_pending_transcription: Boolean(input.hasPendingTranscription),
    timestamp_ms: timestampMs,
    at: new Date(timestampMs).toISOString(),
  };
}