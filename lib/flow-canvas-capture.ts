/**
 * Optional Work-canvas content capture for knowledge verification protocols.
 * Default off: classified canvas actions still record as PoW, but the board
 * itself is not snapshotted. When on, a mermaid markdown document is stored
 * every N canvas actions as a BlobStore document. It never enters embeddings.
 */

import type { IleProofOfWorkUploadItem } from "@/lib/learn-evidence-buffer";
import type { IleWorkCanvasScene } from "@/lib/learn-work-canvas-scene";
import { ileWorkCanvasMermaidDocument } from "@/lib/learn-work-canvas-mermaid";

export const FLOW_CANVAS_CAPTURE_EVERY_MIN = 2;
export const FLOW_CANVAS_CAPTURE_EVERY_MAX = 48;
export const FLOW_CANVAS_CAPTURE_EVERY_DEFAULT = 8;

export const CANVAS_DOCUMENT_TOOL_NAME = "canvas" as const;
export const CANVAS_DOCUMENT_TOOL_ACTION = "canvas_document" as const;
export const CANVAS_DOCUMENT_MIME = "text/markdown";
export const CANVAS_DOCUMENT_SCHEMA = "canvas-mermaid-v1";

export type FlowCanvasCapture = {
  enabled: boolean;
  everyActions: number;
};

export const DEFAULT_FLOW_CANVAS_CAPTURE: FlowCanvasCapture = {
  enabled: false,
  everyActions: FLOW_CANVAS_CAPTURE_EVERY_DEFAULT,
};

export function flowAuthorShowsCanvasCapture(_kind?: string | null): boolean {
  return true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseFlag(value: unknown, fallback: boolean): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (text === "true" || text === "1" || text === "yes") return true;
    if (text === "false" || text === "0" || text === "no") return false;
  }
  return fallback;
}

export function parseCanvasCaptureEveryActions(value: unknown): number {
  const n = typeof value === "string" && value.trim() ? Number(value) : Number(value);
  if (!Number.isFinite(n)) return FLOW_CANVAS_CAPTURE_EVERY_DEFAULT;
  return Math.min(
    FLOW_CANVAS_CAPTURE_EVERY_MAX,
    Math.max(FLOW_CANVAS_CAPTURE_EVERY_MIN, Math.round(n)),
  );
}

export function parseFlowCanvasCapture(raw: unknown): FlowCanvasCapture {
  const record = asRecord(raw);
  if (!record) return { ...DEFAULT_FLOW_CANVAS_CAPTURE };
  return {
    enabled: parseFlag(record.enabled, DEFAULT_FLOW_CANVAS_CAPTURE.enabled),
    everyActions: parseCanvasCaptureEveryActions(
      record.everyActions ?? record.every_actions,
    ),
  };
}

export function serializeFlowCanvasCapture(
  value: FlowCanvasCapture | null | undefined,
): FlowCanvasCapture {
  return parseFlowCanvasCapture(value);
}

export function nextFlowCanvasCapture(
  current: unknown,
  incoming: unknown,
): FlowCanvasCapture {
  if (incoming === undefined) return parseFlowCanvasCapture(current);
  return parseFlowCanvasCapture(incoming);
}

/** Session claim stamp. Missing metadata keeps capture off. */
export function sessionCanvasCapture(metadata: unknown): FlowCanvasCapture {
  const record = asRecord(metadata);
  if (!record) return { ...DEFAULT_FLOW_CANVAS_CAPTURE };
  const raw = record.canvasCapture ?? record.canvas_capture;
  if (raw == null) return { ...DEFAULT_FLOW_CANVAS_CAPTURE };
  return parseFlowCanvasCapture(raw);
}

export function withCanvasCaptureMetadata(
  metadata: Record<string, unknown>,
  capture: FlowCanvasCapture,
): Record<string, unknown> {
  return {
    ...metadata,
    canvasCapture: serializeFlowCanvasCapture(capture),
  };
}

export function isCanvasContentPowRow(row: {
  tool_name?: string | null;
  tool_action?: string | null;
  mime_type?: string | null;
  type?: string | null;
}): boolean {
  const action = String(row.tool_action || "").trim().toLowerCase();
  const name = String(row.tool_name || "").trim().toLowerCase();
  const mime = String(row.mime_type || "").trim().toLowerCase();
  if (action === "canvas_draw" || action === CANVAS_DOCUMENT_TOOL_ACTION) return true;
  if (name === CANVAS_DOCUMENT_TOOL_NAME && mime.startsWith("text/markdown")) return true;
  return false;
}

export class FlowCanvasCaptureClock {
  private count = 0;
  private capture: FlowCanvasCapture = { ...DEFAULT_FLOW_CANVAS_CAPTURE };

  setCapture(next: FlowCanvasCapture | null | undefined) {
    this.capture = parseFlowCanvasCapture(next);
  }

  get enabled(): boolean {
    return this.capture.enabled;
  }

  note(actionCount: number): boolean {
    const n = Math.max(0, Math.floor(Number(actionCount) || 0));
    if (!this.capture.enabled || n <= 0) return false;
    const prev = this.count;
    this.count += n;
    const every = this.capture.everyActions;
    return Math.floor(this.count / every) > Math.floor(prev / every);
  }

  stats(): { actionCount: number; everyActions: number } {
    return { actionCount: this.count, everyActions: this.capture.everyActions };
  }
}

export function buildCanvasMermaidDocumentUploadItem(
  sessionId: string,
  scene: IleWorkCanvasScene | null | undefined,
  input?: { actionCount?: number; everyActions?: number; timestampMs?: number },
): IleProofOfWorkUploadItem {
  const timestampMs = input?.timestampMs ?? Date.now();
  const actionCount = Math.max(0, Math.floor(Number(input?.actionCount) || 0));
  const everyActions = parseCanvasCaptureEveryActions(input?.everyActions);
  const markdown = ileWorkCanvasMermaidDocument(scene, { actionCount, everyActions });
  return {
    kind: "tool",
    mimeType: CANVAS_DOCUMENT_MIME,
    fileName: `canvas-document-${timestampMs}.md`,
    payload: markdown,
    timestampMs,
    toolName: CANVAS_DOCUMENT_TOOL_NAME,
    toolAction: CANVAS_DOCUMENT_TOOL_ACTION,
    metadata: {
      schema: CANVAS_DOCUMENT_SCHEMA,
      format: "mermaid",
      action_count: actionCount,
      every_actions: everyActions,
      session_id: sessionId,
    },
  };
}
