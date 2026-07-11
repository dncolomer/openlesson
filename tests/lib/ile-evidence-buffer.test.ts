import { describe, expect, it } from "vitest";
import { IleEvidenceBuffer, ILE_EVIDENCE_THRESHOLDS } from "@/lib/ile-evidence-buffer";

describe("IleEvidenceBuffer", () => {
  it("does not drain transcript below minimum threshold", () => {
    const buffer = new IleEvidenceBuffer();
    buffer.pushTranscript("hi");
    const drained = buffer.drainForSubmit("session-1");
    expect(drained.uploads).toHaveLength(0);
    expect(drained.screenshots).toHaveLength(0);
  });

  it("drains transcript, tool events, and notebook when thresholds are met", () => {
    const buffer = new IleEvidenceBuffer();
    buffer.pushTranscript("this is long enough to flush");
    buffer.pushToolEvent({
      toolName: "canvas",
      action: "open",
      timestampMs: Date.now(),
      metadata: {},
    });
    buffer.setNotebookContent("a".repeat(ILE_EVIDENCE_THRESHOLDS.notebookMinChars));

    const drained = buffer.drainForSubmit("session-1");
    const kinds = drained.uploads.map((item) => item.toolName);
    expect(kinds).toContain("transcript");
    expect(kinds).toContain("ile-session");
    expect(kinds).toContain("notebook");
  });

  it("deduplicates canvas snapshots until content changes", () => {
    const buffer = new IleEvidenceBuffer();
    const canvas = "x".repeat(ILE_EVIDENCE_THRESHOLDS.canvasMinChars);
    buffer.setCanvasData(canvas);

    const first = buffer.drainForSubmit("session-1");
    expect(first.uploads.some((item) => item.toolName === "canvas")).toBe(true);

    const second = buffer.drainForSubmit("session-1");
    expect(second.uploads.some((item) => item.toolName === "canvas")).toBe(false);

    buffer.setCanvasData(canvas + "!");
    const third = buffer.drainForSubmit("session-1");
    expect(third.uploads.some((item) => item.toolName === "canvas")).toBe(true);
  });

  it("drains screenshots when at least one is buffered", () => {
    const buffer = new IleEvidenceBuffer();
    buffer.pushScreenshot({
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
      timestampMs: 123,
    });
    const drained = buffer.drainForSubmit("session-1");
    expect(drained.screenshots).toHaveLength(1);
  });
});