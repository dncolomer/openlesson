import type { ToolAction, ToolName } from "@/lib/storage";

export const ILE_EVIDENCE_THRESHOLDS = {
  transcriptMinChars: 12,
  facialMinPoints: 5,
  eegMinTotalSamples: 64,
  notebookMinChars: 20,
  canvasMinChars: 100,
  toolEventMinCount: 1,
  screenshotMinCount: 1,
} as const;

export interface IleBufferedToolEvent {
  toolName: ToolName;
  action: ToolAction;
  timestampMs: number;
  metadata: Record<string, unknown>;
}

export interface IleBufferedEegChunk {
  channels: Record<string, number[]>;
  bandPowers: Record<string, number> | null;
  sampleRateHz?: number;
  startedAtMs?: number;
  endedAtMs?: number;
  sampleCounts?: Record<string, number>;
  deviceStatus?: Record<string, unknown> | null;
  deviceName?: string;
  timestampMs: number;
}

export interface IleBufferedScreenshot {
  blob: Blob;
  timestampMs: number;
}

export type IleProofOfWorkUploadKind = "tool" | "eeg";

export interface IleProofOfWorkUploadItem {
  kind: IleProofOfWorkUploadKind;
  mimeType: string;
  fileName: string;
  /** UTF-8 JSON/text payload. */
  payload: string;
  timestampMs: number;
  toolName?: string;
  toolAction?: string;
  metadata?: Record<string, unknown>;
  bandPowers?: Record<string, number> | null;
  deviceName?: string | null;
  sampleCount?: number | null;
}

export interface IleEvidenceDrainResult {
  uploads: IleProofOfWorkUploadItem[];
  screenshots: IleBufferedScreenshot[];
}

function totalEegSamples(channels: Record<string, number[]>): number {
  return Object.values(channels).reduce((sum, samples) => sum + samples.length, 0);
}

export function hashIlePowContent(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return String(hash);
}

function simpleHash(value: string): string {
  return hashIlePowContent(value);
}

export class IleEvidenceBuffer {
  private toolEvents: IleBufferedToolEvent[] = [];
  private transcriptParts: string[] = [];
  private facialPoints: unknown[] = [];
  private eegChunks: IleBufferedEegChunk[] = [];
  private screenshots: IleBufferedScreenshot[] = [];
  private canvasData: string | null = null;
  private notebookContent: string | null = null;
  private lastFlushedCanvasHash: string | null = null;
  private lastFlushedNotebookHash: string | null = null;

  pushToolEvent(event: IleBufferedToolEvent) {
    this.toolEvents.push(event);
  }

  pushTranscript(text: string) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean) this.transcriptParts.push(clean);
  }

  pushFacialPoints(points: unknown[]) {
    if (points.length > 0) this.facialPoints.push(...points);
  }

  pushEegChunk(chunk: IleBufferedEegChunk) {
    this.eegChunks.push(chunk);
  }

  pushScreenshot(screenshot: IleBufferedScreenshot) {
    this.screenshots.push(screenshot);
  }

  setCanvasData(data: string | null) {
    if (data) this.canvasData = data;
  }

  setNotebookContent(content: string | null) {
    if (content?.trim()) this.notebookContent = content;
  }

  drainForSubmit(sessionId: string, now = Date.now(), force = false): IleEvidenceDrainResult {
    const uploads: IleProofOfWorkUploadItem[] = [];

    const transcript = this.transcriptParts.join(" ").trim();
    const transcriptMin = force ? 4 : ILE_EVIDENCE_THRESHOLDS.transcriptMinChars;
    if (transcript.length >= transcriptMin) {
      uploads.push({
        kind: "tool",
        mimeType: "application/json",
        fileName: `ile-transcript-${now}.json`,
        payload: JSON.stringify({
          session_id: sessionId,
          source: "browser-web-speech",
          text: transcript,
          timestamp_ms: now,
        }),
        timestampMs: now,
        toolName: "transcript",
        toolAction: "batch",
        metadata: { source: "browser-web-speech", char_count: transcript.length },
      });
      this.transcriptParts = [];
    }

    if (this.toolEvents.length >= ILE_EVIDENCE_THRESHOLDS.toolEventMinCount) {
      const events = this.toolEvents.splice(0);
      uploads.push({
        kind: "tool",
        mimeType: "application/json",
        fileName: `ile-tool-events-${now}.json`,
        payload: JSON.stringify({ session_id: sessionId, events, timestamp_ms: now }),
        timestampMs: now,
        toolName: "ile-session",
        toolAction: "tool_batch",
        metadata: { event_count: events.length },
      });
    }

    if (this.canvasData) {
      const canvasMin = force ? 20 : ILE_EVIDENCE_THRESHOLDS.canvasMinChars;
      if (this.canvasData.length >= canvasMin) {
        const hash = simpleHash(this.canvasData);
        if (hash !== this.lastFlushedCanvasHash) {
          uploads.push({
            kind: "tool",
            mimeType: "application/json",
            fileName: `ile-canvas-${now}.json`,
            payload: JSON.stringify({
              session_id: sessionId,
              data: this.canvasData,
              timestamp_ms: now,
            }),
            timestampMs: now,
            toolName: "canvas",
            toolAction: "canvas_draw",
            metadata: { bytes: this.canvasData.length },
          });
          this.lastFlushedCanvasHash = hash;
        }
      }
    }

    const notebook = this.notebookContent?.trim() || "";
    const notebookMin = force ? 8 : ILE_EVIDENCE_THRESHOLDS.notebookMinChars;
    if (notebook.length >= notebookMin) {
      const hash = simpleHash(notebook);
      if (hash !== this.lastFlushedNotebookHash) {
        uploads.push({
          kind: "tool",
          mimeType: "application/json",
          fileName: `ile-notebook-${now}.json`,
          payload: JSON.stringify({
            session_id: sessionId,
            content: notebook,
            timestamp_ms: now,
          }),
          timestampMs: now,
          toolName: "notebook",
          toolAction: "notebook_edit",
          metadata: { char_count: notebook.length },
        });
        this.lastFlushedNotebookHash = hash;
      }
    }

    const facialMin = force ? 1 : ILE_EVIDENCE_THRESHOLDS.facialMinPoints;
    if (this.facialPoints.length >= facialMin) {
      const data = this.facialPoints.splice(0);
      uploads.push({
        kind: "tool",
        mimeType: "application/json",
        fileName: `ile-facial-${now}.json`,
        payload: JSON.stringify({ session_id: sessionId, timestamp_ms: now, data }),
        timestampMs: now,
        toolName: "facial",
        toolAction: "facial_batch",
        metadata: { point_count: data.length },
      });
    }

    const eegMin = force ? 16 : ILE_EVIDENCE_THRESHOLDS.eegMinTotalSamples;
    const eegReady = this.eegChunks.filter((chunk) => totalEegSamples(chunk.channels) >= eegMin);
    if (eegReady.length > 0) {
      this.eegChunks = this.eegChunks.filter((chunk) => totalEegSamples(chunk.channels) < eegMin);
      for (const chunk of eegReady) {
        const sampleCount = totalEegSamples(chunk.channels);
        uploads.push({
          kind: "eeg",
          mimeType: "application/json",
          fileName: `ile-eeg-${chunk.timestampMs}.json`,
          payload: JSON.stringify({
            session_id: sessionId,
            channels: chunk.channels,
            band_powers: chunk.bandPowers,
            sample_rate_hz: chunk.sampleRateHz,
            started_at_ms: chunk.startedAtMs,
            ended_at_ms: chunk.endedAtMs,
            sample_counts: chunk.sampleCounts,
            device_status: chunk.deviceStatus,
            device_name: chunk.deviceName,
            timestamp_ms: chunk.timestampMs,
          }),
          timestampMs: chunk.timestampMs,
          bandPowers: chunk.bandPowers,
          deviceName: chunk.deviceName ?? null,
          sampleCount,
          metadata: { sample_count: sampleCount },
        });
      }
    }

    const screenshots =
      this.screenshots.length >= ILE_EVIDENCE_THRESHOLDS.screenshotMinCount || (force && this.screenshots.length > 0)
        ? this.screenshots.splice(0)
        : [];

    return { uploads, screenshots };
  }
}