import {
  buildIleIdleHeartbeatPayload,
  buildIleSpeechSegmentPayload,
  buildIleThoughtTracePayload,
  ILE_IDLE_TOOL_NAME,
  ILE_SPEECH_TOOL_NAME,
  ILE_TRACE_TOOL_NAME,
  type IleSystem1Action,
  type IleSystem2Action,
} from "@/lib/ile-thought-traces";
import { ILE_IMPORT_CAPTURE_CHANNEL, ILE_IMPORT_SESSION_MODE } from "./constants";
import type {
  IleSoloImportContext,
  IleSoloTimelineEvent,
  IleSoloUploadInput,
  MappedStill,
  MappedVideoClip,
} from "./types";

function jsonData(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64");
}

function baseMetadata(context: IleSoloImportContext): Record<string, unknown> {
  return {
    session_id: context.sessionId,
    workspace_id: context.workspaceId,
    session_mode: ILE_IMPORT_SESSION_MODE,
    capture_channel: ILE_IMPORT_CAPTURE_CHANNEL,
  };
}

function mapEvent(
  event: IleSoloTimelineEvent,
  context: IleSoloImportContext,
): IleSoloUploadInput {
  const workspaceId = context.workspaceId;
  const sessionId = context.sessionId;
  const blockId = context.blockId ?? null;

  if (event.kind === "speech_start") {
    const payload = buildIleSpeechSegmentPayload({
      event: "start",
      sessionId,
      workspaceId,
      blockId,
      timestampMs: event.timestampMs,
    });
    return {
      workspaceId,
      type: "tool",
      mime_type: "application/json",
      data: jsonData(payload),
      block_id: blockId,
      session_id: sessionId,
      file_name: `ile-speech-${payload.event}-${sessionId}-${event.timestampMs}.json`,
      timestamp_ms: event.timestampMs,
      tool_name: ILE_SPEECH_TOOL_NAME,
      tool_action: `speech_${payload.event}`,
      metadata: {
        ...baseMetadata(context),
        event: payload.event,
        segment_duration_ms: payload.segment_duration_ms ?? null,
        transcript_snapshot: payload.transcript_snapshot ?? null,
        segment_id: event.segmentId,
      },
    };
  }

  if (event.kind === "speech_stop") {
    const payload = buildIleSpeechSegmentPayload({
      event: "stop",
      sessionId,
      workspaceId,
      blockId,
      segmentDurationMs: event.durationMs,
      transcriptSnapshot: event.transcriptSnapshot,
      timestampMs: event.timestampMs,
    });
    return {
      workspaceId,
      type: "tool",
      mime_type: "application/json",
      data: jsonData(payload),
      block_id: blockId,
      session_id: sessionId,
      file_name: `ile-speech-${payload.event}-${sessionId}-${event.timestampMs}.json`,
      timestamp_ms: event.timestampMs,
      tool_name: ILE_SPEECH_TOOL_NAME,
      tool_action: `speech_${payload.event}`,
      metadata: {
        ...baseMetadata(context),
        event: payload.event,
        segment_duration_ms: payload.segment_duration_ms ?? null,
        transcript_snapshot: payload.transcript_snapshot ?? null,
        segment_id: event.segmentId,
      },
    };
  }

  if (event.kind === "idle") {
    const payload = buildIleIdleHeartbeatPayload({
      sessionId,
      workspaceId,
      blockId,
      idleDurationMs: event.idleDurationMs,
      timestampMs: event.timestampMs,
    });
    return {
      workspaceId,
      type: "tool",
      mime_type: "application/json",
      data: jsonData(payload),
      block_id: blockId,
      session_id: sessionId,
      file_name: `ile-idle-${sessionId}-${event.timestampMs}.json`,
      timestamp_ms: event.timestampMs,
      tool_name: ILE_IDLE_TOOL_NAME,
      tool_action: "idle_heartbeat",
      metadata: {
        ...baseMetadata(context),
        idle_duration_ms: payload.idle_duration_ms,
        has_pending_transcription: payload.has_pending_transcription,
      },
    };
  }

  const payload = buildIleThoughtTracePayload({
    traceType: event.traceType,
    action: event.action as IleSystem1Action | IleSystem2Action,
    sessionId,
    workspaceId,
    blockId,
    thoughtId: event.thoughtId,
    thoughtIds: event.thoughtIds,
    chainId: event.chainId,
    text: event.text,
    combined: event.combined,
    timestampMs: event.timestampMs,
  });
  return {
    workspaceId,
    type: "tool",
    mime_type: "application/json",
    data: jsonData(payload),
    block_id: blockId,
    session_id: sessionId,
    file_name: `ile-trace-${event.traceType}-${event.action}-${event.thoughtId}.json`,
    timestamp_ms: event.timestampMs,
    tool_name: ILE_TRACE_TOOL_NAME,
    tool_action: `${event.traceType}:${event.action}`,
    metadata: {
      ...baseMetadata(context),
      trace_type: event.traceType,
      action: event.action,
      thought_id: event.thoughtId,
      thought_ids: event.thoughtIds ?? null,
      chain_id: event.chainId,
      text: event.text,
      combined: event.combined ?? false,
    },
  };
}

function mapStill(still: MappedStill, context: IleSoloImportContext): IleSoloUploadInput {
  return {
    workspaceId: context.workspaceId,
    type: "screen",
    mime_type: still.mimeType,
    data: still.dataBase64,
    block_id: context.blockId ?? null,
    session_id: context.sessionId,
    file_name: still.fileName,
    timestamp_ms: still.timestampMs,
    metadata: {
      ...baseMetadata(context),
      source: "event_aligned_frame",
    },
  };
}

function mapVideo(clip: MappedVideoClip, context: IleSoloImportContext): IleSoloUploadInput {
  return {
    workspaceId: context.workspaceId,
    type: "video",
    mime_type: clip.mimeType,
    data: clip.dataBase64,
    block_id: context.blockId ?? null,
    session_id: context.sessionId,
    file_name: clip.fileName,
    timestamp_ms: clip.timestampMs,
    metadata: {
      ...baseMetadata(context),
      source: "short_clip",
    },
  };
}

/**
 * Map ILE Solo timeline events to `uploadWorkspaceProofOfWork` inputs.
 * Does not persist, does not trigger LWM Snapshot.
 */
export function mapIleSoloEventsToUploadInputs(
  events: IleSoloTimelineEvent[],
  context: IleSoloImportContext,
  extras?: { stills?: MappedStill[]; videoClip?: MappedVideoClip | null },
): IleSoloUploadInput[] {
  const uploads = events.map((event) => mapEvent(event, context));
  for (const still of extras?.stills ?? []) {
    uploads.push(mapStill(still, context));
  }
  if (extras?.videoClip) {
    uploads.push(mapVideo(extras.videoClip, context));
  }
  uploads.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
  return uploads;
}
