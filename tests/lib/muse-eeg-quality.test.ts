import { describe, expect, it } from "vitest";
import {
  EEG_CONTACT_GOOD_CHANNEL_MIN,
  EEG_CONTACT_PASS_CHANNEL_MIN,
  EEG_QUALITY_CHANNELS,
  MIN_EEG_QUALITY_SAMPLES,
  isCountableEegContact,
  museEegPreviewState,
  scoreEegContactWindow,
} from "@/lib/muse-eeg-quality";
import { SignalQualityChecker } from "@/lib/labs-signal-quality";

/** Full-period sine; amplitude 200 → variance ~20k (on-head good, inside ADC rails). */
function sineWindow(n: number, amplitude: number, period = 16): number[] {
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    samples.push(amplitude * Math.sin((2 * Math.PI * i) / period));
  }
  return samples;
}

function emptyWindow(): Record<string, number[]> {
  const window: Record<string, number[]> = {};
  for (const ch of EEG_QUALITY_CHANNELS) window[ch] = [];
  return window;
}

function assignChannels(
  values: number[],
  names: string[],
): Record<string, number[]> {
  const window = emptyWindow();
  for (const name of names) window[name] = values.slice();
  return window;
}

describe("scoreEegContactWindow", () => {
  it("marks rail/clip channels poor and fails calibration", () => {
    const rails = Array.from({ length: 128 }, () => -250);
    const score = scoreEegContactWindow(assignChannels(rails, ["TP9", "AF7", "AF8", "TP10"]));
    for (const ch of ["TP9", "AF7", "AF8", "TP10"]) {
      const row = score.channels.find((c) => c.channel === ch);
      expect(row?.status).toBe("poor");
      expect(row?.railHits).toBeGreaterThan(3);
    }
    expect(score.overall).toBe("poor");
    expect(score.calibrationPassed).toBe(false);
    expect(isCountableEegContact(score)).toBe(false);
  });

  it("marks empty / insufficient channels poor and fails calibration", () => {
    const empty = scoreEegContactWindow({});
    expect(empty.evaluated).toBe(false);
    expect(empty.overall).toBe("poor");
    expect(empty.calibrationPassed).toBe(false);
    expect(empty.channels).toHaveLength(EEG_QUALITY_CHANNELS.length);
    expect(empty.channels.every((c) => c.status === "poor")).toBe(true);

    const short = Array.from({ length: MIN_EEG_QUALITY_SAMPLES - 1 }, (_, i) => i);
    const insufficient = scoreEegContactWindow(assignChannels(short, ["AF7", "AF8"]));
    expect(insufficient.calibrationPassed).toBe(false);
    expect(insufficient.channels.find((c) => c.channel === "AF7")?.status).toBe("poor");
  });

  it("passes on-head-like windows on enough channels as good or fair", () => {
    const onHead = sineWindow(256, 200);
    const score = scoreEegContactWindow(assignChannels(onHead, ["TP9", "AF7", "AF8", "TP10"]));
    const onHeadStatuses = score.channels
      .filter((c) => ["TP9", "AF7", "AF8", "TP10"].includes(c.channel))
      .map((c) => c.status);
    expect(onHeadStatuses.every((s) => s === "good" || s === "fair")).toBe(true);
    expect(score.evaluated).toBe(true);
    expect(score.calibrationPassed).toBe(true);
    expect(["good", "fair"]).toContain(score.overall);
    expect(isCountableEegContact(score)).toBe(true);
  });

  it("matches overall verdict to the per-channel mix", () => {
    const onHead = sineWindow(128, 200);
    const fair = sineWindow(128, 160);
    const rails = Array.from({ length: 128 }, () => 245);

    const mixedGood = scoreEegContactWindow({
      ...emptyWindow(),
      TP9: onHead,
      AF7: onHead,
      AF8: onHead,
      TP10: rails,
    });
    const goodCount = mixedGood.channels.filter((c) => c.status === "good").length;
    const contactCount = mixedGood.channels.filter(
      (c) => c.status === "good" || c.status === "fair",
    ).length;
    if (mixedGood.overall === "good") {
      expect(goodCount).toBeGreaterThanOrEqual(EEG_CONTACT_GOOD_CHANNEL_MIN);
    } else if (mixedGood.overall === "fair") {
      expect(contactCount).toBeGreaterThanOrEqual(EEG_CONTACT_PASS_CHANNEL_MIN);
      expect(goodCount).toBeLessThan(EEG_CONTACT_GOOD_CHANNEL_MIN);
    } else {
      expect(contactCount).toBeLessThan(EEG_CONTACT_PASS_CHANNEL_MIN);
    }
    expect(mixedGood.calibrationPassed).toBe(mixedGood.overall !== "poor");

    const mixedFair = scoreEegContactWindow({
      ...emptyWindow(),
      AF7: fair,
      AF8: fair,
    });
    const fairContact = mixedFair.channels.filter(
      (c) => c.status === "good" || c.status === "fair",
    ).length;
    expect(fairContact).toBeGreaterThanOrEqual(EEG_CONTACT_PASS_CHANNEL_MIN);
    expect(mixedFair.overall).toBe("fair");
    expect(mixedFair.calibrationPassed).toBe(true);

    const oneGood = scoreEegContactWindow({ ...emptyWindow(), AF7: onHead });
    const oneContact = oneGood.channels.filter(
      (c) => c.status === "good" || c.status === "fair",
    ).length;
    expect(oneContact).toBeLessThan(EEG_CONTACT_PASS_CHANNEL_MIN);
    expect(oneGood.overall).toBe("poor");
    expect(oneGood.calibrationPassed).toBe(false);
  });

  it("is the same scorer labs calibration uses", () => {
    const checker = new SignalQualityChecker();
    checker.startCalibration();
    const onHead = sineWindow(256, 200);
    for (const ch of ["TP9", "AF7", "AF8"] as const) {
      checker.addSample(ch, onHead);
    }
    const live = checker.getCurrentQuality();
    const direct = scoreEegContactWindow({
      ...emptyWindow(),
      TP9: onHead,
      AF7: onHead,
      AF8: onHead,
    });
    expect(live.map((c) => `${c.channel}:${c.status}`)).toEqual(
      direct.channels.map((c) => `${c.channel}:${c.status}`),
    );
    expect(checker.finishCalibration().passed).toBe(direct.calibrationPassed);
  });
});

describe("museEegPreviewState", () => {
  it("does not treat connected/streaming as ready without a contact pass", () => {
    expect(museEegPreviewState("connected", null)).toBe("off");
    expect(museEegPreviewState("streaming", null)).toBe("checking");
    expect(
      museEegPreviewState("streaming", {
        signalQuality: "poor",
        contactEvaluated: false,
        calibrationPassed: false,
      }),
    ).toBe("checking");
    expect(
      museEegPreviewState("streaming", {
        signalQuality: "poor",
        contactEvaluated: true,
        calibrationPassed: false,
      }),
    ).toBe("poor");
    expect(
      museEegPreviewState("streaming", {
        signalQuality: "good",
        contactEvaluated: true,
        calibrationPassed: true,
      }),
    ).toBe("good");
  });
});
