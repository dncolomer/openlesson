import {
  buildGatedIleEegUploadItem,
  buildIleEegUploadItem,
  hashIlePowContent,
  ILE_EVIDENCE_THRESHOLDS,
  isCountableIleEegChunk,
  isCountableIleEegPow,
  scoreIleEegChunk,
  type IleBufferedToolEvent,
  type IleProofOfWorkUploadItem,
} from "@/lib/ile-evidence-buffer";

export {
  ILE_EVIDENCE_THRESHOLDS,
  hashIlePowContent,
  buildIleEegUploadItem,
  buildGatedIleEegUploadItem,
  isCountableIleEegChunk,
  isCountableIleEegPow,
  scoreIleEegChunk,
};

/** Debounce canvas/notebook uploads so rapid edits do not flood the PoW API. */
export const ILE_POW_DEBOUNCE_MS = 4_000;

export function totalIleEegSamples(channels: Record<string, number[]>): number {
  return Object.values(channels).reduce((sum, samples) => sum + samples.length, 0);
}

export function buildIleToolEventUploadItem(
  sessionId: string,
  event: IleBufferedToolEvent,
): IleProofOfWorkUploadItem {
  return {
    kind: "tool",
    mimeType: "application/json",
    fileName: `ile-tool-${event.toolName}-${event.action}-${event.timestampMs}.json`,
    payload: JSON.stringify({
      session_id: sessionId,
      tool: event.toolName,
      action: event.action,
      timestamp_ms: event.timestampMs,
      metadata: event.metadata,
    }),
    timestampMs: event.timestampMs,
    toolName: event.toolName,
    toolAction: event.action,
    metadata: event.metadata,
  };
}

export function buildIleCanvasUploadItem(sessionId: string, data: string, timestampMs = Date.now()) {
  return {
    kind: "tool" as const,
    mimeType: "application/json",
    fileName: `ile-canvas-${timestampMs}.json`,
    payload: JSON.stringify({
      session_id: sessionId,
      data,
      timestamp_ms: timestampMs,
    }),
    timestampMs,
    toolName: "canvas",
    toolAction: "canvas_draw",
    metadata: { bytes: data.length },
  } satisfies IleProofOfWorkUploadItem;
}

export function buildIleNotebookUploadItem(sessionId: string, content: string, timestampMs = Date.now()) {
  return {
    kind: "tool" as const,
    mimeType: "application/json",
    fileName: `ile-notebook-${timestampMs}.json`,
    payload: JSON.stringify({
      session_id: sessionId,
      content,
      timestamp_ms: timestampMs,
    }),
    timestampMs,
    toolName: "notebook",
    toolAction: "notebook_edit",
    metadata: { char_count: content.length },
  } satisfies IleProofOfWorkUploadItem;
}

export function buildIleFacialUploadItem(
  sessionId: string,
  data: unknown[],
  timestampMs = Date.now(),
): IleProofOfWorkUploadItem {
  return {
    kind: "tool",
    mimeType: "application/json",
    fileName: `ile-facial-${timestampMs}.json`,
    payload: JSON.stringify({ session_id: sessionId, timestamp_ms: timestampMs, data }),
    timestampMs,
    toolName: "facial",
    toolAction: "facial_batch",
    metadata: { point_count: data.length },
  };
}

export function meetsCanvasUploadThreshold(length: number, force = false) {
  const min = force ? 20 : ILE_EVIDENCE_THRESHOLDS.canvasMinChars;
  return length >= min;
}

export function meetsNotebookUploadThreshold(length: number, force = false) {
  const min = force ? 8 : ILE_EVIDENCE_THRESHOLDS.notebookMinChars;
  return length >= min;
}

export function meetsFacialUploadThreshold(count: number, force = false) {
  const min = force ? 1 : ILE_EVIDENCE_THRESHOLDS.facialMinPoints;
  return count >= min;
}

export function meetsEegUploadThreshold(sampleCount: number, force = false) {
  const min = force ? 16 : ILE_EVIDENCE_THRESHOLDS.eegMinTotalSamples;
  return sampleCount >= min;
}