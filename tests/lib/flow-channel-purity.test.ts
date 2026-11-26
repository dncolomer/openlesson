import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_FLOW_ENFORCED_CHANNELS,
  parseFlowEnforcedChannels,
} from "@/lib/flow-channels";
import {
  anySensorChannelEnforced,
  emptyFlowChannelLive,
  enforcedSensorChannelsMissing,
  flowEnforcedChannelsKey,
  mediaStreamLive,
  museSamplesLive,
  sessionPurityArmed,
  shouldPenalizeEnforcedChannelIdle,
} from "@/lib/flow-channel-purity";
import { TAP_SILENCE_AUTO_STASH_MS } from "@/lib/tap-session-purity";

const root = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("enforced channel purity", () => {
  it("arms purity when any channel is on, and lists missing sensor streams", () => {
    expect(sessionPurityArmed(DEFAULT_FLOW_ENFORCED_CHANNELS)).toBe(true);
    expect(flowEnforcedChannelsKey(DEFAULT_FLOW_ENFORCED_CHANNELS)).toBe("a");
    expect(anySensorChannelEnforced(DEFAULT_FLOW_ENFORCED_CHANNELS)).toBe(false);
    const museOn = parseFlowEnforcedChannels({ audio: false, muse: true });
    expect(sessionPurityArmed(museOn)).toBe(true);
    expect(anySensorChannelEnforced(museOn)).toBe(true);
    expect(enforcedSensorChannelsMissing(museOn, emptyFlowChannelLive())).toEqual(["muse"]);
    expect(
      enforcedSensorChannelsMissing(museOn, { muse: true, video: false, screenshots: false }),
    ).toEqual([]);
    const all = parseFlowEnforcedChannels({
      audio: false,
      muse: true,
      video: true,
      screenshots: true,
    });
    expect(
      enforcedSensorChannelsMissing(all, { muse: false, video: true, screenshots: false }),
    ).toEqual(["muse", "screenshots"]);
  });

  it("penalizes idle sensors on the same 5s threshold as think-aloud silence", () => {
    expect(shouldPenalizeEnforcedChannelIdle(4_999, 1)).toBe(false);
    expect(shouldPenalizeEnforcedChannelIdle(TAP_SILENCE_AUTO_STASH_MS, 1)).toBe(true);
    expect(shouldPenalizeEnforcedChannelIdle(TAP_SILENCE_AUTO_STASH_MS, 0)).toBe(false);
    expect(museSamplesLive({ lastSampleAtMs: null })).toBe(false);
    expect(museSamplesLive({ lastSampleAtMs: 1_000, nowMs: 1_000 + TAP_SILENCE_AUTO_STASH_MS - 1 })).toBe(
      true,
    );
    expect(museSamplesLive({ lastSampleAtMs: 1_000, nowMs: 1_000 + TAP_SILENCE_AUTO_STASH_MS })).toBe(
      false,
    );
    expect(mediaStreamLive(null)).toBe(false);
  });

  it("wires sensor idle into Learn, Verify, and Calibration", () => {
    const learn = read("components/SessionView.tsx");
    const tap = read("components/TapScoreClient.tsx");
    const hook = read("components/session-view/use-learn-session-purity.ts");
    const signals = read("components/session-view/session-signals.tsx");
    expect(learn).toContain("sessionPurityArmed(enforcedChannels)");
    expect(learn).toContain("getSensorLive");
    expect(tap).toContain("sessionPurityArmed(enforcedChannelsRef.current)");
    expect(tap).toContain("enforcedSensorChannelsMissing");
    expect(hook).toContain("shouldPenalizeEnforcedChannelIdle");
    expect(hook).toContain("if (!channels.audio) return");
    expect(signals).toContain("channels.muse");
    expect(signals).toContain("channels.video");
    expect(signals).toContain("channels.screenshots");
    expect(tap).toContain("enforcedChannelsRef.current");
    expect(tap).toContain("enforcedChannelsKey");
    const chrome = read("components/session-view/session-chrome.tsx");
    expect(chrome).toContain("enforcedChannels.muse");
    expect(chrome).toContain("enforcedChannels.video");
    expect(chrome).toContain("enforcedChannels.screenshots");
    expect(read("components/VerificationFlowRunner.tsx")).toContain(
      "enforcedChannels={enforcedChannels}",
    );
    expect(read("components/product-flow/flow-channels-fields.tsx")).toContain(
      "A required channel with no data flowing",
    );
  });
});
