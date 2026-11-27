import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildCanvasMermaidDocumentUploadItem,
  CANVAS_DOCUMENT_MIME,
  CANVAS_DOCUMENT_SCHEMA,
  CANVAS_DOCUMENT_TOOL_ACTION,
  DEFAULT_FLOW_CANVAS_CAPTURE,
  FlowCanvasCaptureClock,
  isCanvasContentPowRow,
  parseFlowCanvasCapture,
  sessionCanvasCapture,
  withCanvasCaptureMetadata,
} from "@/lib/flow-canvas-capture";
import { ileWorkCanvasMermaid, ileWorkCanvasMermaidDocument } from "@/lib/learn-work-canvas-mermaid";
import { serializeIleWorkCanvasScene } from "@/lib/learn-work-canvas-scene";
import { encodeFlowEmbedding } from "@/lib/flow-embedding-encode";
import { storedRecordFileKind } from "@/lib/behavior-record";
import { acceptProductFlowPublish, emptyProductFlowDraft } from "@/lib/product-flow";
import { applyVerificationCommand, emptyVerificationState } from "@/lib/verification-flow";
import { regionSimulationProgressOverall } from "@/lib/region-simulation";

const root = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function scene(elements: Array<Record<string, unknown>>) {
  return serializeIleWorkCanvasScene({ elements, appState: {}, files: {} });
}

describe("flow canvas capture", () => {
  it("defaults off and clamps every-actions", async () => {
    expect(parseFlowCanvasCapture(null)).toEqual(DEFAULT_FLOW_CANVAS_CAPTURE);
    expect(parseFlowCanvasCapture({ enabled: true, every_actions: 1 }).everyActions).toBe(2);
    expect(parseFlowCanvasCapture({ enabled: true, everyActions: 99 }).everyActions).toBe(48);
    expect(sessionCanvasCapture(null).enabled).toBe(false);
    expect(sessionCanvasCapture({ canvasCapture: { enabled: true, everyActions: 4 } }).enabled).toBe(
      true,
    );
    const stamped = withCanvasCaptureMetadata({ block_id: "b1" }, parseFlowCanvasCapture({ enabled: true }));
    expect(stamped.canvasCapture).toEqual({ enabled: true, everyActions: 8 });
  });

  it("fires once each time the action count crosses a multiple", async () => {
    const clock = new FlowCanvasCaptureClock();
    clock.setCapture({ enabled: true, everyActions: 3 });
    expect(clock.note(2)).toBe(false);
    expect(clock.note(1)).toBe(true);
    expect(clock.note(2)).toBe(false);
    expect(clock.note(1)).toBe(true);
    expect(clock.stats().actionCount).toBe(6);
    const off = new FlowCanvasCaptureClock();
    expect(off.note(8)).toBe(false);
  });

  it("renders mermaid nodes and arrow bindings", async () => {
    const mermaid = ileWorkCanvasMermaid(
      scene([
        { id: "a", type: "rectangle", x: 0, y: 0, width: 40, height: 20, text: "Start" },
        { id: "b", type: "diamond", x: 80, y: 0, width: 40, height: 20, text: "Gate" },
        {
          id: "c",
          type: "arrow",
          x: 0,
          y: 0,
          width: 80,
          height: 0,
          startBinding: { elementId: "a" },
          endBinding: { elementId: "b" },
        },
      ]),
    );
    expect(mermaid).toContain("flowchart TB");
    expect(mermaid).toContain('["Start"]');
    expect(mermaid).toContain('{"Gate"}');
    expect(mermaid).toContain("-->");
    const doc = ileWorkCanvasMermaidDocument(scene([]), { actionCount: 8, everyActions: 8 });
    expect(doc).toContain("# Work canvas");
    expect(doc).toContain("```mermaid");
    expect(doc).toContain("every 8");
  });

  it("stores mermaid as a markdown document row", async () => {
    const item = buildCanvasMermaidDocumentUploadItem("sess-1", scene([]), {
      actionCount: 8,
      everyActions: 8,
      timestampMs: 1,
    });
    expect(item.toolName).toBe("canvas");
    expect(item.toolAction).toBe(CANVAS_DOCUMENT_TOOL_ACTION);
    expect(item.mimeType).toBe(CANVAS_DOCUMENT_MIME);
    expect(item.metadata?.schema).toBe(CANVAS_DOCUMENT_SCHEMA);
    expect(item.payload).toContain("```mermaid");
    expect(storedRecordFileKind({
      type: "tool",
      tool_name: "canvas",
      tool_action: CANVAS_DOCUMENT_TOOL_ACTION,
      mime_type: CANVAS_DOCUMENT_MIME,
    })).toBe("document");
  });

  it("keeps canvas documents out of the embedding bag", async () => {
    expect(isCanvasContentPowRow({ tool_action: "canvas_draw" })).toBe(true);
    expect(isCanvasContentPowRow({ tool_action: CANVAS_DOCUMENT_TOOL_ACTION })).toBe(true);
    expect(isCanvasContentPowRow({ tool_action: "draw_text" })).toBe(false);
    const withDoc = await encodeFlowEmbedding({
      flowKind: "verify",
      pow: [
        {
          type: "tool",
          tool_name: "canvas",
          tool_action: CANVAS_DOCUMENT_TOOL_ACTION,
          payload: ileWorkCanvasMermaidDocument(scene([{ id: "t", type: "text", text: "secret lemma" }])),
        },
      ],
    });
    const empty = await encodeFlowEmbedding({ flowKind: "verify", pow: [] });
    expect(withDoc.vector).toEqual(empty.vector);
    expect(withDoc.vector_path_text).toEqual(empty.vector_path_text);
    expect(JSON.stringify(withDoc.raw.pow)).not.toContain("secret lemma");
  });

  it("publishes default-off and persists on Protocol create", async () => {
    const accepted = acceptProductFlowPublish({
      ...emptyProductFlowDraft(),
      name: "Limits",
      topic: "epsilon-delta",
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.canvasCapture).toEqual(DEFAULT_FLOW_CANVAS_CAPTURE);
    const created = applyVerificationCommand(emptyVerificationState(), {
      type: "create",
      ownerUserId: "u1",
      name: "Limits",
      topic: "epsilon-delta",
      canvasCapture: { enabled: true, everyActions: 4 },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.flow?.canvasCapture).toEqual({ enabled: true, everyActions: 4 });
  });

  it("wires authoring, claim, and run progress bars", () => {
    expect(existsSync(join(root, "supabase/migrations/20261125140000_flow_canvas_capture.sql"))).toBe(
      true,
    );
    expect(read("components/product-flow/flow-channels-fields.tsx")).toContain("data-flow-canvas-capture");
    expect(read("components/product-flow/flow-channels-fields.tsx")).toContain(">Capture Canvas<");
    expect(read("components/product-flow/product-flow-wizard.tsx")).toContain("canvasCapture");
    expect(read("components/product-flow/flow-publish-review.tsx")).toContain("Capture Canvas every");
    expect(read("lib/verification-flow-repository.ts")).toContain("canvas_capture");
    expect(read("lib/verification-flow-repository.ts")).toContain("withCanvasCaptureMetadata");
    expect(read("components/session-view/use-session-field.ts")).toContain(
      "buildCanvasMermaidDocumentUploadItem",
    );
    expect(read("components/tap-score/tap-score-phases.tsx")).toContain(
      "buildCanvasMermaidDocumentUploadItem",
    );
    expect(read("components/tap-score/tap-score-phases.tsx")).not.toContain(
      "buildTapCanvasSnapshotUploadItem",
    );
    expect(read("components/session-view/use-session-runtime.ts")).not.toContain(
      "buildIleCanvasUploadItem",
    );
    expect(read("components/product-flow/region-simulation-setup.tsx")).toContain(
      "data-region-simulation-progress-overall",
    );
    expect(regionSimulationProgressOverall([
      { strategyId: "a", strategyName: "A", done: 3, total: 10 },
      { strategyId: "b", strategyName: "B", done: 1, total: 10 },
    ]).percent).toBe(20);
  });

  it("classifies canvas actions for Unsys even when capture is off", async () => {
    const learn = read("components/session-view/use-session-field.ts");
    const logIdx = learn.indexOf('logTool("canvas"');
    const clockIdx = learn.indexOf("clock.note(events.length)");
    expect(logIdx).toBeGreaterThan(0);
    expect(clockIdx).toBeGreaterThan(logIdx);
    const tap = read("components/tap-score/tap-score-phases.tsx");
    const tapUploadIdx = tap.indexOf("buildTapWorkCanvasActionUploadItem");
    const tapClockIdx = tap.indexOf("clock.note(events.length)");
    expect(tapUploadIdx).toBeGreaterThan(0);
    expect(tapClockIdx).toBeGreaterThan(tapUploadIdx);
    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("onCanvasPowActionsRef.current?.(powEvents)");
    expect(canvas).toContain("publishSessionProofRef.current(powEvents)");
    const policy = read("components/session-view/session-policy-context.tsx");
    expect(policy).toContain("sessionPolicyProofFromCanvas");
    expect(policy).not.toContain("canvasCapture");
    expect(canvas).not.toContain("canvasCapture");
  });
});
