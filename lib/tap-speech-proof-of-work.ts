export const TAP_SPEECH_TOOL_NAME = "tap-speech-segment";

/** Pause length after the last transcript before a speech segment is considered stopped. */
export const TAP_SPEECH_SEGMENT_GAP_MS = 2_600;

export type TapSpeechSegmentEvent = "start" | "stop";

export interface TapSpeechSegmentPayload {
  type: "uncertain_systems_tap_speech_segment";
  event: TapSpeechSegmentEvent;
  tap_session_id: string;
  workspace_id: string;
  block_id?: string | null;
  focus_session_id?: string | null;
  segment_duration_ms?: number;
  transcript_snapshot?: string;
  timestamp_ms: number;
  at: string;
}

export function buildTapSpeechSegmentPayload(input: {
  event: TapSpeechSegmentEvent;
  tapSessionId: string;
  workspaceId: string;
  blockId?: string | null;
  focusSessionId?: string | null;
  segmentDurationMs?: number;
  transcriptSnapshot?: string;
  timestampMs?: number;
}): TapSpeechSegmentPayload {
  const timestampMs = input.timestampMs ?? Date.now();
  return {
    type: "uncertain_systems_tap_speech_segment",
    event: input.event,
    tap_session_id: input.tapSessionId,
    workspace_id: input.workspaceId,
    block_id: input.blockId ?? null,
    focus_session_id: input.focusSessionId ?? null,
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