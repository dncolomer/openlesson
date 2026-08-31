import { describe, expect, it } from "vitest";
import {
  buildGatedIleEegUploadItem,
  buildIleCanvasUploadItem,
  buildIleEegUploadItem,
  buildIleToolEventUploadItem,
  hashIlePowContent,
  isCountableIleEegPow,
  meetsCanvasUploadThreshold,
  meetsEegUploadThreshold,
  totalIleEegSamples,
} from "@/lib/ile-realtime-pow";
import { IleEvidenceBuffer, ILE_EVIDENCE_THRESHOLDS } from "@/lib/ile-evidence-buffer";
import { EEG_QUALITY_CHANNELS } from "@/lib/muse-eeg-quality";
import { countIlePowByType } from "@/lib/ile-pow-counters";
import {
  filterSnapshotEligibleProofOfWorkRows,
  isExcludedFromSnapshotPoW,
} from "@/lib/pow-api/pow-quality";

function sineWindow(n: number, amplitude: number, period = 16): number[] {
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    samples.push(amplitude * Math.sin((2 * Math.PI * i) / period));
  }
  return samples;
}

function onHeadChunk(timestampMs = 1_700_000_000_000) {
  const samples = sineWindow(256, 200);
  const channels: Record<string, number[]> = {};
  for (const ch of EEG_QUALITY_CHANNELS) channels[ch] = [];
  channels.TP9 = samples;
  channels.AF7 = samples;
  channels.AF8 = samples;
  channels.TP10 = samples;
  return {
    channels,
    bandPowers: null,
    sampleRateHz: 256,
    startedAtMs: timestampMs - 1000,
    endedAtMs: timestampMs,
    sampleCounts: { TP9: 256, AF7: 256, AF8: 256, TP10: 256 },
    deviceName: "Muse S Athena",
    timestampMs,
  };
}

function railChunk(timestampMs = 1_700_000_000_001) {
  const rails = Array.from({ length: 256 }, () => -250);
  const channels: Record<string, number[]> = {};
  for (const ch of EEG_QUALITY_CHANNELS) channels[ch] = rails;
  return {
    channels,
    bandPowers: null,
    sampleRateHz: 256,
    startedAtMs: timestampMs - 1000,
    endedAtMs: timestampMs,
    timestampMs,
  };
}

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

  it("gates calibrated EEG PoW with quality and band-power fields", () => {
    const chunk = onHeadChunk();
    const item = buildGatedIleEegUploadItem("session-1", chunk);
    expect(item).not.toBeNull();
    expect(item!.kind).toBe("eeg");
    expect(isCountableIleEegPow(item!)).toBe(true);
    expect(isExcludedFromSnapshotPoW(item!.metadata)).toBe(false);

    expect(item!.bandPowers).toBeTruthy();
    const bands = item!.bandPowers!;
    expect(Object.keys(bands).length).toBeGreaterThan(0);
    expect(["delta", "theta", "alpha", "beta", "gamma"].some((k) => typeof bands[k] === "number")).toBe(
      true,
    );

    const payload = JSON.parse(item!.payload) as Record<string, unknown>;
    expect(payload.signal_quality).toBeTruthy();
    expect(["good", "fair"]).toContain(payload.signal_quality);
    expect(payload.calibration_passed).toBe(true);
    expect(payload.band_powers).toBeTruthy();
    expect(payload.electrode_quality).toBeTruthy();
    expect(item!.metadata?.signal_quality).toBe(payload.signal_quality);
    expect(item!.metadata?.band_powers).toBeTruthy();
    expect(item!.metadata?.impure).not.toBe(true);

    expect(countIlePowByType([{ type: "eeg", metadata: item!.metadata }]).eeg).toBe(1);
    expect(filterSnapshotEligibleProofOfWorkRows([{ id: "eeg-1", metadata: item!.metadata }])).toHaveLength(
      1,
    );
  });

  it("does not count poor or uncalibrated EEG windows as scored PoW", () => {
    const poor = buildIleEegUploadItem("session-1", railChunk());
    expect(poor.kind).toBe("eeg");
    expect(poor.metadata?.impure).toBe(true);
    expect(poor.metadata?.quality).toBe("impure");
    expect(poor.metadata?.calibration_passed).toBe(false);
    expect(isCountableIleEegPow(poor)).toBe(false);
    expect(isExcludedFromSnapshotPoW(poor.metadata)).toBe(true);
    expect(buildGatedIleEegUploadItem("session-1", railChunk())).toBeNull();
    expect(countIlePowByType([{ type: "eeg", metadata: poor.metadata }]).eeg).toBe(0);
    expect(filterSnapshotEligibleProofOfWorkRows([{ id: "eeg-poor", metadata: poor.metadata }])).toEqual(
      [],
    );

    const empty = buildGatedIleEegUploadItem("session-1", {
      channels: {},
      bandPowers: null,
      timestampMs: 3,
    });
    expect(empty).toBeNull();

    const buffer = new IleEvidenceBuffer();
    buffer.pushEegChunk(railChunk());
    buffer.pushEegChunk(onHeadChunk(9));
    const drained = buffer.drainForSubmit("session-1");
    const eegUploads = drained.uploads.filter((row) => row.kind === "eeg");
    expect(eegUploads).toHaveLength(1);
    expect(isCountableIleEegPow(eegUploads[0])).toBe(true);
    expect(JSON.parse(eegUploads[0].payload).calibration_passed).toBe(true);
  });
});