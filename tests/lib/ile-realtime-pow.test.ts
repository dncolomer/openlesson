import { describe, expect, it } from "vitest";
import {
  buildIleCanvasUploadItem,
  buildIleToolEventUploadItem,
  hashIlePowContent,
  meetsCanvasUploadThreshold,
  meetsEegUploadThreshold,
  totalIleEegSamples,
} from "@/lib/ile-realtime-pow";
import { ILE_EVIDENCE_THRESHOLDS } from "@/lib/ile-evidence-buffer";

describe("ile-realtime-pow", () => {
  it("builds per-event tool uploads with tool name and action", () => {
    const item = buildIleToolEventUploadItem("session-1", {
      toolName: "chapters",
      action: "open",
      timestampMs: 1000,
      metadata: { via: "tool_switch" },
    });
    expect(item.toolName).toBe("chapters");
    expect(item.toolAction).toBe("open");
    expect(JSON.parse(item.payload).tool).toBe("chapters");
  });

  it("deduplicates canvas content via hash helper", () => {
    const canvas = "x".repeat(ILE_EVIDENCE_THRESHOLDS.canvasMinChars);
    expect(hashIlePowContent(canvas)).toBe(hashIlePowContent(canvas));
    expect(hashIlePowContent(canvas)).not.toBe(hashIlePowContent(canvas + "!"));
  });

  it("respects canvas and eeg thresholds", () => {
    expect(meetsCanvasUploadThreshold(ILE_EVIDENCE_THRESHOLDS.canvasMinChars - 1)).toBe(false);
    expect(meetsCanvasUploadThreshold(ILE_EVIDENCE_THRESHOLDS.canvasMinChars)).toBe(true);
    expect(meetsEegUploadThreshold(totalIleEegSamples({ AF7: new Array(64).fill(0) }))).toBe(true);
  });

  it("builds canvas upload items", () => {
    const data = "a".repeat(120);
    const item = buildIleCanvasUploadItem("session-1", data, 42);
    expect(item.toolName).toBe("canvas");
    expect(JSON.parse(item.payload).data).toBe(data);
    expect(item.timestampMs).toBe(42);
  });
});